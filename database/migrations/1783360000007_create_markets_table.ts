import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'markets'

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
      table.string('name').notNullable()
      table.string('normalized_name').notNullable()
      table.datetime('created_at')
      table.datetime('updated_at')

      table.unique(['user_id', 'normalized_name'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
