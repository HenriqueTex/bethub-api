import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'account_transactions'

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
        .integer('bookmaker_account_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('bookmaker_accounts')
        .onDelete('CASCADE')
      table.enum('type', ['deposit', 'withdrawal']).notNullable()
      table.decimal('amount', 12, 2).notNullable()
      table.timestamp('occurred_at').notNullable()
      table.text('notes').nullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.index(['user_id'])
      table.index(['bookmaker_account_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
