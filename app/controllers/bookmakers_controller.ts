import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import Bookmaker from '#models/bookmaker'
import Bet from '#models/bet'
import { bookmakerValidator } from '#validators/catalog'
import { accountBalances, emptyBalance } from '#services/account_balance_service'

export default class BookmakersController {
  async index({ auth }: HttpContext) {
    const userId = auth.user!.id
    const bookmakers = await Bookmaker.query()
      .where('user_id', userId)
      .preload('accounts', (query) => query.orderBy('id'))
      .orderBy('name')

    const balances = await accountBalances(userId)

    return bookmakers.map((bookmaker) => {
      const accounts = bookmaker.accounts.map((account) => ({
        ...account.serialize(),
        balance: balances.get(account.id) ?? emptyBalance(),
      }))
      const total = accounts.reduce((sum, account) => sum + account.balance.balance, 0)
      return {
        ...bookmaker.serialize(),
        accounts,
        totalBalance: Math.round(total * 100) / 100,
      }
    })
  }

  async store({ auth, request, response }: HttpContext) {
    const data = await request.validateUsing(bookmakerValidator)
    const bookmaker = await Bookmaker.create({ ...data, userId: auth.user!.id })
    return response.created(bookmaker)
  }

  async update({ auth, request, params }: HttpContext) {
    const bookmaker = await Bookmaker.query()
      .where('user_id', auth.user!.id)
      .where('id', params.id)
      .firstOrFail()
    const data = await request.validateUsing(bookmakerValidator)
    bookmaker.merge(data)
    await bookmaker.save()
    return bookmaker
  }

  async destroy({ auth, params, response }: HttpContext) {
    const userId = auth.user!.id
    const bookmaker = await Bookmaker.query()
      .where('user_id', userId)
      .where('id', params.id)
      .firstOrFail()

    const usedByBets = await Bet.query()
      .where('user_id', userId)
      .whereIn(
        'bookmaker_account_id',
        db.from('bookmaker_accounts').select('id').where('bookmaker_id', bookmaker.id)
      )
      .first()

    if (usedByBets) {
      bookmaker.active = false
      await bookmaker.save()
      return { softDeleted: true, bookmaker }
    }

    await bookmaker.delete()
    return response.noContent()
  }
}
