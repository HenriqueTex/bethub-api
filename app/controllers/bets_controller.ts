import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Bet from '#models/bet'
import BookmakerAccount from '#models/bookmaker_account'
import Tipster from '#models/tipster'
import Method from '#models/method'
import Market from '#models/market'
import Freebet from '#models/freebet'
import { betValidator, betUpdateValidator, settleBetValidator } from '#validators/bet'
import { calculateProfit } from '#services/bet_profit_service'
import { syncGeneratedFreebet } from '#services/freebet_generation_service'
import { parseBetFilters, applyBetFilters } from '#services/bet_filter_service'
import { deleteReceipt, receiptKeyBelongsTo } from '#services/receipt_storage_service'

const round = (value: number) => Math.round(value * 100) / 100

export default class BetsController {
  async index({ auth, request }: HttpContext) {
    const qs = request.qs()
    const page = Math.max(1, Number(qs.page) || 1)
    const perPage = Math.min(100, Math.max(1, Number(qs.perPage) || 20))

    const query = Bet.query()
      .where('bets.user_id', auth.user!.id)
      .preload('account', (accountQuery) => accountQuery.preload('bookmaker'))
      .preload('tipster')
      .preload('method')
      .preload('market')
      .orderBy('placed_at', 'desc')
      .orderBy('id', 'desc')

    applyBetFilters(query, parseBetFilters(qs))
    return query.paginate(page, perPage)
  }

  async show({ auth, params }: HttpContext) {
    return Bet.query()
      .where('user_id', auth.user!.id)
      .where('id', params.id)
      .preload('account', (accountQuery) => accountQuery.preload('bookmaker'))
      .preload('tipster')
      .preload('method')
      .preload('market')
      .firstOrFail()
  }

  async store({ auth, request, response }: HttpContext) {
    const user = auth.user!
    const { marketName, eventDate, placedAt, ...data } = await request.validateUsing(betValidator)

    await this.assertOwnership(user.id, data)
    if (data.receiptKey && !receiptKeyBelongsTo(data.receiptKey, user.id)) {
      return response.forbidden({ errors: [{ message: 'Comprovante inválido.' }] })
    }
    const marketId = await this.resolveMarket(user.id, data.marketId, marketName)

    const unitValue = user.unitValue
    const stakeAmount = data.stakeAmount ?? round(data.units * unitValue)

    const generatesFreebet = data.generatesFreebet ?? false

    const bet = await Bet.create({
      ...data,
      tipsterId: data.tipsterId ?? null,
      methodId: data.methodId ?? null,
      marketId: marketId ?? null,
      stakeAmount,
      unitValue,
      userId: user.id,
      isFreebet: data.isFreebet ?? false,
      notificationsEnabled: data.notificationsEnabled ?? true,
      generatesFreebet,
      freebetValue: generatesFreebet ? (data.freebetValue ?? null) : null,
      freebetExtraction: generatesFreebet ? (data.freebetExtraction ?? 0) : null,
      freebetTrigger: generatesFreebet ? (data.freebetTrigger ?? null) : null,
      eventDate: eventDate ? DateTime.fromJSDate(eventDate) : null,
      placedAt: placedAt ? DateTime.fromJSDate(placedAt) : DateTime.now(),
      result: 'pending',
    })

    await this.loadRelations(bet)
    return response.created(bet)
  }

  async update({ auth, request, params, response }: HttpContext) {
    const user = auth.user!
    const bet = await Bet.query().where('user_id', user.id).where('id', params.id).firstOrFail()

    const { marketName, eventDate, placedAt, ...data } =
      await request.validateUsing(betUpdateValidator)

    await this.assertOwnership(user.id, data)
    if (data.receiptKey && !receiptKeyBelongsTo(data.receiptKey, user.id)) {
      return response.forbidden({ errors: [{ message: 'Comprovante inválido.' }] })
    }

    const previousReceiptKey = bet.receiptKey

    if (marketName !== undefined || data.marketId !== undefined) {
      bet.marketId = await this.resolveMarket(user.id, data.marketId, marketName)
    }
    delete data.marketId

    const unitsChanged = data.units !== undefined && data.units !== bet.units
    bet.merge(data)
    if (eventDate !== undefined) {
      bet.eventDate = eventDate ? DateTime.fromJSDate(eventDate) : null
    }
    if (placedAt !== undefined && placedAt) {
      bet.placedAt = DateTime.fromJSDate(placedAt)
    }
    if (unitsChanged && data.stakeAmount === undefined) {
      bet.stakeAmount = round(bet.units * bet.unitValue)
    }
    if (!bet.generatesFreebet) {
      bet.freebetValue = null
      bet.freebetExtraction = null
      bet.freebetTrigger = null
    }

    if (bet.result !== 'pending') {
      bet.profitAmount = calculateProfit(bet)
    }

    await bet.save()
    if (previousReceiptKey && previousReceiptKey !== bet.receiptKey) {
      await deleteReceipt(previousReceiptKey)
    }
    await syncGeneratedFreebet(bet)
    await this.loadRelations(bet)
    return bet
  }

  async settle({ auth, request, params }: HttpContext) {
    const bet = await Bet.query()
      .where('user_id', auth.user!.id)
      .where('id', params.id)
      .firstOrFail()

    const { result, cashoutAmount } = await request.validateUsing(settleBetValidator)

    bet.result = result
    bet.cashoutAmount = result === 'cashout' ? (cashoutAmount ?? 0) : null

    if (result === 'pending') {
      bet.profitAmount = null
      bet.settledAt = null
    } else {
      bet.profitAmount = calculateProfit(bet)
      bet.settledAt = bet.settledAt ?? DateTime.now()
    }

    await bet.save()
    await syncGeneratedFreebet(bet)
    await this.loadRelations(bet)
    return bet
  }

  async destroy({ auth, params, response }: HttpContext) {
    const bet = await Bet.query()
      .where('user_id', auth.user!.id)
      .where('id', params.id)
      .firstOrFail()
    await Freebet.query().where('source_bet_id', bet.id).where('status', 'pending').delete()
    await bet.delete()
    if (bet.receiptKey) await deleteReceipt(bet.receiptKey)
    return response.noContent()
  }

  private async assertOwnership(
    userId: number,
    data: { bookmakerAccountId?: number; tipsterId?: number | null; methodId?: number | null }
  ) {
    if (data.bookmakerAccountId) {
      await BookmakerAccount.query()
        .where('user_id', userId)
        .where('id', data.bookmakerAccountId)
        .firstOrFail()
    }
    if (data.tipsterId) {
      await Tipster.query().where('user_id', userId).where('id', data.tipsterId).firstOrFail()
    }
    if (data.methodId) {
      await Method.query().where('user_id', userId).where('id', data.methodId).firstOrFail()
    }
  }

  private async resolveMarket(
    userId: number,
    marketId: number | null | undefined,
    marketName: string | undefined
  ) {
    if (marketId) {
      const market = await Market.query()
        .where('user_id', userId)
        .where('id', marketId)
        .firstOrFail()
      return market.id
    }
    if (marketName) {
      const normalizedName = Market.normalize(marketName)
      const existing = await Market.query()
        .where('user_id', userId)
        .where('normalized_name', normalizedName)
        .first()
      if (existing) return existing.id
      const market = await Market.create({ userId, name: marketName, normalizedName })
      return market.id
    }
    return null
  }

  private async loadRelations(bet: Bet) {
    await bet.load('account', (accountQuery) => accountQuery.preload('bookmaker'))
    if (bet.tipsterId) await bet.load('tipster')
    if (bet.methodId) await bet.load('method')
    if (bet.marketId) await bet.load('market')
  }
}
