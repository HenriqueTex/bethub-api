import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('status', 20).notNullable().defaultTo('pending')
      table.datetime('approved_at').nullable()
      table.datetime('email_verified_at').nullable()
    })

    /**
     * Quem já usava o sistema antes da aprovação manual continua entrando
     * normalmente; só cadastros novos passam pela fila.
     */
    this.defer(async (db) => {
      await db.from(this.tableName).update({ status: 'active' })
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('status')
      table.dropColumn('approved_at')
      table.dropColumn('email_verified_at')
    })
  }
}
