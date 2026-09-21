import { DateTime } from 'luxon'

export interface ProviderGame {
  externalId: string
  sport: string
  competition: string | null
  homeTeam: string
  awayTeam: string
  startsAt: DateTime
}

export interface GameProvider {
  /** Identifica a origem na tabela, para o upsert não misturar jogos de fontes diferentes. */
  readonly name: string
  isConfigured(): boolean
  fetchGames(options: { from: DateTime; to: DateTime }): Promise<ProviderGame[]>
}
