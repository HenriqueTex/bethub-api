import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'bet_notifications'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('bet_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('bets')
        .onDelete('CASCADE')
      table.string('kind').notNullable()
      table.datetime('created_at')
      table.datetime('updated_at')

      table.unique(['bet_id', 'kind'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
