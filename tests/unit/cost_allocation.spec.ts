import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { costOccurrences, costsByTipster, totalCosts } from '#services/cost_occurrences'

const d = (iso: string) => DateTime.fromISO(iso)

test.group('costOccurrences', () => {
  test('custo pontual conta uma vez dentro do período', ({ assert }) => {
    const cost = { kind: 'one_time', startsOn: d('2026-02-10'), endsOn: null }
    assert.equal(costOccurrences(cost, d('2026-02-01'), d('2026-02-28')), 1)
  })

  test('custo pontual fora do período não conta', ({ assert }) => {
    const cost = { kind: 'one_time', startsOn: d('2026-01-10'), endsOn: null }
    assert.equal(costOccurrences(cost, d('2026-02-01'), d('2026-02-28')), 0)
  })

  test('custo mensal cobra uma vez por mês do período', ({ assert }) => {
    const cost = { kind: 'monthly', startsOn: d('2026-01-05'), endsOn: null }
    assert.equal(costOccurrences(cost, d('2026-01-01'), d('2026-03-31')), 3)
  })

  test('custo mensal que começa no meio só conta dali em diante', ({ assert }) => {
    const cost = { kind: 'monthly', startsOn: d('2026-02-05'), endsOn: null }
    assert.equal(costOccurrences(cost, d('2026-01-01'), d('2026-03-31')), 2)
  })

  test('custo mensal encerrado para de contar', ({ assert }) => {
    const cost = { kind: 'monthly', startsOn: d('2026-01-05'), endsOn: d('2026-02-05') }
    assert.equal(costOccurrences(cost, d('2026-01-01'), d('2026-12-31')), 2)
  })

  test('custo mensal que ainda não começou não conta', ({ assert }) => {
    const cost = { kind: 'monthly', startsOn: d('2026-06-01'), endsOn: null }
    assert.equal(costOccurrences(cost, d('2026-01-01'), d('2026-03-31')), 0)
  })
})

test.group('rateio entre tipsters', () => {
  const allocated = [
    {
      id: 1,
      description: 'Grupo do João',
      kind: 'monthly',
      amount: 100,
      occurrences: 1,
      total: 100,
      tipsterIds: [1],
      perTipster: 100,
    },
    {
      id: 2,
      description: 'Conta bet365',
      kind: 'monthly',
      amount: 100,
      occurrences: 1,
      total: 100,
      tipsterIds: [1, 2],
      perTipster: 50,
    },
    {
      id: 3,
      description: 'Assinatura de software',
      kind: 'monthly',
      amount: 30,
      occurrences: 1,
      total: 30,
      tipsterIds: [],
      perTipster: 0,
    },
  ]

  test('conta compartilhada divide igualmente e soma ao custo próprio', ({ assert }) => {
    const byTipster = costsByTipster(allocated)
    assert.equal(byTipster.get(1), 150)
    assert.equal(byTipster.get(2), 50)
  })

  test('total inclui custo sem tipster vinculado', ({ assert }) => {
    assert.equal(totalCosts(allocated), 230)
  })
})
