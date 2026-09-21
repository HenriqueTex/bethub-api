import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'games'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('provider').notNullable()
      table.string('external_id').notNullable()
      table.string('sport').notNullable()
      table.string('competition').nullable()
      table.string('home_team').notNullable()
      table.string('away_team').notNullable()
      table.datetime('starts_at').notNullable()
      table.datetime('created_at')
      table.datetime('updated_at')

      table.unique(['provider', 'external_id'])
      table.index(['starts_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
