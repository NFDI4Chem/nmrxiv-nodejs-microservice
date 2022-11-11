import { test } from '@japa/runner'

test.group('Spectra', () => {
  test('should parse spectra from URLs and return their snapshots', async ({ client }) => {
    const response = await client.post('/spectra-parser').json({
      urls: [
        // 'https://cheminfo.github.io/nmr-dataset-demo/cytisine/13c.jdx',
        'https://cheminfo.github.io/nmr-dataset-demo/cytisine/1h.jdx',
        'https://cloud.uni-jena.de/s/y72GbCX8bJbmpJT/download/10.zip',
        'https://cloud.uni-jena.de/s/jsMed9fmqWZzo6r/download/53.zip',
      ],
      // snapshot: false,
    })
    response.assertStatus(200)

    const {
      data: { spectra, molecules },
      // images,
    } = response.body()
    response.assert?.equal(spectra?.length, 5)
    response.assert?.equal(molecules?.length, 2)
    // response.assert?.equal(images?.length, 3)
  })
})
