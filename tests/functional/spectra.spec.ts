import { test } from '@japa/runner'

test.group('Spectra', () => {
  test('should parse spectra from urls ands return their snapshots', async ({ client }) => {
    const response = await client.post('/spectra-parser').json({
      urls: [
        'https://cheminfo.github.io/bruker-data-test/data/zipped/aspirin-1h.zip',
        'https://nmrxiv.org/NRayya/datasets/fsu-nmr-platform-samples/cucurbitacin-e/12',
      ],
      snapshot: true,
    })
    response.assertStatus(200)

    const { spectra, molecules, images } = response.body()
    response.assert?.equal(spectra?.length, 3)
    response.assert?.equal(molecules?.length, 0)
    response.assert?.equal(images?.length, 3)
  })
  // Write your test here
})
