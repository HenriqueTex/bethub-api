import type { HttpContext } from '@adonisjs/core/http'
import Market from '#models/market'
import { marketValidator } from '#validators/catalog'

export default class MarketsController {
  async index({ auth, request }: HttpContext) {
    const search = request.qs().search
    const query = Market.query().where('user_id', auth.user!.id).orderBy('name')
    if (typeof search === 'string' && search.trim()) {
      query.whereILike('name', `%${search.trim()}%`)
    }
    return query
  }

  async store({ auth, request, response }: HttpContext) {
    const { name } = await request.validateUsing(marketValidator)
    const userId = auth.user!.id
    const normalizedName = Market.normalize(name)

    const existing = await Market.query()
      .where('user_id', userId)
      .where('normalized_name', normalizedName)
      .first()
    if (existing) {
      return existing
    }

    const market = await Market.create({ userId, name, normalizedName })
    return response.created(market)
  }

  async destroy({ auth, params, response }: HttpContext) {
    const market = await Market.query()
      .where('user_id', auth.user!.id)
      .where('id', params.id)
      .firstOrFail()
    await market.delete()
    return response.noContent()
  }
}
