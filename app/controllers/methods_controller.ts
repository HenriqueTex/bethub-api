import type { HttpContext } from '@adonisjs/core/http'
import Method from '#models/method'
import Bet from '#models/bet'
import { methodValidator } from '#validators/catalog'

export default class MethodsController {
  async index({ auth }: HttpContext) {
    return Method.query().where('user_id', auth.user!.id).orderBy('name')
  }

  async store({ auth, request, response }: HttpContext) {
    const data = await request.validateUsing(methodValidator)
    const method = await Method.create({ ...data, userId: auth.user!.id })
    return response.created(method)
  }

  async update({ auth, request, params }: HttpContext) {
    const method = await Method.query()
      .where('user_id', auth.user!.id)
      .where('id', params.id)
      .firstOrFail()
    const data = await request.validateUsing(methodValidator)
    method.merge(data)
    await method.save()
    return method
  }

  async destroy({ auth, params, response }: HttpContext) {
    const userId = auth.user!.id
    const method = await Method.query()
      .where('user_id', userId)
      .where('id', params.id)
      .firstOrFail()

    const usedByBets = await Bet.query()
      .where('user_id', userId)
      .where('method_id', method.id)
      .first()

    if (usedByBets) {
      method.active = false
      await method.save()
      return { softDeleted: true, method }
    }

    await method.delete()
    return response.noContent()
  }
}
