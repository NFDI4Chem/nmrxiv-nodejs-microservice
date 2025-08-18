import { SwaggerConfig } from '@dedel.alex/adonis6-swagger/types'

export default {
  // Disable/Enable swaggerUi route
  uiEnabled: true,
  // Url path to swaggerUI
  uiUrl: 'docs',
  // Disable/Enable swagger.json route
  specEnabled: true,
  specUrl: '/swagger.json',

  // List of middlewares to protect your swagger docs and spec endpoints
  middleware: [],

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
