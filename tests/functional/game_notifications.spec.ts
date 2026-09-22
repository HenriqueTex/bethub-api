import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import webpush from 'web-push'
import env from '#start/env'
import User from '#models/user'
import Bet from '#models/bet'
import BetNotification from '#models/bet_notification'
import Bookmaker from '#models/bookmaker'
import BookmakerAccount from '#models/bookmaker_account'
import { notifyStartingGames } from '#services/game_notification_service'

let counter = 0

async function pendingBet(attrs: Partial<Bet> = {}) {
  counter += 1
  const user = await User.create({
    fullName: `Notify User ${counter}`,
    email: `notify-${counter}-${Math.random().toString(36).slice(2)}@test.com`,
    password: 'senha12345',
  })
  const bookmaker = await Bookmaker.create({
    userId: user.id,
    name: `Casa ${counter}`,
    active: true,
  })
  const account = await BookmakerAccount.create({
    userId: user.id,
    bookmakerId: bookmaker.id,
    active: true,
  })

  return Bet.create({
    userId: user.id,
    bookmakerAccountId: account.id,
    event: 'Grêmio x Cruzeiro',
    selection: 'Over 2.5',
    odd: 1.9,
    units: 1,
    unitValue: 100,
    stakeAmount: 100,
    result: 'pending',
    notificationsEnabled: true,
    placedAt: DateTime.now(),
    isFreebet: false,
    generatesFreebet: false,
    ...attrs,
  })
}

test.group('Notificação de jogos', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    const original = env.get('VAPID_PUBLIC_KEY')
    const originalPrivate = env.get('VAPID_PRIVATE_KEY')
    const chaves = webpush.generateVAPIDKeys()
    env.set('VAPID_PUBLIC_KEY', chaves.publicKey)
    env.set('VAPID_PRIVATE_KEY', chaves.privateKey)
    return () => {
      env.set('VAPID_PUBLIC_KEY', original ?? '')
      env.set('VAPID_PRIVATE_KEY', originalPrivate ?? '')
    }
  })

  test('não faz nada quando o push não está configurado', async ({ assert }) => {
    env.set('VAPID_PUBLIC_KEY', '')
    await pendingBet({ eventDate: DateTime.now().plus({ minutes: 2 }) })

    const resultado = await notifyStartingGames()

    assert.equal(resultado.avisos, 0)
    assert.isDefined(resultado.motivo)
    assert.lengthOf(await BetNotification.all(), 0)
  })

  test('avisa uma vez e não repete na execução seguinte', async ({ assert }) => {
    const bet = await pendingBet({ eventDate: DateTime.now().plus({ minutes: 2 }) })

    const primeira = await notifyStartingGames()
    assert.equal(primeira.avisos, 1)

    const segunda = await notifyStartingGames()
    assert.equal(segunda.avisos, 0)

    const registros = await BetNotification.query().where('bet_id', bet.id)
    assert.lengthOf(registros, 1)
    assert.equal(registros[0].kind, 'starting_soon')
  })

  test('o mesmo jogo rende aviso previo e depois aviso de inicio', async ({ assert }) => {
    const bet = await pendingBet({ eventDate: DateTime.now().plus({ minutes: 2 }) })

    await notifyStartingGames()
    await notifyStartingGames(DateTime.now().plus({ minutes: 4 }))

    const kinds = (await BetNotification.query().where('bet_id', bet.id).orderBy('id')).map(
      (registro) => registro.kind
    )
    assert.deepEqual(kinds, ['starting_soon', 'started'])
  })

  test('ignora aposta liquidada, sem data e com sino desligado', async ({ assert }) => {
    const soon = DateTime.now().plus({ minutes: 2 })
    await pendingBet({ eventDate: soon, result: 'green' })
    await pendingBet({ eventDate: null })
    await pendingBet({ eventDate: soon, notificationsEnabled: false })

    const resultado = await notifyStartingGames()

    assert.equal(resultado.avisos, 0)
  })

  test('ignora jogo antigo fora da janela', async ({ assert }) => {
    await pendingBet({ eventDate: DateTime.now().minus({ hours: 3 }) })

    const resultado = await notifyStartingGames()

    assert.equal(resultado.avisos, 0)
  })
})
