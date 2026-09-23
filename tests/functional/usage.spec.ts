import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import type { ApiClient } from '@japa/api-client'
import { DateTime } from 'luxon'

async function createUser(client: ApiClient) {
  const email = `usage-${Math.random().toString(36).slice(2)}@test.com`
  const response = await client
    .post('/auth/register')
    .json({ fullName: 'Uso', email, password: 'senha12345' })
  response.assertStatus(201)
  return response.body().token.value as string
}

async function createAccount(client: ApiClient, token: string, name: string) {
  const bookmaker = await client.post('/bookmakers').bearerToken(token).json({ name })
  bookmaker.assertStatus(201)
  const account = await client
    .post('/accounts')
    .bearerToken(token)
    .json({ bookmakerId: bookmaker.body().id })
  account.assertStatus(201)
  return account.body().id as number
}

async function createTipster(client: ApiClient, token: string, name: string) {
  const response = await client.post('/tipsters').bearerToken(token).json({ name })
  response.assertStatus(201)
  return response.body().id as number
}

async function placeBet(
  client: ApiClient,
  token: string,
  bookmakerAccountId: number,
  tipsterId: number | null,
  placedAt: DateTime
) {
  const response = await client.post('/bets').bearerToken(token).json({
    bookmakerAccountId,
    tipsterId,
    event: 'A x B',
    selection: 'A',
    odd: 2,
    units: 1,
    placedAt: placedAt.toUTC().toISO(),
  })
  response.assertStatus(201)
}

test.group('Uso de contas e tipsters', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('conta apostas dos últimos 90 dias e guarda a última', async ({ client, assert }) => {
    const token = await createUser(client)
    const pouco = await createAccount(client, token, 'Casa Pouco Usada')
    const muito = await createAccount(client, token, 'Casa Muito Usada')
    const semUso = await createAccount(client, token, 'Casa Sem Uso')
    const tipster = await createTipster(client, token, 'Tipster Frequente')
    const tipsterParado = await createTipster(client, token, 'Tipster Parado')

    const antiga = DateTime.now().minus({ days: 200 })
    const ontem = DateTime.now().minus({ days: 1 })
    await placeBet(client, token, pouco, null, antiga)
    await placeBet(client, token, pouco, tipster, ontem)
    await placeBet(client, token, muito, tipster, ontem)
    await placeBet(client, token, muito, tipster, DateTime.now().minus({ days: 10 }))

    const accounts = await client.get('/accounts').bearerToken(token)
    accounts.assertStatus(200)
    const byId = new Map(accounts.body().map((account: any) => [account.id, account]))

    assert.equal(byId.get(muito).betCount, 2)
    assert.equal(byId.get(pouco).betCount, 1)
    assert.equal(byId.get(semUso).betCount, 0)
    assert.isNull(byId.get(semUso).lastBetAt)
    assert.closeTo(
      DateTime.fromISO(byId.get(pouco).lastBetAt).toMillis(),
      ontem.toMillis(),
      2000
    )

    const tipsters = await client.get('/tipsters').bearerToken(token)
    tipsters.assertStatus(200)
    const tipsterById = new Map(tipsters.body().map((item: any) => [item.id, item]))
    assert.equal(tipsterById.get(tipster).betCount, 3)
    assert.equal(tipsterById.get(tipsterParado).betCount, 0)
  })
})
