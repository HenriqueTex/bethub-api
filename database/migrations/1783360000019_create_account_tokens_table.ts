import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'account_tokens'

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
      table.string('type', 20).notNullable()
      table.string('token_hash', 64).notNullable().unique()
      table.datetime('expires_at').notNullable()
      table.datetime('used_at').nullable()
      table.datetime('created_at')
      table.datetime('updated_at')

      table.index(['user_id', 'type'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
