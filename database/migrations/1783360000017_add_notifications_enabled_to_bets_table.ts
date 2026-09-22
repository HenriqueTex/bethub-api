import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'bets'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('notifications_enabled').notNullable().defaultTo(true)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('notifications_enabled')
    })
  }
}
