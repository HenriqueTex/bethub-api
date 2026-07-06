import type { HttpContext } from '@adonisjs/core/http'
import { settingsValidator } from '#validators/catalog'

export default class SettingsController {
  async show({ auth }: HttpContext) {
    return { unitValue: auth.user!.unitValue }
  }

  async update({ auth, request }: HttpContext) {
    const { unitValue } = await request.validateUsing(settingsValidator)
    const user = auth.user!
    user.unitValue = unitValue
    await user.save()
    return { unitValue: user.unitValue }
  }
}
