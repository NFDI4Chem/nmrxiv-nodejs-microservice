import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import playwright from 'playwright'
import type { NmriumState, Spectrum } from '@zakodium/nmrium-core'
import init from '@zakodium/nmrium-core-plugins'
import logger from '@adonisjs/core/services/logger'

import vine from '@vinejs/vine'
import { Exception } from '@adonisjs/core/exceptions'

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
  let { data, version, ...others } = state
  data.spectra = data?.spectra.map((spectrum) =>
    omitKeys(spectrum, ['data', 'originalData'])
  ) as Spectrum[]

  return { data, version, ...others }
}

export default class SpectraController {
  private async loadFilesFromURLs(urls: string[]) {
    const entries = urls.map((url) => {
      const refURL = new URL(decodeURIComponent(url))
      let name = url.substring(url.lastIndexOf('/') + 1)
      const hasExtension = name && name.indexOf('.') !== -1
      if (!hasExtension) {
        name = `${name}.zip`
      }
      return { relativePath: refURL.pathname, baseURL: refURL.origin }
    }, [])
    const state: NmriumState = (await core.readFromWebSource(
      { entries },
      {
        onLoadProcessing: { autoProcessing: true },
        sourceSelector: { general: { dataSelection: 'preferFT' } },
      }
    )) as NmriumState
    return resolveState(state)
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
