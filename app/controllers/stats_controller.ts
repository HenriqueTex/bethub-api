import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { parseBetFilters, applyBetFilters } from '#services/bet_filter_service'
import { accountBalances } from '#services/account_balance_service'

const round = (value: number) => Math.round(value * 100) / 100

const DIMENSIONS = {
  bookmaker: {
    join: (query: any) =>
      query
        .join('bookmaker_accounts', 'bookmaker_accounts.id', 'bets.bookmaker_account_id')
        .join('bookmakers', 'bookmakers.id', 'bookmaker_accounts.bookmaker_id'),
    key: 'bookmakers.id',
    label: 'bookmakers.name',
  },
  tipster: {
    join: (query: any) => query.leftJoin('tipsters', 'tipsters.id', 'bets.tipster_id'),
    key: 'tipsters.id',
    label: 'tipsters.name',
  },
  method: {
    join: (query: any) => query.leftJoin('methods', 'methods.id', 'bets.method_id'),
    key: 'methods.id',
    label: 'methods.name',
  },
  market: {
    join: (query: any) => query.leftJoin('markets', 'markets.id', 'bets.market_id'),
    key: 'markets.id',
    label: 'markets.name',
  },
} as const

export default class StatsController {
  async summary({ auth, request }: HttpContext) {
    const userId = auth.user!.id
    const filters = parseBetFilters(request.qs())

    const query = db
      .from('bets')
      .where('bets.user_id', userId)
      .select(
        db.raw('count(*) as total_bets'),
        db.raw("count(case when result = 'pending' then 1 end) as pending_bets"),
        db.raw("count(case when result in ('green', 'half_green') then 1 end) as wins"),
        db.raw("count(case when result in ('red', 'half_red') then 1 end) as losses"),
        db.raw("count(case when result = 'void' then 1 end) as voids"),
        db.raw("count(case when result = 'cashout' then 1 end) as cashouts"),
        db.raw(
          "coalesce(sum(case when result != 'pending' then stake_amount else 0 end), 0) as staked"
        ),
        db.raw(
          "coalesce(sum(case when result = 'pending' then stake_amount else 0 end), 0) as pending_stake"
        ),
        db.raw('coalesce(sum(profit_amount), 0) as profit'),
        db.raw(
          'coalesce(sum(profit_amount / nullif(unit_value, 0)), 0) as profit_units'
        ),
        db.raw('coalesce(avg(odd), 0) as avg_odd')
      )
    applyBetFilters(query, filters)
    const [row] = await query

    const wins = Number(row.wins)
    const losses = Number(row.losses)
    const staked = Number(row.staked)
    const profit = Number(row.profit)

    const balances = await accountBalances(userId)
    let totalBalance = 0
    for (const balance of balances.values()) totalBalance += balance.balance

    return {
      totalBets: Number(row.total_bets),
      pendingBets: Number(row.pending_bets),
      wins,
      losses,
      voids: Number(row.voids),
      cashouts: Number(row.cashouts),
      staked: round(staked),
      pendingStake: round(Number(row.pending_stake)),
      profit: round(profit),
      profitUnits: round(Number(row.profit_units)),
      roi: staked > 0 ? round((profit / staked) * 100) : 0,
      hitRate: wins + losses > 0 ? round((wins / (wins + losses)) * 100) : 0,
      avgOdd: round(Number(row.avg_odd)),
      totalBalance: round(totalBalance),
    }
  }

  async by({ auth, request, response }: HttpContext) {
    const dimensionName = String(request.qs().dimension ?? '')
    const filters = parseBetFilters(request.qs())
    const userId = auth.user!.id

    if (dimensionName === 'month') {
      const query = db
        .from('bets')
        .where('bets.user_id', userId)
        .select(db.raw("date_format(placed_at, '%Y-%m') as key"))
        .groupBy('key')
        .orderBy('key', 'desc')
      this.selectAggregates(query)
      applyBetFilters(query, filters)
      const rows = await query
      return rows.map((row) => this.formatRow(row, row.key))
    }

    const dimension = DIMENSIONS[dimensionName as keyof typeof DIMENSIONS]
    if (!dimension) {
      return response.badRequest({ errors: [{ message: 'dimension inválida' }] })
    }

    const query = db.from('bets').where('bets.user_id', userId)
    dimension.join(query)
    query
      .select(db.raw(`${dimension.key} as key`), db.raw(`${dimension.label} as label`))
      .groupByRaw(`${dimension.key}, ${dimension.label}`)
      .orderByRaw('sum(profit_amount) desc')
    this.selectAggregates(query)
    applyBetFilters(query, filters)

    const rows = await query
    return rows.map((row) => this.formatRow(row, row.label))
  }

  async timeline({ auth, request }: HttpContext) {
    const filters = parseBetFilters(request.qs())
    const query = db
      .from('bets')
      .where('bets.user_id', auth.user!.id)
      .whereNotNull('settled_at')
      .select(db.raw('date(settled_at) as day'))
      .select(db.raw('coalesce(sum(profit_amount), 0) as profit'))
      .groupBy('day')
      .orderBy('day')
    applyBetFilters(query, filters)

    const rows = await query
    let cumulative = 0
    return rows.map((row) => {
      cumulative = round(cumulative + Number(row.profit))
      return {
        day: typeof row.day === 'string' ? row.day : row.day.toISOString().slice(0, 10),
        profit: round(Number(row.profit)),
        cumulativeProfit: cumulative,
      }
    })
  }

  private selectAggregates(query: any) {
    query.select(
      db.raw('count(*) as total_bets'),
      db.raw("count(case when result = 'pending' then 1 end) as pending_bets"),
      db.raw("count(case when result in ('green', 'half_green') then 1 end) as wins"),
      db.raw("count(case when result in ('red', 'half_red') then 1 end) as losses"),
      db.raw(
        "coalesce(sum(case when result != 'pending' then stake_amount else 0 end), 0) as staked"
      ),
      db.raw('coalesce(sum(profit_amount), 0) as profit'),
      db.raw('coalesce(sum(profit_amount / nullif(unit_value, 0)), 0) as profit_units')
    )
  }

  private formatRow(row: any, label: string | null) {
    const staked = Number(row.staked)
    const profit = Number(row.profit)
    const wins = Number(row.wins)
    const losses = Number(row.losses)
    return {
      key: row.key ?? null,
      label: label ?? null,
      totalBets: Number(row.total_bets),
      pendingBets: Number(row.pending_bets),
      staked: round(staked),
      profit: round(profit),
      profitUnits: round(Number(row.profit_units)),
      roi: staked > 0 ? round((profit / staked) * 100) : 0,
      hitRate: wins + losses > 0 ? round((wins / (wins + losses)) * 100) : 0,
    }
  }
}
