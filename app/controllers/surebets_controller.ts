import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Bet from '#models/bet'
import BookmakerAccount from '#models/bookmaker_account'
import Method from '#models/method'
import SurebetOperation from '#models/surebet_operation'
import { surebetValidator } from '#validators/surebet'

const round = (value: number) => Math.round(value * 100) / 100

export default class SurebetsController {
  async store({ auth, request, response }: HttpContext) {
    const user = auth.user!
    const { event, notes, legs } = await request.validateUsing(surebetValidator)

    const accountIds = [...new Set(legs.map((leg) => leg.bookmakerAccountId))]
    const ownedCount = await BookmakerAccount.query()
      .where('user_id', user.id)
      .whereIn('id', accountIds)
      .count('* as total')
    if (Number(ownedCount[0].$extras.total) !== accountIds.length) {
      return response.notFound({ errors: [{ message: 'Conta não encontrada' }] })
    }

    const method = await this.resolveSurebetMethod(user.id)

    const operation = await db.transaction(async (trx) => {
      const created = await SurebetOperation.create(
        { userId: user.id, event, notes: notes ?? null },
        { client: trx }
      )

      await Bet.createMany(
        legs.map((leg) => ({
          userId: user.id,
          bookmakerAccountId: leg.bookmakerAccountId,
          methodId: method.id,
          tipsterId: null,
          marketId: null,
          surebetOperationId: created.id,
          event,
          selection: leg.selection,
          odd: leg.odd,
          units: round(leg.stakeAmount / user.unitValue),
          unitValue: user.unitValue,
          stakeAmount: leg.stakeAmount,
          result: 'pending' as const,
          placedAt: DateTime.now(),
        })),
        { client: trx }
      )

      return created
    })

    await operation.load('bets', (query) =>
      query.preload('account', (accountQuery) => accountQuery.preload('bookmaker'))
    )
    return response.created(operation)
  }

  private async resolveSurebetMethod(userId: number) {
    const existing = await Method.query()
      .where('user_id', userId)
      .whereILike('name', 'surebet')
      .first()
    if (existing) return existing
    return Method.create({ userId, name: 'Surebet' })
  }
}
