import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import AccountTransaction from '#models/account_transaction'
import BookmakerAccount from '#models/bookmaker_account'
import { transactionValidator } from '#validators/catalog'

export default class TransactionsController {
  async index({ auth, params }: HttpContext) {
    const userId = auth.user!.id
    await BookmakerAccount.query()
      .where('user_id', userId)
      .where('id', params.accountId)
      .firstOrFail()

    return AccountTransaction.query()
      .where('user_id', userId)
      .where('bookmaker_account_id', params.accountId)
      .orderBy('occurred_at', 'desc')
      .orderBy('id', 'desc')
  }

  async store({ auth, params, request, response }: HttpContext) {
    const userId = auth.user!.id
    const account = await BookmakerAccount.query()
      .where('user_id', userId)
      .where('id', params.accountId)
      .firstOrFail()

    const { occurredAt, ...data } = await request.validateUsing(transactionValidator)
    const transaction = await AccountTransaction.create({
      ...data,
      userId,
      bookmakerAccountId: account.id,
      occurredAt: occurredAt ? DateTime.fromJSDate(occurredAt) : DateTime.now(),
    })
    return response.created(transaction)
  }

  async destroy({ auth, params, response }: HttpContext) {
    const transaction = await AccountTransaction.query()
      .where('user_id', auth.user!.id)
      .where('id', params.id)
      .firstOrFail()
    await transaction.delete()
    return response.noContent()
  }
}
