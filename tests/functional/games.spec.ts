import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import Game from '#models/game'
import { GAME_PROVIDERS, syncGames } from '#services/game_sync_service'
import type { GameProvider } from '#services/game_providers/types'

let counter = 0

async function authenticate(client: any) {
  counter += 1
  const response = await client.post('/auth/register').json({
    fullName: `Games User ${counter}`,
    email: `games-${counter}-${Math.random().toString(36).slice(2)}@test.com`,
    password: 'senha12345',
  })
  response.assertStatus(201)
  return response.body().token.value as string
}

test.group('Agenda de jogos', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('exige autenticação para consultar a agenda', async ({ client }) => {
    const response = await client.get('/games')
    response.assertStatus(401)
  })

  test('filtra o intervalo, ordena por início e devolve o formato público', async ({
    client,
    assert,
  }) => {
    const token = await authenticate(client)
    await Game.createMany([
      {
        provider: 'test',
        externalId: 'antes',
        sport: 'Futebol',
        competition: null,
        homeTeam: 'Fora',
        awayTeam: 'Intervalo',
        startsAt: DateTime.fromISO('2026-09-09T12:00:00Z'),
      },
      {
        provider: 'test',
        externalId: 'tarde',
        sport: 'Futebol',
        competition: 'Brasileirão',
        homeTeam: 'Atlético-MG',
        awayTeam: 'Cruzeiro',
        startsAt: DateTime.fromISO('2026-09-10T20:00:00Z'),
      },
      {
        provider: 'test',
        externalId: 'manha',
        sport: 'Futebol',
        competition: 'Brasileirão',
        homeTeam: 'Flamengo',
        awayTeam: 'Vasco',
        startsAt: DateTime.fromISO('2026-09-10T12:00:00Z'),
      },
      {
        provider: 'test',
        externalId: 'depois',
        sport: 'Futebol',
        competition: null,
        homeTeam: 'Depois',
        awayTeam: 'Intervalo',
        startsAt: DateTime.fromISO('2026-09-11T12:00:00Z'),
      },
    ])

    const response = await client
      .get('/games?from=2026-09-10T00:00:00Z&to=2026-09-10T23:59:59Z')
      .bearerToken(token)

    response.assertStatus(200)
    assert.deepEqual(
      response.body().map((game: { name: string }) => game.name),
      ['Flamengo x Vasco', 'Atlético-MG x Cruzeiro']
    )
    assert.deepInclude(response.body()[0], {
      sport: 'Futebol',
      competition: 'Brasileirão',
    })
    assert.equal(
      DateTime.fromISO(response.body()[0].startsAt).toMillis(),
      DateTime.fromISO('2026-09-10T12:00:00Z').toMillis()
    )
    assert.notProperty(response.body()[0], 'provider')
    assert.notProperty(response.body()[0], 'externalId')
  })

  test('sincroniza por provedor, atualiza jogos existentes, isola falhas e remove jogos antigos', async ({
    assert,
    cleanup,
  }) => {
    const originalProviders = [...GAME_PROVIDERS]
    const now = DateTime.now().toUTC()
    const existing = await Game.create({
      provider: 'fake',
      externalId: '42',
      sport: 'Antigo',
      competition: null,
      homeTeam: 'Casa antiga',
      awayTeam: 'Fora antiga',
      startsAt: now.plus({ days: 1 }),
    })
    await Game.create({
      provider: 'fake',
      externalId: 'old',
      sport: 'Futebol',
      competition: null,
      homeTeam: 'Jogo',
      awayTeam: 'Antigo',
      startsAt: now.minus({ days: 11 }),
    })
    const successfulProvider: GameProvider = {
      name: 'fake',
      isConfigured: () => true,
      fetchGames: async () => [
        {
          externalId: '42',
          sport: 'Futebol',
          competition: 'Brasileirão',
          homeTeam: 'Atlético-MG',
          awayTeam: 'Cruzeiro',
          startsAt: now.plus({ days: 2 }),
        },
      ],
    }
    const failingProvider: GameProvider = {
      name: 'broken',
      isConfigured: () => true,
      fetchGames: async () => {
        throw new Error('fonte indisponível')
      },
    }
    GAME_PROVIDERS.splice(0, GAME_PROVIDERS.length, successfulProvider, failingProvider)
    cleanup(() => {
      GAME_PROVIDERS.splice(0, GAME_PROVIDERS.length, ...originalProviders)
    })

    const result = await syncGames()

    assert.deepEqual(result, [
      { provider: 'fake', jogos: 1 },
      { provider: 'broken', jogos: 0, erro: 'fonte indisponível' },
    ])
    await existing.refresh()
    assert.equal(existing.homeTeam, 'Atlético-MG')
    assert.equal(existing.competition, 'Brasileirão')
    assert.isNull(await Game.findBy('externalId', 'old'))
  })
})
