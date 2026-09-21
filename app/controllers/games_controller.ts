import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Game from '#models/game'

const LIST_DAYS_BACK = 3
const LIST_DAYS_AHEAD = 30

export default class GamesController {
  /**
   * Devolve a agenda inteira de uma vez: são poucas centenas de jogos e o cliente
   * cacheia, então a busca enquanto se digita não custa requisição nenhuma.
   */
  async index({ request }: HttpContext) {
    const qs = request.qs()
    const from =
      typeof qs.from === 'string' && qs.from
        ? DateTime.fromISO(qs.from)
        : DateTime.now().minus({ days: LIST_DAYS_BACK })
    const to =
      typeof qs.to === 'string' && qs.to
        ? DateTime.fromISO(qs.to)
        : DateTime.now().plus({ days: LIST_DAYS_AHEAD })

    const games = await Game.query()
      .where('starts_at', '>=', from.toSQL()!)
      .where('starts_at', '<=', to.toSQL()!)
      .orderBy('starts_at', 'asc')

    return games.map((game) => ({
      id: game.id,
      name: `${game.homeTeam} x ${game.awayTeam}`,
      sport: game.sport,
      competition: game.competition,
      startsAt: game.startsAt.toISO(),
    }))
  }
}
