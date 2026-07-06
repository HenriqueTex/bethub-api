import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'bookmaker_accounts'

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
      table
        .integer('bookmaker_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('bookmakers')
        .onDelete('CASCADE')
      table.string('label').nullable()
      table.text('notes').nullable()
      table.boolean('active').notNullable().defaultTo(true)
      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.index(['user_id'])
      table.index(['bookmaker_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
