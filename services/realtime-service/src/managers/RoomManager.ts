import { Server } from 'socket.io';
import Redis from 'ioredis';
import { AuthenticatedSocket, Room, RoomType, SocketEvent, User } from '../types';
import { createLogger } from '../utils/logger';
import { activeRooms, roomParticipants } from '../utils/metrics';

const logger = createLogger('room-manager');

export class RoomManager {
  private io: Server;
  private redis: Redis;
  private rooms: Map<string, Room>;
  
  constructor(io: Server, redis: Redis) {
    this.io = io;
    this.redis = redis;
    this.rooms = new Map();
  }
  
  async createRoom(roomId: string, type: RoomType, metadata?: Record<string, any>): Promise<Room> {
    if (this.rooms.has(roomId)) {
      return this.rooms.get(roomId)!;
    }
    
    const room: Room = {
      id: roomId,
      type,
      participants: new Set(),
      createdAt: new Date(),
      metadata,
    };
    
    this.rooms.set(roomId, room);
    await this.storeRoomInRedis(room);
    
    // Update metrics
    activeRooms.inc({ type });
    
    logger.info({
      event: 'room_created',
      roomId,
      type,
      metadata,
    });
    
    return room;
  }
  
  async joinRoom(socket: AuthenticatedSocket, roomId: string, roomType: RoomType): Promise<void> {
    const { userId } = socket;
    
    // Create room if it doesn't exist
    let room = this.rooms.get(roomId);
    if (!room) {
      room = await this.createRoom(roomId, roomType);
    }
    
    // Add user to room
    room.participants.add(userId);
    socket.join(roomId);
    
    // Update Redis
    await this.addParticipantToRedis(roomId, userId);
    
    // Update metrics
    roomParticipants.set(
      { roomId, type: room.type },
      room.participants.size
    );
    
    logger.info({
      event: 'user_joined_room',
      userId,
      roomId,
      roomType,
      participantCount: room.participants.size,
    });
    
    // Notify room participants
    socket.to(roomId).emit(SocketEvent.USER_JOINED, {
      userId,
      roomId,
      timestamp: new Date(),
    });
    
    // Send current room state to the joining user
    const participants = await this.getRoomParticipants(roomId);
    socket.emit(SocketEvent.ROOM_JOINED, {
      roomId,
      participants,
      metadata: room.metadata,
    });
    
    // Broadcast updated participant list
    this.io.to(roomId).emit(SocketEvent.ROOM_USERS, {
      roomId,
      participants,
    });
  }
  
  async leaveRoom(socket: AuthenticatedSocket, roomId: string): Promise<void> {
    const { userId } = socket;
    const room = this.rooms.get(roomId);
    
    if (!room) {
      return;
    }
    
    // Remove user from room
    room.participants.delete(userId);
    socket.leave(roomId);
    
    // Update Redis
    await this.removeParticipantFromRedis(roomId, userId);
    
    // Update metrics
    roomParticipants.set(
      { roomId, type: room.type },
      room.participants.size
    );
    
    logger.info({
      event: 'user_left_room',
      userId,
      roomId,
      participantCount: room.participants.size,
    });
    
    // Notify room participants
    socket.to(roomId).emit(SocketEvent.USER_LEFT, {
      userId,
      roomId,
      timestamp: new Date(),
    });
    
    // Clean up empty rooms
    if (room.participants.size === 0) {
      await this.removeRoom(roomId);
    } else {
      // Broadcast updated participant list
      const participants = await this.getRoomParticipants(roomId);
      this.io.to(roomId).emit(SocketEvent.ROOM_USERS, {
        roomId,
        participants,
      });
    }
    
    // Notify the leaving user
    socket.emit(SocketEvent.ROOM_LEFT, { roomId });
  }
  
  async leaveAllRooms(socket: AuthenticatedSocket): Promise<void> {
    const { userId } = socket;
    
    // Get all rooms the user is in
    const userRooms = Array.from(socket.rooms).filter(room => room !== socket.id);
    
    for (const roomId of userRooms) {
      // Skip user and company rooms
      if (roomId.startsWith('user:') || roomId.startsWith('company:')) {
        continue;
      }
      
      await this.leaveRoom(socket, roomId);
    }
  }
  
  async getRoomParticipants(roomId: string): Promise<User[]> {
    const room = this.rooms.get(roomId);
    if (!room) {
      return [];
    }
    
    const participants: User[] = [];
    
    // Get user details for each participant
    for (const userId of room.participants) {
      // In a real implementation, you would fetch user details from database
      // For now, we'll use basic info from connected sockets
      const userSockets = await this.getUserSockets(userId);
      if (userSockets.length > 0) {
        const socket = userSockets[0] as AuthenticatedSocket;
        participants.push({
          id: userId,
          email: '', // Would be fetched from database
          name: '', // Would be fetched from database
          companyId: socket.companyId,
          role: socket.role,
        });
      }
    }
    
    return participants;
  }
  
  async broadcastToRoom(roomId: string, event: SocketEvent, data: any, excludeUserId?: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }
    
    if (excludeUserId) {
      // Broadcast to all except the excluded user
      const sockets = await this.io.in(roomId).fetchSockets();
      for (const socket of sockets) {
        const authSocket = socket as unknown as AuthenticatedSocket;
        if (authSocket.userId !== excludeUserId) {
          socket.emit(event, data);
        }
      }
    } else {
      // Broadcast to all in room
      this.io.to(roomId).emit(event, data);
    }
    
    logger.debug({
      event: 'broadcast_to_room',
      roomId,
      socketEvent: event,
      participantCount: room.participants.size,
      excluded: excludeUserId,
    });
  }
  
  async getActiveRooms(type?: RoomType): Promise<Room[]> {
    const rooms = Array.from(this.rooms.values());
    if (type) {
      return rooms.filter(room => room.type === type);
    }
    return rooms;
  }
  
  async getUserRooms(userId: string): Promise<Room[]> {
    const userRooms: Room[] = [];
    
    for (const room of this.rooms.values()) {
      if (room.participants.has(userId)) {
        userRooms.push(room);
      }
    }
    
    return userRooms;
  }
  
  private async getUserSockets(userId: string): Promise<any[]> {
    const sockets = await this.io.in(`user:${userId}`).fetchSockets();
    return sockets;
  }
  
  private async removeRoom(roomId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }
    
    this.rooms.delete(roomId);
    await this.removeRoomFromRedis(roomId);
    
    // Update metrics
    activeRooms.dec({ type: room.type });
    roomParticipants.set({ roomId, type: room.type }, 0);
    
    logger.info({
      event: 'room_removed',
      roomId,
      type: room.type,
    });
  }
  
  private async storeRoomInRedis(room: Room): Promise<void> {
    const key = `${this.redis.options.keyPrefix}room:${room.id}`;
    const data = {
      ...room,
      participants: Array.from(room.participants),
    };
    await this.redis.setex(key, 3600, JSON.stringify(data));
  }
  
  private async removeRoomFromRedis(roomId: string): Promise<void> {
    const key = `${this.redis.options.keyPrefix}room:${roomId}`;
    await this.redis.del(key);
  }
  
  private async addParticipantToRedis(roomId: string, userId: string): Promise<void> {
    const key = `${this.redis.options.keyPrefix}room:${roomId}:participants`;
    await this.redis.sadd(key, userId);
    await this.redis.expire(key, 3600);
  }
  
  private async removeParticipantFromRedis(roomId: string, userId: string): Promise<void> {
    const key = `${this.redis.options.keyPrefix}room:${roomId}:participants`;
    await this.redis.srem(key, userId);
  }
}