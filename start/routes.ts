// import { HealthCheck } from '@ioc:Adonis/Core/HealthCheck';
/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/
import router from '@adonisjs/core/services/router'

const SpectraController = () => import('#controllers/spectra_controller')
const HealthChecksController = () => import('#controllers/health_checks_controller')

router.get('/', [HealthChecksController, 'handle'])
router.post('/spectra-parser', [SpectraController, 'index'])
