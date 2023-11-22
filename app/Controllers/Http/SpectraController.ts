import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { rules, schema as Schema } from '@ioc:Adonis/Core/Validator'
import Env from '@ioc:Adonis/Core/Env'
import playwright from 'playwright'
import { NmriumState, readFromWebSource, Spectrum } from 'nmr-load-save'
import Logger from '@ioc:Adonis/Core/Logger'

interface SpectrumSnapshot {
  image: string
  id: string
}

function omitKeys<T>(source: T, excludeKeys: Array<keyof T | 'logger' | 'keepSource'>): Partial<T> {
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
    omitKeys(spectrum, ['data', 'originalData', 'logger', 'keepSource'])
  ) as Spectrum[]

  return { data, version, ...others }
}

export default class SpectraController {
  private async loadFilesFromURLs(urls: string[]) {
    const entries = urls.map((url) => {
      const refURL = new URL(url)
      let name = url.substring(url.lastIndexOf('/') + 1)
      const hasExtension = name && name.indexOf('.') !== -1
      if (!hasExtension) {
        name = `${name}.zip`
      }
      return { relativePath: refURL.pathname, baseURL: refURL.origin }
    }, [])
    const state: NmriumState = (await readFromWebSource({ entries })) as NmriumState
    return resolveState(state)
  }

  private generateNMRiumURL() {
    const baseURL =
      Env.get('NODE_ENV') === 'development'
        ? Env.get('NMRIUM_DEV_URL')
        : Env.get('NMRIUM_PROD_URL')

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
        Logger.error(e)
      }
    }

    await context.close()
    await browser.close()

    return data
  }

  public async index(context: HttpContextContract) {
    const { response, request } = context

    //validate parameters
    const schema = Schema.create({
      urls: Schema.array().members(Schema.string([rules.url()])),
      snapshot: Schema.boolean.optional(),
    })

    try {
      const { urls, snapshot = false } = await request.validate({
        schema,
      })

      const { data, version } = await this.loadFilesFromURLs(urls)

      const images = snapshot ? await this.getSpectraViewAsBase64(data?.spectra) : null
      response.send({ data: { ...data, version }, images })
    } catch (error) {
      Logger.error(error)
      response.status(400).send(error)
    }
  }
}
