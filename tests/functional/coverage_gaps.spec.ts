import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import type { ApiClient } from '@japa/api-client'
import env from '#start/env'

let counter = 0

async function register(client: ApiClient) {
  counter += 1
  const email = `coverage-${counter}-${Math.random().toString(36).slice(2)}@test.com`
  const response = await client.post('/auth/register').json({
    fullName: `Coverage User ${counter}`,
    email,
    password: 'senha12345',
  })
  response.assertStatus(201)
  return { email, token: response.body().token.value as string }
}

async function createAccount(client: ApiClient, token: string) {
  const bookmaker = await client.post('/bookmakers').bearerToken(token).json({ name: 'Bet365' })
  bookmaker.assertStatus(201)
  const account = await client
    .post('/accounts')
    .bearerToken(token)
    .json({ bookmakerId: bookmaker.body().id })
  account.assertStatus(201)
  return account.body().id as number
}

test.group('Lacunas críticas de cobertura', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('cria sessão, devolve o usuário autenticado e invalida o token no logout', async ({
    client,
    assert,
  }) => {
    const { email, token } = await register(client)
    const login = await client.post('/auth/login').json({ email, password: 'senha12345' })
    login.assertStatus(200)
    assert.equal(login.body().user.email, email)

    const me = await client.get('/auth/me').bearerToken(login.body().token.value)
    me.assertStatus(200)
    assert.equal(me.body().user.email, email)

    const logout = await client.delete('/auth/logout').bearerToken(token)
    logout.assertStatus(204)
    const afterLogout = await client.get('/auth/me').bearerToken(token)
    afterLogout.assertStatus(401)
  })

  test('gerencia mercados normalizados sem misturar dados de outro usuário', async ({
    client,
    assert,
  }) => {
    const owner = await register(client)
    const other = await register(client)
    const created = await client
      .post('/markets')
      .bearerToken(owner.token)
      .json({ name: ' Mais de 2,5 ' })
    created.assertStatus(201)
    assert.equal(created.body().normalizedName, 'mais de 2,5')

    const duplicate = await client
      .post('/markets')
      .bearerToken(owner.token)
      .json({ name: 'mais de 2,5' })
    duplicate.assertStatus(200)
    assert.equal(duplicate.body().id, created.body().id)

    const search = await client.get('/markets?search=2,5').bearerToken(owner.token)
    assert.include(
      search.body().map((market: { id: number }) => market.id),
      created.body().id
    )
    const foreignList = await client.get('/markets').bearerToken(other.token)
    assert.notInclude(
      foreignList.body().map((market: { id: number }) => market.id),
      created.body().id
    )

    const foreignDelete = await client
      .delete(`/markets/${created.body().id}`)
      .bearerToken(other.token)
    foreignDelete.assertStatus(404)
    const deleted = await client.delete(`/markets/${created.body().id}`).bearerToken(owner.token)
    deleted.assertStatus(204)
  })

  test('cria, atualiza e remove tipster e método não utilizados', async ({ client, assert }) => {
    const { token } = await register(client)
    const tipster = await client
      .post('/tipsters')
      .bearerToken(token)
      .json({ name: 'Canal Premium', channel: 'Telegram' })
    tipster.assertStatus(201)
    const updatedTipster = await client
      .put(`/tipsters/${tipster.body().id}`)
      .bearerToken(token)
      .json({ name: 'Canal VIP', active: false })
    updatedTipster.assertStatus(200)
    assert.isFalse(updatedTipster.body().active)
    const deletedTipster = await client.delete(`/tipsters/${tipster.body().id}`).bearerToken(token)
    deletedTipster.assertStatus(204)

    const method = await client
      .post('/methods')
      .bearerToken(token)
      .json({ name: 'Arbitragem', description: 'Duas casas' })
    method.assertStatus(201)
    const updatedMethod = await client
      .put(`/methods/${method.body().id}`)
      .bearerToken(token)
      .json({ name: 'Surebet', active: false })
    updatedMethod.assertStatus(200)
    assert.equal(updatedMethod.body().name, 'Surebet')
    const deletedMethod = await client.delete(`/methods/${method.body().id}`).bearerToken(token)
    deletedMethod.assertStatus(204)
  })

  test('lança, aloca, atualiza e remove custo associado a tipster próprio', async ({
    client,
    assert,
  }) => {
    const { token } = await register(client)
    const tipster = await client.post('/tipsters').bearerToken(token).json({ name: 'João' })
    const cost = await client
      .post('/costs')
      .bearerToken(token)
      .json({
        description: 'Assinatura',
        amount: 100,
        kind: 'monthly',
        startsOn: '2026-09-01',
        tipsterIds: [tipster.body().id],
      })
    cost.assertStatus(201)
    assert.equal(cost.body().tipsters[0].id, tipster.body().id)

    const summary = await client
      .get('/costs/summary?from=2026-09-01&to=2026-09-30')
      .bearerToken(token)
    summary.assertStatus(200)
    assert.equal(summary.body().total, 100)
    assert.equal(summary.body().byTipster[tipster.body().id], 100)

    const updated = await client
      .put(`/costs/${cost.body().id}`)
      .bearerToken(token)
      .json({ amount: 120, endsOn: '2026-10-01', tipsterIds: [] })
    updated.assertStatus(200)
    assert.equal(updated.body().amount, 120)
    assert.lengthOf(updated.body().tipsters, 0)

    const deleted = await client.delete(`/costs/${cost.body().id}`).bearerToken(token)
    deleted.assertStatus(204)
  })

  test('mantém subscription de push por usuário e remove somente a inscrição indicada', async ({
    client,
    assert,
  }) => {
    const { token } = await register(client)
    const config = await client.get('/push/config').bearerToken(token)
    config.assertStatus(200)
    assert.isBoolean(config.body().configured)

    const endpoint = 'https://push.example.test/subscription-1'
    const created = await client
      .post('/push/subscriptions')
      .bearerToken(token)
      .json({
        endpoint,
        keys: { p256dh: 'public-key', auth: 'auth-key' },
      })
    assert.equal(created.status(), 201, JSON.stringify(created.body()))
    assert.isNumber(created.body().id)

    const invalid = await client.delete('/push/subscriptions').bearerToken(token).json({})
    invalid.assertStatus(400)
    const removed = await client.delete('/push/subscriptions').bearerToken(token).json({ endpoint })
    removed.assertStatus(204)
  })

  test('recusa upload sem armazenamento configurado e não expõe recibo inexistente', async ({
    client,
    cleanup,
  }) => {
    const keys = ['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'] as const
    const original = keys.map((key) => [key, env.get(key)] as const)
    for (const key of keys) env.set(key, '')
    cleanup(() => {
      for (const [key, value] of original) env.set(key, value)
    })
    const { token } = await register(client)
    const unavailable = await client.post('/bets/receipts').bearerToken(token)
    unavailable.assertStatus(503)

    const accountId = await createAccount(client, token)
    const bet = await client.post('/bets').bearerToken(token).json({
      bookmakerAccountId: accountId,
      event: 'A x B',
      selection: 'A vence',
      odd: 2,
      units: 1,
    })
    bet.assertStatus(201)
    const missingReceipt = await client.get(`/bets/${bet.body().id}/receipt`).bearerToken(token)
    missingReceipt.assertStatus(404)
  })
})
