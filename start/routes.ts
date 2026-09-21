/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const AuthController = () => import('#controllers/auth_controller')
const BookmakersController = () => import('#controllers/bookmakers_controller')
const AccountsController = () => import('#controllers/accounts_controller')
const TransactionsController = () => import('#controllers/transactions_controller')
const TipstersController = () => import('#controllers/tipsters_controller')
const MethodsController = () => import('#controllers/methods_controller')
const MarketsController = () => import('#controllers/markets_controller')
const SettingsController = () => import('#controllers/settings_controller')
const BetsController = () => import('#controllers/bets_controller')
const BetImageAnalysisController = () => import('#controllers/bet_image_analysis_controller')
const SurebetsController = () => import('#controllers/surebets_controller')
const FreebetsController = () => import('#controllers/freebets_controller')
const StatsController = () => import('#controllers/stats_controller')
const BetReceiptsController = () => import('#controllers/bet_receipts_controller')
const CostsController = () => import('#controllers/costs_controller')
const GamesController = () => import('#controllers/games_controller')

router.get('/', async () => {
  return {
    hello: 'world',
  }
})

router
  .group(() => {
    router.post('/register', [AuthController, 'register'])
    router.post('/login', [AuthController, 'login'])
    router.post('/dev-login', [AuthController, 'devLogin'])
    router.get('/me', [AuthController, 'me']).use(middleware.auth())
    router.delete('/logout', [AuthController, 'logout']).use(middleware.auth())
  })
  .prefix('/auth')

router
  .group(() => {
    router.get('/me/settings', [SettingsController, 'show'])
    router.put('/me/settings', [SettingsController, 'update'])

    router.get('/bookmakers', [BookmakersController, 'index'])
    router.post('/bookmakers', [BookmakersController, 'store'])
    router.put('/bookmakers/:id', [BookmakersController, 'update'])
    router.delete('/bookmakers/:id', [BookmakersController, 'destroy'])

    router.get('/accounts', [AccountsController, 'index'])
    router.post('/accounts', [AccountsController, 'store'])
    router.put('/accounts/:id', [AccountsController, 'update'])
    router.delete('/accounts/:id', [AccountsController, 'destroy'])

    router.get('/accounts/:accountId/transactions', [TransactionsController, 'index'])
    router.post('/accounts/:accountId/transactions', [TransactionsController, 'store'])
    router.delete('/transactions/:id', [TransactionsController, 'destroy'])

    router.get('/tipsters', [TipstersController, 'index'])
    router.post('/tipsters', [TipstersController, 'store'])
    router.put('/tipsters/:id', [TipstersController, 'update'])
    router.delete('/tipsters/:id', [TipstersController, 'destroy'])

    router.get('/methods', [MethodsController, 'index'])
    router.post('/methods', [MethodsController, 'store'])
    router.put('/methods/:id', [MethodsController, 'update'])
    router.delete('/methods/:id', [MethodsController, 'destroy'])

    router.get('/markets', [MarketsController, 'index'])
    router.post('/markets', [MarketsController, 'store'])
    router.delete('/markets/:id', [MarketsController, 'destroy'])

    router.post('/surebets', [SurebetsController, 'store'])

    router.get('/bets', [BetsController, 'index'])
    router.post('/bets/analyze-image', [BetImageAnalysisController, 'store'])
    router.post('/bets/receipts', [BetReceiptsController, 'store'])
    router.post('/bets', [BetsController, 'store'])
    router.get('/bets/:id', [BetsController, 'show'])
    router.get('/bets/:id/receipt', [BetReceiptsController, 'show'])
    router.put('/bets/:id', [BetsController, 'update'])
    router.patch('/bets/:id/settle', [BetsController, 'settle'])
    router.delete('/bets/:id', [BetsController, 'destroy'])

    router.get('/freebets', [FreebetsController, 'index'])
    router.patch('/freebets/:id/extract', [FreebetsController, 'extract'])
    router.patch('/freebets/:id/discard', [FreebetsController, 'discard'])
    router.patch('/freebets/:id/reopen', [FreebetsController, 'reopen'])

    router.get('/games', [GamesController, 'index'])

    router.get('/costs', [CostsController, 'index'])
    router.get('/costs/summary', [CostsController, 'summary'])
    router.post('/costs', [CostsController, 'store'])
    router.put('/costs/:id', [CostsController, 'update'])
    router.delete('/costs/:id', [CostsController, 'destroy'])

    router.get('/stats/summary', [StatsController, 'summary'])
    router.get('/stats/by', [StatsController, 'by'])
    router.get('/stats/timeline', [StatsController, 'timeline'])
  })
  .use(middleware.auth())
