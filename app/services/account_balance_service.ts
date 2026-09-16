import db from '@adonisjs/lucid/services/db'

export interface AccountBalance {
  deposits: number
  withdrawals: number
  profit: number
  extractedFreebets: number
  pendingFreebets: number
  balance: number
}

export async function accountBalances(userId: number) {
  const txRows = await db
    .from('account_transactions')
    .where('user_id', userId)
    .groupBy('bookmaker_account_id')
    .select('bookmaker_account_id')
    .select(
      db.raw("coalesce(sum(case when type = 'deposit' then amount else 0 end), 0) as deposits"),
      db.raw(
        "coalesce(sum(case when type = 'withdrawal' then amount else 0 end), 0) as withdrawals"
      )
    )

  const betRows = await db
    .from('bets')
    .where('user_id', userId)
    .whereNotNull('profit_amount')
    .groupBy('bookmaker_account_id')
    .select('bookmaker_account_id')
    .select(db.raw('coalesce(sum(profit_amount), 0) as profit'))

  const freebetRows = await db
    .from('freebets')
    .where('user_id', userId)
    .groupBy('bookmaker_account_id')
    .select('bookmaker_account_id')
    .select(
      db.raw(
        "coalesce(sum(case when status = 'extracted' then extracted_value else 0 end), 0) as extracted"
      ),
      db.raw(
        "coalesce(sum(case when status = 'pending' then extracted_value else 0 end), 0) as pending"
      )
    )

  const balances = new Map<number, AccountBalance>()

  const entry = (accountId: number) => {
    let current = balances.get(accountId)
    if (!current) {
      current = {
        deposits: 0,
        withdrawals: 0,
        profit: 0,
        extractedFreebets: 0,
        pendingFreebets: 0,
        balance: 0,
      }
      balances.set(accountId, current)
    }
    return current
  }

  for (const row of txRows) {
    const current = entry(row.bookmaker_account_id)
    current.deposits = Number(row.deposits)
    current.withdrawals = Number(row.withdrawals)
  }
  for (const row of betRows) {
    const current = entry(row.bookmaker_account_id)
    current.profit = Number(row.profit)
  }
  for (const row of freebetRows) {
    const current = entry(row.bookmaker_account_id)
    current.extractedFreebets = Number(row.extracted)
    current.pendingFreebets = Number(row.pending)
  }
  for (const current of balances.values()) {
    current.balance =
      Math.round(
        (current.deposits - current.withdrawals + current.profit + current.extractedFreebets) * 100
      ) / 100
  }

  return balances
}

export function emptyBalance(): AccountBalance {
  return {
    deposits: 0,
    withdrawals: 0,
    profit: 0,
    extractedFreebets: 0,
    pendingFreebets: 0,
    balance: 0,
  }
}
