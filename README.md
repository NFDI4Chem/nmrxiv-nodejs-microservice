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
      "source": object[],
      "spectra" : object[],
      "molecules" : object[],
      "version"    : number,
   },
  "images"    : {"id":string,"image":string}[]

}
The `source` attribute contains an array of spectra files relative paths.
The `spectra` attribute contains an array of spectra (1D and 2D).
The `molecules` attribute contains an array of molecules.
The `version` attribute contains the current version of the data which is crucial for data migration in NMRium
The `images` attribute contains a list of the images for the spectra which is processed and displayed by NMRium,
  where each object contains two attributes the `id` is the spectrum id and an `image` as a Base64 format.
  ```

> **⚠ WARNING: Data Conversion.**  
> Data should be converted from a **Typed Array** to a **Array**, without this step the NMRium will not be able to load the spectra. ```version``` object is important for NMRium data migration.

## Usage

#### Production

[nodejs.nmrxiv.org](https://nodejs.nmrxiv.org/)

#### Development

[nodejsdev.nmrxiv.org](https://nodejsdev.nmrxiv.org/)

#### Deployment
https://github.com/NFDI4Chem/nmrxiv-nodejs-microservice/wiki/Deployment

#### Helm chart
https://github.com/NFDI4Chem/repo-helm-charts/tree/main/charts/nmrxiv-nodejs-microservice

## Maintained by
This project is developed and maintained by the [NFDI4Chem partners](https://www.nfdi4chem.de/) at the [Friedrich Schiller University](https://www.uni-jena.de/en/) Jena, Germany. 
The code for this web application is released under the [MIT license](https://opensource.org/licenses/MIT).


<p align="left"><a href="https://nfdi4chem.de/" target="_blank"><img src="https://www.nfdi4chem.de/wp-content/themes/wptheme/assets/img/logo.svg" width="50%" alt="NFDI4Chem Logo"></a></p>

## Acknowledgments

Funded by the [Deutsche Forschungsgemeinschaft (DFG, German Research Foundation)](https://www.dfg.de/) under the [National Research Data Infrastructure – NFDI4Chem](https://nfdi4chem.de/) – Projektnummer **441958208**.

<p align="left"><a href="https://www.dfg.de/" target="_blank"><img src="./public/img/dfg_logo_schriftzug_blau_foerderung_en.gif" width="50%" alt="DFG Logo"></a></p>
