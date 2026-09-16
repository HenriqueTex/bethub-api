import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'surebet_operations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.string('event').notNullable()
      table.text('notes').nullable()
      table.datetime('created_at')
      table.datetime('updated_at')

      table.index(['user_id'])
    })

    this.schema.alterTable('bets', (table) => {
      table
        .integer('surebet_operation_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('surebet_operations')
        .onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable('bets', (table) => {
      table.dropForeign(['surebet_operation_id'])
      table.dropColumn('surebet_operation_id')
    })
    this.schema.dropTable(this.tableName)
  }
}
