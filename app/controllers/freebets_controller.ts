import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Freebet from '#models/freebet'

export default class FreebetsController {
  async index({ auth, request }: HttpContext) {
    const status = request.qs().status
    const query = Freebet.query()
      .where('user_id', auth.user!.id)
      .preload('account', (accountQuery) => accountQuery.preload('bookmaker'))
      .preload('sourceBet')
      .orderBy('created_at', 'desc')

    if (typeof status === 'string' && status) {
      query.where('status', status)
    }

    return query
  }

  async extract({ auth, params }: HttpContext) {
    return this.resolve(auth.user!.id, params.id, 'extracted')
  }

  async discard({ auth, params }: HttpContext) {
    return this.resolve(auth.user!.id, params.id, 'discarded')
  }

  async reopen({ auth, params }: HttpContext) {
    const freebet = await Freebet.query()
      .where('user_id', auth.user!.id)
      .where('id', params.id)
      .firstOrFail()
    freebet.status = 'pending'
    freebet.resolvedAt = null
    await freebet.save()
    return freebet
  }

  private async resolve(userId: number, id: number, status: 'extracted' | 'discarded') {
    const freebet = await Freebet.query().where('user_id', userId).where('id', id).firstOrFail()
    freebet.status = status
    freebet.resolvedAt = DateTime.now()
    await freebet.save()
    return freebet
  }
}
