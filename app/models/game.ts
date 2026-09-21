import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Game extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare provider: string

  @column()
  declare externalId: string

  @column()
  declare sport: string

  @column()
  declare competition: string | null

  @column()
  declare homeTeam: string

  @column()
  declare awayTeam: string

  @column.dateTime()
  declare startsAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
