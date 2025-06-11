import { Server } from 'socket.io';
import Redis from 'ioredis';
import { AuthenticatedSocket, Session, SocketEvent } from '../types';
import { createLogger } from '../utils/logger';
import { wsConnections, wsConnectionsPerUser, activeSessions } from '../utils/metrics';
import { v4 as uuidv4 } from 'uuid';

const logger = createLogger('connection-manager');

export class ConnectionManager {
  private io: Server;
  private redis: Redis;
  private sessions: Map<string, Session>;
  private userSockets: Map<string, Set<string>>; // userId -> socketIds
  
  constructor(io: Server, redis: Redis) {
    this.io = io;
    this.redis = redis;
    this.sessions = new Map();
    this.userSockets = new Map();
  }
  
  async handleConnection(socket: AuthenticatedSocket): Promise<void> {
    const { userId, sessionId } = socket;
    
    logger.info({
      event: 'connection_established',
      userId,
      socketId: socket.id,
      sessionId,
    });
    
    // Create session
    const session: Session = {
      id: sessionId,
      userId,
      socketId: socket.id,
      connectedAt: new Date(),
      lastActivity: new Date(),
      metadata: {
        userAgent: socket.handshake.headers['user-agent'],
        ip: socket.handshake.address,
      },
    };
    
    // Store session
    this.sessions.set(sessionId, session);
    await this.storeSessionInRedis(session);
    
    // Track user sockets
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socket.id);
    
    // Update metrics
    wsConnections.inc({ status: 'connected' });
    wsConnectionsPerUser.set({ userId }, this.userSockets.get(userId)!.size);
    activeSessions.set(this.sessions.size);
    
    // Join user-specific room
    socket.join(`user:${userId}`);
    socket.join(`company:${socket.companyId}`);
    
    // Notify other instances about new connection
    await this.broadcastConnectionStatus(userId, true);
  }
  
  async handleDisconnection(socket: AuthenticatedSocket): Promise<void> {
    const { userId, sessionId } = socket;
    
    logger.info({
      event: 'connection_closed',
      userId,
      socketId: socket.id,
      sessionId,
    });
    
    // Remove session
    const session = this.sessions.get(sessionId);
    if (session) {
      // Calculate session duration
      const duration = (Date.now() - session.connectedAt.getTime()) / 1000;
      logger.info({
        event: 'session_ended',
        userId,
        sessionId,
        duration,
      });
    }
    
    this.sessions.delete(sessionId);
    await this.removeSessionFromRedis(sessionId);
    
    // Update user sockets
    const userSocketSet = this.userSockets.get(userId);
    if (userSocketSet) {
      userSocketSet.delete(socket.id);
      if (userSocketSet.size === 0) {
        this.userSockets.delete(userId);
        wsConnectionsPerUser.set({ userId }, 0);
      } else {
        wsConnectionsPerUser.set({ userId }, userSocketSet.size);
      }
    }
    
    // Update metrics
    wsConnections.dec({ status: 'connected' });
    activeSessions.set(this.sessions.size);
    
    // Notify if user is completely disconnected
    if (!this.userSockets.has(userId)) {
      await this.broadcastConnectionStatus(userId, false);
    }
  }
  
  async updateActivity(socket: AuthenticatedSocket): Promise<void> {
    const session = this.sessions.get(socket.sessionId);
    if (session) {
      session.lastActivity = new Date();
      await this.storeSessionInRedis(session);
    }
  }
  
  async getActiveSessions(userId?: string): Promise<Session[]> {
    if (userId) {
      const sessions: Session[] = [];
      const socketIds = this.userSockets.get(userId);
      if (socketIds) {
        for (const socketId of socketIds) {
          const socket = this.io.sockets.sockets.get(socketId) as AuthenticatedSocket;
          if (socket) {
            const session = this.sessions.get(socket.sessionId);
            if (session) {
              sessions.push(session);
            }
          }
        }
      }
      return sessions;
    }
    
    return Array.from(this.sessions.values());
  }
  
  async getUserSocketIds(userId: string): Promise<string[]> {
    const localSockets = this.userSockets.get(userId);
    if (!localSockets || localSockets.size === 0) {
      return [];
    }
    return Array.from(localSockets);
  }
  
  async isUserOnline(userId: string): Promise<boolean> {
    // Check local connections
    if (this.userSockets.has(userId)) {
      return true;
    }
    
    // Check Redis for connections on other instances
    const key = `${this.redis.options.keyPrefix}user:${userId}:online`;
    const isOnline = await this.redis.get(key);
    return isOnline === '1';
  }
  
  async getOnlineUsers(companyId?: string): Promise<string[]> {
    const onlineUsers = new Set<string>();
    
    // Get local users
    for (const userId of this.userSockets.keys()) {
      if (companyId) {
        const socketIds = this.userSockets.get(userId);
        if (socketIds) {
          for (const socketId of socketIds) {
            const socket = this.io.sockets.sockets.get(socketId) as AuthenticatedSocket;
            if (socket && socket.companyId === companyId) {
              onlineUsers.add(userId);
              break;
            }
          }
        }
      } else {
        onlineUsers.add(userId);
      }
    }
    
    // Get users from Redis (other instances)
    const pattern = companyId 
      ? `${this.redis.options.keyPrefix}company:${companyId}:user:*:online`
      : `${this.redis.options.keyPrefix}user:*:online`;
    
    const keys = await this.redis.keys(pattern);
    for (const key of keys) {
      const match = key.match(/user:([^:]+):online/);
      if (match) {
        onlineUsers.add(match[1]);
      }
    }
    
    return Array.from(onlineUsers);
  }
  
  private async storeSessionInRedis(session: Session): Promise<void> {
    const key = `${this.redis.options.keyPrefix}session:${session.id}`;
    await this.redis.setex(
      key,
      3600, // 1 hour TTL
      JSON.stringify(session)
    );
  }
  
  private async removeSessionFromRedis(sessionId: string): Promise<void> {
    const key = `${this.redis.options.keyPrefix}session:${sessionId}`;
    await this.redis.del(key);
  }
  
  private async broadcastConnectionStatus(userId: string, isOnline: boolean): Promise<void> {
    // Update Redis
    const userKey = `${this.redis.options.keyPrefix}user:${userId}:online`;
    if (isOnline) {
      await this.redis.setex(userKey, 3600, '1'); // 1 hour TTL
    } else {
      await this.redis.del(userKey);
    }
    
    // Broadcast to relevant rooms
    this.io.emit(isOnline ? SocketEvent.USER_JOINED : SocketEvent.USER_LEFT, {
      userId,
      timestamp: new Date(),
    });
  }
}