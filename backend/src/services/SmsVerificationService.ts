import { Resend } from 'resend';
import { prisma } from '../config/prisma';
import { t } from '../locales';

/**
 * Vérification du numéro de téléphone via un code OTP envoyé par EMAIL (gratuit, aucun SMS).
 * L'utilisateur saisit son numéro de téléphone, reçoit un email avec un code à 6 chiffres
 * et le saisit dans l'application pour confirmer son numéro.
 */
export class SmsVerificationService {
  private resend: Resend | null = null;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) this.resend = new Resend(apiKey);
  }

  generateVerificationCode(length: number = 6): string {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
  }

  getCodeExpiration(): Date {
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 10);
    return expires;
  }

  /**
   * Envoyer le code OTP par email (remplace l'envoi SMS — gratuit via Resend)
   */
  private async sendOtpByEmail(userEmail: string, phoneNumber: string, code: string, language: 'fr' | 'en'): Promise<void> {
    if (!this.resend) {
      console.log(`[DEV OTP] Code pour ${phoneNumber} (email: ${userEmail}) : ${code}`);
      return;
    }

    const subject = language === 'fr'
      ? 'Code de vérification de votre numéro — EcoMobile'
      : 'Phone verification code — EcoMobile';

    const html = `
      <!DOCTYPE html><html><head><meta charset="UTF-8"></head>
      <body style="font-family:sans-serif;background:#f4f4f4;margin:0;padding:20px;">
        <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
          <div style="background:#16a34a;padding:24px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:22px;">EcoMobile</h1>
          </div>
          <div style="padding:32px 24px;text-align:center;">
            <p style="color:#374151;font-size:15px;margin-bottom:8px;">
              ${language === 'fr'
                ? `Code de vérification pour le numéro <strong>${phoneNumber}</strong> :`
                : `Verification code for number <strong>${phoneNumber}</strong>:`}
            </p>
            <div style="font-size:36px;font-weight:700;letter-spacing:10px;color:#111827;margin:24px 0;padding:16px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
              ${code}
            </div>
            <p style="color:#6b7280;font-size:13px;">
              ${language === 'fr'
                ? 'Ce code expire dans <strong>10 minutes</strong>. Ne le partagez jamais.'
                : 'This code expires in <strong>10 minutes</strong>. Never share it.'}
            </p>
          </div>
          <div style="background:#f9fafb;padding:16px;text-align:center;">
            <p style="color:#9ca3af;font-size:12px;margin:0;">© ${new Date().getFullYear()} EcoMobile</p>
          </div>
        </div>
      </body></html>
    `;

    const { error } = await this.resend.emails.send({
      from: process.env.RESEND_FROM || 'EcoMobile <onboarding@resend.dev>',
      to: [userEmail],
      subject,
      html,
    });

    if (error) {
      console.error('Resend OTP email error:', error);
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[DEV OTP] Code (fallback log) : ${code}`);
        return;
      }
      throw new Error(error.message);
    }
  }

  /**
   * Initier la vérification du téléphone : génère un code et l'envoie par email
   */
  async initiatePhoneVerification(userId: string, phoneNumber: string, language: 'fr' | 'en' = 'fr'): Promise<string> {
    const code = this.generateVerificationCode(6);
    const expiresAt = this.getCodeExpiration();

    // Récupérer l'email de l'utilisateur pour lui envoyer le code
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user?.email) throw new Error(t('error.user_not_found', language));

    await prisma.user.update({
      where: { id: userId },
      data: { phone: phoneNumber, phoneVerificationCode: code, phoneVerificationExpires: expiresAt },
    });

    await this.sendOtpByEmail(user.email, phoneNumber, code, language);

    return code;
  }

  /**
   * Verify phone code
   */
  async verifyPhoneCode(userId: string, code: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || !user.phoneVerificationCode || !user.phoneVerificationExpires) {
      return false;
    }

    // Check if code is expired
    if (new Date() > user.phoneVerificationExpires) {
      return false;
    }

    // Check if code matches
    if (user.phoneVerificationCode !== code) {
      return false;
    }

    // Update user as verified
    await prisma.user.update({
      where: { id: userId },
      data: {
        phoneVerified: true,
        phoneVerificationCode: null,
        phoneVerificationExpires: null
      }
    });

    return true;
  }

  /**
   * Resend verification code
   */
  async resendVerificationCode(userId: string, language: 'fr' | 'en' = 'fr'): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || !user.phone) {
      throw new Error(t('error.phone_not_found', language));
    }

    await this.initiatePhoneVerification(userId, user.phone, language);
  }
}
