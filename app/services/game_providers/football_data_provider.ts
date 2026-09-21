import { DateTime } from 'luxon'
import env from '#start/env'
import type { GameProvider, ProviderGame } from '#services/game_providers/types'

const BASE_URL = 'https://api.football-data.org/v4'
const MAX_TENTATIVAS = 3
/** A API recusa intervalos maiores que isso, então o período é varrido em janelas. */
const MAX_DIAS_POR_CHAMADA = 10

const esperar = (segundos: number) =>
  new Promise((resolve) => setTimeout(resolve, Math.max(1, segundos) * 1000))

/**
 * O autor da API pede explicitamente que o cliente leia os cabeçalhos de throttling
 * em vez de só reagir ao 429: `x-requests-available-minute` diz quantas chamadas
 * restam na janela e `x-requestcounter-reset`, em quantos segundos ela vira.
 */
async function pedir(url: string, token: string, tentativa = 1): Promise<Response> {
  const response = await fetch(url, { headers: { 'X-Auth-Token': token } })
  const restantes = Number(response.headers.get('x-requests-available-minute') ?? '1')
  const reset = Number(response.headers.get('x-requestcounter-reset') ?? '60')

  if (response.status === 429 && tentativa < MAX_TENTATIVAS) {
    await esperar(reset)
    return pedir(url, token, tentativa + 1)
  }

  // sem chamadas sobrando, aguarda a janela virar antes de devolver o controle
  if (response.ok && restantes <= 0) await esperar(reset)

  return response
}

interface FootballDataMatch {
  id: number
  utcDate: string
  competition?: { name?: string }
  homeTeam?: { name?: string; shortName?: string }
  awayTeam?: { name?: string; shortName?: string }
}

/**
 * Um único GET cobre todas as competições do plano, então a sincronização diária
 * cabe folgada no limite de 10 requisições por minuto do tier gratuito.
 */
export class FootballDataProvider implements GameProvider {
  readonly name = 'football-data'

  isConfigured() {
    return !!env.get('FOOTBALL_DATA_TOKEN')
  }

  async fetchGames({ from, to }: { from: DateTime; to: DateTime }): Promise<ProviderGame[]> {
    const token = env.get('FOOTBALL_DATA_TOKEN')
    if (!token) return []

    const partidas: FootballDataMatch[] = []

    for (let inicio = from; inicio < to; inicio = inicio.plus({ days: MAX_DIAS_POR_CHAMADA })) {
      const fim = DateTime.min(inicio.plus({ days: MAX_DIAS_POR_CHAMADA - 1 }), to)
      const query = new URLSearchParams({
        dateFrom: inicio.toFormat('yyyy-MM-dd'),
        dateTo: fim.toFormat('yyyy-MM-dd'),
      })

      const response = await pedir(`${BASE_URL}/matches?${query}`, token)

      if (!response.ok) {
        const corpo = await response.text()
        throw new Error(`football-data respondeu ${response.status}: ${corpo.slice(0, 200)}`)
      }

      const payload = (await response.json()) as { matches?: FootballDataMatch[] }
      partidas.push(...(payload.matches ?? []))
    }

    return partidas
      .filter((match) => match.homeTeam?.name && match.awayTeam?.name && match.utcDate)
      .map((match) => ({
        externalId: String(match.id),
        sport: 'Futebol',
        competition: match.competition?.name ?? null,
        homeTeam: match.homeTeam!.shortName ?? match.homeTeam!.name!,
        awayTeam: match.awayTeam!.shortName ?? match.awayTeam!.name!,
        startsAt: DateTime.fromISO(match.utcDate, { zone: 'utc' }),
      }))
  }
}
