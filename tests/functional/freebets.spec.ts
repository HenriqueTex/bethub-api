import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import type { ApiClient } from '@japa/api-client'

let counter = 0

async function setup(client: ApiClient) {
  counter += 1
  const register = await client.post('/auth/register').json({
    fullName: `Freebet User ${counter}`,
    email: `freebet${counter}-${Math.random().toString(36).slice(2)}@test.com`,
    password: 'senha12345',
  })
  const token = register.body().token.value as string

  const bookmaker = await client.post('/bookmakers').bearerToken(token).json({ name: 'Bet365' })
  const account = await client
    .post('/accounts')
    .bearerToken(token)
    .json({ bookmakerId: bookmaker.body().id, initialDeposit: 1000 })

  return { token, accountId: account.body().id as number }
}

test.group('Freebets', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('aposta que É freebet usa SNR: green paga odd-1, red = 0', async ({ client, assert }) => {
    const { token, accountId } = await setup(client)

    const win = await client.post('/bets').bearerToken(token).json({
      bookmakerAccountId: accountId,
      event: 'A x B',
      selection: 'A ML',
      odd: 3,
      units: 1,
      stakeAmount: 100,
      isFreebet: true,
    })
    await client
      .patch(`/bets/${win.body().id}/settle`)
      .bearerToken(token)
      .json({ result: 'green' })
      .then((r) => assert.equal(r.body().profitAmount, 200))

    const loss = await client.post('/bets').bearerToken(token).json({
      bookmakerAccountId: accountId,
      event: 'C x D',
      selection: 'C ML',
      odd: 3,
      units: 1,
      stakeAmount: 100,
      isFreebet: true,
    })
    const settledLoss = await client
      .patch(`/bets/${loss.body().id}/settle`)
      .bearerToken(token)
      .json({ result: 'red' })
    assert.equal(settledLoss.body().profitAmount, 0)
  })

  test('aposta gera freebet ao perder: cria crédito pendente com valor extraído', async ({
    client,
    assert,
  }) => {
    const { token, accountId } = await setup(client)

    const bet = await client.post('/bets').bearerToken(token).json({
      bookmakerAccountId: accountId,
      event: 'A x B',
      selection: 'A ML',
      odd: 2,
      units: 1,
      stakeAmount: 100,
      generatesFreebet: true,
      freebetValue: 50,
      freebetExtraction: 70,
      freebetTrigger: 'on_loss',
    })
    const betId = bet.body().id

    // ganhando, o gatilho on_loss não dispara
    await client.patch(`/bets/${betId}/settle`).bearerToken(token).json({ result: 'green' })
    let list = await client.get('/freebets').bearerToken(token)
    assert.lengthOf(list.body(), 0)

    // perdendo, gera a freebet
    await client.patch(`/bets/${betId}/settle`).bearerToken(token).json({ result: 'red' })
    list = await client.get('/freebets').bearerToken(token)
    assert.lengthOf(list.body(), 1)
    assert.equal(list.body()[0].value, 50)
    assert.equal(list.body()[0].extractedValue, 35)
    assert.equal(list.body()[0].status, 'pending')

    // pendente aparece separado do saldo; extraída entra no saldo
    let accounts = await client.get('/accounts').bearerToken(token)
    let acc = accounts.body().find((a: any) => a.id === accountId)
    assert.equal(acc.balance.pendingFreebets, 35)
    assert.equal(acc.balance.extractedFreebets, 0)

    await client.patch(`/freebets/${list.body()[0].id}/extract`).bearerToken(token)
    accounts = await client.get('/accounts').bearerToken(token)
    acc = accounts.body().find((a: any) => a.id === accountId)
    assert.equal(acc.balance.pendingFreebets, 0)
    assert.equal(acc.balance.extractedFreebets, 35)
    // saldo = 1000 depósito - 100 (red da aposta geradora) + 35 freebet extraída
    assert.equal(acc.balance.balance, 935)
  })

  test('re-liquidar remove a freebet pendente anterior (idempotente)', async ({
    client,
    assert,
  }) => {
    const { token, accountId } = await setup(client)
    const bet = await client.post('/bets').bearerToken(token).json({
      bookmakerAccountId: accountId,
      event: 'A x B',
      selection: 'A ML',
      odd: 2,
      units: 1,
      stakeAmount: 100,
      generatesFreebet: true,
      freebetValue: 50,
      freebetExtraction: 80,
      freebetTrigger: 'always',
    })
    const betId = bet.body().id

    await client.patch(`/bets/${betId}/settle`).bearerToken(token).json({ result: 'red' })
    await client.patch(`/bets/${betId}/settle`).bearerToken(token).json({ result: 'green' })

    const list = await client.get('/freebets').bearerToken(token)
    assert.lengthOf(list.body(), 1)
    assert.equal(list.body()[0].extractedValue, 40)
  })
})
