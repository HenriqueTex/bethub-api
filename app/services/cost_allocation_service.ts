import { DateTime } from 'luxon'
import Cost from '#models/cost'
import { costOccurrences, round, type AllocatedCost } from '#services/cost_occurrences'

export {
  costsByTipster,
  totalCosts,
  unassignedCosts,
  costOccurrences,
  type AllocatedCost,
} from '#services/cost_occurrences'

function periodBounds(from?: string, to?: string) {
  return {
    from: from ? DateTime.fromISO(from) : DateTime.fromISO('1970-01-01'),
    to: to ? DateTime.fromISO(to) : DateTime.now(),
  }
}

export async function allocateCosts(userId: number, fromISO?: string, toISO?: string) {
  const { from, to } = periodBounds(fromISO, toISO)
  const costs = await Cost.query().where('user_id', userId).preload('tipsters')

  const allocated: AllocatedCost[] = []

  for (const cost of costs) {
    const occurrences = costOccurrences(cost, from, to)
    if (occurrences === 0) continue

    const total = round(cost.amount * occurrences)
    const tipsterIds = cost.tipsters.map((tipster) => tipster.id)

    allocated.push({
      id: cost.id,
      description: cost.description,
      kind: cost.kind,
      amount: cost.amount,
      occurrences,
      total,
      tipsterIds,
      perTipster: tipsterIds.length > 0 ? round(total / tipsterIds.length) : 0,
    })
  }

  return allocated
}
