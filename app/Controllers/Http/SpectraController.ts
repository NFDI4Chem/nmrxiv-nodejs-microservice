import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { rules, schema as Schema } from '@ioc:Adonis/Core/Validator'
import Env from '@ioc:Adonis/Core/Env'
import playwright from 'playwright'
import { read } from 'nmr-load-save'
import { FileCollection, FileCollectionItem } from 'filelist-utils'
import fetch from 'cross-fetch'
import { maybeFilter, FilterOptions } from 'filelist-utils/lib/utilities/maybeFilter'
import { maybeExpand } from 'filelist-utils/lib/utilities/maybeExpand'
import { ExpandOptions } from 'filelist-utils/lib/ExpandOptions'
import Logger from '@ioc:Adonis/Core/Logger'

interface SpectrumSnapshot {
  image: string
  id: string
}

export async function createFileCollectionFromFiles(
  files: {
    name: string
    data: ArrayBuffer
  }[],
  options: FilterOptions & ExpandOptions = {}
) {
  let fileCollections: FileCollectionItem[] = []

  // eslint-disable-next-line no-restricted-syntax
  for (const file of files) {
    const data: FileCollectionItem = {
      name: file.name,
      size: file.data.byteLength,
      relativePath: file.name,
      lastModified: Date.now(),
      stream: (): ReadableStream => {
        throw new Error('stream not yet implemented')
      },
      arrayBuffer: () => Promise.resolve(file.data),
      text: () => {
        const decoder = new TextDecoder()
        decoder.decode(file.data)
        return Promise.resolve(decoder.decode(file.data))
      },
    }

    fileCollections.push(data)
  }

  fileCollections = await maybeExpand(fileCollections, options)
  fileCollections = await maybeFilter(fileCollections, options)

  return new FileCollection(fileCollections)
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

  private async praseSpectra(urls: string[]) {
    const files = await this.loadFilesFromURLs(urls)

    const filesCollection = await createFileCollectionFromFiles(files)

    return await read(filesCollection)
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
      Logger.error(error)
      response.status(400).send('messages' in error ? error.messages : error)
    }
  }
}
