import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Bookmaker from '#models/bookmaker'
import User from '#models/user'
import { DEFAULT_BOOKMAKERS } from '#services/default_bookmakers_service'

export default class extends BaseSeeder {
  async run() {
    const users = await User.all()

    for (const user of users) {
      const existing = await Bookmaker.query().where('user_id', user.id).select('name')
      const known = new Set(existing.map((bookmaker) => bookmaker.name))
      const missing = DEFAULT_BOOKMAKERS.filter((bookmaker) => !known.has(bookmaker.name))

      if (missing.length === 0) {
        continue
      }

      await Bookmaker.createMany(missing.map((bookmaker) => ({ userId: user.id, ...bookmaker })))
    }
  }
}
