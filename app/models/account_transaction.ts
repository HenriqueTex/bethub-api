import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import BookmakerAccount from '#models/bookmaker_account'

export type TransactionType = 'deposit' | 'withdrawal'

export default class AccountTransaction extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare bookmakerAccountId: number

  @column()
  declare type: TransactionType

  @column({ consume: (value) => Number(value) })
  declare amount: number

  @column.dateTime()
  declare occurredAt: DateTime

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
}
