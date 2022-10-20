import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { rules, schema as Schema } from '@ioc:Adonis/Core/Validator'
import Env from '@ioc:Adonis/Core/Env'
import playwright from 'playwright'
import { read } from 'nmr-load-save'
import { FileCollection, FileCollectionItem } from 'filelist-utils'
import fetch from 'cross-fetch'

interface SpectrumSnapshot {
  image: string
  id: string
}

export default class SpectraController {
  private loadFilesFromURLs(urls: string[]): Promise<{ name: string; data: ArrayBuffer }[]> {
    const fetches = urls.map((url) =>
      fetch(url)
        .then((response) => response.arrayBuffer())
        .then((data) => {
          let name = url.substring(url.lastIndexOf('/') + 1)
          const hasExtension = name && name.indexOf('.') !== -1
          if (!hasExtension) {
            name = `${name}.zip`
          }
          return { name, data }
        })
    )

    return Promise.all(fetches)
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
    const browser = await playwright.webkit.launch()
    const context = await browser.newContext(playwright.devices['Desktop Safari'])
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
      const snapshot = await page.locator('#nmrSVG .container').screenshot()

      data.push({
        image: snapshot.toString('base64'),
        id: spectrum.id,
      })
    }

    await context.close()
    await browser.close()

    return data
  }

  private async praseSpectra(urls: string[]) {
    const data = await this.loadFilesFromURLs(urls)

    const files: FileCollectionItem[] = data.map((file) => {
      return {
        name: file.name,
        size: file.data.byteLength,
        arrayBuffer: () => Promise.resolve(file.data),
        relativePath: '.',
        lastModified: Date.now(),
        stream: (): ReadableStream => {
          throw new Error('stream not yet implemented')
        },
        text: () => Promise.resolve(''),
      }
    })

    return await read({ files } as FileCollection)
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

      const collections = await this.praseSpectra(urls)

      const images = snapshot ? await this.getSpectraViewAsBase64(collections?.spectra) : null
      response.send({ ...collections, images })
    } catch (error) {
      response.status(400).send('messages' in error ? error.messages : error)
    }
  }
}
