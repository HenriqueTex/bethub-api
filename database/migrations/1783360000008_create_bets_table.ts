import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'bets'

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
        .onDelete('RESTRICT')
      table
        .integer('tipster_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('tipsters')
        .onDelete('SET NULL')
      table
        .integer('method_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('methods')
        .onDelete('SET NULL')
      table
        .integer('market_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('markets')
        .onDelete('SET NULL')
      table.string('event').notNullable()
      table.string('selection').notNullable()
      table.string('sport').nullable()
      table.string('competition').nullable()
      table.timestamp('event_date').nullable()
      table.decimal('odd', 8, 3).notNullable()
      table.decimal('units', 8, 2).notNullable()
      table.decimal('unit_value', 12, 2).notNullable()
      table.decimal('stake_amount', 12, 2).notNullable()
      table
        .enum('result', ['pending', 'green', 'red', 'half_green', 'half_red', 'void', 'cashout'])
        .notNullable()
        .defaultTo('pending')
      table.decimal('cashout_amount', 12, 2).nullable()
      table.decimal('profit_amount', 12, 2).nullable()
      table.timestamp('placed_at').notNullable()
      table.timestamp('settled_at').nullable()
      table.text('notes').nullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.index(['user_id'])
      table.index(['user_id', 'placed_at'])
      table.index(['bookmaker_account_id'])
      table.index(['result'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
