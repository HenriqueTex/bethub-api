import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import env from '#start/env'
import { FootballDataProvider } from '#services/game_providers/football_data_provider'

test.group('FootballDataProvider', () => {
  test('não faz requisição quando o token não está configurado', async ({ assert, cleanup }) => {
    const originalToken = env.get('FOOTBALL_DATA_TOKEN')
    const originalFetch = globalThis.fetch
    env.set('FOOTBALL_DATA_TOKEN', '')
    globalThis.fetch = async () => {
      throw new Error('A API externa não deveria ser chamada')
    }
    cleanup(() => {
      env.set('FOOTBALL_DATA_TOKEN', originalToken)
      globalThis.fetch = originalFetch
    })

    const games = await new FootballDataProvider().fetchGames({
      from: DateTime.fromISO('2026-09-01'),
      to: DateTime.fromISO('2026-09-02'),
    })

    assert.deepEqual(games, [])
  })

  test('varre o período em janelas de até dez dias e normaliza partidas válidas', async ({
    assert,
    cleanup,
  }) => {
    const originalToken = env.get('FOOTBALL_DATA_TOKEN')
    const originalFetch = globalThis.fetch
    const requests: URL[] = []
    env.set('FOOTBALL_DATA_TOKEN', 'token-de-teste')
    globalThis.fetch = async (input, init) => {
      requests.push(new URL(String(input)))
      assert.equal(new Headers(init?.headers).get('X-Auth-Token'), 'token-de-teste')
      return new Response(
        JSON.stringify({
          matches: [
            {
              id: requests.length,
              utcDate: '2026-09-10T20:00:00Z',
              competition: { name: 'Brasileirão' },
              homeTeam: { name: 'Clube Atlético Mineiro', shortName: 'Atlético-MG' },
              awayTeam: { name: 'Cruzeiro Esporte Clube', shortName: 'Cruzeiro' },
            },
            { id: 99, utcDate: '2026-09-10T20:00:00Z', homeTeam: { name: 'Incompleto' } },
          ],
        })
      )
    }
    cleanup(() => {
      env.set('FOOTBALL_DATA_TOKEN', originalToken)
      globalThis.fetch = originalFetch
    })

    const games = await new FootballDataProvider().fetchGames({
      from: DateTime.fromISO('2026-09-01'),
      to: DateTime.fromISO('2026-09-22'),
    })

    assert.lengthOf(requests, 3)
    assert.deepEqual(
      requests.map((request) => [
        request.searchParams.get('dateFrom'),
        request.searchParams.get('dateTo'),
      ]),
      [
        ['2026-09-01', '2026-09-10'],
        ['2026-09-11', '2026-09-20'],
        ['2026-09-21', '2026-09-22'],
      ]
    )
    assert.lengthOf(games, 3)
    assert.deepInclude(games[0], {
      externalId: '1',
      sport: 'Futebol',
      competition: 'Brasileirão',
      homeTeam: 'Atlético-MG',
      awayTeam: 'Cruzeiro',
    })
    assert.equal(games[0].startsAt.toUTC().toISO(), '2026-09-10T20:00:00.000Z')
  })

  test('expõe a falha da fonte sem retornar agenda parcial', async ({ assert, cleanup }) => {
    const originalToken = env.get('FOOTBALL_DATA_TOKEN')
    const originalFetch = globalThis.fetch
    env.set('FOOTBALL_DATA_TOKEN', 'token-de-teste')
    globalThis.fetch = async () => new Response('indisponível', { status: 503 })
    cleanup(() => {
      env.set('FOOTBALL_DATA_TOKEN', originalToken)
      globalThis.fetch = originalFetch
    })

    await assert.rejects(
      () =>
        new FootballDataProvider().fetchGames({
          from: DateTime.fromISO('2026-09-01'),
          to: DateTime.fromISO('2026-09-02'),
        }),
      /football-data respondeu 503: indisponível/
    )
  })
})
