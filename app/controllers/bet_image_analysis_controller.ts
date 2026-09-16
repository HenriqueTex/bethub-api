import type { HttpContext } from '@adonisjs/core/http'
import fs from 'node:fs/promises'
import BetImageAnalysisService from '#services/bet_image_analysis_service'

const MIME_TYPES_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

export default class BetImageAnalysisController {
  async store({ request, response, auth }: HttpContext) {
    const image = request.file('image', {
      size: '10mb',
      extnames: Object.keys(MIME_TYPES_BY_EXTENSION),
    })

    const contextText = request.input('contextText')
    const mode = request.input('mode', 'punter')
    const timeZone = request.input('timeZone', 'America/Sao_Paulo')
    if (
      (contextText !== undefined &&
        contextText !== null &&
        (typeof contextText !== 'string' || contextText.length > 6000)) ||
      !['punter', 'surebet'].includes(mode)
    ) {
      if (image?.tmpPath) await this.cleanup(image.tmpPath)
      return response.badRequest({
        errors: [{ message: 'Verifique o texto (até 6.000 caracteres) e o tipo de aposta.' }],
      })
    }
    try {
      if (typeof timeZone !== 'string' || timeZone.length > 100) throw new Error('Invalid timezone')
      new Intl.DateTimeFormat('pt-BR', { timeZone })
    } catch {
      if (image?.tmpPath) await this.cleanup(image.tmpPath)
      return response.badRequest({ errors: [{ message: 'Fuso horário inválido.' }] })
    }
    if (!image && !contextText?.trim())
      return response.badRequest({
        errors: [{ message: 'Envie uma imagem ou o texto da aposta.' }],
      })

    if (image && !image.isValid) {
      if (image.tmpPath) await this.cleanup(image.tmpPath)
      return response.badRequest({ errors: image.errors })
    }

    if (image && !image.tmpPath) {
      return response.badRequest({
        errors: [{ message: 'Não foi possível processar o arquivo enviado.' }],
      })
    }

    const mimeType = image
      ? MIME_TYPES_BY_EXTENSION[String(image.extname).toLowerCase()]
      : undefined
    if (image && !mimeType) {
      await this.cleanup(image.tmpPath!)
      return response.badRequest({
        errors: [{ message: 'Formato de imagem não suportado. Use png, jpg, jpeg ou webp.' }],
      })
    }

    try {
      const service = new BetImageAnalysisService()
      return await service.analyzeImage({
        userId: auth.user!.id,
        filePath: image?.tmpPath,
        mimeType,
        contextText,
        mode,
        timeZone,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Não foi possível analisar a imagem enviada.'
      const status = message.includes('não está configurada') ? 503 : 502

      return response.status(status).send({
        errors: [{ message }],
      })
    } finally {
      if (image?.tmpPath) await this.cleanup(image.tmpPath)
    }
  }

  private async cleanup(path: string) {
    try {
      await fs.unlink(path)
    } catch {
      // Arquivo temporário pode já ter sido removido pelo runtime.
    }
  }
}
