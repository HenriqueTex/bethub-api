import type { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'
import User from '#models/user'
import { loginValidator, registerValidator } from '#validators/auth'
import { seedDefaultMarkets } from '#services/default_markets_service'
import { seedDefaultMethods } from '#services/default_methods_service'

const DEV_USER_EMAIL = 'dev@bethub.local'

export default class AuthController {
  async register({ request, response }: HttpContext) {
    const data = await request.validateUsing(registerValidator)

    const existing = await User.findBy('email', data.email)
    if (existing) {
      return response.conflict({
        errors: [{ field: 'email', message: 'Este e-mail já está cadastrado' }],
      })
    }

    const user = await User.create(data)
    await seedDefaultMarkets(user.id)
    await seedDefaultMethods(user.id)
    const token = await User.accessTokens.create(user)

    return response.created({
      user,
      token: {
        type: 'bearer',
        value: token.value!.release(),
        expiresAt: token.expiresAt,
      },
    })
  }

  async login({ request }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)

    const user = await User.verifyCredentials(email, password)
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
      await seedDefaultMarkets(user.id)
      await seedDefaultMethods(user.id)
    }

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

  async me({ auth }: HttpContext) {
    return { user: auth.user }
  }

  async logout({ auth, response }: HttpContext) {
    const user = auth.user!
    await User.accessTokens.delete(user, user.currentAccessToken.identifier)
    return response.noContent()
  }
}
