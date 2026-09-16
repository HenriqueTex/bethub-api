import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import type { ApiClient } from '@japa/api-client'

let counter = 0

async function setupUser(client: ApiClient) {
  counter += 1
  const register = await client.post('/auth/register').json({
    fullName: `Surebet User ${counter}`,
    email: `surebet${counter}-${Math.random().toString(36).slice(2)}@test.com`,
    password: 'senha12345',
  })
  const token = register.body().token.value as string

  const createAccount = async (name: string) => {
    const bookmaker = await client.post('/bookmakers').bearerToken(token).json({ name })
    const account = await client
      .post('/accounts')
      .bearerToken(token)
      .json({ bookmakerId: bookmaker.body().id })
    return account.body().id as number
  }

  return { token, createAccount }
}

test.group('Surebets', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('cria operação com pernas em contas diferentes no método Surebet', async ({
    client,
    assert,
  }) => {
    const { token, createAccount } = await setupUser(client)
    const accountA = await createAccount('Bet365')
    const accountB = await createAccount('Betano')

    await client.put('/me/settings').bearerToken(token).json({ unitValue: 50 })

    const response = await client
      .post('/surebets')
      .bearerToken(token)
      .json({
        event: 'Djokovic x Alcaraz',
        legs: [
          { bookmakerAccountId: accountA, selection: 'Djokovic ML', odd: 2.1, stakeAmount: 494 },
          { bookmakerAccountId: accountB, selection: 'Alcaraz ML', odd: 2.05, stakeAmount: 506 },
        ],
      })

    response.assertStatus(201)
    const operation = response.body()
    assert.lengthOf(operation.bets, 2)
    for (const bet of operation.bets) {
      assert.equal(bet.surebetOperationId, operation.id)
      assert.equal(bet.result, 'pending')
      assert.equal(bet.unitValue, 50)
    }
    assert.equal(operation.bets[0].units, 9.88)

    const methods = await client.get('/methods').bearerToken(token)
    const surebetMethod = methods.body().find((m: any) => m.name.toLowerCase() === 'surebet')
    assert.equal(operation.bets[0].methodId, surebetMethod.id)
  })

  test('rejeita menos de 2 pernas e conta de outro usuário', async ({ client }) => {
    const { token, createAccount } = await setupUser(client)
    const account = await createAccount('Bet365')
    const other = await setupUser(client)
    const foreignAccount = await other.createAccount('KTO')

    const single = await client
      .post('/surebets')
      .bearerToken(token)
      .json({
        event: 'A x B',
        legs: [{ bookmakerAccountId: account, selection: 'A', odd: 2, stakeAmount: 100 }],
      })
    single.assertStatus(422)

    const foreign = await client
      .post('/surebets')
      .bearerToken(token)
      .json({
        event: 'A x B',
        legs: [
          { bookmakerAccountId: account, selection: 'A', odd: 2, stakeAmount: 100 },
          { bookmakerAccountId: foreignAccount, selection: 'B', odd: 2.2, stakeAmount: 91 },
        ],
      })
    foreign.assertStatus(404)
  })
})
