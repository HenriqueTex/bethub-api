import type { HttpContext } from '@adonisjs/core/http'
import { accountTokenValidator } from '#validators/auth'
import { findUsableToken } from '#services/account_token_service'
import {
  approveSignup,
  rejectSignup,
  type DecisionResult,
} from '#services/account_approval_service'

const INVALID_TOKEN = {
  code: 'INVALID_TOKEN',
  message: 'Este link de aprovação é inválido, expirou ou já foi usado.',
}

/**
 * O link do e-mail do admin é a credencial: quem o tem pode decidir aquele
 * cadastro e só aquele. O GET apenas mostra os dados; a decisão exige POST,
 * para que antivírus e pré-visualizações de e-mail não aprovem sozinhos.
 */
export default class AccountApprovalsController {
  async show({ request, response }: HttpContext) {
    const { token } = await accountTokenValidator.validate(request.qs())

    const found = await findUsableToken(token, 'approval')
    if (!found || found.user.status !== 'pending') {
      return response.gone({ errors: [INVALID_TOKEN] })
    }

    return {
      user: {
        fullName: found.user.fullName,
        email: found.user.email,
        createdAt: found.user.createdAt,
      },
      expiresAt: found.expiresAt,
    }
  }

  async approve(ctx: HttpContext) {
    const { token } = await ctx.request.validateUsing(accountTokenValidator)
    return this.respond(ctx, await approveSignup(token))
  }

  async reject(ctx: HttpContext) {
    const { token } = await ctx.request.validateUsing(accountTokenValidator)
    return this.respond(ctx, await rejectSignup(token))
  }

  private respond({ response }: HttpContext, result: DecisionResult) {
    if (result.ok) {
      return { status: result.user.status, email: result.user.email }
    }
    if (result.reason === 'already_decided') {
      return response.conflict({
        errors: [{ code: 'ALREADY_DECIDED', message: 'Este cadastro já foi decidido.' }],
      })
    }
    return response.gone({ errors: [INVALID_TOKEN] })
  }
}
