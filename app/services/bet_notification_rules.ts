import { DateTime } from 'luxon'
import type { BetNotificationKind } from '#models/bet_notification'

export const CRON_MINUTES = 5

export const SOON_MINUTES = CRON_MINUTES

/**
 * No pior caso o jogo começa logo após uma execução, então a seguinte o encontra
 * com CRON_MINUTES de atraso; a folga cobre jitter do agendador. Manter a janela
 * curta é proposital: um "seu jogo começou" muito atrasado é pior que nenhum, e
 * o limite também impede que a primeira execução avise sobre jogos antigos.
 */
export const LOOKBACK_MINUTES = CRON_MINUTES + 2

export function classifyBet(eventDate: DateTime | null, now: DateTime): BetNotificationKind | null {
  if (!eventDate) return null

  const minutes = eventDate.diff(now, 'minutes').minutes

  if (minutes > SOON_MINUTES) return null
  if (minutes > 0) return 'starting_soon'
  if (minutes >= -LOOKBACK_MINUTES) return 'started'
  return null
}

export function notificationText(kind: BetNotificationKind, event: string, selection: string) {
  const title = kind === 'starting_soon' ? 'Jogo prestes a começar' : 'Seu jogo começou'
  return { title, body: `${event} — ${selection}` }
}
