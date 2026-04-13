import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Internal notify method.
   * Records a notification into the DB for in-app retrieval.
   */
  async notify(userId: string, title: string, message: string, type: string, metadata?: any) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.organizationId) {
      console.warn('Cannot send notification, user or org missing.');
      return null;
    }
    return this.prisma.notification.create({
      data: {
        userId,
        organizationId: user.organizationId,
        title,
        message,
        type,
        metadata: metadata || {},
      },
    });
  }

  /**
   * Fetch latest notifications for a user (Inbox)
   */
  async findAllForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  /**
   * Toggle unread/read state
   */
  async markAsRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) throw new NotFoundException('Notification not found.');
    if (notification.userId !== userId) throw new ForbiddenException('Unauthorized.');

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }
}
