import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import env from '#start/env'
import BetImageAnalysisService from '#services/bet_image_analysis_service'
import { parseAnalysis } from '#services/bet_analysis_contract'

test.group('Importação de aposta', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('exige autenticação', async ({ client }) => {
    const response = await client.post('/bets/analyze-image').json({ contextText: 'A x B' })
    response.assertStatus(401)
  })

  test('valida entrada e repassa texto com usuário e modo', async ({ client, assert, cleanup }) => {
    const registration = await client.post('/auth/register').json({
      fullName: 'Import test',
      email: `import-${Date.now()}@test.com`,
      password: 'senha12345',
    })
    registration.assertStatus(201)
    const token = registration.body().token.value
    const originalKey = env.get('GEMINI_API_KEY')
    env.set('GEMINI_API_KEY', 'test-only')
    const original = BetImageAnalysisService.prototype.analyzeImage
    const calls: Parameters<typeof original>[0][] = []
    cleanup(() => {
      BetImageAnalysisService.prototype.analyzeImage = original
      env.set('GEMINI_API_KEY', originalKey)
    })
    BetImageAnalysisService.prototype.analyzeImage = async (options) => {
      calls.push(options)
      return {
        ...parseAnalysis('{"isBet":true,"odd":2,"stakeAmount":100}'),
        metadata: {
          model: 'test',
          durationMs: 1,
          cacheHit: false,
          inputTokens: 10,
          outputTokens: 10,
          thinkingTokens: 0,
          attempts: 1,
        },
      }
    }
    for (const body of [
      {},
      { contextText: 'x'.repeat(6001) },
      { contextText: 'A', mode: 'invalid' },
      { contextText: 'A', timeZone: 'invalid' },
    ]) {
      const invalid = await client.post('/bets/analyze-image').bearerToken(token).json(body)
      invalid.assertStatus(400)
    }
    assert.lengthOf(calls, 0)
    const valid = await client
      .post('/bets/analyze-image')
      .bearerToken(token)
      .json({ contextText: 'A x B, odd 2, R$100', mode: 'punter', timeZone: 'America/Sao_Paulo' })
    valid.assertStatus(200)
    assert.equal(valid.body().stakeAmount, 100)
    assert.equal(calls[0].userId, registration.body().user.id)
    assert.equal(calls[0].mode, 'punter')
    assert.isUndefined(calls[0].filePath)
  })
})
