import webpush from 'web-push'
import env from '#start/env'
import PushSubscription from '#models/push_subscription'

export type PushPayload = {
  title: string
  body: string
  url?: string
  tag?: string
}

export function isPushConfigured() {
  return !!env.get('VAPID_PUBLIC_KEY') && !!env.get('VAPID_PRIVATE_KEY')
}

export function publicKey() {
  return env.get('VAPID_PUBLIC_KEY') ?? null
}

function configure() {
  webpush.setVapidDetails(
    env.get('VAPID_SUBJECT') ?? 'mailto:contato@texasbethub.com',
    env.get('VAPID_PUBLIC_KEY')!,
    env.get('VAPID_PRIVATE_KEY')!
  )
}

/**
 * 404 e 410 significam que o navegador descartou a inscrição; qualquer outro
 * erro pode ser transitório, então só os dois primeiros apagam o registro.
 */
export async function sendToUser(userId: number, payload: PushPayload) {
  if (!isPushConfigured()) return { enviados: 0, removidos: 0 }

  const subscriptions = await PushSubscription.query().where('user_id', userId)
  if (subscriptions.length === 0) return { enviados: 0, removidos: 0 }

  configure()

  let enviados = 0
  let removidos = 0

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify(payload)
      )
      enviados += 1
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        await subscription.delete()
        removidos += 1
      }
    }
  }

  return { enviados, removidos }
}
