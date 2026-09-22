import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import PushSubscription from '#models/push_subscription'
import { isPushConfigured, publicKey } from '#services/push_service'

const subscriptionValidator = vine.compile(
  vine.object({
    endpoint: vine.string().trim().url().maxLength(500),
    keys: vine.object({
      p256dh: vine.string().trim().maxLength(255),
      auth: vine.string().trim().maxLength(255),
    }),
  })
)

export default class PushController {
  async config({}: HttpContext) {
    return { configured: isPushConfigured(), publicKey: publicKey() }
  }

  async store({ request, auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const { endpoint, keys } = await request.validateUsing(subscriptionValidator)

    /**
     * O endpoint é único no banco: se o mesmo navegador reinscrever, o registro
     * é reaproveitado e migra de usuário em vez de duplicar.
     */
    const subscription = await PushSubscription.updateOrCreate(
      { endpoint },
      { userId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth }
    )

    return response.created({ id: subscription.id })
  }

  async destroy({ request, auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const endpoint = request.input('endpoint')

    if (typeof endpoint !== 'string' || !endpoint) {
      return response.badRequest({ message: 'Informe o endpoint da inscrição' })
    }

    await PushSubscription.query().where('user_id', user.id).where('endpoint', endpoint).delete()

    return response.noContent()
  }
}
