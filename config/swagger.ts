import { SwaggerConfig } from '@ioc:Adonis/Addons/Swagger'

export default {
  uiEnabled: true, //disable or enable swaggerUi route
  uiUrl: 'docs', // url path to swaggerUI
  specEnabled: true, //disable or enable swagger.json route
  specUrl: '/swagger.json',

  middleware: [], // middlewares array, for protect your swagger docs and spec endpoints

  options: {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'API Service To Process Spectra',
        version: '1.0.0',
        description:
          'The API uses the nmr-load-save package to process the spectra and playwright to load the NMRium from the deployed wrapper nmrium-react-wrapper and import the generated data to get the snapshots.',
      },
    },

    apis: ['app/**/*.ts', 'docs/swagger/**/*.yml', 'start/routes.ts'],
    basePath: '/',
  },
  mode: process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'RUNTIME',
  specFilePath: 'docs/swagger.json',
} as SwaggerConfig
