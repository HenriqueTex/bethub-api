import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'costs'

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
      table.string('description').notNullable()
      table.decimal('amount', 12, 2).notNullable()
      table.enum('kind', ['one_time', 'monthly']).notNullable()
      table.date('starts_on').notNullable()
      table.date('ends_on').nullable()
      table.text('notes').nullable()
      table.datetime('created_at')
      table.datetime('updated_at')

      table.index(['user_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
