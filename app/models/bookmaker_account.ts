import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Bookmaker from '#models/bookmaker'
import AccountTransaction from '#models/account_transaction'

export default class BookmakerAccount extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare bookmakerId: number

  @column()
  declare label: string | null

  @column()
  declare notes: string | null

  @column()
  declare active: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Bookmaker)
  declare bookmaker: BelongsTo<typeof Bookmaker>

  @hasMany(() => AccountTransaction)
  declare transactions: HasMany<typeof AccountTransaction>
}
