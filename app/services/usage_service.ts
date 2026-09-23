import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

export const USAGE_WINDOW_DAYS = 90

export interface Usage {
  betCount: number
  lastBetAt: string | null
}

export const emptyUsage = (): Usage => ({ betCount: 0, lastBetAt: null })

/**
 * Quantas apostas o usuário fez com cada conta ou tipster nos últimos 90 dias, e quando
 * foi a última (em todo o histórico), para ordenar os selects pelo uso real. É uma
 * única agregação sobre `bets`, apoiada no índice de `user_id`.
 */
export async function usageBy(userId: number, column: 'bookmaker_account_id' | 'tipster_id') {
  const since = DateTime.now().minus({ days: USAGE_WINDOW_DAYS }).toJSDate()
  const rows = await db
    .from('bets')
    .where('user_id', userId)
    .whereNotNull(column)
    .groupBy(column)
    .select(`${column} as id`)
    .select(db.raw('sum(case when placed_at >= ? then 1 else 0 end) as recent', [since]))
    .select(db.raw('max(placed_at) as last_bet_at'))

  const usage = new Map<number, Usage>()
  for (const row of rows) {
    const last = row.last_bet_at ? new Date(row.last_bet_at) : null
    usage.set(Number(row.id), {
      betCount: Number(row.recent) || 0,
      lastBetAt: last ? last.toISOString() : null,
    })
  }
  return usage
}
