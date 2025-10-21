import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import playwright from 'playwright'
import type { NmriumState, ParsingOptions, Spectrum } from '@zakodium/nmrium-core'
import init from '@zakodium/nmrium-core-plugins'
import logger from '@adonisjs/core/services/logger'

import vine from '@vinejs/vine'
import { Exception } from '@adonisjs/core/exceptions'

const PARSING_OPTIONS: Partial<ParsingOptions> = {
  onLoadProcessing: { autoProcessing: true },
  experimentalFeatures: true,
  selector: { general: { dataSelection: 'preferFT' } },
}

const validator = vine.compile(
  vine.object({
    urls: vine.array(vine.string()),
    snapshot: vine.boolean().optional(),
  })
)

const core = init()

interface SpectrumSnapshot {
  image: string
  id: string
}

function omitKeys<T>(source: T, excludeKeys: Array<keyof T>): Partial<T> {
  const target: Partial<T> = {}
  for (const key in source) {
    if (!excludeKeys.includes(key)) {
      target[key] = source[key]
    }
  }

  return target
}

function resolveState(state: NmriumState) {
  console.log(state)
  let { data, version, ...others } = state
  data.spectra = data?.spectra.map((spectrum) =>
    omitKeys(spectrum, ['data', 'originalData'])
  ) as Spectrum[]

  return { data, version, ...others }
}

function getFileNameFromURL(url: string) {
  return url.slice(Math.max(0, url.lastIndexOf('/') + 1))
}

export default class SpectraController {
  private async loadFilesFromURLs(urls: string[]) {
    const entries = urls.map((url) => {
      const refURL = new URL(url)
      const name = getFileNameFromURL(url)
      let path = refURL.pathname
      const hasExtension = name?.includes('.')
      if (!hasExtension) {
        path = `${path}.zip`
      }
      return { relativePath: path, baseURL: refURL.origin }
    }, [])
    const [state] = await core.readFromWebSource({ entries }, PARSING_OPTIONS)
    return resolveState(state as NmriumState)
  }

  private generateNMRiumURL() {
    const baseURL =
      env.get('NODE_ENV') === 'development' ? env.get('NMRIUM_DEV_URL') : env.get('NMRIUM_PROD_URL')

    if (!baseURL) {
      logger.error('Base URL is not defined')
      throw new Exception('Base URL is not defined', {
        status: 400,
        code: 'BASE_URL_MISSING',
      })
    }

    const url = new URL(baseURL)
    const preferences = JSON.stringify({
      general: {
        hidePanelOnLoad: true,
      },
    })

    url.searchParams.append('preferences', preferences)
    return url.toString()
  }

  private async getSpectraViewAsBase64(spectra: any[] | undefined): Promise<SpectrumSnapshot[]> {
    const browser = await playwright.chromium.launch()
    const context = await browser.newContext(playwright.devices['Desktop Chrome HiDPI'])
    const page = await context.newPage()

    const url = this.generateNMRiumURL()

    await page.goto(url)

    let data: SpectrumSnapshot[] = []

    for (const spectrum of spectra || []) {
      const spectrumObject = {
        spectra: [{ ...spectrum }],
      }

      // convert typed array to array
      const stringObject = JSON.stringify(spectrumObject, (_, value) => {
        return ArrayBuffer.isView(value) ? Array.from(value as Float32Array) : value
      })

      // load the spectrum into NMRium using the custom event
      await page.evaluate(
        `
      window.postMessage({ type: "nmr-wrapper:load", data:{data: ${stringObject},type:"nmrium"}}, '*');
      `
      )

      // take a snapshot for the spectrum
      try {
        const snapshot = await page.locator('#nmrSVG .container').screenshot()

        data.push({
          image: snapshot.toString('base64'),
          id: spectrum.id,
        })
      } catch (e) {
        logger.error(e)
      }
    }

    await context.close()
    await browser.close()

    return data
  }

  public async index(context: HttpContext) {
    const { response, request } = context

    try {
      const payload = await request.body()
      const { urls, snapshot = false } = await validator.validate(payload)

      const { data, version } = await this.loadFilesFromURLs(urls)

      const images = snapshot ? await this.getSpectraViewAsBase64(data?.spectra) : null
      response.send({ data: { ...data, version }, images })
    } catch (error) {
      logger.error(error)
      response.status(400).send(error)
    }
  }
}
