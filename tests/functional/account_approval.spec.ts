import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import type { ApiClient } from '@japa/api-client'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import User from '#models/user'
import { testOutbox } from '#services/mail_service'
import { renotifyPendingSignups } from '#services/account_approval_service'

let counter = 0

async function registerPending(client: ApiClient) {
  counter += 1
  const email = `aprovacao-${counter}-${Math.random().toString(36).slice(2)}@test.com`
  const response = await client
    .post('/auth/register')
    .json({ fullName: `Pessoa ${counter}`, email, password: 'senha12345' })
  response.assertStatus(201)
  return { email, response }
}

function lastTokenFrom(subjectPart: string) {
  const mail = [...testOutbox].reverse().find((m) => m.subject.includes(subjectPart))
  const match = mail?.text.match(/token=([A-Za-z0-9_-]+)/)
  if (!match) throw new Error(`Nenhum e-mail com token para "${subjectPart}"`)
  return { mail: mail!, token: decodeURIComponent(match[1]) }
}

async function approve(client: ApiClient) {
  const { token } = lastTokenFrom('Novo cadastro pendente')
  const response = await client.post('/auth/approvals/approve').json({ token })
  response.assertStatus(200)
  return lastTokenFrom('foi aprovada').token
}

test.group('Cadastro com aprovação manual', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    testOutbox.length = 0
  })

  test('cadastro fica pendente, não devolve token e avisa o admin', async ({ client, assert }) => {
    const { email, response } = await registerPending(client)

    assert.equal(response.body().status, 'pending')
    assert.notProperty(response.body(), 'token')
    const stored = await User.findByOrFail('email', email)
    assert.equal(stored.status, 'pending')

    const { mail } = lastTokenFrom('Novo cadastro pendente')
    assert.include(mail.text, email)
    assert.include(mail.text, '/aprovar?token=')

    const login = await client.post('/auth/login').json({ email, password: 'senha12345' })
    login.assertStatus(403)
    assert.equal(login.body().errors[0].code, 'ACCOUNT_PENDING')
  })

  test('senha errada não revela o status da conta', async ({ client }) => {
    const { email } = await registerPending(client)
    const login = await client.post('/auth/login').json({ email, password: 'outra-senha' })
    login.assertStatus(400)
  })

  test('aprovação, ativação e login de ponta a ponta', async ({ client, assert }) => {
    const { email } = await registerPending(client)
    const approvalToken = lastTokenFrom('Novo cadastro pendente').token

    const preview = await client.get('/auth/approvals').qs({ token: approvalToken })
    preview.assertStatus(200)
    assert.equal(preview.body().user.email, email)
    assert.notProperty(preview.body().user, 'password')

    const activationToken = await approve(client)
    const activationMail = lastTokenFrom('foi aprovada').mail
    assert.equal(activationMail.to, email)
    assert.include(activationMail.text, '/ativar?token=')

    const reused = await client.post('/auth/approvals/approve').json({ token: approvalToken })
    reused.assertStatus(410)

    const blocked = await client.post('/auth/login').json({ email, password: 'senha12345' })
    blocked.assertStatus(403)
    assert.equal(blocked.body().errors[0].code, 'ACCOUNT_NOT_ACTIVATED')

    const activated = await client.post('/auth/activate').json({ token: activationToken })
    activated.assertStatus(200)
    assert.equal(activated.body().user.status, 'active')
    const sessionToken = activated.body().token.value as string

    const markets = await client.get('/markets').bearerToken(sessionToken)
    markets.assertStatus(200)
    assert.isAbove(markets.body().length, 0)

    const again = await client.post('/auth/activate').json({ token: activationToken })
    again.assertStatus(410)

    const login = await client.post('/auth/login').json({ email, password: 'senha12345' })
    login.assertStatus(200)
  })

  test('rejeição bloqueia o login e avisa o usuário', async ({ client, assert }) => {
    const { email } = await registerPending(client)
    const { token } = lastTokenFrom('Novo cadastro pendente')

    const rejected = await client.post('/auth/approvals/reject').json({ token })
    rejected.assertStatus(200)
    assert.equal(rejected.body().status, 'rejected')
    assert.isTrue(
      testOutbox.some((m) => m.to === email && m.subject.includes('Sobre seu cadastro'))
    )
    assert.isFalse(testOutbox.some((m) => m.subject.includes('foi aprovada')))

    const login = await client.post('/auth/login').json({ email, password: 'senha12345' })
    login.assertStatus(403)
    assert.equal(login.body().errors[0].code, 'ACCOUNT_REJECTED')

    const preview = await client.get('/auth/approvals').qs({ token })
    preview.assertStatus(410)
  })

  test('reaviso de pendentes troca o link de aprovação', async ({ client, assert }) => {
    const { email } = await registerPending(client)
    const oldToken = lastTokenFrom('Novo cadastro pendente').token

    const results = await renotifyPendingSignups()
    assert.deepInclude(results, { email, sent: true })
    const newToken = lastTokenFrom('Novo cadastro pendente').token
    assert.notEqual(newToken, oldToken)

    const old = await client.get('/auth/approvals').qs({ token: oldToken })
    old.assertStatus(410)
    const fresh = await client.get('/auth/approvals').qs({ token: newToken })
    fresh.assertStatus(200)
  })

  test('link de ativação expirado é recusado', async ({ client }) => {
    await registerPending(client)
    const activationToken = await approve(client)

    await db
      .from('account_tokens')
      .where('type', 'activation')
      .update({ expires_at: DateTime.now().minus({ hours: 1 }).toSQL({ includeOffset: false }) })

    const response = await client.post('/auth/activate').json({ token: activationToken })
    response.assertStatus(410)
  })

  test('reenvio gera link novo, invalida o antigo e não revela contas', async ({
    client,
    assert,
  }) => {
    const { email } = await registerPending(client)
    const firstToken = await approve(client)

    const tooSoon = await client.post('/auth/activation/resend').json({ email })
    tooSoon.assertStatus(202)
    assert.equal(lastTokenFrom('foi aprovada').token, firstToken)

    await db
      .from('account_tokens')
      .where('type', 'activation')
      .update({ created_at: DateTime.now().minus({ minutes: 5 }).toSQL({ includeOffset: false }) })

    const resent = await client.post('/auth/activation/resend').json({ email })
    resent.assertStatus(202)
    const secondToken = lastTokenFrom('foi aprovada').token
    assert.notEqual(secondToken, firstToken)

    const old = await client.post('/auth/activate').json({ token: firstToken })
    old.assertStatus(410)
    const fresh = await client.post('/auth/activate').json({ token: secondToken })
    fresh.assertStatus(200)

    const unknown = await client.post('/auth/activation/resend').json({ email: 'ninguem@test.com' })
    unknown.assertStatus(202)
    assert.equal(unknown.body().message, resent.body().message)
  })
})
