import type { HttpContext } from '@adonisjs/core/http'
import Tipster from '#models/tipster'
import Bet from '#models/bet'
import { tipsterValidator } from '#validators/catalog'

export default class TipstersController {
  async index({ auth }: HttpContext) {
    return Tipster.query().where('user_id', auth.user!.id).orderBy('name')
  }

  async store({ auth, request, response }: HttpContext) {
    const data = await request.validateUsing(tipsterValidator)
    const tipster = await Tipster.create({ ...data, userId: auth.user!.id })
    return response.created(tipster)
  }

  async update({ auth, request, params }: HttpContext) {
    const tipster = await Tipster.query()
      .where('user_id', auth.user!.id)
      .where('id', params.id)
      .firstOrFail()
    const data = await request.validateUsing(tipsterValidator)
    tipster.merge(data)
    await tipster.save()
    return tipster
  }

  async destroy({ auth, params, response }: HttpContext) {
    const userId = auth.user!.id
    const tipster = await Tipster.query()
      .where('user_id', userId)
      .where('id', params.id)
      .firstOrFail()

    const usedByBets = await Bet.query()
      .where('user_id', userId)
      .where('tipster_id', tipster.id)
      .first()

    if (usedByBets) {
      tipster.active = false
      await tipster.save()
      return { softDeleted: true, tipster }
    }

    await tipster.delete()
    return response.noContent()
  }
}
