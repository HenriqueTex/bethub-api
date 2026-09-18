import { randomUUID } from 'node:crypto'
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import env from '#start/env'

export const RECEIPT_URL_TTL_SECONDS = 300

export class ReceiptStorageNotConfiguredError extends Error {
  constructor() {
    super('A integração com o armazenamento de comprovantes não está configurada.')
  }
}

function config() {
  const endpoint = env.get('R2_ENDPOINT')
  const accessKeyId = env.get('R2_ACCESS_KEY_ID')
  const secretAccessKey = env.get('R2_SECRET_ACCESS_KEY')
  const bucket = env.get('R2_BUCKET')

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) return null

  return { endpoint, accessKeyId, secretAccessKey, bucket }
}

export function isReceiptStorageConfigured() {
  return config() !== null
}

function client(settings: NonNullable<ReturnType<typeof config>>) {
  return new S3Client({
    region: 'auto',
    endpoint: settings.endpoint,
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey,
    },
  })
}

function requireConfig() {
  const settings = config()
  if (!settings) throw new ReceiptStorageNotConfiguredError()
  return settings
}

export function buildReceiptKey(userId: number, extension: string) {
  return `receipts/${userId}/${randomUUID()}.${extension}`
}

/**
 * A chave carrega o dono no próprio caminho, então comparar o prefixo impede que um
 * usuário anexe à sua aposta o comprovante de outro.
 */
export function receiptKeyBelongsTo(key: string, userId: number) {
  return key.startsWith(`receipts/${userId}/`)
}

export async function uploadReceipt(options: {
  userId: number
  body: Buffer
  extension: string
  mimeType: string
}) {
  const settings = requireConfig()
  const key = buildReceiptKey(options.userId, options.extension)

  await client(settings).send(
    new PutObjectCommand({
      Bucket: settings.bucket,
      Key: key,
      Body: options.body,
      ContentType: options.mimeType,
    })
  )

  return key
}

export async function receiptUrl(key: string) {
  const settings = requireConfig()

  return getSignedUrl(
    client(settings),
    new GetObjectCommand({ Bucket: settings.bucket, Key: key }),
    { expiresIn: RECEIPT_URL_TTL_SECONDS }
  )
}

export async function deleteReceipt(key: string) {
  const settings = config()
  if (!settings) return

  await client(settings).send(new DeleteObjectCommand({ Bucket: settings.bucket, Key: key }))
}
