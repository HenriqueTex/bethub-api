import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export const BET_NOTIFICATION_KINDS = ['starting_soon', 'started'] as const

export type BetNotificationKind = (typeof BET_NOTIFICATION_KINDS)[number]

export default class BetNotification extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare betId: number

  @column()
  declare kind: BetNotificationKind

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
