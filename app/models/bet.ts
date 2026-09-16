import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import BookmakerAccount from '#models/bookmaker_account'
import Tipster from '#models/tipster'
import Method from '#models/method'
import Market from '#models/market'

export const BET_RESULTS = [
  'pending',
  'green',
  'red',
  'half_green',
  'half_red',
  'void',
  'cashout',
] as const

export type BetResult = (typeof BET_RESULTS)[number]

export const FREEBET_TRIGGERS = ['on_loss', 'on_win', 'always'] as const

export type FreebetTrigger = (typeof FREEBET_TRIGGERS)[number]

const toNumber = (value: unknown) => (value === null ? null : Number(value))

export default class Bet extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare bookmakerAccountId: number

  @column()
  declare tipsterId: number | null

  @column()
  declare methodId: number | null

  @column()
  declare marketId: number | null

  @column()
  declare surebetOperationId: number | null

  @column()
  declare event: string

  @column()
  declare selection: string

  @column()
  declare sport: string | null

  @column()
  declare competition: string | null

  @column.dateTime()
  declare eventDate: DateTime | null

  @column({ consume: toNumber })
  declare odd: number

  @column({ consume: toNumber })
  declare units: number

  @column({ consume: toNumber })
  declare unitValue: number

  @column({ consume: toNumber })
  declare stakeAmount: number

  @column()
  declare result: BetResult

  @column({ consume: toNumber })
  declare cashoutAmount: number | null

  @column({ consume: toNumber })
  declare profitAmount: number | null

  @column()
  declare isFreebet: boolean

  @column()
  declare generatesFreebet: boolean

  @column({ consume: toNumber })
  declare freebetValue: number | null

  @column({ consume: toNumber })
  declare freebetExtraction: number | null

  @column()
  declare freebetTrigger: FreebetTrigger | null

  @column.dateTime()
  declare placedAt: DateTime

  @column.dateTime()
  declare settledAt: DateTime | null

  @column()
  declare notes: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => BookmakerAccount)
  declare account: BelongsTo<typeof BookmakerAccount>

  @belongsTo(() => Tipster)
  declare tipster: BelongsTo<typeof Tipster>

  @belongsTo(() => Method)
  declare method: BelongsTo<typeof Method>

  @belongsTo(() => Market)
  declare market: BelongsTo<typeof Market>
}
