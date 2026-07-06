import db from '@adonisjs/lucid/services/db'
import { BET_RESULTS, type BetResult } from '#models/bet'

export interface BetFilters {
  from?: string
  to?: string
  accountId?: number
  bookmakerId?: number
  tipsterId?: number
  methodId?: number
  marketId?: number
  result?: BetResult
  search?: string
}

const toId = (value: unknown) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

export function parseBetFilters(qs: Record<string, unknown>): BetFilters {
  const filters: BetFilters = {}
  if (typeof qs.from === 'string' && qs.from) filters.from = qs.from
  if (typeof qs.to === 'string' && qs.to) filters.to = qs.to
  filters.accountId = toId(qs.accountId)
  filters.bookmakerId = toId(qs.bookmakerId)
  filters.tipsterId = toId(qs.tipsterId)
  filters.methodId = toId(qs.methodId)
  filters.marketId = toId(qs.marketId)
  if (typeof qs.result === 'string' && BET_RESULTS.includes(qs.result as BetResult)) {
    filters.result = qs.result as BetResult
  }
  if (typeof qs.search === 'string' && qs.search.trim()) filters.search = qs.search.trim()
  return filters
}

interface Filterable {
  where(...args: unknown[]): unknown
  whereIn(column: string, values: unknown): unknown
  whereILike?: unknown
}

export function applyBetFilters(query: Filterable, filters: BetFilters, column = 'bets.') {
  if (filters.from) {
    query.where(`${column}placed_at`, '>=', filters.from)
  }
  if (filters.to) {
    const to = DATE_ONLY.test(filters.to) ? `${filters.to}T23:59:59.999Z` : filters.to
    query.where(`${column}placed_at`, '<=', to)
  }
  if (filters.accountId) {
    query.where(`${column}bookmaker_account_id`, filters.accountId)
  }
  if (filters.bookmakerId) {
    query.whereIn(
      `${column}bookmaker_account_id`,
      db.from('bookmaker_accounts').select('id').where('bookmaker_id', filters.bookmakerId)
    )
  }
  if (filters.tipsterId) {
    query.where(`${column}tipster_id`, filters.tipsterId)
  }
  if (filters.methodId) {
    query.where(`${column}method_id`, filters.methodId)
  }
  if (filters.marketId) {
    query.where(`${column}market_id`, filters.marketId)
  }
  if (filters.result) {
    query.where(`${column}result`, filters.result)
  }
  if (filters.search) {
    const term = `%${filters.search}%`
    query.where((builder: any) => {
      builder
        .whereILike(`${column}event`, term)
        .orWhereILike(`${column}selection`, term)
        .orWhereILike(`${column}competition`, term)
    })
  }
}
