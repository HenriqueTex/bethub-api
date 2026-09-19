import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, ManyToMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Tipster from '#models/tipster'
import { toNumber } from '#models/casts'

export const COST_KINDS = ['one_time', 'monthly'] as const
export type CostKind = (typeof COST_KINDS)[number]

export default class Cost extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare description: string

  @column({ consume: toNumber })
  declare amount: number

  @column()
  declare kind: CostKind

  @column.date()
  declare startsOn: DateTime

  @column.date()
  declare endsOn: DateTime | null

  @column()
  declare notes: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @manyToMany(() => Tipster, { pivotTable: 'cost_tipster' })
  declare tipsters: ManyToMany<typeof Tipster>
}
