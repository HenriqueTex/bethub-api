import env from '#start/env'
import type User from '#models/user'
import type { MailMessage } from '#services/mail_service'

function webUrl(path: string, token: string) {
  const base = (env.get('WEB_URL') ?? 'http://localhost:3000').replace(/\/+$/, '')
  return `${base}${path}?token=${encodeURIComponent(token)}`
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function displayName(user: User) {
  return user.fullName?.trim() || user.email
}

function layout(title: string, body: string, action?: { label: string; url: string }) {
  const button = action
    ? `<p style="margin:28px 0"><a href="${escapeHtml(action.url)}" style="background:#16a34a;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">${escapeHtml(action.label)}</a></p>
<p style="font-size:12px;color:#6b7280">Se o botão não funcionar, copie e cole este endereço no navegador:<br><span style="word-break:break-all">${escapeHtml(action.url)}</span></p>`
    : ''
  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#111827">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px">
<h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(title)}</h1>
${body}
${button}
<p style="font-size:12px;color:#6b7280;margin-top:28px">Texas Bethub</p>
</div></body></html>`
}

export function newSignupForAdmin(user: User, approvalToken: string): MailMessage {
  const url = webUrl('/aprovar', approvalToken)
  const name = displayName(user)
  return {
    to: env.get('ADMIN_NOTIFY_EMAIL') ?? '',
    subject: `Novo cadastro pendente: ${name}`,
    html: layout(
      'Novo cadastro aguardando aprovação',
      `<p><strong>Nome:</strong> ${escapeHtml(user.fullName ?? '-')}<br><strong>E-mail:</strong> ${escapeHtml(user.email)}</p>
<p>Abra o link para aprovar ou rejeitar. Ele vale por 7 dias.</p>`,
      { label: 'Revisar cadastro', url }
    ),
    text: `Novo cadastro aguardando aprovação.\n\nNome: ${user.fullName ?? '-'}\nE-mail: ${user.email}\n\nAprovar ou rejeitar (válido por 7 dias):\n${url}\n`,
  }
}

export function activation(user: User, activationToken: string): MailMessage {
  const url = webUrl('/ativar', activationToken)
  const name = displayName(user)
  return {
    to: user.email,
    subject: 'Sua conta no Texas Bethub foi aprovada',
    html: layout(
      'Conta aprovada',
      `<p>Olá, ${escapeHtml(name)}.</p>
<p>Seu cadastro foi aprovado. Para começar a usar, confirme seu e-mail e ative a conta. O link vale por 48 horas e só pode ser usado uma vez.</p>`,
      { label: 'Ativar minha conta', url }
    ),
    text: `Olá, ${name}.\n\nSeu cadastro foi aprovado. Ative sua conta pelo link abaixo (válido por 48 horas, uso único):\n${url}\n`,
  }
}

export function signupRejected(user: User): MailMessage {
  const name = displayName(user)
  return {
    to: user.email,
    subject: 'Sobre seu cadastro no Texas Bethub',
    html: layout(
      'Cadastro não aprovado',
      `<p>Olá, ${escapeHtml(name)}.</p>
<p>Seu cadastro não foi aprovado neste momento. Se acredita que houve um engano, responda este e-mail.</p>`
    ),
    text: `Olá, ${name}.\n\nSeu cadastro não foi aprovado neste momento. Se acredita que houve um engano, responda este e-mail.\n`,
  }
}
