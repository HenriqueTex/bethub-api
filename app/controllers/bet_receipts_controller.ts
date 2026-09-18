import type { HttpContext } from '@adonisjs/core/http'
import fs from 'node:fs/promises'
import Bet from '#models/bet'
import {
  ReceiptStorageNotConfiguredError,
  isReceiptStorageConfigured,
  receiptUrl,
  uploadReceipt,
} from '#services/receipt_storage_service'

const MIME_TYPES_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

export default class BetReceiptsController {
  async store({ request, response, auth }: HttpContext) {
    if (!isReceiptStorageConfigured()) {
      return response.serviceUnavailable({
        errors: [{ message: new ReceiptStorageNotConfiguredError().message }],
      })
    }

    const image = request.file('image', {
      size: '10mb',
      extnames: Object.keys(MIME_TYPES_BY_EXTENSION),
    })

    if (!image) {
      return response.badRequest({ errors: [{ message: 'Envie o comprovante.' }] })
    }

    if (!image.isValid) {
      if (image.tmpPath) await this.cleanup(image.tmpPath)
      return response.badRequest({ errors: image.errors })
    }

    const extension = String(image.extname).toLowerCase()
    const mimeType = MIME_TYPES_BY_EXTENSION[extension]

    if (!image.tmpPath || !mimeType) {
      if (image.tmpPath) await this.cleanup(image.tmpPath)
      return response.badRequest({
        errors: [{ message: 'Formato de imagem não suportado. Use png, jpg, jpeg ou webp.' }],
      })
    }

    try {
      const key = await uploadReceipt({
        userId: auth.user!.id,
        body: await fs.readFile(image.tmpPath),
        extension,
        mimeType,
      })

      return response.created({ receiptKey: key })
    } finally {
      await this.cleanup(image.tmpPath)
    }
  }

  async show({ auth, params, response }: HttpContext) {
    const bet = await Bet.query()
      .where('user_id', auth.user!.id)
      .where('id', params.id)
      .firstOrFail()

    if (!bet.receiptKey) {
      return response.notFound({ errors: [{ message: 'Esta aposta não tem comprovante.' }] })
    }

    try {
      return { url: await receiptUrl(bet.receiptKey) }
    } catch (error) {
      if (error instanceof ReceiptStorageNotConfiguredError) {
        return response.serviceUnavailable({ errors: [{ message: error.message }] })
      }
      throw error
    }
  }

  private async cleanup(path: string) {
    try {
      await fs.unlink(path)
    } catch {
      // arquivo temporário já removido
    }
  }
}
