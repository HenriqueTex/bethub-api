import type { ApiClient } from '@japa/api-client'
import User from '#models/user'
import { markActive } from '#services/account_approval_service'

let counter = 0

/**
 * Cadastra pela API e ativa direto no banco, pulando aprovação e e-mail, para
 * os testes que só precisam de um usuário logado.
 */
export async function createActiveUser(
  client: ApiClient,
  data: { fullName?: string; email?: string; password?: string } = {}
) {
  counter += 1
  const email = data.email ?? `user-${counter}-${Math.random().toString(36).slice(2)}@test.com`
  const password = data.password ?? 'senha12345'

  const registration = await client
    .post('/auth/register')
    .json({ fullName: data.fullName ?? `User ${counter}`, email, password })
  registration.assertStatus(201)

  await markActive(await User.findByOrFail('email', email))

  const login = await client.post('/auth/login').json({ email, password })
  login.assertStatus(200)
  return {
    email,
    password,
    userId: login.body().user.id as number,
    token: login.body().token.value as string,
  }
}
