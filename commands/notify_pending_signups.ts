import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class NotifyPendingSignups extends BaseCommand {
  static commandName = 'signups:notify-pending'
  static description = 'Reenvia ao admin o aviso de aprovação de todos os cadastros pendentes'
  static options: CommandOptions = { startApp: true }

  async run() {
    const { renotifyPendingSignups } = await import('#services/account_approval_service')

    const results = await renotifyPendingSignups()
    if (results.length === 0) {
      this.logger.info('Nenhum cadastro pendente.')
      return
    }

    for (const { email, sent } of results) {
      if (sent) this.logger.success(`Aviso reenviado: ${email}`)
      else this.logger.error(`Falha ao enviar o aviso de ${email} (veja o log de e-mail)`)
    }
  }
}
