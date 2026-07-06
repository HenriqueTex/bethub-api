import { test } from '@japa/runner'
import { calculateProfit } from '#services/bet_profit_service'

test.group('calculateProfit', () => {
  test('green retorna stake * (odd - 1)', ({ assert }) => {
    assert.equal(calculateProfit({ result: 'green', stakeAmount: 100, odd: 1.85 }), 85)
  })

  test('red retorna -stake', ({ assert }) => {
    assert.equal(calculateProfit({ result: 'red', stakeAmount: 100, odd: 1.85 }), -100)
  })

  test('half_green retorna metade do lucro cheio', ({ assert }) => {
    assert.equal(calculateProfit({ result: 'half_green', stakeAmount: 100, odd: 1.85 }), 42.5)
  })

  test('half_red retorna metade da perda', ({ assert }) => {
    assert.equal(calculateProfit({ result: 'half_red', stakeAmount: 100, odd: 1.85 }), -50)
  })

  test('void retorna 0', ({ assert }) => {
    assert.equal(calculateProfit({ result: 'void', stakeAmount: 100, odd: 1.85 }), 0)
  })

  test('cashout retorna cashout - stake', ({ assert }) => {
    assert.equal(
      calculateProfit({ result: 'cashout', stakeAmount: 100, odd: 1.85, cashoutAmount: 130 }),
      30
    )
    assert.equal(
      calculateProfit({ result: 'cashout', stakeAmount: 100, odd: 1.85, cashoutAmount: 40 }),
      -60
    )
  })

  test('pending retorna null', ({ assert }) => {
    assert.isNull(calculateProfit({ result: 'pending', stakeAmount: 100, odd: 1.85 }))
  })

  test('arredonda para 2 casas', ({ assert }) => {
    assert.equal(calculateProfit({ result: 'green', stakeAmount: 33.33, odd: 1.777 }), 25.9)
  })
})
