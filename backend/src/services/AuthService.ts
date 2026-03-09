import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { UserRepository, SessionRepository } from '../repositories';
import { LoginRequest, RegisterRequest, AuthResponse } from '../models/types';
import { generateToken, generateRefreshToken } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { t } from '../locales';
import NotificationService from './NotificationService';
import { EmailVerificationService } from './EmailVerificationService';
import { SmsVerificationService } from './SmsVerificationService';
import FreeDaysRuleService from './FreeDaysRuleService';

export class AuthService {
  private userRepository: UserRepository;
  private sessionRepository: SessionRepository;
  private notificationService: NotificationService;
  private emailVerificationService: EmailVerificationService;
  private smsVerificationService: SmsVerificationService;

  constructor() {
    this.userRepository = new UserRepository();
    this.sessionRepository = new SessionRepository();
    this.notificationService = new NotificationService();
    this.emailVerificationService = new EmailVerificationService();
    this.smsVerificationService = new SmsVerificationService();
  }

  async register(data: RegisterRequest, language: 'fr' | 'en' = 'fr'): Promise<AuthResponse> {
    const existingUser = await this.userRepository.findByEmail(data.email);
    if (existingUser) {
      throw new AppError(t('auth.register.email_exists', language), 400);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Générer le token de vérification
    const verificationToken = this.emailVerificationService.generateVerificationToken();
    const verificationExpires = this.emailVerificationService.getTokenExpiration();

    // Create user with pending verification status
    const user = await this.userRepository.create({
      email: data.email,
      password: hashedPassword,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      role: 'USER',
      status: 'pending_verification',
      isActive: false,
      emailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires,
      phoneVerified: false,
      language: data.language || language
    });

    // Send verification email
    try {
      await this.emailVerificationService.sendVerificationEmail(
        user.id,
        user.email,
        user.firstName,
        verificationToken,
        language
      );
    } catch (error) {
      console.error(t('error.email_verification_failed', language), error);
    }

    // Remove password from response
    const { password, ...userWithoutPassword } = user;

    // Generate tokens
    const token = generateToken({ id: user.id, email: user.email, role: user.role, roleId: user.roleId || '', emailVerified: false });
    const refreshToken = generateRefreshToken({ id: user.id, email: user.email, role: user.role, roleId: user.roleId || '', emailVerified: false });

    // Send welcome notification and email
    try {
      await this.notificationService.sendWelcomeNotification(
        user.id,
        user.email,
        user.firstName,
        language
      );
    } catch (error) {
      console.error(t('error.welcome_notification_failed', language), error);
      // Don't throw - registration was successful
    }

    // Apply automatic free days rules for new users
    try {
      await FreeDaysRuleService.applyAutoRulesToNewUser(user.id);
    } catch (error) {
      console.error('Failed to apply free days rules:', error);
      // Don't throw - registration was successful
    }

    return {
      user: { ...userWithoutPassword, emailVerified: false },
      token,
      refreshToken
    };
  }

  async login(credentials: LoginRequest, language: 'fr' | 'en' = 'fr', req?: any): Promise<AuthResponse> {
    // Find user
    const user = await this.userRepository.findByEmail(credentials.email);
    if (!user) {
      throw new AppError(t('auth.login.failed', language), 401);
    }

    // Check password
    const isValidPassword = await bcrypt.compare(credentials.password, user.password!);
    if (!isValidPassword) {
      throw new AppError(t('auth.login.failed', language), 401);
    }

    // Note: Email verification is no longer blocking - user can login but account status will be pending
    // Check if user account is verified by admin (not just active status)
    // Users with pending_verification status can login but will be redirected to document submission
    
    // Vérifier si le compte est désactivé/bloqué
    const deactivatedStatuses = ['suspended', 'banned', 'blocked', 'inactive', 'deleted'];
    if (deactivatedStatuses.includes(user.status) || user.isActive === false) {
      throw new AppError(t('auth.account.deactivated', language), 403);
    }

    // Remove password from response
    const { password, ...userWithoutPassword } = user;

    // Generate tokens
    const token = generateToken({ id: user.id, email: user.email, role: user.role, roleId: user.roleId || '', emailVerified: user.emailVerified });
    const refreshToken = generateRefreshToken({ id: user.id, email: user.email, role: user.role, roleId: user.roleId || '', emailVerified: user.emailVerified });
    
    if (req) {
      try {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        await this.sessionRepository.createSession({
          userId: user.id,
          token: token,
          device: this.parseDeviceFromUserAgent(req.get('User-Agent'), language),
          location: await this.getLocationFromIP(req.ip, language),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          expiresAt
        });
      } catch (sessionError) {
        console.error('Failed to create session:', sessionError);
        // Continue login even if session creation fails
      }
    }

    return {
      user: userWithoutPassword,
      token,
      refreshToken
    };
  }

  async getUserById(userId: string, language: 'fr' | 'en' = 'fr'): Promise<any> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AppError(t('user.not_found', language), 404);
    }

    // Remove password from response
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async updateProfile(userId: string, data: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    address?: string;
    avatar?: string;
  }, language: 'fr' | 'en' = 'fr'): Promise<any> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AppError(t('user.not_found', language), 404);
    }

    // Check if email is being changed and already exists
    if (data.email !== user.email) {
      const existingUser = await this.userRepository.findByEmail(data.email);
      if (existingUser && existingUser.id !== userId) {
        throw new AppError(t('auth.register.email_exists', language), 400);
      }
    }

    const updatedUser = await this.userRepository.update(userId, {
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      address: data.address,
      avatar: data.avatar,
    });

    const { password, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  }

  async getSessions(userId: string, language: 'fr' | 'en' = 'fr'): Promise<any[]> {
    try {
      // Clean up expired sessions first
      await this.sessionRepository.deleteExpiredSessions();
      
      // Get active sessions for the user
      const sessions = await this.sessionRepository.getUserSessionsWithDetails(userId);
      return sessions;
    } catch (error) {
      console.error('Error fetching sessions:', error);
      throw new AppError(t('session.fetch.error', language), 500);
    }
  }

  async disconnectSession(userId: string, sessionId: string, language: 'fr' | 'en' = 'fr'): Promise<void> {
    try {
      // Verify the session belongs to the user
      const sessions = await this.sessionRepository.findByUserId(userId);
      const session = sessions.find((s: { id: string; }) => s.id === sessionId);
      
      if (!session) {
        throw new AppError(t('session.not_found', language), 404);
      }

      await this.sessionRepository.deactivateSession(sessionId);
    } catch (error) {
      console.error('Error disconnecting session:', error);
      throw new AppError(t('session.disconnect.error', language), 500);
    }
  }

  async disconnectAllSessions(userId: string, language: 'fr' | 'en' = 'fr'): Promise<void> {
    try {
      await this.sessionRepository.deactivateAllUserSessions(userId);
    } catch (error) {
      console.error('Error disconnecting all sessions:', error);
      throw new AppError(t('session.disconnect_all.error', language), 500);
    }
  }

  async forgotPassword(email: string, language: 'fr' | 'en' = 'fr'): Promise<string> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      // Don't reveal if user exists or not for security
      throw new AppError(t('auth.forgot_password.success', language), 200);
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Send password reset notification and email
    try {
      await this.notificationService.sendPasswordResetNotification(
        user.id,
        user.email,
        user.firstName,
        resetToken,
        language
      );
    } catch (error) {
      console.error(t('error.password_reset_failed', language), error);
      throw new AppError(t('error.password_reset_failed', language), 500);
    }

    throw new AppError(t('auth.forgot_password.success', language), 200);
  }

  async resetPassword(email: string, newPassword: string, language: 'fr' | 'en' = 'fr'): Promise<any> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new AppError(t('user.not_found', language), 404);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await this.userRepository.updatePassword(user.id, hashedPassword);

    // Deactivate all sessions for security
    await this.sessionRepository.deactivateAllUserSessions(user.id);

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string, language: 'fr' | 'en' = 'fr'): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AppError(t('user.not_found', language), 404);
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.password!);
    if (!isValidPassword) {
      throw new AppError(t('auth.password.current.invalid', language), 401);
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      throw new AppError(t('validation.password.min_length', language), 400);
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      throw new AppError(t('validation.password.complexity', language), 400);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await this.userRepository.updatePassword(userId, hashedPassword);
  }

  async logout(userId: string, _language: 'fr' | 'en' = 'fr'): Promise<void> {
    try {
      await this.sessionRepository.deactivateAllUserSessions(userId);
    } catch (error) {
      console.error('Error during logout:', error);
    }
  }

  /**
   * Vérifier l'email avec le token
   */
  async verifyEmail(userId: string, token: string, language: 'fr' | 'en' = 'fr'): Promise<boolean> {
    const user = await this.userRepository.findById(userId);
    
    if (!user) {
      throw new AppError(t('user.not_found', language), 404);
    }

    // Vérifier si l'email est déjà vérifié
    if (user.emailVerified) {
      throw new AppError(t('error.email_already_verified', language), 400);
    }

    // Vérifier le token
    if (!user.emailVerificationToken || user.emailVerificationToken !== token) {
      throw new AppError(t('error.invalid_verification_token', language), 400);
    }

    // Vérifier l'expiration
    if (!user.emailVerificationExpires || new Date() > user.emailVerificationExpires) {
      throw new AppError(t('error.verification_token_expired', language), 400);
    }

    // Mettre à jour l'utilisateur
    await this.userRepository.update(userId, {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null
    });

    // Envoyer une notification de confirmation
    try {
      await this.notificationService.sendEmailVerifiedConfirmation(
        user.id,
        user.email,
        user.firstName,
        language
      );
    } catch (error) {
      console.error('Failed to send verification confirmation:', error);
    }

    return true;
  }

  /**
   * Resend the verification email
   */
  async resendVerificationEmail(email: string, language: 'fr' | 'en' = 'fr'): Promise<boolean> {
    const user = await this.userRepository.findByEmail(email);
    
    if (!user) {
      return true;
    }

    if (user.emailVerified) {
      throw new AppError(t('error.email_already_verified', language), 400);
    }

    // Generate new verification token
    const verificationToken = this.emailVerificationService.generateVerificationToken();
    const verificationExpires = this.emailVerificationService.getTokenExpiration();

    // Update user with new token
    await this.userRepository.updateEmailVerificationToken(
      user.id, 
      verificationToken, 
      verificationExpires
    );

    // Send new verification email
    await this.emailVerificationService.sendVerificationEmail(
      user.id,
      user.email,
      user.firstName,
      verificationToken,
      language
    );

    return true;
  }

  private parseDeviceFromUserAgent(userAgent?: string, language: 'fr' | 'en' = 'fr'): string {
    if (!userAgent) return t('device.unknown', language);
    
    if (userAgent.includes('Chrome')) {
      if (userAgent.includes('Windows')) return 'Chrome sur Windows';
      if (userAgent.includes('Mac')) return 'Chrome sur Mac';
      if (userAgent.includes('Android')) return 'Chrome sur Android';
      return 'Chrome';
    }
    
    if (userAgent.includes('Safari')) {
      if (userAgent.includes('iPhone')) return 'Safari sur iPhone';
      if (userAgent.includes('iPad')) return 'Safari sur iPad';
      if (userAgent.includes('Mac')) return 'Safari sur Mac';
      return 'Safari';
    }
    
    if (userAgent.includes('Firefox')) {
      if (userAgent.includes('Windows')) return 'Firefox sur Windows';
      if (userAgent.includes('Mac')) return 'Firefox sur Mac';
      return 'Firefox';
    }
    
    return 'Navigateur inconnu';
  }

  private async getLocationFromIP(ip?: string, language: 'fr' | 'en' = 'fr'): Promise<string> {
    if (!ip || ip === '127.0.0.1' || ip === '::1') {
      return t('location.local', language);
    }
    return t('location.cameroon', language); // Default for your app context
  }

  /**
   * Initiate phone verification
   */
  async initiatePhoneVerification(userId: string, phoneNumber: string, language: 'fr' | 'en' = 'fr'): Promise<string> {
    return await this.smsVerificationService.initiatePhoneVerification(userId, phoneNumber, language);
  }

  /**
   * Verify phone code
   */
  async verifyPhoneCode(userId: string, code: string): Promise<boolean> {
    return await this.smsVerificationService.verifyPhoneCode(userId, code);
  }

  /**
   * Resend phone verification code
   */
  async resendPhoneVerification(userId: string, language: 'fr' | 'en' = 'fr'): Promise<void> {
    await this.smsVerificationService.resendVerificationCode(userId, language);
  }
}