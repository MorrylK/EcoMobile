import express, { Request } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';
import { prisma } from '../config/prisma';
import { UserRole } from '@prisma/client';
import { t } from '../locales';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
        roleId: string | null;
        permissions: string[];
        emailVerified: boolean
      };
      language?: 'fr' | 'en';
    }
  }
}

interface LogRequest {
  ip?: string;
  connection?: {
    remoteAddress?: string;
  };
  headers?: {
    'user-agent'?: string;
  };
}

export type AuthRequest = Request;

// Service pour logger les activités
export const logActivity = async (
  userId: string | null,
  action: string,
  resource: string,
  resourceId?: string,
  details?: string,
  metadata?: any,
  req?: LogRequest
) => {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        resource,
        resourceId,
        details,
        metadata,
        ipAddress: req?.ip || req?.connection?.remoteAddress,
        userAgent: req?.headers?.['user-agent']
      }
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};

export const authenticate = async (req: AuthRequest, res: express.Response, next: express.NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: t('auth.token.missing', req.language)
      });
      return;
    }

    const token = authHeader.substring(7);

    try {
      const secret = config.jwt.secret;
      if (!secret) {
        throw new Error('JWT secret is not configured');
      }

      const decoded = jwt.verify(token, secret as string) as {
        id: string;
        email: string;
        role: string;
        roleId: string;
        emailVerified?: boolean
      };

      // Récupérer les permissions de l'utilisateur
      const userWithPermissions = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          email: true,
          role: true,
          roleId: true,
          isActive: true,
          status: true,
          emailVerified: true,
          roleRelation: {
            include: {
              permissions: {
                include: {
                  permission: true
                }
              }
            }
          }
        }
      });

      if (!userWithPermissions) {
        res.status(401).json({
          success: false,
          error: t('auth.user.not_found', req.language)
        });
        return;
      }

      // Autoriser les utilisateurs avec pending_verification pour certaines actions
      // (gestion dans authenticateWithPendingVerification)
      // Bloquer seulement les comptes bannis ou suspendus
      if (userWithPermissions.status === 'banned' || userWithPermissions.status === 'suspended') {
        res.status(403).json({
          success: false,
          error: t('auth.account.deactivated', req.language)
        });
        return;
      }

      // Pour les utilisateurs en attente de vérification, on les autorise uniquement
      // pour certaines actions spécifiques (soumission de documents, vérification téléphone, etc.)
      // mais on bloque leur accès aux fonctionnalités principales de l'application
      if (!userWithPermissions.isActive && userWithPermissions.status !== 'pending_verification') {
        res.status(403).json({
          success: false,
          error: t('auth.account.deactivated', req.language)
        });
        return;
      }

      const permissions = userWithPermissions.roleRelation?.permissions.map(
        (        rp: { permission: { resource: any; action: any; }; }) => `${rp.permission.resource}:${rp.permission.action}`
      ) || [];

      req.user = {
        id: userWithPermissions.id,
        email: userWithPermissions.email,
        role: userWithPermissions.role,
        roleId: userWithPermissions.roleId,
        permissions: permissions || [],
        emailVerified: userWithPermissions.emailVerified
      };

      next();
    } catch (error) {
      res.status(401).json({
        success: false,
        error: t('auth.token.invalid', req.language)
      });
      return;
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: t('error.server', req.language)
    });
    return;
  }
};

/**
 * Authentification pour le stream SSE : accepte le token en query (?token=) ou en header Bearer.
 * EventSource ne permet pas d'envoyer des headers personnalisés, d'où le support du token en query.
 */
export const authenticateSSE = async (req: AuthRequest, res: express.Response, next: express.NextFunction): Promise<void> => {
  try {
    const tokenFromQuery = req.query.token as string | undefined;
    const authHeader = req.headers.authorization;
    const token = tokenFromQuery || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined);

    if (!token) {
      res.status(401).json({
        success: false,
        error: t('auth.token.missing', req.language)
      });
      return;
    }

    try {
      const secret = config.jwt.secret;
      if (!secret) {
        throw new Error('JWT secret is not configured');
      }

      const decoded = jwt.verify(token, secret as string) as {
        id: string;
        email: string;
        role: string;
        roleId: string;
        emailVerified?: boolean;
      };

      const userWithPermissions = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          email: true,
          role: true,
          roleId: true,
          isActive: true,
          status: true,
          emailVerified: true,
          roleRelation: {
            include: {
              permissions: {
                include: {
                  permission: true
                }
              }
            }
          }
        }
      });

      if (!userWithPermissions) {
        res.status(401).json({
          success: false,
          error: t('auth.user.not_found', req.language)
        });
        return;
      }

      if (userWithPermissions.status === 'banned' || userWithPermissions.status === 'suspended') {
        res.status(403).json({
          success: false,
          error: t('auth.account.deactivated', req.language)
        });
        return;
      }

      if (!userWithPermissions.isActive && userWithPermissions.status !== 'pending_verification') {
        res.status(403).json({
          success: false,
          error: t('auth.account.deactivated', req.language)
        });
        return;
      }

      const permissions = userWithPermissions.roleRelation?.permissions.map(
        (rp: { permission: { resource: string; action: string } }) => `${rp.permission.resource}:${rp.permission.action}`
      ) || [];

      req.user = {
        id: userWithPermissions.id,
        email: userWithPermissions.email,
        role: userWithPermissions.role,
        roleId: userWithPermissions.roleId,
        permissions: permissions || [],
        emailVerified: userWithPermissions.emailVerified
      };

      next();
    } catch {
      res.status(401).json({
        success: false,
        error: t('auth.token.invalid', req.language)
      });
      return;
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: t('error.server', req.language)
    });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: express.Response, next: express.NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: t('auth.unauthorized', req.language)
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: t('auth.forbidden', req.language)
      });
      return;
    }

    next();
  };
};

export const requirePermission = (resource: string, action: string) => {
  return async (req: AuthRequest, res: express.Response, next: express.NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: t('auth.unauthorized', req.language)
      });
      return;
    }

    const requiredPermission = `${resource}:${action}`;
    const hasPermission = req.user.role === 'SUPER_ADMIN' ||
                         req.user.permissions?.includes(requiredPermission) || 
                         req.user.permissions?.includes(`${resource}:manage`) ||
                         req.user.permissions?.includes('admin:manage');

    if (!hasPermission) {
      // Logger la tentative d'accès non autorisée
      await logActivity(
        req.user.id,
        'ACCESS_DENIED',
        resource,
        '',
        `Attempted ${action} on ${resource} without permission`,
        { requiredPermission, userPermissions: req.user.permissions },
        req
      );

      res.status(403).json({
        success: false,
        error: t('auth.insufficient_permissions', req.language)
      });
      return;
    }

    next();
  };
};

export const requireAdmin = authorize('ADMIN', 'SUPER_ADMIN');

/**
 * Middleware d'authentification qui autorise les utilisateurs avec pending_verification
 * Utilisé pour les routes de vérification (téléphone, documents, profil basique)
 */
export const authenticateWithPendingVerification = async (req: AuthRequest, res: express.Response, next: express.NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: t('auth.token.missing', req.language)
      });
      return;
    }

    const token = authHeader.substring(7);

    try {
      const secret = config.jwt.secret;
      if (!secret) {
        throw new Error('JWT secret is not configured');
      }

      const decoded = jwt.verify(token, secret as string) as {
        id: string;
        email: string;
        role: string;
        roleId: string;
        emailVerified?: boolean
      };

      // Récupérer les permissions de l'utilisateur
      const userWithPermissions = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          email: true,
          role: true,
          roleId: true,
          isActive: true,
          status: true,
          emailVerified: true,
          roleRelation: {
            include: {
              permissions: {
                include: {
                  permission: true
                }
              }
            }
          }
        }
      });

      if (!userWithPermissions) {
        res.status(401).json({
          success: false,
          error: t('auth.user.not_found', req.language)
        });
        return;
      }

      // Autoriser uniquement les utilisateurs actifs ou en attente de vérification
      // Bloquer les comptes bannis ou suspendus
      if (userWithPermissions.status === 'banned' || userWithPermissions.status === 'suspended') {
        res.status(403).json({
          success: false,
          error: t('auth.account.deactivated', req.language)
        });
        return;
      }

      // Autoriser les utilisateurs avec pending_verification pour la vérification
      if (userWithPermissions.status !== 'active' && userWithPermissions.status !== 'pending_verification') {
        res.status(403).json({
          success: false,
          error: t('auth.account.deactivated', req.language)
        });
        return;
      }

      const permissions = userWithPermissions.roleRelation?.permissions.map(
        (        rp: { permission: { resource: any; action: any; }; }) => `${rp.permission.resource}:${rp.permission.action}`
      ) || [];

      req.user = {
        id: userWithPermissions.id,
        email: userWithPermissions.email,
        role: userWithPermissions.role,
        roleId: userWithPermissions.roleId,
        permissions: permissions || [],
        emailVerified: userWithPermissions.emailVerified
      };

      next();
    } catch (error) {
      res.status(401).json({
        success: false,
        error: t('auth.token.invalid', req.language)
      });
      return;
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: t('error.server', req.language)
    });
    return;
  }
};

export const optionalAuth = async (req: AuthRequest, _res: express.Response, next: express.NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      try {
        const secret = config.jwt.secret;
        if (secret) {
          const decoded = jwt.verify(token, secret as string) as {
            id: string;
            email: string;
            role: string;
            roleId: string;
          };

          const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: {
              id: true,
              email: true,
              role: true,
              roleId: true,
              emailVerified: true,
              roleRelation: {
                include: {
                  permissions: {
                    include: {
                      permission: true
                    }
                  }
                }
              }
            }
          });

          if (user) {
            const permissions = user.roleRelation?.permissions?.map(
              (rp: any) => `${rp.permission.resource}:${rp.permission.action}`
            ) || [];

            req.user = {
              id: user.id,
              email: user.email,
              role: user.role,
              roleId: user.roleId,
              permissions,
              emailVerified: user.emailVerified
            };
          }
        }
      } catch (error) {
        // Token invalid but continue anyway
      }
    }

    next();
  } catch (error) {
    next();
  }
};

export const generateToken = (user: { id: string; email: string; role: string; roleId: string; emailVerified?: boolean; }): string => {
  const secret = config.jwt.secret;
  if (!secret) {
    throw new Error('JWT secret is not configured');
  }
  
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    roleId: user.roleId,
    emailVerified: user.emailVerified || false
  };
  
  return jwt.sign(payload, secret, {
    expiresIn: '24h',
    algorithm: "HS256"
  });
};

export const generateRefreshToken = (user: { id: string; email: string; role: string; roleId: string; emailVerified?: boolean; }): string => {
  const refreshSecret = config.jwt.refreshSecret;
  if (!refreshSecret) {
    throw new Error('JWT refresh secret is not configured');
  }
  
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    roleId: user.roleId
  };
  
  return jwt.sign(payload, refreshSecret, {
    expiresIn: '7d',
    algorithm: "HS256"
  });
};

export const verifyRefreshToken = (token: string): { id: string; email: string; role: string; roleId: string } | null => {
  try {
    const refreshSecret = config.jwt.refreshSecret;
    if (!refreshSecret) {
      return null;
    }
    
    return jwt.verify(token, refreshSecret as string) as {
      id: string;
      email: string;
      role: string;
      roleId: string;
    };
  } catch (error) {
    return null;
  }
};

export const detectLanguage = (req: AuthRequest, _res: express.Response, next: express.NextFunction): void => {
  try {
    const acceptLanguage = req.headers['accept-language'];
    const queryLang = req.query.lang as string;
    const cookieLang = req.cookies?.lang;
    
    if (queryLang && ['fr', 'en'].includes(queryLang.toLowerCase())) {
      req.language = queryLang.toLowerCase() as 'fr' | 'en';
    } else if (cookieLang && ['fr', 'en'].includes(cookieLang.toLowerCase())) {
      req.language = cookieLang.toLowerCase() as 'fr' | 'en';
    } else if (acceptLanguage) {
      const preferredLang = acceptLanguage.split(',')[0].split('-')[0].toLowerCase();
      req.language = ['fr', 'en'].includes(preferredLang) ? preferredLang as 'fr' | 'en' : 'fr';
    } else {
      req.language = 'fr';
    }
    
    next();
  } catch (error) {
    req.language = 'fr';
    next();
  }
};