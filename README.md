# API Service To Process Spectra from various data formats to NMRium format


The API uses the [nmr-load-save](https://github.com/cheminfo/nmr-load-save) package to process the spectra and [playwright](https://playwright.dev/) to load the NMRium from the deployed wrapper [nmrium-react-wrapper](https://github.com/NFDI4Chem/nmrium-react-wrapper) and import the generated data to get the snapshots.
 
## Secptra processing 

Process and convert various data formats (from various manufacturers, JCAMP standard files, or NMReDATA format, Bruker) to NMRium format


```http
POST /spectra-parser
```

| Parameter | Type |Default| Description |
| :--- | :--- | :--- | :--- |
| `urls` | `string[]` || **Required**. Spectra files URLs   |
| `snapshot` | `boolean` |`false`| **Optional**. Enable/dispable Spectra snapshot     |

## Responses

```javascript
{
  "data": {
      "spectra" : object[],
      "molecules" : object[],
      "version"    : number,
   },
  "images"    : {"id":string,"image":string}[]

}
The `spectra` attribute contains an array of spectra (1D and 2D).
The `molecules` attribute contains an array of molecules.
The `version` attribute contains the current version of the data which is crucial for data migration in NMRium
The `images` attribute contains a list of the images for the spectra which is processed and displayed by NMRium,
  where each object contains two attributes the `id` is the spectrum id and an `image` as a Base64 format.
  ```

> **⚠ WARNING: Data Conversion.**  
> Data should be converted from a **Typed Array** to a **Array**, without this step the NMRium will not be able to load the spectra. ```version``` object is important for NMRium data migration. 

