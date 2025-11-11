import * as sgMail from '@sendgrid/mail'
import { createLogger } from '../lib/logger'
import * as crypto from 'crypto'

const logger = createLogger()

// Initialize SendGrid with CJS/ESM interop and safety for missing keys
const mail: any = (sgMail as any)?.default ?? (sgMail as any)
try {
    if (process.env.SENDGRID_API_KEY) {
        if (typeof mail.setApiKey === 'function') {
            mail.setApiKey(process.env.SENDGRID_API_KEY)
        }
    }
} catch (err) {
    // Don't crash on startup if SendGrid init fails; log only
    createLogger().warn('SendGrid initialization warning:', err)
}

interface EmailVerificationData {
    email: string
    name?: string
    verificationUrl: string
}

interface WelcomeEmailData {
    email: string
    name?: string
    tier: string
}

export class EmailService {
    private static instance: EmailService
    private fromEmail: string
    private verificationTemplateId: string
    private welcomeTemplateId: string
    private baseUrl: string

    constructor() {
        this.fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@volspike.com'
        this.verificationTemplateId = process.env.SENDGRID_VERIFICATION_TEMPLATE_ID || ''
        this.welcomeTemplateId = process.env.SENDGRID_WELCOME_TEMPLATE_ID || ''
        this.baseUrl = process.env.EMAIL_VERIFICATION_URL_BASE || 'http://localhost:3000'
    }

    /**
     * Send password reset email with secure one-time token
     */
    async sendPasswordResetEmail(data: { email: string; resetUrl: string }): Promise<boolean> {
        try {
            if (!process.env.SENDGRID_API_KEY) {
                logger.error('SENDGRID_API_KEY is not set in environment variables')
                return false
            }
            const safeUrl = data.resetUrl.replace(/"/g, '&quot;')
            const html = `
<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Reset your VolSpike password</title></head>
<body style="margin:0;padding:0;background:#0f172a;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;">
    <tr><td align="center" style="padding:24px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#111827;border-radius:12px;">
        <tr><td align="center" style="padding:28px;background:#059669;border-radius:12px 12px 0 0;">
          <img src="https://volspike.com/email/volspike-badge@2x.png" width="72" height="72" alt="VolSpike" style="display:block;border:0;">
          <div style="margin-top:12px;font-weight:700;font-size:22px;color:#fff;">Password Reset</div>
        </td></tr>
        <tr><td style="padding:28px;">
          <p style="margin:0 0 16px;">We received a request to reset the password for your VolSpike account.</p>
          <p style="margin:0 0 16px;">Click the button below to choose a new password. This link expires in 60 minutes.</p>
          <div style="text-align:center;margin:20px 0;">
            <a href="${safeUrl}" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Reset Password</a>
          </div>
          <p style="margin:16px 0 8px;">If the button doesn’t work, copy and paste this link:</p>
          <p style="margin:0;word-break:break-all;font:14px/1.6 SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace;color:#93c5fd">${data.resetUrl}</p>
          <p style="margin:24px 0 0;color:#9ca3af;font-size:14px;">If you didn’t request this, you can safely ignore this email.</p>
        </td></tr>
        <tr><td align="center" style="padding:16px;background:#0b1220;border-top:1px solid #1f2937;border-radius:0 0 12px 12px;">
          <div style="font-size:13px;color:#9ca3af;">© ${new Date().getFullYear()} VolSpike • Need help? <a href="mailto:support@volspike.com" style="color:#10b981;text-decoration:none;">support@volspike.com</a></div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
            const msg: any = {
                to: data.email,
                from: { email: this.fromEmail, name: 'VolSpike Team' },
                subject: 'Reset your VolSpike password',
                html,
                text: `Reset your password: ${data.resetUrl}`
            }
            await mail.send(msg)
            logger.info(`Password reset email sent to ${data.email}`)
            return true
        } catch (error) {
            logger.error('Failed to send password reset email:', error)
            return false
        }
    }

    static getInstance(): EmailService {
        if (!EmailService.instance) {
            EmailService.instance = new EmailService()
        }
        return EmailService.instance
    }

    /**
     * Generate a secure verification token
     */
    generateVerificationToken(): string {
        return crypto.randomBytes(32).toString('hex')
    }

    /**
     * Send email verification email
     */
    async sendVerificationEmail(data: EmailVerificationData): Promise<boolean> {
        try {
            // Check if SendGrid is configured
            if (!process.env.SENDGRID_API_KEY) {
                logger.error('SENDGRID_API_KEY is not set in environment variables')
                return false
            }

            if (!this.fromEmail || this.fromEmail === 'noreply@volspike.com' && !process.env.SENDGRID_FROM_EMAIL) {
                logger.warn(`SendGrid from email may not be verified: ${this.fromEmail}`)
            }

            const msg: any = {
                to: data.email,
                from: {
                    email: this.fromEmail,
                    name: 'VolSpike Team'
                },
                // Fallback HTML/text are always included
                html: this.getVerificationEmailHTML(data),
                text: this.getVerificationEmailText(data),
                subject: 'Verify Your Email - VolSpike'
            }

            // Only include templateId if it's configured
            if (this.verificationTemplateId) {
                msg.templateId = this.verificationTemplateId
                msg.dynamicTemplateData = {
                    first_name: data.name || data.email.split('@')[0],
                    verification_url: data.verificationUrl,
                    support_email: 'support@volspike.com',
                    company_name: 'VolSpike'
                }
            }

            logger.info(`Attempting to send verification email to ${data.email} from ${this.fromEmail}`)
            
            const response = await mail.send(msg)
            
            // Log SendGrid response for debugging
            logger.info(`SendGrid response for ${data.email}:`, {
                statusCode: response[0]?.statusCode,
                headers: response[0]?.headers,
                body: response[0]?.body
            })

            logger.info(`✅ Verification email sent successfully to ${data.email}`)
            return true
        } catch (error: any) {
            // Detailed error logging
            logger.error('❌ Failed to send verification email:', {
                email: data.email,
                fromEmail: this.fromEmail,
                error: error?.message || error,
                response: error?.response?.body || error?.response,
                code: error?.code,
                stack: error?.stack
            })

            // Check for specific SendGrid errors
            if (error?.response?.body) {
                const sendgridError = error.response.body
                logger.error('SendGrid API Error Details:', {
                    errors: sendgridError.errors,
                    message: sendgridError.message
                })
            }

            return false
        }
    }

    /**
     * Send welcome email after successful verification
     */
    async sendWelcomeEmail(data: WelcomeEmailData): Promise<boolean> {
        try {
            const msg = {
                to: data.email,
                from: {
                    email: this.fromEmail,
                    name: 'VolSpike Team'
                },
                templateId: this.welcomeTemplateId,
                dynamicTemplateData: {
                    first_name: data.name || data.email.split('@')[0],
                    tier: data.tier,
                    dashboard_url: `${this.baseUrl}/dashboard`,
                    support_email: 'support@volspike.com',
                    company_name: 'VolSpike'
                },
                // Fallback HTML if template is not available
                html: this.getWelcomeEmailHTML(data),
                text: this.getWelcomeEmailText(data)
            }

            await mail.send(msg)
            logger.info(`Welcome email sent to ${data.email}`)
            return true
        } catch (error) {
            logger.error('Failed to send welcome email:', error)
            return false
        }
    }

    /**
     * Fallback HTML template for verification email
     * Optimized for deliverability, responsiveness, and compatibility across all email clients
     */
    private getVerificationEmailHTML(data: EmailVerificationData): string {
        // Escape HTML to prevent XSS
        const safeName = (data.name || 'there').replace(/[<>]/g, '')
        const safeUrl = data.verificationUrl.replace(/"/g, '&quot;')

        return `
<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title>Verify your VolSpike email</title>
  <style>
    img { -ms-interpolation-mode:bicubic; }
    @media only screen and (max-width:600px){ .container{ width:100% !important; } }
  </style>
  <!--[if mso]>
  <style type="text/css"> body, table, td {font-family: Arial, sans-serif !important;} </style>
  <![endif]-->
  </head>
  <body style="margin:0;padding:0;background:#f1f5f9;">
  <div style="display:none;font-size:1px;color:#fff;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    Verify your email to start using VolSpike. Link expires in 24 hours.
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;">
    <tr><td align="center" style="padding:24px;">
      <table role="presentation" width="600" class="container" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:12px;">
        <tr>
          <td align="center" style="padding:32px;background:#0ea371;border-radius:12px 12px 0 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:12px;">
                  <img src="https://volspike.com/email/volspike-badge@2x.png" width="80" height="80" alt="VolSpike" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;height:80px;width:80px;line-height:100%;-ms-interpolation-mode:bicubic;">
                </td>
              </tr>
            </table>
            <div style="font:700 24px/1.2 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#fff;">Welcome to VolSpike!</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;font:400 16px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#334155;">
            <div style="font:600 20px/1.3 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;margin:0 0 12px;">Verify your email</div>
            <p style="margin:0 0 20px;">Hi ${safeName},</p>
            <p style="margin:0 0 24px;">Click the button below to confirm your email. This link expires in 24 hours.</p>
            <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto;">
              <tr><td align="center">
                <!--[if mso]>
                <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${safeUrl}"
                  style="height:48px;v-text-anchor:middle;width:280px;" arcsize="10%" stroke="f" fillcolor="#059669">
                  <w:anchorlock/>
                  <center style="color:#ffffff;font-family:Arial, sans-serif;font-size:16px;font-weight:bold;">
                    Verify Email Address
                  </center>
                </v:roundrect>
                <![endif]-->
                <!--[if !mso]><!-- -->
                <a href="${safeUrl}" target="_blank" style="display:block;background-color:#059669;color:#ffffff;text-decoration:none;padding:16px 32px;border-radius:8px;font-weight:600;font-size:16px;line-height:20px;text-align:center;">
                  Verify Email Address
                </a>
                <!--<![endif]-->
              </td></tr>
            </table>
            <p style="margin:24px 0 8px;">Or copy and paste this link:</p>
            <p style="margin:0;word-break:break-all;font:14px/1.6 SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace;">${data.verificationUrl}</p>
            <p style="margin:24px 0 0;color:#64748b;font-size:14px;">Didn’t request this? You can ignore this email.</p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:20px;background:#f8fafc;border-top:1px solid #e2e8f0;border-radius:0 0 12px 12px;">
            <div style="font:14px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#64748b;">© ${new Date().getFullYear()} VolSpike • Need help? <a href="mailto:support@volspike.com" style="color:#059669;text-decoration:none;">support@volspike.com</a></div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
  </body>
  </html>
        `
    }

    /**
     * Fallback text template for verification email
     */
    private getVerificationEmailText(data: EmailVerificationData): string {
        return `Verify your email for VolSpike: ${data.verificationUrl}`
    }

    /**
     * Fallback HTML template for welcome email
     */
    private getWelcomeEmailHTML(data: WelcomeEmailData): string {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to VolSpike!</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #0f172a; color: #e2e8f0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { width: 60px; height: 60px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; }
        .logo-text { color: white; font-weight: bold; font-size: 24px; }
        .content { background: #1e293b; border-radius: 12px; padding: 30px; margin-bottom: 20px; }
        .button { display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
        .footer { text-align: center; color: #64748b; font-size: 14px; }
        .highlight { color: #10b981; font-weight: 600; }
        .tier-badge { display: inline-block; background: #334155; color: #10b981; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">
                <div class="logo-text">⚡</div>
            </div>
            <h1>Welcome to VolSpike!</h1>
        </div>
        
        <div class="content">
            <h2>Your Account is Ready</h2>
            <p>Hi ${data.name || 'there'},</p>
            <p>🎉 <strong>Congratulations!</strong> Your email has been verified and your VolSpike account is now active.</p>
            
            <div style="text-align: center; margin: 20px 0;">
                <span class="tier-badge">${data.tier} Tier</span>
            </div>
            
            <p>You can now:</p>
            <ul>
                <li>📊 Track real-time volume spikes on Binance Perpetual Futures</li>
                <li>🔔 Set up custom alerts for your favorite trading pairs</li>
                <li>📈 Monitor market data with our advanced dashboard</li>
                <li>⚡ Get instant notifications when volume spikes occur</li>
            </ul>
            
            <div style="text-align: center;">
                <a href="${this.baseUrl}" class="button">Start Trading</a>
            </div>
            
            <p><strong>Pro Tip:</strong> Upgrade to Pro or Elite tier to unlock advanced features like email alerts, SMS notifications, and faster refresh rates!</p>
        </div>
        
        <div class="footer">
            <p>© 2024 VolSpike. All rights reserved.</p>
            <p>Need help? Contact us at <a href="mailto:support@volspike.com" style="color: #10b981;">support@volspike.com</a></p>
        </div>
    </div>
</body>
</html>
        `
    }

    /**
     * Fallback text template for welcome email
     */
    private getWelcomeEmailText(data: WelcomeEmailData): string {
        return `
Welcome to VolSpike!

Hi ${data.name || 'there'},

🎉 Congratulations! Your email has been verified and your VolSpike account is now active.

Your account tier: ${data.tier.toUpperCase()}

You can now:
- Track real-time volume spikes on Binance Perpetual Futures
- Set up custom alerts for your favorite trading pairs
- Monitor market data with our advanced dashboard
- Get instant notifications when volume spikes occur

Start trading: ${this.baseUrl}

Pro Tip: Upgrade to Pro or Elite tier to unlock advanced features like email alerts, SMS notifications, and faster refresh rates!

Need help? Contact us at support@volspike.com

© 2024 VolSpike. All rights reserved.
        `
    }
}

export default EmailService
