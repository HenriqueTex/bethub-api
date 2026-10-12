import { createHash, randomBytes } from 'node:crypto'
import { DateTime, type DurationLike } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import AccountToken, { type AccountTokenType } from '#models/account_token'

export const TOKEN_TTL: Record<AccountTokenType, DurationLike> = {
  approval: { days: 7 },
  activation: { hours: 48 },
}

function hashToken(raw: string) {
  return createHash('sha256').update(raw).digest('hex')
}

/**
 * Emitir um token novo invalida os anteriores do mesmo tipo, para que só o
 * link mais recente funcione.
 */
export async function issueToken(
  userId: number,
  type: AccountTokenType,
  trx?: TransactionClientContract
) {
  const now = DateTime.now()
  await AccountToken.query({ client: trx })
    .where('user_id', userId)
    .where('type', type)
    .whereNull('used_at')
    .update({ used_at: now.toSQL({ includeOffset: false }) })

  const raw = randomBytes(32).toString('base64url')
  await AccountToken.create(
    {
      userId,
      type,
      tokenHash: hashToken(raw),
      expiresAt: now.plus(TOKEN_TTL[type]),
    },
    { client: trx }
  )
  return raw
}

function isUsable(token: AccountToken | null): token is AccountToken {
  return !!token && token.usedAt === null && token.expiresAt > DateTime.now()
}

/** Consulta sem consumir, para mostrar a tela de confirmação. */
export async function findUsableToken(raw: string, type: AccountTokenType) {
  const token = await AccountToken.query()
    .where('token_hash', hashToken(raw))
    .where('type', type)
    .preload('user')
    .first()
  return isUsable(token) ? token : null
}

/**
 * Marca o token como usado dentro da transação do chamador; o lock de linha
 * impede que dois cliques simultâneos usem o mesmo link.
 */
export async function consumeToken(
  raw: string,
  type: AccountTokenType,
  trx: TransactionClientContract
) {
  const token = await AccountToken.query({ client: trx })
    .where('token_hash', hashToken(raw))
    .where('type', type)
    .forUpdate()
    .first()
  if (!isUsable(token)) return null

  token.usedAt = DateTime.now()
  await token.useTransaction(trx).save()
  return token
}

export async function lastIssuedAt(userId: number, type: AccountTokenType) {
  const token = await AccountToken.query()
    .where('user_id', userId)
    .where('type', type)
    .orderBy('created_at', 'desc')
    .first()
  return token?.createdAt ?? null
}
