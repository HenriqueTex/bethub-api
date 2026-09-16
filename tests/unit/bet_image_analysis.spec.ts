import { test } from '@japa/runner'
import { analysisSchema, parseAnalysis } from '#services/bet_analysis_contract'
import BetImageAnalysisService from '#services/bet_image_analysis_service'

test.group('Bet image analysis', () => {
  test('resposta inválida não é confundida com imagem sem aposta', ({ assert }) => {
    for (const value of ['invalid', 'null', '[]', '{"event":"A x B"}']) {
      assert.throws(() => parseAnalysis(value), 'A leitura retornou dados inválidos')
    }
    assert.isFalse(parseAnalysis('{"isBet":false,"odd":2}').isBet)
    assert.isNull(parseAnalysis('{"isBet":false,"odd":2}').odd)
  })

  test('valida valores e fuso sem inventar números', ({ assert }) => {
    const result = parseAnalysis(
      JSON.stringify({
        isBet: true,
        odd: '1,95',
        stakeAmount: -1,
        placedAt: '2026-09-16T15:00:00',
        notes: 'Explicação automática',
      })
    )
    assert.isNull(result.odd)
    assert.isNull(result.stakeAmount)
    assert.isNull(result.placedAt)
    assert.isNull(result.notes)
    assert.lengthOf(result.warnings, 3)
    const valid = parseAnalysis(
      '{"isBet":true,"odd":1.95,"stakeAmount":100,"placedAt":"2026-09-16T15:00:00-03:00"}'
    )
    assert.equal(valid.stakeAmount, 100)
    assert.equal(valid.placedAt, '2026-09-16T18:00:00.000Z')
  })

  test('schema de Punter não exige pernas de surebet', ({ assert }) => {
    assert.notInclude(analysisSchema('punter').required, 'legs')
    assert.include(analysisSchema('surebet').required, 'legs')
  })

  test('cache e requisições simultâneas são isolados por usuário e modo', async ({
    assert,
    cleanup,
  }) => {
    const originalFetch = globalThis.fetch
    cleanup(() => {
      globalThis.fetch = originalFetch
    })
    let calls = 0
    globalThis.fetch = async (_url, options) => {
      calls++
      const body = JSON.parse(String(options?.body))
      assert.equal(body.generationConfig.responseMimeType, 'application/json')
      assert.exists(options?.signal)
      return new Response(
        JSON.stringify({
          candidates: [
            {
              finishReason: 'STOP',
              content: { parts: [{ text: '{"isBet":true,"odd":2,"stakeAmount":100}' }] },
            },
          ],
          modelVersion: 'test-model',
          usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 30 },
        }),
        { status: 200 }
      )
    }
    const service = new BetImageAnalysisService({
      apiKey: 'test-only',
      model: 'gemini-3.1-flash-lite',
    })
    const options = { userId: 9101, contextText: 'cache test ' + Date.now() }
    const [first, duplicate] = await Promise.all([
      service.analyzeImage(options),
      service.analyzeImage(options),
    ])
    assert.equal(calls, 1)
    assert.equal(first.metadata.inputTokens, 100)
    assert.isTrue(duplicate.metadata.cacheHit)
    const cached = await service.analyzeImage(options)
    assert.isTrue(cached.metadata.cacheHit)
    await service.analyzeImage({ ...options, userId: 9102 })
    await service.analyzeImage({ ...options, mode: 'surebet' })
    assert.equal(calls, 3)
  })

  test('não guarda resultado incompleto no cache', async ({ assert, cleanup }) => {
    const originalFetch = globalThis.fetch
    cleanup(() => {
      globalThis.fetch = originalFetch
    })
    let calls = 0
    globalThis.fetch = async () => {
      calls++
      return new Response(
        JSON.stringify({
          candidates: [
            { finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"isBet":true}' }] } },
          ],
        })
      )
    }
    const service = new BetImageAnalysisService({ apiKey: 'test-only' })
    const options = { userId: 9103, contextText: 'incomplete test' }
    await assert.rejects(() => service.analyzeImage(options), /A leitura ficou incompleta/)
    await assert.rejects(() => service.analyzeImage(options), /A leitura ficou incompleta/)
    assert.equal(calls, 2)
  })
})
