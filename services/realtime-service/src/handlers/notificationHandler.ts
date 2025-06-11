import { Server } from 'socket.io';
import { AuthenticatedSocket, SocketEvent, NotificationPayload, NotificationType } from '../types';
import { createLogger } from '../utils/logger';
import { eventsEmitted } from '../utils/metrics';

const logger = createLogger('notification-handler');

export class NotificationHandler {
  private io: Server;
  
  constructor(io: Server) {
    this.io = io;
  }
  
  async sendNotification(
    userId: string,
    notification: NotificationPayload
  ): Promise<void> {
    logger.info({
      event: 'sending_notification',
      userId,
      notificationId: notification.id,
      type: notification.type,
      priority: notification.priority,
    });
    
    // Send to user's sockets
    this.io.to(`user:${userId}`).emit(SocketEvent.NOTIFICATION, notification);
    
    eventsEmitted.inc({ event: SocketEvent.NOTIFICATION, broadcast: 'false' });
  }
  
  async broadcastNotification(
    companyId: string,
    notification: NotificationPayload
  ): Promise<void> {
    logger.info({
      event: 'broadcasting_notification',
      companyId,
      notificationId: notification.id,
      type: notification.type,
      priority: notification.priority,
    });
    
    // Broadcast to company
    this.io.to(`company:${companyId}`).emit(SocketEvent.NOTIFICATION, notification);
    
    eventsEmitted.inc({ event: SocketEvent.NOTIFICATION, broadcast: 'true' });
  }
  
  async sendAlert(
    userId: string,
    title: string,
    message: string,
    priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium'
  ): Promise<void> {
    const notification: NotificationPayload = {
      id: `alert-${Date.now()}`,
      type: NotificationType.WARNING,
      title,
      message,
      priority,
      metadata: {
        timestamp: new Date(),
      },
    };
    
    await this.sendNotification(userId, notification);
  }
  
  async notifyOpportunityMatch(
    userId: string,
    opportunity: any
  ): Promise<void> {
    const notification: NotificationPayload = {
      id: `opp-${opportunity.noticeId}-${Date.now()}`,
      type: NotificationType.OPPORTUNITY,
      title: 'New Opportunity Match',
      message: `A new opportunity matches your criteria: ${opportunity.title}`,
      priority: 'high',
      metadata: {
        opportunityId: opportunity.id,
        noticeId: opportunity.noticeId,
        postedDate: opportunity.postedDate,
        responseDeadline: opportunity.responseDeadline,
      },
    };
    
    await this.sendNotification(userId, notification);
  }
  
  async notifyProposalUpdate(
    userId: string,
    proposalId: string,
    status: string,
    message: string
  ): Promise<void> {
    const notification: NotificationPayload = {
      id: `proposal-${proposalId}-${Date.now()}`,
      type: NotificationType.PROPOSAL,
      title: 'Proposal Status Update',
      message,
      priority: 'medium',
      metadata: {
        proposalId,
        status,
        timestamp: new Date(),
      },
    };
    
    await this.sendNotification(userId, notification);
  }
  
  async notifyComplianceUpdate(
    companyId: string,
    matrixId: string,
    status: string
  ): Promise<void> {
    const notification: NotificationPayload = {
      id: `compliance-${matrixId}-${Date.now()}`,
      type: NotificationType.COMPLIANCE,
      title: 'Compliance Matrix Update',
      message: `Compliance matrix ${matrixId} status: ${status}`,
      priority: 'medium',
      metadata: {
        matrixId,
        status,
        timestamp: new Date(),
      },
    };
    
    await this.broadcastNotification(companyId, notification);
  }
  
  async notifyError(
    userId: string,
    error: string,
    context?: Record<string, any>
  ): Promise<void> {
    const notification: NotificationPayload = {
      id: `error-${Date.now()}`,
      type: NotificationType.ERROR,
      title: 'Error Occurred',
      message: error,
      priority: 'high',
      metadata: {
        context,
        timestamp: new Date(),
      },
    };
    
    await this.sendNotification(userId, notification);
  }
}