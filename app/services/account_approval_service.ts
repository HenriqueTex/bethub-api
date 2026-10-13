import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import { consumeToken, issueToken } from '#services/account_token_service'
import { sendMailSafely } from '#services/mail_service'
import { seedDefaultMarkets } from '#services/default_markets_service'
import { seedDefaultMethods } from '#services/default_methods_service'
import { activation, newSignupForAdmin, signupRejected } from '#mails/account_mails'

export type DecisionResult =
  { ok: true; user: User } | { ok: false; reason: 'invalid_token' | 'already_decided' }

export async function registerPendingUser(data: {
  fullName: string
  email: string
  password: string
}) {
  const { user, approvalToken } = await db.transaction(async (trx) => {
    const created = await User.create({ ...data, status: 'pending' }, { client: trx })
    const token = await issueToken(created.id, 'approval', trx)
    return { user: created, approvalToken: token }
  })

  await sendMailSafely(newSignupForAdmin(user, approvalToken))
  return user
}

/**
 * Reemite o link de aprovação de quem ainda está pendente (ex.: o aviso
 * original falhou por SMTP). O link antigo deixa de valer.
 */
export async function renotifyPendingSignups() {
  const pending = await User.query().where('status', 'pending').orderBy('created_at')
  const results: { email: string; sent: boolean }[] = []
  for (const user of pending) {
    const token = await issueToken(user.id, 'approval')
    results.push({ email: user.email, sent: await sendMailSafely(newSignupForAdmin(user, token)) })
  }
  return results
}

async function decide(rawToken: string, approve: boolean): Promise<DecisionResult> {
  const outcome = await db.transaction(async (trx) => {
    const token = await consumeToken(rawToken, 'approval', trx)
    if (!token) return { ok: false as const, reason: 'invalid_token' as const }

    const user = await User.query({ client: trx })
      .where('id', token.userId)
      .forUpdate()
      .firstOrFail()
    if (user.status !== 'pending') return { ok: false as const, reason: 'already_decided' as const }

    user.status = approve ? 'approved' : 'rejected'
    if (approve) user.approvedAt = DateTime.now()
    await user.useTransaction(trx).save()

    const activationToken = approve ? await issueToken(user.id, 'activation', trx) : null
    return { ok: true as const, user, activationToken }
  })

  if (!outcome.ok) return outcome

  await sendMailSafely(
    outcome.activationToken
      ? activation(outcome.user, outcome.activationToken)
      : signupRejected(outcome.user)
  )
  return { ok: true, user: outcome.user }
}

export function approveSignup(rawToken: string) {
  return decide(rawToken, true)
}

export function rejectSignup(rawToken: string) {
  return decide(rawToken, false)
}

/**
 * Os dados padrão (mercados, métodos) só nascem na ativação, para que
 * cadastros recusados não deixem lixo no banco.
 */
async function seedDefaults(userId: number) {
  await seedDefaultMarkets(userId)
  await seedDefaultMethods(userId)
}

/** Ativa direto, sem token: usado pelo dev-login e pelos testes. */
export async function markActive(user: User) {
  user.status = 'active'
  user.emailVerifiedAt = DateTime.now()
  await user.save()
  await seedDefaults(user.id)
  return user
}

export async function activateAccount(rawToken: string) {
  const user = await db.transaction(async (trx) => {
    const token = await consumeToken(rawToken, 'activation', trx)
    if (!token) return null

    const found = await User.query({ client: trx })
      .where('id', token.userId)
      .forUpdate()
      .firstOrFail()
    if (found.status !== 'approved') return null

    found.status = 'active'
    found.emailVerifiedAt = DateTime.now()
    await found.useTransaction(trx).save()
    return found
  })

  if (user) await seedDefaults(user.id)
  return user
}

export async function resendActivation(user: User) {
  const token = await issueToken(user.id, 'activation')
  await sendMailSafely(activation(user, token))
}
