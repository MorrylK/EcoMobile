import NotificationRepository, { Notification } from '../repositories/NotificationRepository';
import EmailService from './EmailService';
import { notificationSSEService } from './NotificationSSEService';
import { t } from '../locales';

export interface NotificationWithEmail {
  userId: string;
  title: string;
  message: string;
  type: string;
  metadata?: any;
  sendEmail?: boolean;
  emailData?: {
    userEmail: string;
    firstName: string;
    lang: 'en' | 'fr';
  };
}

class NotificationService {
  
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService();
  }

  /**
   * Create a notification (and optionally send email)
   */
  async createNotification(data: NotificationWithEmail): Promise<Notification> {
    // Create notification in database
    const notification = await NotificationRepository.createNotification({
      userId: data.userId,
      title: data.title,
      message: data.message,
      type: data.type,
      metadata: data.metadata
    });

    // Envoyer la notification via SSE en temps réel (si des clients sont connectés)
    try {
      await notificationSSEService.sendNotificationToUser(data.userId, notification);
      // Mettre à jour le nombre de notifications non lues
      await notificationSSEService.updateUnreadCountForUser(data.userId);
    } catch (error) {
      console.error('Failed to send notification via SSE:', error);
      // Ne pas bloquer - la notification a été créée avec succès
    }

    // Send email if requested
    if (data.sendEmail && data.emailData) {
      try {
        await this.sendNotificationEmail(
          data.type,
          data.emailData,
          {
            title: data.title,
            message: data.message,
          }
        );
      } catch (error) {
        console.error('Failed to send notification email:', error);
        // Don't throw - notification was created successfully
      }
    }

    return notification;
  }

  /**
   * Bulk delete notifications
   */
  async bulkDeleteNotifications(notificationIds: string[]): Promise<void> {
    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      throw new Error('Invalid notification IDs provided');
    }

    await NotificationRepository.bulkDeleteNotifications(notificationIds);
  }

  /**
   * Send email verification confirmation
   */
  async sendEmailVerifiedConfirmation(
    userId: string,
    userEmail: string,
    firstName: string,
    lang: 'en' | 'fr' = 'fr'
  ): Promise<void> {
    // Create notification
    await this.createNotification({
      userId,
      title: t('notification.email_verified', lang),
      message: t('auth.email.verified', lang),
      type: 'EMAIL_VERIFIED',
      sendEmail: true,
      emailData: {
        userEmail,
        firstName,
        lang,
      },
    });

    // Send verification confirmation email
    try {
      const emailTemplate = this.emailService.generateEmailVerifiedTemplate(
        firstName,
        lang,
        t
      );
      await this.emailService.sendEmail({
        to: userEmail,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
      });
    } catch (error) {
      console.error('Failed to send email verification confirmation:', error);
    }
  }

  /**
   * Create notification for ride started
   */
  async notifyRideStarted(
    userId: string,
    bikeCode: string,
    _userEmail?: string,
    _firstName?: string,
    lang: 'en' | 'fr' = 'fr'
  ): Promise<Notification> {
    const title = t('notification.ride_started', lang);
    const bikeMessage = t('bike.not_found', lang).replace('Vélo non trouvé', `Bike ${bikeCode}`).replace('Bike not found', `Bike ${bikeCode}`);
    
    return await this.createNotification({
      userId,
      title,
      message: `${title} - ${bikeMessage}`,
      type: 'RIDE_STARTED',
      sendEmail: false, // Usually don't send email for ride start
    });
  }

  /**
   * Create notification for ride ended
   */
  async notifyRideEnded(
    userId: string,
    rideDetails: { duration: number; distance: number; cost: number },
    userEmail: string,
    firstName: string,
    lang: 'en' | 'fr' = 'fr'
  ): Promise<Notification> {
    const message = t('notification.ride_ended', lang).replace('{{cost}}', rideDetails.cost.toFixed(0));

    const notification = await this.createNotification({
      userId,
      title: t('ride.ended', lang),
      message,
      type: 'RIDE_ENDED',
      sendEmail: true,
      emailData: {
        userEmail,
        firstName,
        lang,
      },
    });

    // Send detailed ride completion email
    try {
      const emailTemplate = this.emailService.generateRideCompletedEmail(
        firstName,
        rideDetails,
        lang,
        t
      );
      await this.emailService.sendEmail({
        to: userEmail,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
      });
    } catch (error) {
      console.error('Failed to send ride completion email:', error);
    }

    return notification;
  }

  /**
   * Create notification for wallet deposit
   */
  async notifyWalletDeposit(
    userId: string,
    amount: number,
    balance: number,
    userEmail: string,
    firstName: string,
    lang: 'en' | 'fr' = 'fr'
  ): Promise<Notification> {
    const message = t('notification.wallet_deposit', lang).replace('{{amount}}', amount.toFixed(0));

    const notification = await this.createNotification({
      userId,
      title: t('wallet.deposit_success', lang),
      message,
      type: 'WALLET_DEPOSIT',
      sendEmail: true,
      emailData: {
        userEmail,
        firstName,
        lang,
      },
    });

    // Send deposit confirmation email
    try {
      const emailTemplate = this.emailService.generateDepositEmail(
        firstName,
        amount,
        balance,
        lang,
        t
      );
      await this.emailService.sendEmail({
        to: userEmail,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
      });
    } catch (error) {
      console.error('Failed to send deposit email:', error);
    }

    return notification;
  }

  /**
   * Create notification for wallet withdrawal
   */
  async notifyWalletWithdrawal(
    userId: string,
    amount: number,
    _userEmail?: string,
    _firstName?: string,
    lang: 'en' | 'fr' = 'fr'
  ): Promise<Notification> {
    const message = t('notification.wallet_withdrawal', lang).replace('{{amount}}', amount.toFixed(0));

    return await this.createNotification({
      userId,
      title: t('wallet.withdrawal_success', lang),
      message,
      type: 'WALLET_WITHDRAWAL',
      sendEmail: false, // Usually don't send email for withdrawals
    });
  }

  /**
   * Create notification for ride payment
   */
  async notifyRidePayment(
    userId: string,
    amount: number,
    _userEmail?: string,
    _firstName?: string,
    lang: 'en' | 'fr' = 'fr'
  ): Promise<Notification> {
    const message = t('notification.ride_payment', lang).replace('{{amount}}', amount.toFixed(0));

    return await this.createNotification({
      userId,
      title: t('payment.completed', lang),
      message,
      type: 'RIDE_PAYMENT',
      sendEmail: false,
    });
  }

  /**
   * Send welcome notification and email
   */
  async sendWelcomeNotification(
    userId: string,
    userEmail: string,
    firstName: string,
    lang: 'en' | 'fr' = 'fr'
  ): Promise<Notification> {
    const notification = await this.createNotification({
      userId,
      title: t('notification.account_created', lang),
      message: t('auth.register.success', lang),
      type: 'ACCOUNT_CREATED',
      sendEmail: false, // Will send custom email below
    });

    // Send welcome email
    try {
      if (this.emailService.isConfigured()) {
        const emailTemplate = this.emailService.generateWelcomeEmail(firstName, lang, t);
        await this.emailService.sendEmail({
          to: userEmail,
          subject: emailTemplate.subject,
          html: emailTemplate.html,
        });
      } else {
        console.log(`[DEV EMAIL] Email service not configured, skipping welcome email`);
      }
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      // Don't throw - email failure shouldn't block registration
    }

    return notification;
  }

  /**
   * Send password reset notification and email
   */
  async sendPasswordResetNotification(
    userId: string,
    userEmail: string,
    firstName: string,
    resetToken: string,
    lang: 'en' | 'fr' = 'fr'
  ): Promise<void> {
    // Create notification
    await this.createNotification({
      userId,
      title: t('notification.password_reset_requested', lang),
      message: t('auth.password.reset.success', lang),
      type: 'PASSWORD_RESET',
      sendEmail: false, // Will send custom email below
    });

    // Send password reset email
    try {
      const emailTemplate = this.emailService.generatePasswordResetEmail(
        firstName,
        resetToken,
        lang,
        t
      );
      await this.emailService.sendEmail({
        to: userEmail,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
      });
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      throw error; // Re-throw for password reset as email is critical
    }
  }

  /**
   * Send incident reported notification
   */
  async notifyIncidentReported(
    userId: string,
    _incidentId: string,
    incidentType: string,
    _userEmail?: string,
    _firstName?: string,
    lang: 'en' | 'fr' = 'fr'
  ): Promise<Notification> {
    const title = t('notification.incident_reported', lang);

    return await this.createNotification({
      userId,
      title,
      message: `${title} - ${incidentType}`,
      type: 'INCIDENT_REPORTED',
      sendEmail: false,
    });
  }

  /**
   * Send incident resolved notification and email
   */
  async notifyIncidentResolved(
    userId: string,
    incidentId: string,
    userEmail: string,
    firstName: string,
    lang: 'en' | 'fr' = 'fr'
  ): Promise<Notification> {
    const title = t('notification.incident_resolved', lang);

    const notification = await this.createNotification({
      userId,
      title,
      message: title,
      type: 'INCIDENT_RESOLVED',
      sendEmail: true,
      emailData: {
        userEmail,
        firstName,
        lang,
      },
    });

    // Send incident resolved email
    try {
      const emailTemplate = this.emailService.generateIncidentResolvedEmail(
        firstName,
        incidentId,
        lang,
        t
      );
      await this.emailService.sendEmail({
        to: userEmail,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
      });
    } catch (error) {
      console.error('Failed to send incident resolved email:', error);
    }

    return notification;
  }

  /**
   * Send promotional notification and email to multiple users
   */
  async sendPromotionToUsers(
    userIds: string[],
    promotionData: {
      subject: string;
      title: string;
      message: string;
      ctaUrl?: string;
    },
    userEmails?: Array<{ userId: string; email: string; firstName: string; lang: 'en' | 'fr' }>
  ): Promise<{ notifications: number; emailsSent: number; emailsFailed: number }> {
    // Create notifications in bulk
    const notificationData = userIds.map(userId => ({
      userId,
      title: promotionData.title,
      message: promotionData.message,
      type: 'PROMOTION',
    }));

    const notificationsCreated = await NotificationRepository.createBulkNotifications(
      notificationData
    );

    // Send emails if user emails provided
    let emailsSent = 0;
    let emailsFailed = 0;

    if (userEmails && userEmails.length > 0) {
      for (const user of userEmails) {
        try {
          const emailTemplate = this.emailService.generatePromotionEmail(
            user.firstName,
            promotionData,
            user.lang,
            t
          );

          await this.emailService.sendEmail({
            to: user.email,
            subject: emailTemplate.subject,
            html: emailTemplate.html,
          });
          emailsSent++;
        } catch (error) {
          console.error(`Failed to send promotion email to ${user.email}:`, error);
          emailsFailed++;
        }
      }
    }

    return {
      notifications: notificationsCreated,
      emailsSent,
      emailsFailed,
    };
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(
    userId: string,
    options?: { limit?: number; offset?: number; unreadOnly?: boolean }
  ): Promise<Notification[]> {
    return await NotificationRepository.findByUserId(userId, options);
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string): Promise<number> {
    return await NotificationRepository.getUnreadCount(userId);
  }

  /**
   * Mark as read
   */
  async markAsRead(notificationId: string): Promise<Notification | null> {
    const notification = await NotificationRepository.markAsRead(notificationId);
    
    // Mettre à jour le nombre de notifications non lues via SSE
    if (notification) {
      try {
        await notificationSSEService.updateUnreadCountForUser(notification.userId);
      } catch (error) {
        console.error('Failed to update unread count via SSE:', error);
      }
    }
    
    return notification;
  }

  /**
   * Mark all as read
   */
  async markAllAsRead(userId: string): Promise<number> {
    const count = await NotificationRepository.markAllAsRead(userId);
    
    // Mettre à jour le nombre de notifications non lues via SSE
    try {
      await notificationSSEService.updateUnreadCountForUser(userId);
    } catch (error) {
      console.error('Failed to update unread count via SSE:', error);
    }
    
    return count;
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string): Promise<boolean> {
    return await NotificationRepository.deleteNotification(notificationId);
  }

  /**
   * Helper method to send notification-specific emails
   */
  private async sendNotificationEmail(
    _type: string,
    emailData: { userEmail: string; firstName: string; lang: 'en' | 'fr' },
    content: { title: string; message: string }
  ): Promise<void> {
    // This is a fallback for generic notification emails
    // Specific notification types should use their dedicated email methods
    const { userEmail, firstName } = emailData;

    const html = `
      <h2>${content.title}</h2>
      <p>Hello ${firstName},</p>
      <p>${content.message}</p>
      <p>Best regards,<br>FreeBike Team</p>
    `;

    await this.emailService.sendEmail({
      to: userEmail,
      subject: content.title,
      html,
    });
  }

  /**
   * Notify admins about new review
   */
  async notifyAdminsAboutNewReview(review: any): Promise<void> {
    // This would notify admins in a real implementation
    console.log('New review pending approval:', review.id);
  }

  /**
   * Notify admins about refund request
   */
  async notifyAdminsAboutRefundRequest(refund: any): Promise<void> {
    // This would notify admins in a real implementation
    console.log('New refund request:', refund.id);
  }

  /**
   * Notify admins about new support ticket
   */
  async notifyAdminsAboutNewTicket(ticket: any): Promise<void> {
    // This would notify admins in a real implementation
    console.log('New support ticket:', ticket.id);
  }

  /**
   * Notify maintenance team about alert
   */
  async notifyMaintenanceTeam(alert: any): Promise<void> {
    // This would notify maintenance team in a real implementation
    console.log('New maintenance alert:', alert.id);
  }

  /**
   * Create a simple notification
   */
  async create(data: {
    userId: string;
    type: string;
    category: string;
    title: string;
    message: string;
    read: boolean;
    actionUrl?: string;
  }): Promise<void> {
    await this.createNotification({
      userId: data.userId,
      title: data.title,
      message: data.message,
      type: data.type,
      metadata: data.actionUrl ? { actionUrl: data.actionUrl } : undefined
    });
  }
}

export default NotificationService;