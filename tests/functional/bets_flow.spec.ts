import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import type { ApiClient } from '@japa/api-client'

let counter = 0

async function createUser(client: ApiClient) {
  counter += 1
  const email = `user${counter}-${Math.random().toString(36).slice(2)}@test.com`
  const response = await client.post('/auth/register').json({
    fullName: `User ${counter}`,
    email,
    password: 'senha12345',
  })
  response.assertStatus(201)
  return response.body().token.value as string
}

async function createAccount(client: ApiClient, token: string, deposit?: number) {
  const bookmakerResponse = await client
    .post('/bookmakers')
    .bearerToken(token)
    .json({ name: 'Bet365' })
  bookmakerResponse.assertStatus(201)

  const accountResponse = await client
    .post('/accounts')
    .bearerToken(token)
    .json({ bookmakerId: bookmakerResponse.body().id, initialDeposit: deposit })
  accountResponse.assertStatus(201)
  return accountResponse.body().id as number
}

test.group('Fluxo de apostas', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('cria aposta com snapshot da unidade e liquida green', async ({ client, assert }) => {
    const token = await createUser(client)
    const accountId = await createAccount(client, token, 1000)

    await client.put('/me/settings').bearerToken(token).json({ unitValue: 50 })

    const betResponse = await client.post('/bets').bearerToken(token).json({
      bookmakerAccountId: accountId,
      event: 'Cruzeiro x Galo',
      selection: 'Cruzeiro ML',
      marketName: 'Moneyline',
      odd: 2.1,
      units: 2,
    })
    betResponse.assertStatus(201)
    const bet = betResponse.body()
    assert.equal(bet.unitValue, 50)
    assert.equal(bet.stakeAmount, 100)
    assert.equal(bet.result, 'pending')

    await client.put('/me/settings').bearerToken(token).json({ unitValue: 999 })

    const settleResponse = await client
      .patch(`/bets/${bet.id}/settle`)
      .bearerToken(token)
      .json({ result: 'green' })
    settleResponse.assertStatus(200)
    assert.equal(settleResponse.body().profitAmount, 110)
    assert.equal(settleResponse.body().stakeAmount, 100)
  })

  test('preserva stake monetário ao editar outros campos com unidades arredondadas', async ({
    client,
    assert,
  }) => {
    const token = await createUser(client)
    const accountId = await createAccount(client, token)
    await client.put('/me/settings').bearerToken(token).json({ unitValue: 30 })
    const created = await client
      .post('/bets')
      .bearerToken(token)
      .json({
        bookmakerAccountId: accountId,
        event: 'A x B',
        selection: 'A vence',
        odd: 2,
        units: 100 / 30,
        stakeAmount: 100,
      })
    created.assertStatus(201)
    const updated = await client
      .put(`/bets/${created.body().id}`)
      .bearerToken(token)
      .json({ odd: 2.1, units: created.body().units })
    updated.assertStatus(200)
    assert.equal(updated.body().stakeAmount, 100)
    const changed = await client
      .put(`/bets/${created.body().id}`)
      .bearerToken(token)
      .json({ units: 2 })
    changed.assertStatus(200)
    assert.equal(changed.body().stakeAmount, 60)
  })

  test('cashout exige valor e calcula lucro', async ({ client, assert }) => {
    const token = await createUser(client)
    const accountId = await createAccount(client, token)

    const betResponse = await client.post('/bets').bearerToken(token).json({
      bookmakerAccountId: accountId,
      event: 'Flamengo x Vasco',
      selection: 'Over 2.5',
      odd: 1.9,
      units: 1,
      stakeAmount: 100,
    })
    const betId = betResponse.body().id

    const missingValue = await client
      .patch(`/bets/${betId}/settle`)
      .bearerToken(token)
      .json({ result: 'cashout' })
    missingValue.assertStatus(422)

    const settled = await client
      .patch(`/bets/${betId}/settle`)
      .bearerToken(token)
      .json({ result: 'cashout', cashoutAmount: 130 })
    settled.assertStatus(200)
    assert.equal(settled.body().profitAmount, 30)
  })

  test('des-liquidar volta a pending e limpa lucro', async ({ client, assert }) => {
    const token = await createUser(client)
    const accountId = await createAccount(client, token)

    const betResponse = await client.post('/bets').bearerToken(token).json({
      bookmakerAccountId: accountId,
      event: 'A x B',
      selection: 'A ML',
      odd: 2,
      units: 1,
      stakeAmount: 50,
    })
    const betId = betResponse.body().id

    await client.patch(`/bets/${betId}/settle`).bearerToken(token).json({ result: 'red' })
    const reopened = await client
      .patch(`/bets/${betId}/settle`)
      .bearerToken(token)
      .json({ result: 'pending' })

    assert.equal(reopened.body().result, 'pending')
    assert.isNull(reopened.body().profitAmount)
    assert.isNull(reopened.body().settledAt)
  })

  test('saldo da conta deriva de depositos, saques e lucro', async ({ client, assert }) => {
    const token = await createUser(client)
    const accountId = await createAccount(client, token, 1000)

    await client
      .post(`/accounts/${accountId}/transactions`)
      .bearerToken(token)
      .json({ type: 'withdrawal', amount: 200 })

    const betResponse = await client.post('/bets').bearerToken(token).json({
      bookmakerAccountId: accountId,
      event: 'A x B',
      selection: 'Over 1.5',
      odd: 1.5,
      units: 1,
      stakeAmount: 100,
    })
    await client
      .patch(`/bets/${betResponse.body().id}/settle`)
      .bearerToken(token)
      .json({ result: 'green' })

    const accounts = await client.get('/accounts').bearerToken(token)
    const account = accounts.body().find((item: any) => item.id === accountId)
    assert.equal(account.balance.deposits, 1000)
    assert.equal(account.balance.withdrawals, 200)
    assert.equal(account.balance.profit, 50)
    assert.equal(account.balance.balance, 850)
  })

  test('usuario nao enxerga nem altera dados de outro usuario', async ({ client, assert }) => {
    const tokenA = await createUser(client)
    const tokenB = await createUser(client)
    const accountA = await createAccount(client, tokenA, 500)

    const betA = await client.post('/bets').bearerToken(tokenA).json({
      bookmakerAccountId: accountA,
      event: 'Secreto x Privado',
      selection: 'ML',
      odd: 2,
      units: 1,
    })
    betA.assertStatus(201)

    const listB = await client.get('/bets').bearerToken(tokenB)
    assert.lengthOf(listB.body().data, 0)

    const bookmakersB = await client.get('/bookmakers').bearerToken(tokenB)
    assert.lengthOf(bookmakersB.body(), 0)

    const showB = await client.get(`/bets/${betA.body().id}`).bearerToken(tokenB)
    showB.assertStatus(404)

    const betWithForeignAccount = await client.post('/bets').bearerToken(tokenB).json({
      bookmakerAccountId: accountA,
      event: 'Roubo x Conta',
      selection: 'ML',
      odd: 2,
      units: 1,
    })
    betWithForeignAccount.assertStatus(404)

    const settleB = await client
      .patch(`/bets/${betA.body().id}/settle`)
      .bearerToken(tokenB)
      .json({ result: 'green' })
    settleB.assertStatus(404)
  })

  test('summary calcula lucro, roi e taxa de acerto', async ({ client, assert }) => {
    const token = await createUser(client)
    const accountId = await createAccount(client, token, 1000)

    const place = async (odd: number, stake: number) => {
      const response = await client
        .post('/bets')
        .bearerToken(token)
        .json({
          bookmakerAccountId: accountId,
          event: 'A x B',
          selection: `sel-${odd}-${stake}`,
          odd,
          units: 1,
          stakeAmount: stake,
        })
      return response.body().id
    }

    const green = await place(2, 100)
    const red = await place(1.8, 100)
    const pending = await place(3, 50)

    await client.patch(`/bets/${green}/settle`).bearerToken(token).json({ result: 'green' })
    await client.patch(`/bets/${red}/settle`).bearerToken(token).json({ result: 'red' })

    const summary = await client.get('/stats/summary').bearerToken(token)
    const body = summary.body()
    assert.equal(body.totalBets, 3)
    assert.equal(body.pendingBets, 1)
    assert.equal(body.wins, 1)
    assert.equal(body.losses, 1)
    assert.equal(body.profit, 0)
    assert.equal(body.staked, 200)
    assert.equal(body.roi, 0)
    assert.equal(body.hitRate, 50)
    assert.equal(body.totalBalance, 1000)
    assert.isNumber(body.profitUnits)
    assert.exists(pending)
  })
})
