import type { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'
import { DateTime } from 'luxon'
import User, { type UserStatus } from '#models/user'
import {
  accountTokenValidator,
  loginValidator,
  registerValidator,
  resendActivationValidator,
} from '#validators/auth'
import {
  activateAccount,
  markActive,
  registerPendingUser,
  resendActivation,
} from '#services/account_approval_service'
import { lastIssuedAt } from '#services/account_token_service'

const DEV_USER_EMAIL = 'dev@bethub.local'
const RESEND_COOLDOWN_SECONDS = 60

const BLOCKED_LOGIN: Record<Exclude<UserStatus, 'active'>, { code: string; message: string }> = {
  pending: {
    code: 'ACCOUNT_PENDING',
    message: 'Seu cadastro ainda está aguardando aprovação.',
  },
  approved: {
    code: 'ACCOUNT_NOT_ACTIVATED',
    message: 'Seu cadastro foi aprovado. Ative a conta pelo link enviado ao seu e-mail.',
  },
  rejected: {
    code: 'ACCOUNT_REJECTED',
    message: 'Seu cadastro não foi aprovado.',
  },
}

async function issueSession(user: User) {
  const token = await User.accessTokens.create(user)
  return {
    user,
    token: {
      type: 'bearer',
      value: token.value!.release(),
      expiresAt: token.expiresAt,
    },
  }
}

export default class AuthController {
  async register({ request, response }: HttpContext) {
    const data = await request.validateUsing(registerValidator)

    const existing = await User.findBy('email', data.email)
    if (existing) {
      return response.conflict({
        errors: [{ field: 'email', message: 'Este e-mail já está cadastrado' }],
      })
    }

    await registerPendingUser(data)

    return response.created({
      status: 'pending',
      message: 'Cadastro recebido. Você receberá um e-mail quando ele for aprovado.',
    })
  }

  /**
   * A senha é conferida antes do status, para não revelar a situação de uma
   * conta a quem não sabe a senha dela.
   */
  async login({ request, response }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)

    const user = await User.verifyCredentials(email, password)
    if (user.status !== 'active') {
      return response.forbidden({ errors: [BLOCKED_LOGIN[user.status]] })
    }

    return issueSession(user)
  }

  async activate({ request, response }: HttpContext) {
    const { token } = await request.validateUsing(accountTokenValidator)

    const user = await activateAccount(token)
    if (!user) {
      return response.gone({
        errors: [
          {
            code: 'INVALID_TOKEN',
            message: 'Este link de ativação é inválido, expirou ou já foi usado.',
          },
        ],
      })
    }

    return issueSession(user)
  }

  /**
   * Responde sempre igual, exista ou não a conta, para não servir de
   * verificador de e-mails cadastrados.
   */
  async resendActivation({ request, response }: HttpContext) {
    const { email } = await request.validateUsing(resendActivationValidator)

    const user = await User.findBy('email', email)
    if (user?.status === 'approved') {
      const last = await lastIssuedAt(user.id, 'activation')
      const cooledDown =
        !last || DateTime.now().diff(last, 'seconds').seconds >= RESEND_COOLDOWN_SECONDS
      if (cooledDown) await resendActivation(user)
    }

    return response.accepted({
      message: 'Se houver uma conta aprovada com este e-mail, enviaremos um novo link.',
    })
  }

  async devLogin({ response }: HttpContext) {
    if (!app.inDev) {
      return response.notFound()
    }

    let user = await User.findBy('email', DEV_USER_EMAIL)
    if (!user) {
      user = await User.create({
        fullName: 'Dev',
        email: DEV_USER_EMAIL,
        password: 'dev-password',
      })
      await markActive(user)
    }

    return issueSession(user)
  }

  async me({ auth }: HttpContext) {
    return { user: auth.user }
  }

  async logout({ auth, response }: HttpContext) {
    const user = auth.user!
    await User.accessTokens.delete(user, user.currentAccessToken.identifier)
    return response.noContent()
  }
}
