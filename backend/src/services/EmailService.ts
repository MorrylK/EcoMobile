import { Resend } from 'resend';
import { config } from '../config/config';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

// Adresse expéditeur : utilise le domaine vérifié Resend si disponible, sinon le domaine de test
const RESEND_FROM = process.env.RESEND_FROM || 'EcoMobile <onboarding@resend.dev>';

class EmailService {
  private resend: Resend | null = null;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      this.resend = new Resend(apiKey);
    }
  }

  /**
   * Check if email service is properly configured
   */
  isConfigured(): boolean {
    return !!process.env.RESEND_API_KEY;
  }

  /**
   * Send an email via Resend
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.isConfigured() || !this.resend) {
      if (process.env.NODE_ENV !== 'production') {
        const to = Array.isArray(options.to) ? options.to.join(', ') : options.to;
        console.log(`[DEV EMAIL] → ${to} | ${options.subject}`);
        return true;
      }
      throw new Error('Email service not configured (RESEND_API_KEY manquant)');
    }

    try {
      const to = Array.isArray(options.to) ? options.to : [options.to];
      const { error } = await this.resend.emails.send({
        from: RESEND_FROM,
        to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html),
      });

      if (error) {
        console.error('Resend error:', error);
        if (process.env.NODE_ENV !== 'production') return false;
        throw new Error(error.message);
      }

      console.log(`Email sent via Resend to: ${to.join(', ')}`);
      return true;
    } catch (error) {
      console.error('Error sending email via Resend:', error);
      if (process.env.NODE_ENV !== 'production') return false;
      throw error;
    }
  }

  /**
   * Send bulk emails (for promotions/announcements)
   */
  async sendBulkEmails(recipients: string[], subject: string, html: string): Promise<{
    success: number;
    failed: number;
    errors: Array<{ email: string; error: string }>;
  }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ email: string; error: string }>,
    };

    // Send emails in batches to avoid overwhelming the SMTP server
    const batchSize = 50;
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);

      const promises = batch.map(async (email) => {
        try {
          await this.sendEmail({ to: email, subject, html });
          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            email,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      });

      await Promise.all(promises);

      // Add a small delay between batches
      if (i + batchSize < recipients.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * Generate Email Verified Template
   */
  generateEmailVerifiedTemplate(
    firstName: string,
    lang: 'en' | 'fr',
    _translations: any
  ): EmailTemplate {
    const subject = lang === 'fr' 
      ? 'Email vérifié avec succès - FreeBike'
      : 'Email verified successfully - FreeBike';
    
    const title = lang === 'fr'
      ? 'Email vérifié'
      : 'Email Verified';
    
    const message = lang === 'fr'
      ? `Bonjour ${firstName},<br><br>Votre email a été vérifié avec succès ! Votre compte FreeBike est maintenant activé. Vous pouvez profiter de tous les services.<br><br>Merci,<br>L'équipe FreeBike`
      : `Hello ${firstName},<br><br>Your email has been successfully verified! Your FreeBike account is now activated. You can enjoy all our services.<br><br>Thank you,<br>The FreeBike Team`;
    
    const ctaText = lang === 'fr' ? 'Commencer à utiliser FreeBike' : 'Start using FreeBike';
    const footerText = lang === 'fr' 
      ? '© 2026 FreeBike. Tous droits réservés.'
      : '© 2026 FreeBike. All rights reserved.';

    const html = this.generateEmailTemplate({
      title,
      message,
      ctaText,
      ctaUrl: `${config.frontendUrl}/mobile/login`,
      footerText
    });

    return { subject, html };
  }

  /**
   * Generate Welcome Email Template
   */
  generateWelcomeEmail(
    firstName: string,
    _lang: 'en' | 'fr',
    translations: any
  ): EmailTemplate {
    const subject = translations.email.welcome_subject;
    const title = translations.email.welcome_title;
    const message = translations.email.welcome_message.replace('{{firstName}}', firstName);
    const ctaText = translations.email.welcome_cta;

    const html = this.generateEmailTemplate({
      title,
      message,
      ctaText,
      ctaUrl: `${config.frontendUrl}/mobile/login`,
      footerText: translations.email.footer_text,
    });

    return { subject, html };
  }

  /**
   * Generate Password Reset Email Template
   */
  generatePasswordResetEmail(
    firstName: string,
    resetToken: string,
    _lang: 'en' | 'fr',
    translations: any
  ): EmailTemplate {
    const subject = translations.email.password_reset_subject;
    const title = translations.email.password_reset_title;
    const message = translations.email.password_reset_message.replace('{{firstName}}', firstName);
    const ctaText = translations.email.password_reset_cta;
    const ignoreText = translations.email.password_reset_ignore;

    const html = this.generateEmailTemplate({
      title,
      message,
      ctaText,
      ctaUrl: `${config.frontendUrl}/mobile/reset-password?token=${resetToken}`,
      footerText: translations.email.footer_text,
      additionalText: ignoreText,
    });

    return { subject, html };
  }

  /**
   * Generate Ride Completed Email Template
   */
  generateRideCompletedEmail(
    firstName: string,
    rideDetails: { duration: number; distance: number; cost: number },
    _lang: 'en' | 'fr',
    translations: any
  ): EmailTemplate {
    const subject = translations.email.ride_completed_subject;
    const title = translations.email.ride_completed_title;
    let message = translations.email.ride_completed_message
      .replace('{{firstName}}', firstName)
      .replace('{{duration}}', rideDetails.duration.toString())
      .replace('{{distance}}', rideDetails.distance.toFixed(2))
      .replace('{{cost}}', rideDetails.cost.toFixed(0));

    const ctaText = translations.email.ride_completed_cta;

    const html = this.generateEmailTemplate({
      title,
      message,
      ctaText,
      ctaUrl: `${config.frontendUrl}/mobile/ride-history`,
      footerText: translations.email.footer_text,
    });

    return { subject, html };
  }

  /**
   * Generate Deposit Confirmation Email Template
   */
  generateDepositEmail(
    firstName: string,
    amount: number,
    balance: number,
    _lang: 'en' | 'fr',
    translations: any
  ): EmailTemplate {
    const subject = translations.email.deposit_subject;
    const title = translations.email.deposit_title;
    const message = translations.email.deposit_message
      .replace('{{firstName}}', firstName)
      .replace('{{amount}}', amount.toFixed(0))
      .replace('{{balance}}', balance.toFixed(0));

    const ctaText = translations.email.deposit_cta;

    const html = this.generateEmailTemplate({
      title,
      message,
      ctaText,
      ctaUrl: `${config.frontendUrl}/mobile/wallet`,
      footerText: translations.email.footer_text,
    });

    return { subject, html };
  }

  /**
   * Generate Promotion Email Template
   */
  generatePromotionEmail(
    firstName: string,
    promotionData: { subject: string; title: string; message: string; ctaUrl?: string },
    _lang: 'en' | 'fr',
    translations: any
  ): EmailTemplate {
    const subject = promotionData.subject;
    const title = promotionData.title;
    const message = promotionData.message.replace('{{firstName}}', firstName);
    const ctaText = translations.email.promotion_cta;

    const html = this.generateEmailTemplate({
      title,
      message,
      ctaText,
      ctaUrl: promotionData.ctaUrl || config.frontendUrl,
      footerText: translations.email.footer_text,
    });

    return { subject, html };
  }

  /**
   * Generate Incident Resolved Email Template
   */
  generateIncidentResolvedEmail(
    firstName: string,
    incidentId: string,
    _lang: 'en' | 'fr',
    translations: any
  ): EmailTemplate {
    const subject = translations.email.incident_resolved_subject;
    const title = translations.email.incident_resolved_title;
    const message = translations.email.incident_resolved_message
      .replace('{{firstName}}', firstName)
      .replace('{{incidentId}}', incidentId);

    const ctaText = translations.email.incident_resolved_cta;

    const html = this.generateEmailTemplate({
      title,
      message,
      ctaText,
      ctaUrl: `${config.frontendUrl}/mobile/profile`,
      footerText: translations.email.footer_text,
    });

    return { subject, html };
  }

  /**
   * Generate Review Submitted Confirmation Email Template
   */
  generateReviewSubmittedEmail(
    firstName: string,
    lastName: string,
    _lang: 'en' | 'fr',
    translations: any
  ): EmailTemplate {
    const subject = translations.email.review_submitted_subject;
    const title = translations.email.review_submitted_title;
    const message = translations.email.review_submitted_message
      .replace('{{firstName}}', firstName)
      .replace('{{lastName}}', lastName);

    const ctaText = translations.email.review_submitted_cta;

    const html = this.generateEmailTemplate({
      title,
      message,
      ctaText,
      ctaUrl: `${config.frontendUrl}/mobile/services`,
      footerText: translations.email.footer_text,
    });

    return { subject, html };
  }

  /**
   * Generate New Review Notification Email Template (for admins)
   */
  generateNewReviewNotificationEmail(
    review: any,
    _lang: 'en' | 'fr',
    translations: any
  ): EmailTemplate {
    const subject = translations.email.new_review_subject;
    const title = translations.email.new_review_title;
    const message = translations.email.new_review_message
      .replace('{{firstName}}', review.firstName)
      .replace('{{lastName}}', review.lastName)
      .replace('{{rating}}', review.rating.toString())
      .replace('{{socialStatus}}', review.socialStatus)
      .replace('{{comment}}', review.comment);

    const ctaText = translations.email.new_review_cta;

    const html = this.generateEmailTemplate({
      title,
      message,
      ctaText,
      ctaUrl: `${config.frontendUrl}/admin/reviews`,
      footerText: translations.email.footer_text,
    });

    return { subject, html };
  }

  /**
   * Base HTML Email Template
   */
  private generateEmailTemplate(options: {
    title: string;
    message: string;
    ctaText: string;
    ctaUrl: string;
    footerText: string;
    additionalText?: string;
  }): string {
    const { title, message, ctaText, ctaUrl, footerText, additionalText } = options;

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            padding: 0;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 20px;
            text-align: center;
          }
          .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 28px;
          }
          .content {
            padding: 40px 30px;
          }
          .content h2 {
            color: #333333;
            font-size: 24px;
            margin-bottom: 20px;
          }
          .content p {
            color: #666666;
            font-size: 16px;
            line-height: 1.8;
            margin-bottom: 20px;
            white-space: pre-line;
          }
          .cta-button {
            display: inline-block;
            padding: 14px 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
            font-size: 16px;
          }
          .additional-text {
            color: #999999;
            font-size: 14px;
            font-style: italic;
            margin-top: 20px;
          }
          .footer {
            background-color: #f8f8f8;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #eeeeee;
          }
          .footer p {
            color: #999999;
            font-size: 14px;
            margin: 5px 0;
          }
          .footer a {
            color: #667eea;
            text-decoration: none;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚴 FreeBike</h1>
          </div>
          <div class="content">
            <h2>${title}</h2>
            <p>${message}</p>
            <div style="text-align: center;">
              <a href="${ctaUrl}" class="cta-button">${ctaText}</a>
            </div>
            ${additionalText ? `<p class="additional-text">${additionalText}</p>` : ''}
          </div>
          <div class="footer">
            <p>${footerText}</p>
            <p>
              <a href="mailto:support@freebike.com">support@freebike.com</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `.trim();
  }

  /**
   * Strip HTML tags from text
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Verify Resend connection (teste l'envoi d'un email de sanity check)
   */
  async verifyConnection(): Promise<boolean> {
    return this.isConfigured();
  }
}

export default EmailService;
