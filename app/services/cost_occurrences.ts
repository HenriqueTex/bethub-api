import { DateTime } from 'luxon'

export const round = (value: number) => Math.round(value * 100) / 100

export interface AllocatedCost {
  id: number
  description: string
  kind: string
  amount: number
  occurrences: number
  total: number
  tipsterIds: number[]
  perTipster: number
}

/**
 * Um custo mensal é cobrado uma vez por mês-calendário em que esteve ativo, então o
 * período pedido é varrido por mês e não por dia: filtrar 15/01 a 15/02 cobra janeiro
 * e fevereiro, como as duas faturas que de fato caíram.
 */
export function costOccurrences(
  cost: { kind: string; startsOn: DateTime; endsOn: DateTime | null },
  from: DateTime,
  to: DateTime
) {
  if (cost.kind !== 'monthly') {
    return cost.startsOn >= from.startOf('day') && cost.startsOn <= to.endOf('day') ? 1 : 0
  }

  const start = DateTime.max(cost.startsOn.startOf('month'), from.startOf('month'))
  const endLimit = cost.endsOn ? DateTime.min(cost.endsOn, to) : to
  const end = endLimit.startOf('month')

  if (end < start) return 0
  return Math.floor(end.diff(start, 'months').months) + 1
}

export function costsByTipster(allocated: AllocatedCost[]) {
  const byTipster = new Map<number, number>()

  for (const cost of allocated) {
    for (const tipsterId of cost.tipsterIds) {
      byTipster.set(tipsterId, round((byTipster.get(tipsterId) ?? 0) + cost.perTipster))
    }
  }

  return byTipster
}

export function totalCosts(allocated: AllocatedCost[]) {
  return round(allocated.reduce((sum, cost) => sum + cost.total, 0))
}

/** Custos sem tipster vinculado pesam no resultado geral, mas não no de ninguém. */
export function unassignedCosts(allocated: AllocatedCost[]) {
  return round(
    allocated
      .filter((cost) => cost.tipsterIds.length === 0)
      .reduce((sum, cost) => sum + cost.total, 0)
  )
}
