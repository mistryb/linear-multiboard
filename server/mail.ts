import nodemailer from 'nodemailer'
import { env } from './env'

const transport = env.smtpUrl ? nodemailer.createTransport(env.smtpUrl) : null

export async function sendMagicLink(email: string, link: string): Promise<void> {
  if (!transport) {
    // No SMTP configured (local dev / single-user self-host): print the link.
    console.log(`[mail] SMTP_URL not set — sign-in link for ${email}:\n  ${link}`)
    return
  }
  await transport.sendMail({
    from: env.mailFrom,
    to: email,
    subject: 'Your Linear MultiBoard sign-in link',
    text: `Sign in to Linear MultiBoard:\n\n${link}\n\nThis link expires in 15 minutes. If you didn't request it, ignore this email.`,
    html: `<p>Sign in to Linear MultiBoard:</p>
<p><a href="${link}" style="display:inline-block;padding:10px 16px;background:#5e6ad2;color:#fff;border-radius:8px;text-decoration:none">Sign in</a></p>
<p style="color:#666;font-size:13px">This link expires in 15 minutes. If you didn't request it, ignore this email.</p>`,
  })
}
