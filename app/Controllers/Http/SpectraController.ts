import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { rules, schema as Schema } from '@ioc:Adonis/Core/Validator'
import Env from '@ioc:Adonis/Core/Env'
import playwright from 'playwright'
import { CURRENT_EXPORT_VERSION, readSource } from 'nmr-load-save'
import Logger from '@ioc:Adonis/Core/Logger'

interface SpectrumSnapshot {
  image: string
  id: string
}

export default class SpectraController {
  private async loadFilesFromURLs(urls: string[]) {
    const promises = urls.map((url) => {
      const refURL = new URL(url)
      let name = url.substring(url.lastIndexOf('/') + 1)
      const hasExtension = name && name.indexOf('.') !== -1
      if (!hasExtension) {
        name = `${name}.zip`
      }
      return readSource({
        baseURL: refURL.origin,
        files: [{ relativePath: refURL.pathname, name }],
      })
    }, [])
    const results = await Promise.all(promises)
    const spectra: any[] = []
    const molecules: any[] = []
    // eslint-disable-next-line no-restricted-syntax
    for (const result of results) {
      spectra.push(...result.data.spectra)
      molecules.push(...result.data.spectra)
    }
    return { spectra, molecules, version: CURRENT_EXPORT_VERSION }
  }

  private generateNMRiumURL() {
    const baseURL =
      Env.get('NODE_ENV') === 'development'
        ? 'https://nmriumdev.nmrxiv.org'
        : 'https://nmrium.nmrxiv.org/'

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

      const data = await this.loadFilesFromURLs(urls)
      const images = snapshot ? await this.getSpectraViewAsBase64(data?.spectra) : null
      response.send({ data, images })
    } catch (error) {
      Logger.error(error)
      response.status(400).send('messages' in error ? error.messages : error)
    }
  }
}
