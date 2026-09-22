import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class NotifyGames extends BaseCommand {
  static commandName = 'notifications:games'
  static description = 'Avisa sobre jogos de apostas pendentes que estão começando'
  static options: CommandOptions = { startApp: true }

  async run() {
    const { notifyStartingGames } = await import('#services/game_notification_service')
    const { avisos, enviados, motivo } = await notifyStartingGames()

    if (motivo) {
      this.logger.warning(motivo)
      return
    }

    this.logger.success(`${avisos} aviso(s), ${enviados} envio(s)`)
  }
}
