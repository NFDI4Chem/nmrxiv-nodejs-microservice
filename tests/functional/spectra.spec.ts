import { test } from '@japa/runner'

test.group('Spectra', () => {
  test('should parse spectra from URLs and return their snapshots', async ({ client }) => {
    const response = await client.post('/spectra-parser').json({
      urls: [
        'https://cheminfo.github.io/nmr-dataset-demo/cytisine/13c.jdx',
        'https://cheminfo.github.io/nmr-dataset-demo/cytisine/1h.jdx',
      ],
      // snapshot: false,
    })
    response.assertStatus(200)

    const {
      data: { spectra, molecules },
      // images,
    } = response.body()
    response.assert?.equal(spectra?.length, 2)
    response.assert?.equal(molecules?.length, 0)
    // response.assert?.equal(images?.length, 3)
  })
})
