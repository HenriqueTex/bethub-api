import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class SyncGames extends BaseCommand {
  static commandName = 'games:sync'
  static description = 'Baixa a agenda de jogos dos provedores configurados'
  static options: CommandOptions = { startApp: true }

  async run() {
    const { syncGames, configuredProviders } = await import('#services/game_sync_service')

    if (configuredProviders().length === 0) {
      this.logger.warning('Nenhum provedor configurado — confira as variáveis de ambiente.')
      return
    }

    for (const linha of await syncGames()) {
      if (linha.erro) this.logger.error(`${linha.provider}: ${linha.erro}`)
      else this.logger.success(`${linha.provider}: ${linha.jogos} jogos`)
    }
  }
}
