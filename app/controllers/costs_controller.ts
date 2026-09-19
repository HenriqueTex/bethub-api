import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Cost from '#models/cost'
import Tipster from '#models/tipster'
import { costValidator, costUpdateValidator } from '#validators/cost'
import { allocateCosts, costsByTipster, totalCosts } from '#services/cost_allocation_service'

export default class CostsController {
  async index({ auth }: HttpContext) {
    return Cost.query()
      .where('user_id', auth.user!.id)
      .preload('tipsters')
      .orderBy('starts_on', 'desc')
      .orderBy('id', 'desc')
  }

  async summary({ auth, request }: HttpContext) {
    const qs = request.qs()
    const allocated = await allocateCosts(
      auth.user!.id,
      typeof qs.from === 'string' ? qs.from : undefined,
      typeof qs.to === 'string' ? qs.to : undefined
    )

    return {
      total: totalCosts(allocated),
      byTipster: Object.fromEntries(costsByTipster(allocated)),
      costs: allocated,
    }
  }

  async store({ auth, request, response }: HttpContext) {
    const { tipsterIds, startsOn, endsOn, ...data } = await request.validateUsing(costValidator)
    const userId = auth.user!.id

    await this.assertTipstersOwned(userId, tipsterIds)

    const cost = await Cost.create({
      ...data,
      userId,
      startsOn: DateTime.fromJSDate(startsOn),
      endsOn: endsOn ? DateTime.fromJSDate(endsOn) : null,
    })
    await cost.related('tipsters').sync(tipsterIds ?? [])
    await cost.load('tipsters')

    return response.created(cost)
  }

  async update({ auth, request, params }: HttpContext) {
    const userId = auth.user!.id
    const cost = await Cost.query().where('user_id', userId).where('id', params.id).firstOrFail()
    const { tipsterIds, startsOn, endsOn, ...data } =
      await request.validateUsing(costUpdateValidator)

    await this.assertTipstersOwned(userId, tipsterIds)

    cost.merge(data)
    if (startsOn !== undefined) cost.startsOn = DateTime.fromJSDate(startsOn)
    if (endsOn !== undefined) cost.endsOn = endsOn ? DateTime.fromJSDate(endsOn) : null
    await cost.save()

    if (tipsterIds !== undefined) await cost.related('tipsters').sync(tipsterIds)
    await cost.load('tipsters')

    return cost
  }

  async destroy({ auth, params, response }: HttpContext) {
    const cost = await Cost.query()
      .where('user_id', auth.user!.id)
      .where('id', params.id)
      .firstOrFail()
    await cost.delete()

    return response.noContent()
  }

  private async assertTipstersOwned(userId: number, tipsterIds?: number[]) {
    if (!tipsterIds?.length) return

    const owned = await Tipster.query()
      .where('user_id', userId)
      .whereIn('id', tipsterIds)
      .select('id')

    if (owned.length !== new Set(tipsterIds).size) {
      throw new Error('Tipster inválido')
    }
  }
}
