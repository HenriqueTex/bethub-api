import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import {
  classifyBet,
  notificationText,
  LOOKBACK_MINUTES,
  SOON_MINUTES,
  CRON_MINUTES,
} from '#services/bet_notification_rules'

const now = DateTime.fromISO('2026-09-22T20:00:00')

test.group('Bet notification rules', () => {
  test('aposta sem data do jogo nunca notifica', ({ assert }) => {
    assert.isNull(classifyBet(null, now))
  })

  test('jogo distante ainda não rende aviso', ({ assert }) => {
    assert.isNull(classifyBet(now.plus({ minutes: SOON_MINUTES + 1 }), now))
    assert.isNull(classifyBet(now.plus({ hours: 3 }), now))
  })

  test('jogo dentro da janela rende prestes a começar', ({ assert }) => {
    assert.equal(classifyBet(now.plus({ minutes: SOON_MINUTES }), now), 'starting_soon')
    assert.equal(classifyBet(now.plus({ minutes: 1 }), now), 'starting_soon')
    assert.equal(classifyBet(now.plus({ seconds: 30 }), now), 'starting_soon')
  })

  test('jogo já iniciado rende começou', ({ assert }) => {
    assert.equal(classifyBet(now, now), 'started')
    assert.equal(classifyBet(now.minus({ minutes: 1 }), now), 'started')
    assert.equal(classifyBet(now.minus({ minutes: LOOKBACK_MINUTES }), now), 'started')
  })

  test('jogo antigo não é ressuscitado', ({ assert }) => {
    assert.isNull(classifyBet(now.minus({ minutes: LOOKBACK_MINUTES + 1 }), now))
    assert.isNull(classifyBet(now.minus({ days: 2 }), now))
  })

  test('grade real do cron avisa todo jogo, sem depender de sorte no horário', ({ assert }) => {
    const grade = [0, 5, 10, 15, 20, 25, 30].map((m) => now.plus({ minutes: m }))

    for (let segundos = 1; segundos <= 20 * 60; segundos += 1) {
      const inicio = now.plus({ seconds: segundos })
      const vistos = grade.map((execucao) => classifyBet(inicio, execucao))

      assert.include(vistos, 'starting_soon', `sem aviso previo em +${segundos}s`)
      assert.include(vistos, 'started', `sem aviso de inicio em +${segundos}s`)
    }
  })

  test('janela para tras cobre o intervalo do cron e nao muito mais', ({ assert }) => {
    assert.isAtLeast(LOOKBACK_MINUTES, CRON_MINUTES)
    assert.isBelow(LOOKBACK_MINUTES, CRON_MINUTES * 2)
  })

  test('texto distingue os dois avisos', ({ assert }) => {
    const soon = notificationText('starting_soon', 'Grêmio x Cruzeiro', 'Over 2.5')
    const started = notificationText('started', 'Grêmio x Cruzeiro', 'Over 2.5')
    assert.equal(soon.title, 'Jogo prestes a começar')
    assert.equal(started.title, 'Seu jogo começou')
    assert.equal(soon.body, 'Grêmio x Cruzeiro — Over 2.5')
  })
})
