import { DateTime } from 'luxon'
import Game from '#models/game'
import { FootballDataProvider } from '#services/game_providers/football_data_provider'
import type { GameProvider } from '#services/game_providers/types'

/** Basta acrescentar um provedor aqui para uma nova fonte entrar na sincronização. */
export const GAME_PROVIDERS: GameProvider[] = [new FootballDataProvider()]

export const SYNC_DAYS_BACK = 3
export const SYNC_DAYS_AHEAD = 30

export function configuredProviders() {
  return GAME_PROVIDERS.filter((provider) => provider.isConfigured())
}

export async function syncGames() {
  const from = DateTime.now().minus({ days: SYNC_DAYS_BACK })
  const to = DateTime.now().plus({ days: SYNC_DAYS_AHEAD })
  const resultado: { provider: string; jogos: number; erro?: string }[] = []

  for (const provider of configuredProviders()) {
    try {
      const games = await provider.fetchGames({ from, to })

      for (const game of games) {
        await Game.updateOrCreate(
          { provider: provider.name, externalId: game.externalId },
          {
            provider: provider.name,
            externalId: game.externalId,
            sport: game.sport,
            competition: game.competition,
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            startsAt: game.startsAt,
          }
        )
      }

      resultado.push({ provider: provider.name, jogos: games.length })
    } catch (error) {
      resultado.push({
        provider: provider.name,
        jogos: 0,
        erro: error instanceof Error ? error.message : 'falha desconhecida',
      })
    }
  }

  // jogos antigos só ocupam espaço e poluem a busca
  await Game.query()
    .where('starts_at', '<', from.minus({ days: 7 }).toSQL())
    .delete()

  return resultado
}
