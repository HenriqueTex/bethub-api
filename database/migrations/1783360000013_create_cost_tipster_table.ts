import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'cost_tipster'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('cost_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('costs')
        .onDelete('CASCADE')
      table
        .integer('tipster_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('tipsters')
        .onDelete('CASCADE')

      table.unique(['cost_id', 'tipster_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
