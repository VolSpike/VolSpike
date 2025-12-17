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

interface TierUpgradeEmailData {
    email: string
    name?: string
    newTier: string
    previousTier?: string
}

interface CryptoRenewalReminderData {
    email: string
    tier: string
    daysUntilExpiration: number
    expiresAt: Date
}

interface CryptoSubscriptionExpiredData {
    email: string
    tier: string
    expiresAt: Date
}

interface PaymentIssueAlertData {
    type: string
    details: Record<string, any>
}

interface PaymentConfirmationEmailData {
    email: string
    name?: string
    tier: string
    amountUsd: number
    payCurrency: string
    actuallyPaid: number | null
    actuallyPaidCurrency: string | null
    paymentId: string
    orderId: string
    expiresAt: Date
}

interface PartialPaymentEmailData {
    email: string
    name?: string
    tier: string
    requestedAmount: number
    actuallyPaid: number
    payCurrency: string
    shortfall: number
    shortfallPercent: string
    paymentId: string
    orderId: string
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
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title>Reset your VolSpike password</title>
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
    Reset your VolSpike password. This link expires in 60 minutes.
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
            <div style="font:700 24px/1.2 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#fff;">Password Reset</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;font:400 16px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#334155;">
            <p style="margin:0 0 20px;">We received a request to reset the password for your VolSpike account.</p>
            <p style="margin:0 0 24px;">Click the button below to choose a new password. This link expires in 60 minutes.</p>
            <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto;">
              <tr><td align="center">
                <!--[if mso]>
                <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${safeUrl}"
                  style="height:48px;v-text-anchor:middle;width:280px;" arcsize="10%" stroke="f" fillcolor="#059669">
                  <w:anchorlock/>
                  <center style="color:#ffffff;font-family:Arial, sans-serif;font-size:16px;font-weight:bold;">
                    Reset Password
                  </center>
                </v:roundrect>
                <![endif]-->
                <!--[if !mso]><!-- -->
                <a href="${safeUrl}" target="_blank" style="display:block;background-color:#059669;color:#ffffff;text-decoration:none;padding:16px 32px;border-radius:8px;font-weight:600;font-size:16px;line-height:20px;text-align:center;">
                  Reset Password
                </a>
                <!--<![endif]-->
              </td></tr>
            </table>
            <p style="margin:24px 0 8px;">If the button doesn't work, copy and paste this link:</p>
            <p style="margin:0;word-break:break-all;font:14px/1.6 SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace;">${data.resetUrl}</p>
            <p style="margin:24px 0 0;color:#64748b;font-size:14px;">If you didn't request this, you can safely ignore this email.</p>
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
</html>`
            const msg: any = {
                to: data.email,
                from: { email: this.fromEmail, name: 'VolSpike Team' },
                replyTo: 'support@volspike.com',
                subject: 'Reset your VolSpike password',
                html,
                text: `Reset your VolSpike password\n\nWe received a request to reset the password for your VolSpike account.\n\nClick this link to choose a new password (expires in 60 minutes):\n${data.resetUrl}\n\nIf you didn't request this, you can safely ignore this email.\n\nNeed help? Contact us at support@volspike.com\n\n© ${new Date().getFullYear()} VolSpike`,
                categories: ['password-reset'],
                customArgs: {
                    type: 'password-reset',
                    timestamp: Date.now().toString()
                }
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

    /**
     * Send tier upgrade/downgrade confirmation email
     */
    async sendTierUpgradeEmail(data: TierUpgradeEmailData): Promise<boolean> {
        try {
            if (!process.env.SENDGRID_API_KEY) {
                logger.error('SENDGRID_API_KEY is not set in environment variables')
                return false
            }

            const isUpgrade = !data.previousTier || 
                (data.previousTier === 'free' && data.newTier !== 'free') ||
                (data.previousTier === 'pro' && data.newTier === 'elite')

            const tierName = data.newTier.toUpperCase()
            const subject = isUpgrade 
                ? `🎉 Welcome to ${tierName} Tier - VolSpike`
                : `Your VolSpike subscription has been updated to ${tierName} Tier`

            const msg: any = {
                to: data.email,
                from: {
                    email: this.fromEmail,
                    name: 'VolSpike Team'
                },
                replyTo: 'support@volspike.com',
                subject: subject,
                html: this.getTierUpgradeEmailHTML(data, isUpgrade),
                text: this.getTierUpgradeEmailText(data, isUpgrade),
                categories: ['tier-upgrade'],
                customArgs: {
                    type: 'tier-upgrade',
                    tier: data.newTier,
                    timestamp: Date.now().toString()
                }
            }

            await mail.send(msg)
            logger.info(`Tier upgrade email sent to ${data.email} (${data.previousTier || 'unknown'} → ${data.newTier})`)
            return true
        } catch (error) {
            logger.error('Failed to send tier upgrade email:', error)
            return false
        }
    }

    /**
     * Send beautiful payment confirmation email to user
     */
    async sendPaymentConfirmationEmail(data: PaymentConfirmationEmailData): Promise<boolean> {
        try {
            if (!process.env.SENDGRID_API_KEY) {
                logger.error('SENDGRID_API_KEY is not set in environment variables')
                return false
            }

            const tierName = data.tier.toUpperCase()
            const subject = `✅ Payment Confirmed - Welcome to ${tierName} Tier!`
            const dashboardUrl = `${this.baseUrl}/dashboard`
            const safeDashboardUrl = dashboardUrl.replace(/"/g, '&quot;')

            const msg: any = {
                to: data.email,
                from: {
                    email: this.fromEmail,
                    name: 'VolSpike Team'
                },
                replyTo: 'support@volspike.com',
                subject: subject,
                html: this.getPaymentConfirmationEmailHTML(data, safeDashboardUrl),
                text: this.getPaymentConfirmationEmailText(data, dashboardUrl),
                categories: ['payment-confirmation'],
                customArgs: {
                    type: 'payment-confirmation',
                    tier: data.tier,
                    paymentId: data.paymentId,
                    timestamp: Date.now().toString()
                }
            }

            await mail.send(msg)
            logger.info(`Payment confirmation email sent to ${data.email} (${tierName} tier)`)
            return true
        } catch (error) {
            logger.error('Failed to send payment confirmation email:', error)
            return false
        }
    }

    /**
     * HTML template for payment confirmation email
     */
    private getPaymentConfirmationEmailHTML(data: PaymentConfirmationEmailData, safeDashboardUrl: string): string {
        const safeName = (data.name || 'there').replace(/[<>]/g, '')
        const tierName = data.tier.toUpperCase()
        const amountDisplay = data.actuallyPaid 
            ? `${data.actuallyPaid} ${data.actuallyPaidCurrency || data.payCurrency.toUpperCase()}`
            : `${data.amountUsd} USD`
        const expiresDate = new Date(data.expiresAt).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        })

        return `
<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title>Payment Confirmed - Welcome to ${tierName} Tier!</title>
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
    Your payment has been confirmed! Welcome to ${tierName} Tier. Your subscription is active until ${expiresDate}.
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
            <div style="font:700 24px/1.2 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#fff;">Payment Confirmed</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;font:400 16px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#334155;">
            <p style="margin:0 0 20px;">Hi ${safeName},</p>
            <p style="margin:0 0 24px;">Great news! Your payment has been successfully processed and confirmed. Your <strong style="color:#0f172a;">${tierName} Tier</strong> subscription is now active.</p>
            
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:24px 0;">
              <div style="font:600 16px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;margin:0 0 16px;">Payment Details:</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font:14px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#334155;">
                <tr>
                  <td style="padding:8px 0;color:#64748b;">Amount Paid:</td>
                  <td align="right" style="padding:8px 0;font-weight:600;color:#0f172a;">${amountDisplay}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#64748b;">Subscription Tier:</td>
                  <td align="right" style="padding:8px 0;font-weight:600;color:#0ea371;">${tierName}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#64748b;">Valid Until:</td>
                  <td align="right" style="padding:8px 0;font-weight:600;color:#0f172a;">${expiresDate}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#64748b;">Payment ID:</td>
                  <td align="right" style="padding:8px 0;font-family:monospace;font-size:12px;color:#64748b;">${data.paymentId.slice(-8)}</td>
                </tr>
              </table>
            </div>

            <div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:20px;margin:24px 0;border-radius:4px;">
              <div style="font:600 18px/1.3 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;margin:0 0 12px;">🎉 What's Next?</div>
              <p style="margin:0;color:#334155;">Your ${tierName} Tier features are now unlocked! Access real-time market data, advanced analytics, and premium alerts.</p>
            </div>

            <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto;">
              <tr><td align="center">
                <!--[if mso]>
                <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${safeDashboardUrl}"
                  style="height:48px;v-text-anchor:middle;width:280px;" arcsize="10%" stroke="f" fillcolor="#059669">
                  <w:anchorlock/>
                  <center style="color:#ffffff;font-family:Arial, sans-serif;font-size:16px;font-weight:bold;">
                    Go to Dashboard
                  </center>
                </v:roundrect>
                <![endif]-->
                <!--[if !mso]><!-- -->
                <a href="${safeDashboardUrl}" target="_blank" style="display:block;background-color:#059669;color:#ffffff;text-decoration:none;padding:16px 32px;border-radius:8px;font-weight:600;font-size:16px;line-height:20px;text-align:center;">
                  Go to Dashboard
                </a>
                <!--<![endif]-->
              </td></tr>
            </table>

            <p style="margin:24px 0 0;color:#64748b;font-size:14px;">Questions about your payment? Contact us at <a href="mailto:support@volspike.com" style="color:#059669;text-decoration:none;">support@volspike.com</a></p>
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
     * Text template for payment confirmation email
     */
    private getPaymentConfirmationEmailText(data: PaymentConfirmationEmailData, dashboardUrl: string): string {
        const tierName = data.tier.toUpperCase()
        const amountDisplay = data.actuallyPaid 
            ? `${data.actuallyPaid} ${data.actuallyPaidCurrency || data.payCurrency.toUpperCase()}`
            : `${data.amountUsd} USD`
        const expiresDate = new Date(data.expiresAt).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        })

        return `Payment Confirmed - Welcome to ${tierName} Tier!

Hi ${data.name || 'there'},

Great news! Your payment has been successfully processed and confirmed. Your ${tierName} Tier subscription is now active.

Payment Details:
- Amount Paid: ${amountDisplay}
- Subscription Tier: ${tierName}
- Valid Until: ${expiresDate}
- Payment ID: ${data.paymentId}

What's Next?
Your ${tierName} Tier features are now unlocked! Access real-time market data, advanced analytics, and premium alerts.

Go to Dashboard: ${dashboardUrl}

Questions about your payment? Contact us at support@volspike.com

© ${new Date().getFullYear()} VolSpike
        `
    }

    /**
     * Send beautiful partial payment notification email to user
     */
    async sendPartialPaymentEmail(data: PartialPaymentEmailData): Promise<boolean> {
        try {
            if (!process.env.SENDGRID_API_KEY) {
                logger.error('SENDGRID_API_KEY is not set in environment variables')
                return false
            }

            const tierName = data.tier.toUpperCase()
            const subject = `⏳ Payment Received - Waiting for Full Confirmation`
            const paymentUrl = `${this.baseUrl}/checkout/crypto/pay?paymentId=${data.paymentId}`
            const safePaymentUrl = paymentUrl.replace(/"/g, '&quot;')

            const msg: any = {
                to: data.email,
                from: {
                    email: this.fromEmail,
                    name: 'VolSpike Team'
                },
                replyTo: 'support@volspike.com',
                subject: subject,
                html: this.getPartialPaymentEmailHTML(data, safePaymentUrl),
                text: this.getPartialPaymentEmailText(data, paymentUrl),
                categories: ['partial-payment'],
                customArgs: {
                    type: 'partial-payment',
                    tier: data.tier,
                    paymentId: data.paymentId,
                    timestamp: Date.now().toString()
                }
            }

            await mail.send(msg)
            logger.info(`Partial payment email sent to ${data.email} (${tierName} tier)`)
            return true
        } catch (error) {
            logger.error('Failed to send partial payment email:', error)
            return false
        }
    }

    /**
     * HTML template for partial payment email
     */
    private getPartialPaymentEmailHTML(data: PartialPaymentEmailData, safePaymentUrl: string): string {
        const safeName = (data.name || 'there').replace(/[<>]/g, '')
        const tierName = data.tier.toUpperCase()
        const requestedDisplay = `${data.requestedAmount} ${data.payCurrency.toUpperCase()}`
        const paidDisplay = `${data.actuallyPaid} ${data.payCurrency.toUpperCase()}`
        const shortfallDisplay = `${data.shortfall} ${data.payCurrency.toUpperCase()}`

        return `
<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title>Payment Received - Waiting for Full Confirmation</title>
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
    Payment received but slightly less than requested. Waiting for full confirmation to upgrade to ${tierName} Tier.
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;">
    <tr><td align="center" style="padding:24px;">
      <table role="presentation" width="600" class="container" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:12px;">
        <tr>
          <td align="center" style="padding:32px;background:#f59e0b;border-radius:12px 12px 0 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:12px;">
                  <img src="https://volspike.com/email/volspike-badge@2x.png" width="80" height="80" alt="VolSpike" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;height:80px;width:80px;line-height:100%;-ms-interpolation-mode:bicubic;">
                </td>
              </tr>
            </table>
            <div style="font:700 24px/1.2 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#fff;">Payment Received</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;font:400 16px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#334155;">
            <p style="margin:0 0 20px;">Hi ${safeName},</p>
            <p style="margin:0 0 24px;">We've received your payment, but the amount is slightly less than requested. This is usually due to blockchain network fees or decimal precision differences.</p>
            
            <div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;padding:20px;margin:24px 0;">
              <div style="font:600 16px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#92400e;margin:0 0 16px;">Payment Details:</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font:14px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#334155;">
                <tr>
                  <td style="padding:8px 0;color:#64748b;">Requested Amount:</td>
                  <td align="right" style="padding:8px 0;font-weight:600;color:#0f172a;">${requestedDisplay}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#64748b;">Amount Received:</td>
                  <td align="right" style="padding:8px 0;font-weight:600;color:#059669;">${paidDisplay}</td>
                </tr>
                <tr style="border-top:1px solid #e2e8f0;">
                  <td style="padding:8px 0;color:#64748b;">Shortfall:</td>
                  <td align="right" style="padding:8px 0;font-weight:600;color:#dc2626;">${shortfallDisplay} (${data.shortfallPercent})</td>
                </tr>
              </table>
            </div>

            <div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:20px;margin:24px 0;border-radius:4px;">
              <div style="font:600 18px/1.3 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;margin:0 0 12px;">What Happens Next?</div>
              <p style="margin:0 0 12px;color:#334155;">We're waiting for blockchain confirmations. Once your payment is fully confirmed, you'll be automatically upgraded to <strong style="color:#0f172a;">${tierName} Tier</strong> and receive a confirmation email.</p>
              <p style="margin:0;color:#334155;">If you believe you paid the full amount, please contact support and we'll review your payment manually.</p>
            </div>

            <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto;">
              <tr><td align="center">
                <!--[if mso]>
                <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${safePaymentUrl}"
                  style="height:48px;v-text-anchor:middle;width:280px;" arcsize="10%" stroke="f" fillcolor="#d97706">
                  <w:anchorlock/>
                  <center style="color:#ffffff;font-family:Arial, sans-serif;font-size:16px;font-weight:bold;">
                    View Payment Status
                  </center>
                </v:roundrect>
                <![endif]-->
                <!--[if !mso]><!-- -->
                <a href="${safePaymentUrl}" target="_blank" style="display:block;background-color:#d97706;color:#ffffff;text-decoration:none;padding:16px 32px;border-radius:8px;font-weight:600;font-size:16px;line-height:20px;text-align:center;">
                  View Payment Status
                </a>
                <!--<![endif]-->
              </td></tr>
            </table>

            <p style="margin:24px 0 0;color:#64748b;font-size:14px;">Questions? Contact us at <a href="mailto:support@volspike.com" style="color:#059669;text-decoration:none;">support@volspike.com</a></p>
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
     * Text template for partial payment email
     */
    private getPartialPaymentEmailText(data: PartialPaymentEmailData, paymentUrl: string): string {
        const tierName = data.tier.toUpperCase()
        const requestedDisplay = `${data.requestedAmount} ${data.payCurrency.toUpperCase()}`
        const paidDisplay = `${data.actuallyPaid} ${data.payCurrency.toUpperCase()}`
        const shortfallDisplay = `${data.shortfall} ${data.payCurrency.toUpperCase()}`

        return `Payment Received - Waiting for Full Confirmation

Hi ${data.name || 'there'},

We've received your payment, but the amount is slightly less than requested. This is usually due to blockchain network fees or decimal precision differences.

Payment Details:
- Requested Amount: ${requestedDisplay}
- Amount Received: ${paidDisplay}
- Shortfall: ${shortfallDisplay} (${data.shortfallPercent})

What Happens Next?
We're waiting for blockchain confirmations. Once your payment is fully confirmed, you'll be automatically upgraded to ${tierName} Tier and receive a confirmation email.

If you believe you paid the full amount, please contact support and we'll review your payment manually.

View Payment Status: ${paymentUrl}

Questions? Contact us at support@volspike.com

© ${new Date().getFullYear()} VolSpike
        `
    }

    /**
     * Send an alert to the site owner when a payment-related issue occurs
     * (e.g. webhook failure, missing payment record, tier mismatch).
     *
     * This is intentionally simple HTML/text because it is an internal
     * operational email rather than a marketing or user-facing template.
     */
    async sendPaymentIssueAlertEmail(data: PaymentIssueAlertData): Promise<boolean> {
        try {
            if (!process.env.SENDGRID_API_KEY) {
                logger.error('SENDGRID_API_KEY is not set in environment variables')
                return false
            }

            const adminEmail =
                process.env.ADMIN_ALERT_EMAIL ||
                process.env.SUPPORT_EMAIL ||
                'support@volspike.com'

            const subject = `[VolSpike] Payment issue detected: ${data.type}`

            const dashboardUrl = `${this.baseUrl}/admin/payments`
            const safeDashboardUrl = dashboardUrl.replace(/"/g, '&quot;')

            const prettyDetails = JSON.stringify(data.details, null, 2)
            const createdAt = new Date().toISOString()

            const html = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>VolSpike Payment Issue</title>
  </head>
  <body style="margin:0;padding:0;background:#0b1120;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1120;">
      <tr>
        <td align="center" style="padding:24px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#020617;border-radius:16px;border:1px solid #1e293b;">
            <tr>
              <td style="padding:24px 24px 16px;border-bottom:1px solid #1e293b;">
                <div style="font:600 14px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#38bdf8;text-transform:uppercase;letter-spacing:0.08em;">Payment Alert</div>
                <div style="margin-top:8px;font:600 22px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e5e7eb;">
                  ${subject.replace('[VolSpike] ', '')}
                </div>
                <div style="margin-top:4px;font:400 13px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#9ca3af;">
                  Generated at ${createdAt}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 24px 8px;">
                <div style="font:500 14px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e5e7eb;margin-bottom:8px;">
                  Summary
                </div>
                <div style="font:400 13px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#9ca3af;">
                  A payment-related error occurred in the backend. Review the details below and fix the affected user before more people hit the same issue.
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 24px 8px;">
                <div style="font:500 14px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e5e7eb;margin-bottom:8px;">
                  Details (JSON)
                </div>
                <pre style="margin:0;padding:12px 14px;border-radius:8px;background:#020617;border:1px solid #1e293b;font:12px/1.5 SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;color:#e5e7eb;white-space:pre-wrap;word-break:break-word;">
${prettyDetails}
                </pre>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 24px 24px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="left">
                      <a href="${safeDashboardUrl}" style="display:inline-block;padding:10px 18px;border-radius:999px;background-image:linear-gradient(90deg,#22c55e,#22d3ee);color:#020617;font:600 13px/1 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;text-decoration:none;">
                        Open Admin Payments
                      </a>
                    </td>
                  </tr>
                </table>
                <div style="margin-top:12px;font:11px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#6b7280;">
                  You are receiving this email because <span style="color:#e5e7eb;">ADMIN_ALERT_EMAIL</span> or <span style="color:#e5e7eb;">SUPPORT_EMAIL</span> is configured for VolSpike.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`

            const text = `VolSpike payment issue detected (${data.type})

Created at: ${createdAt}

Details (JSON):
${prettyDetails}

Admin payments dashboard: ${dashboardUrl}
`

            const msg: any = {
                to: adminEmail,
                from: {
                    email: this.fromEmail,
                    name: 'VolSpike Alerts',
                },
                replyTo: 'support@volspike.com',
                subject,
                html,
                text,
                categories: ['payment-issue'],
                customArgs: {
                    type: 'payment-issue',
                    issueType: data.type,
                    timestamp: Date.now().toString(),
                },
            }

            await mail.send(msg)
            logger.info(`Payment issue alert email sent to ${adminEmail} (${data.type})`)
            return true
        } catch (error) {
            logger.error('Failed to send payment issue alert email:', error)
            return false
        }
    }

    /**
     * Send a success/ops notification to the site owner when a payment
     * completes and the user is upgraded correctly. Uses the same
     * lightweight JSON details pattern as the issue alert, but with
     * positive wording so admins aren’t confused by “issue detected”
     * on successful payments.
     */
    async sendPaymentSuccessAlertEmail(data: PaymentIssueAlertData): Promise<boolean> {
        try {
            if (!process.env.SENDGRID_API_KEY) {
                logger.error('SENDGRID_API_KEY is not set in environment variables')
                return false
            }

            const adminEmail =
                process.env.ADMIN_ALERT_EMAIL ||
                process.env.SUPPORT_EMAIL ||
                'support@volspike.com'

            const subject = `[VolSpike] Payment completed: ${data.type}`
            const dashboardUrl = `${this.baseUrl}/admin/payments`
            const safeDashboardUrl = dashboardUrl.replace(/"/g, '&quot;')

            const prettyDetails = JSON.stringify(data.details, null, 2)
            const createdAt = new Date().toISOString()

            const html = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>VolSpike Payment Success</title>
  </head>
  <body style="margin:0;padding:0;background:#0b1120;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1120;">
      <tr>
        <td align="center" style="padding:24px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#020617;border-radius:16px;border:1px solid #1e293b;">
            <tr>
              <td style="padding:24px 24px 16px;border-bottom:1px solid #1e293b;">
                <div style="font:600 14px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#22c55e;text-transform:uppercase;letter-spacing:0.08em;">Payment Success</div>
                <div style="margin-top:8px;font:600 22px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e5e7eb;">
                  ${subject.replace('[VolSpike] ', '')}
                </div>
                <div style="margin-top:4px;font:400 13px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#9ca3af;">
                  Logged at ${createdAt}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 24px 8px;">
                <div style="font:500 14px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e5e7eb;margin-bottom:8px;">
                  Summary
                </div>
                <div style="font:400 13px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#9ca3af;">
                  A payment completed successfully and the user was upgraded or synced correctly. This email is for operational visibility only – no action is required unless something looks off in the details below.
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 24px 8px;">
                <div style="font:500 14px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e5e7eb;margin-bottom:8px;">
                  Details (JSON)
                </div>
                <pre style="margin:0;padding:12px 14px;border-radius:8px;background:#020617;border:1px solid #1e293b;font:12px/1.5 SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;color:#e5e7eb;white-space:pre-wrap;word-break:break-word;">
${prettyDetails}
                </pre>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 24px 24px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="left">
                      <a href="${safeDashboardUrl}" style="display:inline-block;padding:10px 18px;border-radius:999px;background-image:linear-gradient(90deg,#22c55e,#22d3ee);color:#020617;font:600 13px/1 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;text-decoration:none;">
                        Open Admin Payments
                      </a>
                    </td>
                  </tr>
                </table>
                <div style="margin-top:12px;font:11px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#6b7280;">
                  You are receiving this email because <span style="color:#e5e7eb;">ADMIN_ALERT_EMAIL</span> or <span style="color:#e5e7eb;">SUPPORT_EMAIL</span> is configured for VolSpike.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`

            const text = `VolSpike payment completed (${data.type})

Logged at: ${createdAt}

Details (JSON):
${prettyDetails}

Admin payments dashboard: ${dashboardUrl}
`

            const msg: any = {
                to: adminEmail,
                from: {
                    email: this.fromEmail,
                    name: 'VolSpike Alerts',
                },
                replyTo: 'support@volspike.com',
                subject,
                html,
                text,
                categories: ['payment-success'],
                customArgs: {
                    type: 'payment-success',
                    successType: data.type,
                    timestamp: Date.now().toString(),
                },
            }

            await mail.send(msg)
            logger.info(`Payment success alert email sent to ${adminEmail} (${data.type})`)
            return true
        } catch (error) {
            logger.error('Failed to send payment success alert email:', error)
            return false
        }
    }

    /**
     * HTML template for tier upgrade email
     * Optimized for deliverability, responsiveness, and compatibility across all email clients
     */
    private getTierUpgradeEmailHTML(data: TierUpgradeEmailData, isUpgrade: boolean): string {
        // Escape HTML to prevent XSS
        const safeName = (data.name || 'there').replace(/[<>]/g, '')
        const tierName = data.newTier.toUpperCase()
        const dashboardUrl = `${this.baseUrl}/dashboard`
        const safeDashboardUrl = dashboardUrl.replace(/"/g, '&quot;')

        // Tier features mapping with checkmark icons
        const tierFeatures: Record<string, string[]> = {
            free: [
                'Top 50 symbols by volume',
                '15-minute refresh rate',
                '10 volume spike alerts',
                'Basic volume analytics',
                'TradingView watchlist export'
            ],
            pro: [
                'Top 100 symbols by volume',
                '5-minute refresh rate',
                '50 volume spike alerts',
                'Email notifications',
                'Open Interest data',
                'CSV & JSON data export',
                'Subscribe to specific symbols',
                'Ad-free experience'
            ],
            elite: [
                'Unlimited symbols (all active pairs)',
                'Real-time streaming updates',
                '100 volume spike alerts',
                'Instant alert delivery (0 delay)',
                'Email + SMS notifications',
                'Full API access',
                'Priority support',
                'Custom alert conditions',
                'Advanced analytics'
            ]
        }

        const features = tierFeatures[data.newTier] || tierFeatures.free
        const featuresList = features.map(f => {
            const safeFeature = f.replace(/[<>]/g, '')
            return `<li style="margin:0 0 10px 0;padding-left:0;color:#334155;line-height:1.6;">${safeFeature}</li>`
        }).join('')

        // Determine header title and preheader text
        const headerTitle = isUpgrade 
            ? `Welcome to ${tierName} Tier!`
            : `Subscription Updated to ${tierName} Tier`

        const preheaderText = isUpgrade
            ? `Your VolSpike account has been upgraded to ${tierName} Tier. Start using your new features now.`
            : `Your VolSpike subscription has been updated to ${tierName} Tier.`

        // Intro message
        const introMessage = isUpgrade
            ? `Congratulations! Your VolSpike account has been upgraded to <strong style="color:#0f172a;">${tierName} Tier</strong>. You now have access to powerful new features to enhance your trading experience.`
            : `Your VolSpike subscription has been updated to <strong style="color:#0f172a;">${tierName} Tier</strong>. Here's what you have access to:`

        return `
<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title>${headerTitle}</title>
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
    ${preheaderText}
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
            <div style="font:700 24px/1.2 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#fff;">${headerTitle}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;font:400 16px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#334155;">
            <div style="font:600 20px/1.3 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;margin:0 0 12px;">${isUpgrade ? 'Your upgrade is complete' : 'Your subscription has been updated'}</div>
            <p style="margin:0 0 20px;">Hi ${safeName},</p>
            <p style="margin:0 0 24px;">${introMessage}</p>
            
            <div style="background:#f8fafc;border-left:4px solid #059669;padding:20px;margin:24px 0;border-radius:4px;">
              <div style="font:600 18px/1.3 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;margin:0 0 16px;">Your ${tierName} Tier Features:</div>
              <ul style="margin:0;padding-left:24px;color:#334155;">
                ${featuresList}
              </ul>
            </div>

            <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto;">
              <tr><td align="center">
                <!--[if mso]>
                <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${safeDashboardUrl}"
                  style="height:48px;v-text-anchor:middle;width:280px;" arcsize="10%" stroke="f" fillcolor="#059669">
                  <w:anchorlock/>
                  <center style="color:#ffffff;font-family:Arial, sans-serif;font-size:16px;font-weight:bold;">
                    Go to Dashboard
                  </center>
                </v:roundrect>
                <![endif]-->
                <!--[if !mso]><!-- -->
                <a href="${safeDashboardUrl}" target="_blank" style="display:block;background-color:#059669;color:#ffffff;text-decoration:none;padding:16px 32px;border-radius:8px;font-weight:600;font-size:16px;line-height:20px;text-align:center;">
                  Go to Dashboard
                </a>
                <!--<![endif]-->
              </td></tr>
            </table>

            <p style="margin:24px 0 0;color:#64748b;font-size:14px;">Questions about your subscription? Contact us at <a href="mailto:support@volspike.com" style="color:#059669;text-decoration:none;">support@volspike.com</a></p>
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
     * Text template for tier upgrade email
     */
    private getTierUpgradeEmailText(data: TierUpgradeEmailData, isUpgrade: boolean): string {
        const tierName = data.newTier.toUpperCase()
        const title = isUpgrade 
            ? `Welcome to ${tierName} Tier!`
            : `Subscription Updated to ${tierName} Tier`

        const tierFeatures: Record<string, string[]> = {
            free: [
                'Top 50 symbols by volume',
                '15-minute refresh rate',
                '10 volume spike alerts',
                'Basic volume analytics',
                'TradingView watchlist export'
            ],
            pro: [
                'Top 100 symbols by volume',
                '5-minute refresh rate',
                '50 volume spike alerts',
                'Email notifications',
                'Open Interest data',
                'CSV & JSON data export',
                'Subscribe to specific symbols',
                'Ad-free experience'
            ],
            elite: [
                'Unlimited symbols (all active pairs)',
                'Real-time streaming updates',
                '100 volume spike alerts',
                'Instant alert delivery (0 delay)',
                'Email + SMS notifications',
                'Full API access',
                'Priority support',
                'Custom alert conditions',
                'Advanced analytics'
            ]
        }

        const features = tierFeatures[data.newTier] || tierFeatures.free
        const featuresList = features.map(f => `• ${f}`).join('\n')

        const subtitle = isUpgrade 
            ? 'Your upgrade is complete'
            : 'Your subscription has been updated'

        return `
${title}

${subtitle}

Hi ${data.name || 'there'},

${isUpgrade 
    ? `Congratulations! Your VolSpike account has been upgraded to ${tierName} Tier. You now have access to powerful new features to enhance your trading experience.`
    : `Your VolSpike subscription has been updated to ${tierName} Tier. Here's what you have access to:`}

Your ${tierName} Tier Features:
${featuresList}

Go to your dashboard: ${this.baseUrl}/dashboard

Questions about your subscription? Contact us at support@volspike.com

© ${new Date().getFullYear()} VolSpike. All rights reserved.
        `
    }

    /**
     * Send crypto subscription renewal reminder email
     */
    async sendCryptoRenewalReminder(data: CryptoRenewalReminderData): Promise<boolean> {
        try {
            if (!process.env.SENDGRID_API_KEY) {
                logger.error('SENDGRID_API_KEY is not set in environment variables')
                return false
            }

            const tierName = data.tier.toUpperCase()
            const daysText = data.daysUntilExpiration === 1 ? 'day' : 'days'
            const urgency = data.daysUntilExpiration <= 1 ? 'urgent' : data.daysUntilExpiration <= 3 ? 'soon' : 'upcoming'
            
            const subject = urgency === 'urgent' 
                ? `⚠️ Your ${tierName} subscription expires tomorrow - Renew now`
                : urgency === 'soon'
                ? `⏰ Your ${tierName} subscription expires in ${data.daysUntilExpiration} ${daysText}`
                : `📅 Reminder: Your ${tierName} subscription expires in ${data.daysUntilExpiration} ${daysText}`

            const renewalUrl = `${this.baseUrl}/pricing?renew=${data.tier}`
            const safeUrl = renewalUrl.replace(/"/g, '&quot;')
            const expiresDate = data.expiresAt.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            })

            const html = `
<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title>${subject}</title>
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
    Your ${tierName} subscription expires ${data.daysUntilExpiration === 1 ? 'tomorrow' : `in ${data.daysUntilExpiration} days`}. Renew now to continue enjoying premium features.
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;">
    <tr><td align="center" style="padding:24px;">
      <table role="presentation" width="600" class="container" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:12px;">
        <tr>
          <td align="center" style="padding:32px;background:${urgency === 'urgent' ? '#dc2626' : urgency === 'soon' ? '#f59e0b' : '#0ea371'};border-radius:12px 12px 0 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:12px;">
                  <img src="https://volspike.com/email/volspike-badge@2x.png" width="80" height="80" alt="VolSpike" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;height:80px;width:80px;line-height:100%;-ms-interpolation-mode:bicubic;">
                </td>
              </tr>
            </table>
            <div style="font:700 24px/1.2 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#fff;">Subscription Renewal Reminder</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;font:400 16px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#334155;">
            <div style="font:600 20px/1.3 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;margin:0 0 12px;">Your ${tierName} subscription expires ${data.daysUntilExpiration === 1 ? 'tomorrow' : `in ${data.daysUntilExpiration} ${daysText}`}</div>
            <p style="margin:0 0 20px;">Your crypto subscription will expire on <strong>${expiresDate}</strong>. To continue enjoying ${tierName} tier features, please renew your subscription.</p>
            <p style="margin:0 0 24px;color:#64748b;">💡 <strong>Note:</strong> Crypto subscriptions require manual renewal. Click the button below to renew now.</p>
            <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto;">
              <tr><td align="center">
                <!--[if mso]>
                <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${safeUrl}"
                  style="height:48px;v-text-anchor:middle;width:280px;" arcsize="10%" stroke="f" fillcolor="#059669">
                  <w:anchorlock/>
                  <center style="color:#ffffff;font-family:Arial, sans-serif;font-size:16px;font-weight:bold;">
                    Renew Subscription
                  </center>
                </v:roundrect>
                <![endif]-->
                <!--[if !mso]><!-- -->
                <a href="${safeUrl}" target="_blank" style="display:block;background-color:#059669;color:#ffffff;text-decoration:none;padding:16px 32px;border-radius:8px;font-weight:600;font-size:16px;line-height:20px;text-align:center;">
                  Renew Subscription
                </a>
                <!--<![endif]-->
              </td></tr>
            </table>
            <p style="margin:24px 0 8px;">Or copy and paste this link:</p>
            <p style="margin:0;word-break:break-all;font:14px/1.6 SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace;">${renewalUrl}</p>
            <p style="margin:24px 0 0;color:#64748b;font-size:14px;">After expiration, your account will be downgraded to Free tier. Renew anytime to restore access.</p>
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
</html>`

            const text = `
Subscription Renewal Reminder - VolSpike

Your ${tierName} subscription expires ${data.daysUntilExpiration === 1 ? 'tomorrow' : `in ${data.daysUntilExpiration} ${daysText}`}.

Expiration Date: ${expiresDate}

Your crypto subscription will expire soon. To continue enjoying ${tierName} tier features, please renew your subscription.

Note: Crypto subscriptions require manual renewal.

Renew now: ${renewalUrl}

After expiration, your account will be downgraded to Free tier. Renew anytime to restore access.

Need help? Contact us at support@volspike.com

© ${new Date().getFullYear()} VolSpike
            `

            const msg: any = {
                to: data.email,
                from: {
                    email: this.fromEmail,
                    name: 'VolSpike Team'
                },
                replyTo: 'support@volspike.com',
                subject: subject,
                html,
                text,
                categories: ['crypto-renewal-reminder'],
                customArgs: {
                    type: 'crypto-renewal-reminder',
                    tier: data.tier,
                    daysUntilExpiration: data.daysUntilExpiration.toString(),
                    timestamp: Date.now().toString()
                }
            }

            await mail.send(msg)
            logger.info(`Crypto renewal reminder sent to ${data.email} (${data.daysUntilExpiration} days until expiration)`)
            return true
        } catch (error) {
            logger.error('Failed to send crypto renewal reminder:', error)
            return false
        }
    }

    /**
     * Send crypto subscription expired email
     */
    async sendCryptoSubscriptionExpired(data: CryptoSubscriptionExpiredData): Promise<boolean> {
        try {
            if (!process.env.SENDGRID_API_KEY) {
                logger.error('SENDGRID_API_KEY is not set in environment variables')
                return false
            }

            const tierName = data.tier.toUpperCase()
            const expiresDate = data.expiresAt.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            })

            const renewalUrl = `${this.baseUrl}/pricing?renew=${data.tier}`
            const safeUrl = renewalUrl.replace(/"/g, '&quot;')

            const html = `
<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title>Your ${tierName} subscription has expired</title>
  <style>
    img { -ms-interpolation-mode:bicubic; }
    @media only screen and (max-width:600px){ .container{ width:100% !important; } }
  </style>
  <!--[if mso]>
  <style type="text/css"> body, table, td {font-family: Arial, sans-serif !important;} </style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background:#f1f5f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;">
    <tr><td align="center" style="padding:24px;">
      <table role="presentation" width="600" class="container" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:12px;">
        <tr>
          <td align="center" style="padding:32px;background:#dc2626;border-radius:12px 12px 0 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:12px;">
                  <img src="https://volspike.com/email/volspike-badge@2x.png" width="80" height="80" alt="VolSpike" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;height:80px;width:80px;line-height:100%;-ms-interpolation-mode:bicubic;">
                </td>
              </tr>
            </table>
            <div style="font:700 24px/1.2 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#fff;">Subscription Expired</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;font:400 16px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#334155;">
            <div style="font:600 20px/1.3 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;margin:0 0 12px;">Your ${tierName} subscription has expired</div>
            <p style="margin:0 0 20px;">Your crypto subscription expired on <strong>${expiresDate}</strong>. Your account has been downgraded to Free tier.</p>
            <p style="margin:0 0 24px;">Don't worry - you can renew anytime to restore your ${tierName} tier access and continue enjoying premium features.</p>
            <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto;">
              <tr><td align="center">
                <a href="${safeUrl}" target="_blank" style="display:block;background-color:#059669;color:#ffffff;text-decoration:none;padding:16px 32px;border-radius:8px;font-weight:600;font-size:16px;line-height:20px;text-align:center;">
                  Renew Subscription
                </a>
              </td></tr>
            </table>
            <p style="margin:24px 0 0;color:#64748b;font-size:14px;">Renew now to restore your ${tierName} tier access immediately.</p>
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
</html>`

            const text = `
Subscription Expired - VolSpike

Your ${tierName} subscription has expired.

Expiration Date: ${expiresDate}

Your crypto subscription has expired and your account has been downgraded to Free tier.

Don't worry - you can renew anytime to restore your ${tierName} tier access.

Renew now: ${renewalUrl}

Need help? Contact us at support@volspike.com

© ${new Date().getFullYear()} VolSpike
            `

            const msg: any = {
                to: data.email,
                from: {
                    email: this.fromEmail,
                    name: 'VolSpike Team'
                },
                replyTo: 'support@volspike.com',
                subject: `Your ${tierName} subscription has expired - Renew now`,
                html,
                text,
                categories: ['crypto-subscription-expired'],
                customArgs: {
                    type: 'crypto-subscription-expired',
                    tier: data.tier,
                    timestamp: Date.now().toString()
                }
            }

            await mail.send(msg)
            logger.info(`Crypto subscription expired email sent to ${data.email}`)
            return true
        } catch (error) {
            logger.error('Failed to send crypto subscription expired email:', error)
            return false
        }
    }

    /**
     * Send alert notification email when a cross alert is triggered
     */
    async sendAlertEmail(data: {
        to: string
        symbol: string
        alertType: string
        threshold: string
        currentValue: string
        direction: string
    }): Promise<boolean> {
        try {
            const subject = `VolSpike Alert: ${data.symbol} ${data.alertType} Crossed ${data.threshold}`

            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                        .header h1 { margin: 0; font-size: 24px; }
                        .content { background: #f7f9fc; padding: 30px; border-radius: 0 0 8px 8px; }
                        .alert-box { background: white; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 4px; }
                        .metric { margin: 12px 0; }
                        .metric-label { font-weight: 600; color: #666; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
                        .metric-value { font-size: 18px; font-weight: 700; color: #667eea; margin-top: 4px; }
                        .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                        .footer a { color: #667eea; text-decoration: none; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🔔 VolSpike Alert Triggered</h1>
                        </div>
                        <div class="content">
                            <p style="font-size: 16px; margin-top: 0;">Your ${data.alertType.toLowerCase()} alert for <strong>${data.symbol}</strong> has been triggered!</p>

                            <div class="alert-box">
                                <div class="metric">
                                    <div class="metric-label">Symbol</div>
                                    <div class="metric-value">${data.symbol}</div>
                                </div>
                                <div class="metric">
                                    <div class="metric-label">Alert Type</div>
                                    <div class="metric-value">${data.alertType}</div>
                                </div>
                                <div class="metric">
                                    <div class="metric-label">Threshold</div>
                                    <div class="metric-value">${data.threshold}</div>
                                </div>
                                <div class="metric">
                                    <div class="metric-label">Current Value</div>
                                    <div class="metric-value">${data.currentValue}</div>
                                </div>
                                <div class="metric">
                                    <div class="metric-label">Direction</div>
                                    <div class="metric-value">Crossed ${data.direction}</div>
                                </div>
                            </div>

                            <p style="margin-top: 24px;">
                                <a href="https://volspike.com/dashboard" class="button">View in Dashboard</a>
                            </p>

                            <p style="font-size: 14px; color: #666; margin-top: 24px;">
                                This alert has been marked as inactive. You can reactivate it from your alerts management page.
                            </p>
                        </div>
                        <div class="footer">
                            <p>
                                Manage your alerts: <a href="https://volspike.com/settings/alerts">Alert Settings</a><br>
                                Questions? Visit <a href="https://volspike.com">VolSpike.com</a>
                            </p>
                        </div>
                    </div>
                </body>
                </html>
            `

            const text = `
VolSpike Alert Triggered

Your ${data.alertType.toLowerCase()} alert for ${data.symbol} has been triggered!

Symbol: ${data.symbol}
Alert Type: ${data.alertType}
Threshold: ${data.threshold}
Current Value: ${data.currentValue}
Direction: Crossed ${data.direction}

View in Dashboard: https://volspike.com/dashboard

This alert has been marked as inactive. You can reactivate it from your alerts management page.

Manage your alerts: https://volspike.com/settings/alerts
            `.trim()

            const msg = {
                to: data.to,
                from: this.fromEmail,
                subject,
                html,
                text,
                categories: ['user-alert'],
                customArgs: {
                    type: 'user-alert',
                    symbol: data.symbol,
                    alertType: data.alertType,
                    timestamp: Date.now().toString()
                }
            }

            await mail.send(msg)
            logger.info(`Alert email sent`, { to: data.to, symbol: data.symbol, alertType: data.alertType })
            return true
        } catch (error) {
            logger.error('Failed to send alert email:', error)
            return false
        }
    }

    /**
     * Send suggestion notification to team
     */
    async sendSuggestionNotification(data: {
        name: string
        email: string
        type: 'feature' | 'improvement' | 'bug' | 'other'
        title: string
        description: string
    }): Promise<boolean> {
        try {
            const typeLabels = {
                feature: 'New Feature',
                improvement: 'Improvement',
                bug: 'Bug Report',
                other: 'Other'
            }

            const typeEmojis = {
                feature: '💡',
                improvement: '⚡',
                bug: '🐛',
                other: '💬'
            }

            const typeLabel = typeLabels[data.type]
            const typeEmoji = typeEmojis[data.type]

            const msg: any = {
                to: 'support@volspike.com',
                from: {
                    email: this.fromEmail,
                    name: 'VolSpike Suggestions'
                },
                replyTo: data.email,
                subject: `${typeEmoji} [${typeLabel}] ${data.title}`,
                html: `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <title>New Suggestion: ${data.title}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;">
    <tr><td align="center" style="padding:24px;">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:12px;">
        <tr>
          <td align="center" style="padding:32px;background:#0ea371;border-radius:12px 12px 0 0;">
            <div style="font:700 24px/1.2 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#fff;">
              ${typeEmoji} New Suggestion
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;font:400 16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#334155;">
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:8px 0;color:#64748b;font-size:14px;">Type:</td>
                  <td align="right" style="padding:8px 0;font-weight:600;color:#0f172a;">${typeLabel}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#64748b;font-size:14px;">From:</td>
                  <td align="right" style="padding:8px 0;font-weight:600;color:#0f172a;">${data.name}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#64748b;font-size:14px;">Email:</td>
                  <td align="right" style="padding:8px 0;"><a href="mailto:${data.email}" style="color:#0ea371;text-decoration:none;">${data.email}</a></td>
                </tr>
              </table>
            </div>

            <div style="margin-bottom:20px;">
              <div style="font:600 14px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">
                Title
              </div>
              <div style="font:600 18px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
                ${data.title}
              </div>
            </div>

            <div>
              <div style="font:600 14px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">
                Description
              </div>
              <div style="padding:16px;background:#f8fafc;border-radius:6px;white-space:pre-wrap;font-size:14px;line-height:1.6;color:#334155;">
${data.description}
              </div>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 32px;text-align:center;">
            <a href="mailto:${data.email}?subject=Re: ${encodeURIComponent(data.title)}" style="display:inline-block;padding:12px 32px;background:#0ea371;color:#fff;text-decoration:none;border-radius:6px;font:600 14px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              Reply to ${data.name}
            </a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
                `,
                text: `
New Suggestion Received

Type: ${typeLabel}
From: ${data.name}
Email: ${data.email}

Title: ${data.title}

Description:
${data.description}

---
Reply to this email to respond to ${data.name}.
                `.trim(),
                categories: ['suggestion-notification'],
                customArgs: {
                    type: 'suggestion',
                    suggestionType: data.type,
                    timestamp: Date.now().toString()
                }
            }

            await mail.send(msg)
            logger.info(`Suggestion notification sent for: ${data.title} (from ${data.email})`)
            return true
        } catch (error) {
            logger.error('Failed to send suggestion notification:', error)
            return false
        }
    }
}

export default EmailService

/**
 * Helper function to send alert email
 */
export async function sendAlertEmail(data: {
    to: string
    symbol: string
    alertType: string
    threshold: string
    currentValue: string
    direction: string
}): Promise<boolean> {
    const emailService = new EmailService()
    return emailService.sendAlertEmail(data)
}
