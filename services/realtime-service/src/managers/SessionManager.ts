import { Server } from 'socket.io';
import Redis from 'ioredis';
import { AuthenticatedSocket, Presence, PresenceStatus, CursorPosition, SocketEvent } from '../types';
import { createLogger } from '../utils/logger';

const logger = createLogger('session-manager');

export class SessionManager {
  private io: Server;
  private redis: Redis;
  private presenceMap: Map<string, Presence>;
  private typingUsers: Map<string, Set<string>>; // roomId -> Set of userIds
  
  constructor(io: Server, redis: Redis) {
    this.io = io;
    this.redis = redis;
    this.presenceMap = new Map();
    this.typingUsers = new Map();
    
    // Clean up stale presence data periodically
    setInterval(() => this.cleanupStalePresence(), 60000); // Every minute
  }
  
  async updatePresence(
    socket: AuthenticatedSocket,
    status: PresenceStatus,
    currentRoom?: string,
    cursor?: CursorPosition
  ): Promise<void> {
    const { userId } = socket;
    
    const presence: Presence = {
      userId,
      user: {
        id: userId,
        email: '', // Would be fetched from database
        name: '', // Would be fetched from database
        companyId: socket.companyId,
        role: socket.role,
      },
      status,
      lastSeen: new Date(),
      currentRoom,
      cursor,
    };
    
    // Update local presence
    this.presenceMap.set(userId, presence);
    
    // Update Redis
    await this.storePresenceInRedis(presence);
    
    logger.debug({
      event: 'presence_updated',
      userId,
      status,
      currentRoom,
    });
    
    // Broadcast presence update
    if (currentRoom) {
      this.io.to(currentRoom).emit(SocketEvent.PRESENCE_UPDATE, {
        userId,
        status,
        cursor,
        timestamp: new Date(),
      });
    }
    
    // Broadcast to company members
    this.io.to(`company:${socket.companyId}`).emit(SocketEvent.PRESENCE_UPDATE, {
      userId,
      status,
      timestamp: new Date(),
    });
  }
  
  async getPresence(userId: string): Promise<Presence | null> {
    // Check local cache first
    const localPresence = this.presenceMap.get(userId);
    if (localPresence) {
      return localPresence;
    }
    
    // Check Redis
    const key = `${this.redis.options.keyPrefix}presence:${userId}`;
    const data = await this.redis.get(key);
    if (data) {
      return JSON.parse(data);
    }
    
    return null;
  }
  
  async getActiveUsers(companyId?: string, roomId?: string): Promise<Presence[]> {
    const activeUsers: Presence[] = [];
    
    if (roomId) {
      // Get users in specific room
      const pattern = `${this.redis.options.keyPrefix}presence:*`;
      const keys = await this.redis.keys(pattern);
      
      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          const presence: Presence = JSON.parse(data);
          if (presence.currentRoom === roomId) {
            activeUsers.push(presence);
          }
        }
      }
    } else if (companyId) {
      // Get users in company
      const pattern = `${this.redis.options.keyPrefix}presence:*`;
      const keys = await this.redis.keys(pattern);
      
      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          const presence: Presence = JSON.parse(data);
          if (presence.user.companyId === companyId) {
            activeUsers.push(presence);
          }
        }
      }
    } else {
      // Get all active users
      activeUsers.push(...Array.from(this.presenceMap.values()));
    }
    
    return activeUsers;
  }
  
  async handleCursorMove(
    socket: AuthenticatedSocket,
    roomId: string,
    cursor: CursorPosition
  ): Promise<void> {
    const { userId } = socket;
    
    // Update presence with cursor position
    await this.updatePresence(socket, PresenceStatus.ONLINE, roomId, cursor);
    
    // Broadcast cursor position to room
    socket.to(roomId).emit(SocketEvent.CURSOR_MOVE, {
      userId,
      cursor,
      timestamp: new Date(),
    });
  }
  
  async handleTypingStart(socket: AuthenticatedSocket, roomId: string): Promise<void> {
    const { userId } = socket;
    
    if (!this.typingUsers.has(roomId)) {
      this.typingUsers.set(roomId, new Set());
    }
    
    this.typingUsers.get(roomId)!.add(userId);
    
    // Broadcast typing indicator
    socket.to(roomId).emit(SocketEvent.TYPING_START, {
      userId,
      roomId,
      timestamp: new Date(),
    });
    
    // Auto-clear typing after 5 seconds
    setTimeout(() => {
      this.handleTypingStop(socket, roomId);
    }, 5000);
  }
  
  async handleTypingStop(socket: AuthenticatedSocket, roomId: string): Promise<void> {
    const { userId } = socket;
    
    const typingSet = this.typingUsers.get(roomId);
    if (typingSet) {
      typingSet.delete(userId);
      if (typingSet.size === 0) {
        this.typingUsers.delete(roomId);
      }
    }
    
    // Broadcast typing stop
    socket.to(roomId).emit(SocketEvent.TYPING_STOP, {
      userId,
      roomId,
      timestamp: new Date(),
    });
  }
  
  async getTypingUsers(roomId: string): Promise<string[]> {
    const typingSet = this.typingUsers.get(roomId);
    return typingSet ? Array.from(typingSet) : [];
  }
  
  async handleDisconnect(socket: AuthenticatedSocket): Promise<void> {
    const { userId } = socket;
    
    // Update presence to offline
    await this.updatePresence(socket, PresenceStatus.OFFLINE);
    
    // Clear typing indicators
    for (const [roomId, typingSet] of this.typingUsers.entries()) {
      if (typingSet.has(userId)) {
        await this.handleTypingStop(socket, roomId);
      }
    }
    
    // Remove from local cache
    this.presenceMap.delete(userId);
    
    // Remove from Redis
    await this.removePresenceFromRedis(userId);
  }
  
  private async storePresenceInRedis(presence: Presence): Promise<void> {
    const key = `${this.redis.options.keyPrefix}presence:${presence.userId}`;
    await this.redis.setex(
      key,
      300, // 5 minutes TTL
      JSON.stringify(presence)
    );
  }
  
  private async removePresenceFromRedis(userId: string): Promise<void> {
    const key = `${this.redis.options.keyPrefix}presence:${userId}`;
    await this.redis.del(key);
  }
  
  private async cleanupStalePresence(): Promise<void> {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    
    // Clean local presence
    for (const [userId, presence] of this.presenceMap.entries()) {
      if (now - presence.lastSeen.getTime() > staleThreshold) {
        this.presenceMap.delete(userId);
        logger.info({
          event: 'stale_presence_removed',
          userId,
          lastSeen: presence.lastSeen,
        });
      }
    }
  }
}