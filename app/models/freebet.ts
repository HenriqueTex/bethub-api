import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import BookmakerAccount from '#models/bookmaker_account'
import Bet from '#models/bet'
import type { FreebetTrigger } from '#models/bet'

export const FREEBET_STATUSES = ['pending', 'extracted', 'discarded'] as const

export type FreebetStatus = (typeof FREEBET_STATUSES)[number]

const toNumber = (value: unknown) => (value === null ? null : Number(value))

export default class Freebet extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare bookmakerAccountId: number

  @column()
  declare sourceBetId: number | null

  @column({ consume: toNumber })
  declare value: number

  @column({ consume: toNumber })
  declare extractionRate: number

  @column({ consume: toNumber })
  declare extractedValue: number

  @column()
  declare trigger: FreebetTrigger

  @column()
  declare status: FreebetStatus

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime()
  declare resolvedAt: DateTime | null

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => BookmakerAccount)
  declare account: BelongsTo<typeof BookmakerAccount>

  @belongsTo(() => Bet, { foreignKey: 'sourceBetId' })
  declare sourceBet: BelongsTo<typeof Bet>
}
