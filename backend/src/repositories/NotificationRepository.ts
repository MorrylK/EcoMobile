import { BaseRepository } from './BaseRepository';
import { prisma } from '../config/prisma';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  metadata?: any;
  createdAt: Date;
}

export interface CreateNotificationDTO {
  userId: string;
  title: string;
  message: string;
  type: string;
  metadata?: any;
}

class NotificationRepository extends BaseRepository<Notification> {
  constructor() {
    super('notification');
  }

  /**
   * Get all notifications for a user
   */
  async findByUserId(
    userId: string,
    options?: { limit?: number; offset?: number; unreadOnly?: boolean }
  ): Promise<Notification[]> {
    const { limit = 50, offset = 0, unreadOnly = false } = options || {};

    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly && { isRead: false }),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    });

    return notifications as Notification[];
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return await prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  }

  /**
   * Mark notification as read
   */
  async markAsRead(id: string): Promise<Notification | null> {
    const notification = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return notification as Notification;
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<number> {
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return result.count;
  }

  /**
   * Delete notification
   */
  async deleteNotification(id: string): Promise<boolean> {
    try {
      await prisma.notification.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Bulk delete notifications
   */
  async bulkDeleteNotifications(notificationIds: string[]): Promise<number> {
    const result = await prisma.notification.deleteMany({
      where: {
        id: {
          in: notificationIds,
        },
      },
    });

    return result.count;
  }

  /**
   * Delete all notifications for a user
   */
  async deleteAllForUser(userId: string): Promise<number> {
    const result = await prisma.notification.deleteMany({
      where: { userId },
    });

    return result.count;
  }

  /**
   * Delete old notifications (older than specified days)
   */
  async deleteOldNotifications(daysOld: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await prisma.notification.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
        isRead: true,
      },
    });

    return result.count;
  }

  /**
   * Create notification
   */
  async createNotification(data: CreateNotificationDTO): Promise<Notification> {
    const notification = await prisma.notification.create({
      data,
    });

    return notification as Notification;
  }

  /**
   * Create bulk notifications
   */
  async createBulkNotifications(
    notifications: CreateNotificationDTO[]
  ): Promise<number> {
    const result = await prisma.notification.createMany({
      data: notifications,
    });

    return result.count;
  }

  /**
   * Get notification by ID
   */
  async findById(id: string): Promise<Notification | null> {
    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    return notification as Notification | null;
  }

  /**
   * Get notifications by type
   */
  async findByType(
    userId: string,
    type: string,
    limit: number = 20
  ): Promise<Notification[]> {
    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        type,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return notifications as Notification[];
  }
}

export default new NotificationRepository();