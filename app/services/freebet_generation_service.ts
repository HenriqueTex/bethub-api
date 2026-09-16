import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'
import Bet from '#models/bet'
import Freebet from '#models/freebet'
import type { BetResult, FreebetTrigger } from '#models/bet'

const round = (value: number) => Math.round(value * 100) / 100

export function triggerMatchesResult(trigger: FreebetTrigger, result: BetResult) {
  if (result === 'pending') return false
  if (trigger === 'always') return true
  if (trigger === 'on_win') return result === 'green' || result === 'half_green'
  if (trigger === 'on_loss') return result === 'red' || result === 'half_red'
  return false
}

/**
 * Sincroniza a freebet gerada por uma aposta com o resultado atual.
 * Idempotente: remove a freebet pendente anterior desta aposta e recria se o gatilho bater.
 * Freebets já extraídas/descartadas não são tocadas.
 */
export async function syncGeneratedFreebet(bet: Bet, trx?: TransactionClientContract) {
  const client = trx ? { client: trx } : {}

  await Freebet.query({ client: trx })
    .where('source_bet_id', bet.id)
    .where('status', 'pending')
    .delete()

  if (
    !bet.generatesFreebet ||
    !bet.freebetTrigger ||
    !bet.freebetValue ||
    bet.freebetValue <= 0 ||
    !triggerMatchesResult(bet.freebetTrigger, bet.result)
  ) {
    return null
  }

  const extractionRate = bet.freebetExtraction ?? 0
  const extractedValue = round((bet.freebetValue * extractionRate) / 100)

  return Freebet.create(
    {
      userId: bet.userId,
      bookmakerAccountId: bet.bookmakerAccountId,
      sourceBetId: bet.id,
      value: bet.freebetValue,
      extractionRate,
      extractedValue,
      trigger: bet.freebetTrigger,
      status: 'pending',
      resolvedAt: DateTime.now(),
    },
    client
  )
}
