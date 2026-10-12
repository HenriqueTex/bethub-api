import nodemailer, { type Transporter } from 'nodemailer'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'

export type MailMessage = {
  to: string
  subject: string
  html: string
  text: string
}

/** Nos testes nada sai pela rede: as mensagens ficam aqui para inspeção. */
export const testOutbox: MailMessage[] = []

let transporter: Transporter | null = null

export function isMailConfigured() {
  return (
    !!env.get('SMTP_HOST') &&
    !!env.get('SMTP_USER') &&
    !!env.get('SMTP_PASS') &&
    !!env.get('MAIL_FROM')
  )
}

/**
 * Hostinger: 465 usa SSL direto; 587 começa em texto e sobe via STARTTLS,
 * por isso `secure` depende da porta.
 */
function getTransporter() {
  if (!transporter) {
    const port = env.get('SMTP_PORT') ?? 465
    transporter = nodemailer.createTransport({
      host: env.get('SMTP_HOST'),
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      auth: { user: env.get('SMTP_USER'), pass: env.get('SMTP_PASS') },
    })
  }
  return transporter
}

export async function sendMail(message: MailMessage) {
  if (app.inTest) {
    testOutbox.push(message)
    return
  }

  if (!message.to) {
    logger.warn({ subject: message.subject }, 'E-mail sem destinatário; confira ADMIN_NOTIFY_EMAIL')
    return
  }

  if (!isMailConfigured()) {
    logger.warn(
      { to: message.to, subject: message.subject },
      'SMTP não configurado; e-mail não enviado'
    )
    if (app.inDev) logger.info(`Conteúdo do e-mail não enviado:\n${message.text}`)
    return
  }

  await getTransporter().sendMail({
    from: env.get('MAIL_FROM'),
    replyTo: env.get('MAIL_REPLY_TO'),
    ...message,
  })
}

/**
 * Falha de SMTP não deve desfazer a ação do usuário (o cadastro, a aprovação):
 * registra o erro e segue, e o link pode ser reenviado depois.
 */
export async function sendMailSafely(message: MailMessage) {
  try {
    await sendMail(message)
    return true
  } catch (error) {
    logger.error({ err: error, to: message.to, subject: message.subject }, 'Falha ao enviar e-mail')
    return false
  }
}
