import { DateTime } from 'luxon'
import Bet from '#models/bet'
import BetNotification from '#models/bet_notification'
import {
  classifyBet,
  notificationText,
  LOOKBACK_MINUTES,
  SOON_MINUTES,
} from '#services/bet_notification_rules'
import { isPushConfigured, sendToUser } from '#services/push_service'

export async function notifyStartingGames(now = DateTime.now()) {
  if (!isPushConfigured()) return { avisos: 0, enviados: 0, motivo: 'push não configurado' }

  const bets = await Bet.query()
    .where('result', 'pending')
    .where('notifications_enabled', true)
    .whereNotNull('event_date')
    .where('event_date', '>=', now.minus({ minutes: LOOKBACK_MINUTES }).toSQL()!)
    .where('event_date', '<=', now.plus({ minutes: SOON_MINUTES }).toSQL()!)

  let avisos = 0
  let enviados = 0

  for (const bet of bets) {
    const kind = classifyBet(bet.eventDate, now)
    if (!kind) continue

    /**
     * O unique em (bet_id, kind) é quem garante o envio único: duas execuções
     * concorrentes do cron não duplicam o aviso porque a segunda falha aqui.
     */
    try {
      await BetNotification.create({ betId: bet.id, kind })
    } catch {
      continue
    }

    const { title, body } = notificationText(kind, bet.event, bet.selection)
    const resultado = await sendToUser(bet.userId, {
      title,
      body,
      url: '/bets',
      tag: `bet-${bet.id}-${kind}`,
    })

    avisos += 1
    enviados += resultado.enviados
  }

  return { avisos, enviados }
}
