import * as SibApiV3Sdk from '@getbrevo/brevo'

// Initialize Brevo API client
const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi()
apiInstance.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY || '')

export interface EmailData {
  to: string
  subject: string
  html: string
  text?: string
}

export const sendEmail = async (emailData: EmailData) => {
  try {
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail()

    sendSmtpEmail.subject = emailData.subject
    sendSmtpEmail.htmlContent = emailData.html
    sendSmtpEmail.sender = {
      name: 'Your App Name',
      email: process.env.BREVO_FROM_EMAIL || 'noreply@yourdomain.com'
    }
    sendSmtpEmail.to = [
      {
        email: emailData.to,
        name: emailData.to.split('@')[0] // Use email prefix as name
      }
    ]

    const result = await apiInstance.sendTransacEmail(sendSmtpEmail)
    console.log('Email sent successfully:', result)
    return result
  } catch (error) {
    console.error('Error sending email:', error)
    throw error
  }
}

export const sendResetPasswordEmail = async (email: string, resetToken: string) => {
  const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`

  const emailData: EmailData = {
    to: email,
    subject: 'Reset Your Password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Reset Your Password</h2>
        <p>Hello,</p>
        <p>You have requested to reset your password. Click the button below to create a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" 
             style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${resetLink}</p>
        <p>This link will expire in 15 minutes for security reasons.</p>
        <p>If you didn't request this password reset, please ignore this email.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">
          This is an automated email. Please do not reply to this message.
        </p>
      </div>
    `
  }

  return sendEmail(emailData)
}

export const sendWelcomeEmail = async (email: string, name: string) => {
  const emailData: EmailData = {
    to: email,
    subject: 'Welcome to Our Platform!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome, ${name}!</h2>
        <p>Thank you for registering with us. Your account has been created successfully.</p>
        <p>You can now log in to your account and start using our services.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.CLIENT_URL}/login" 
             style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Login Now
          </a>
        </div>
        <p>If you have any questions, feel free to contact our support team.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">
          This is an automated email. Please do not reply to this message.
        </p>
      </div>
    `
  }

  return sendEmail(emailData)
}
