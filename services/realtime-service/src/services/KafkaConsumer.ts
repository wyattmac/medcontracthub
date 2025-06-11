import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { Server } from 'socket.io';
import { config } from '../config';
import { createLogger } from '../utils/logger';
import { kafkaMessagesConsumed, kafkaConsumerLag } from '../utils/metrics';
import { NotificationHandler } from '../handlers/notificationHandler';
import { KafkaMessage, BroadcastMessage } from '../types';

const logger = createLogger('kafka-consumer');

export class KafkaConsumerService {
  private kafka: Kafka;
  private consumer: Consumer;
  private io: Server;
  private notificationHandler: NotificationHandler;
  private isRunning: boolean = false;
  
  constructor(io: Server, notificationHandler: NotificationHandler) {
    this.io = io;
    this.notificationHandler = notificationHandler;
    
    this.kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: config.kafka.brokers,
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    });
    
    this.consumer = this.kafka.consumer({
      groupId: config.kafka.groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });
  }
  
  async start(): Promise<void> {
    try {
      logger.info('Starting Kafka consumer...');
      
      // Connect to Kafka
      await this.consumer.connect();
      
      // Subscribe to topics
      const topics = Object.values(config.kafka.topics);
      await this.consumer.subscribe({
        topics,
        fromBeginning: false,
      });
      
      logger.info({
        event: 'kafka_subscribed',
        topics,
      });
      
      this.isRunning = true;
      
      // Start consuming messages
      await this.consumer.run({
        eachMessage: async (payload) => this.handleMessage(payload),
      });
      
    } catch (error) {
      logger.error({
        event: 'kafka_consumer_error',
        error,
      });
      throw error;
    }
  }
  
  async stop(): Promise<void> {
    this.isRunning = false;
    await this.consumer.disconnect();
    logger.info('Kafka consumer stopped');
  }
  
  private async handleMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload;
    
    try {
      const value = message.value?.toString();
      if (!value) {
        return;
      }
      
      const parsedMessage = JSON.parse(value);
      
      logger.debug({
        event: 'kafka_message_received',
        topic,
        partition,
        offset: message.offset,
        key: message.key?.toString(),
      });
      
      // Route message based on topic
      switch (topic) {
        case config.kafka.topics.notifications:
          await this.handleNotificationMessage(parsedMessage);
          break;
          
        case config.kafka.topics.proposals:
          await this.handleProposalMessage(parsedMessage);
          break;
          
        case config.kafka.topics.opportunities:
          await this.handleOpportunityMessage(parsedMessage);
          break;
          
        case config.kafka.topics.compliance:
          await this.handleComplianceMessage(parsedMessage);
          break;
          
        case config.kafka.topics.analytics:
          await this.handleAnalyticsMessage(parsedMessage);
          break;
          
        default:
          logger.warn({
            event: 'unknown_topic',
            topic,
          });
      }
      
      kafkaMessagesConsumed.inc({ topic, status: 'success' });
      
      // Update consumer lag metric
      const lag = parseInt(message.offset) - parseInt(payload.heartbeat.offset);
      kafkaConsumerLag.set({ topic, partition: partition.toString() }, lag);
      
    } catch (error) {
      logger.error({
        event: 'kafka_message_error',
        error,
        topic,
        partition,
        offset: message.offset,
      });
      
      kafkaMessagesConsumed.inc({ topic, status: 'error' });
    }
  }
  
  private async handleNotificationMessage(message: any): Promise<void> {
    const { userId, companyId, notification } = message;
    
    if (userId) {
      await this.notificationHandler.sendNotification(userId, notification);
    } else if (companyId) {
      await this.notificationHandler.broadcastNotification(companyId, notification);
    }
  }
  
  private async handleProposalMessage(message: any): Promise<void> {
    const { proposalId, userId, status, action } = message;
    
    switch (action) {
      case 'status_update':
        await this.notificationHandler.notifyProposalUpdate(
          userId,
          proposalId,
          status,
          `Proposal ${proposalId} status changed to ${status}`
        );
        break;
        
      case 'generation_complete':
        await this.notificationHandler.sendNotification(userId, {
          id: `proposal-gen-${proposalId}`,
          type: 'proposal' as any,
          title: 'Proposal Generated',
          message: 'Your proposal has been generated successfully',
          priority: 'high',
          metadata: { proposalId },
        });
        break;
        
      case 'collaboration_update':
        // Broadcast to proposal room
        this.io.to(`proposal:${proposalId}`).emit('proposal_update', message);
        break;
    }
  }
  
  private async handleOpportunityMessage(message: any): Promise<void> {
    const { opportunityId, companyId, action, data } = message;
    
    switch (action) {
      case 'new_match':
        // Notify all users in company about new opportunity
        const users = data.matchedUsers || [];
        for (const userId of users) {
          await this.notificationHandler.notifyOpportunityMatch(userId, data.opportunity);
        }
        break;
        
      case 'deadline_approaching':
        // Broadcast deadline warning
        this.io.to(`opportunity:${opportunityId}`).emit('deadline_warning', {
          opportunityId,
          deadline: data.deadline,
          hoursRemaining: data.hoursRemaining,
        });
        break;
        
      case 'status_change':
        // Broadcast status change
        this.io.to(`opportunity:${opportunityId}`).emit('opportunity_status_change', {
          opportunityId,
          newStatus: data.status,
          timestamp: new Date(),
        });
        break;
    }
  }
  
  private async handleComplianceMessage(message: any): Promise<void> {
    const { matrixId, companyId, status } = message;
    
    await this.notificationHandler.notifyComplianceUpdate(
      companyId,
      matrixId,
      status
    );
    
    // Broadcast to compliance room
    this.io.to(`compliance:${matrixId}`).emit('compliance_update', {
      matrixId,
      status,
      timestamp: new Date(),
    });
  }
  
  private async handleAnalyticsMessage(message: any): Promise<void> {
    const { event, companyId, data } = message;
    
    // Broadcast analytics updates to dashboard rooms
    if (companyId) {
      this.io.to(`dashboard:${companyId}`).emit('analytics_update', {
        event,
        data,
        timestamp: new Date(),
      });
    }
  }
}