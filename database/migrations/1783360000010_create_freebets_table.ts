import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('bets', (table) => {
      table.boolean('is_freebet').notNullable().defaultTo(false)
      table.boolean('generates_freebet').notNullable().defaultTo(false)
      table.decimal('freebet_value', 12, 2).nullable()
      table.decimal('freebet_extraction', 5, 2).nullable()
      table.enum('freebet_trigger', ['on_loss', 'on_win', 'always']).nullable()
    })

    this.schema.createTable('freebets', (table) => {
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
      table
        .integer('source_bet_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('bets')
        .onDelete('SET NULL')
      table.decimal('value', 12, 2).notNullable()
      table.decimal('extraction_rate', 5, 2).notNullable()
      table.decimal('extracted_value', 12, 2).notNullable()
      table.enum('trigger', ['on_loss', 'on_win', 'always']).notNullable()
      table.enum('status', ['pending', 'extracted', 'discarded']).notNullable().defaultTo('pending')
      table.datetime('created_at')
      table.datetime('resolved_at').nullable()

      table.index(['user_id'])
      table.index(['bookmaker_account_id'])
      table.index(['source_bet_id'])
      table.index(['status'])
    })
  }

  async down() {
    this.schema.dropTable('freebets')
    this.schema.alterTable('bets', (table) => {
      table.dropColumn('is_freebet')
      table.dropColumn('generates_freebet')
      table.dropColumn('freebet_value')
      table.dropColumn('freebet_extraction')
      table.dropColumn('freebet_trigger')
    })
  }
}
