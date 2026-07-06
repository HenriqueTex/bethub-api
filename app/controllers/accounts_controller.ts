import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import BookmakerAccount from '#models/bookmaker_account'
import Bookmaker from '#models/bookmaker'
import AccountTransaction from '#models/account_transaction'
import Bet from '#models/bet'
import { accountValidator, accountUpdateValidator } from '#validators/catalog'
import { accountBalances, emptyBalance } from '#services/account_balance_service'

export default class AccountsController {
  async index({ auth }: HttpContext) {
    const userId = auth.user!.id
    const accounts = await BookmakerAccount.query()
      .where('user_id', userId)
      .preload('bookmaker')
      .orderBy('id')

    const balances = await accountBalances(userId)
    return accounts.map((account) => ({
      ...account.serialize(),
      balance: balances.get(account.id) ?? emptyBalance(),
    }))
  }

  async store({ auth, request, response }: HttpContext) {
    const userId = auth.user!.id
    const { initialDeposit, ...data } = await request.validateUsing(accountValidator)

    await Bookmaker.query().where('user_id', userId).where('id', data.bookmakerId).firstOrFail()

    const account = await BookmakerAccount.create({ ...data, userId })

    if (initialDeposit) {
      await AccountTransaction.create({
        userId,
        bookmakerAccountId: account.id,
        type: 'deposit',
        amount: initialDeposit,
        occurredAt: DateTime.now(),
      })
    }

    await account.load('bookmaker')
    return response.created(account)
  }

  async update({ auth, request, params }: HttpContext) {
    const account = await BookmakerAccount.query()
      .where('user_id', auth.user!.id)
      .where('id', params.id)
      .firstOrFail()
    const data = await request.validateUsing(accountUpdateValidator)
    account.merge(data)
    await account.save()
    await account.load('bookmaker')
    return account
  }

  async destroy({ auth, params, response }: HttpContext) {
    const userId = auth.user!.id
    const account = await BookmakerAccount.query()
      .where('user_id', userId)
      .where('id', params.id)
      .firstOrFail()

    const usedByBets = await Bet.query()
      .where('user_id', userId)
      .where('bookmaker_account_id', account.id)
      .first()

    if (usedByBets) {
      account.active = false
      await account.save()
      return { softDeleted: true, account }
    }

    await account.delete()
    return response.noContent()
  }
}
