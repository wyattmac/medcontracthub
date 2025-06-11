import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { AuthenticatedSocket, SocketEvent, JoinRoomPayload, PresenceUpdatePayload } from '../types';
import { config } from '../config';
import { createLogger } from '../utils/logger';
import { authenticateSocket } from '../middleware/auth';
import { RateLimiter } from '../middleware/rateLimiter';
import { ConnectionManager } from '../managers/ConnectionManager';
import { RoomManager } from '../managers/RoomManager';
import { SessionManager } from '../managers/SessionManager';
import { CollaborationHandler } from '../handlers/collaborationHandler';
import { eventsReceived, messageSize, errors } from '../utils/metrics';

const logger = createLogger('websocket-server');

export class WebSocketServer {
  private io: Server;
  private pubClient: Redis;
  private subClient: Redis;
  private connectionManager: ConnectionManager;
  private roomManager: RoomManager;
  private sessionManager: SessionManager;
  private collaborationHandler: CollaborationHandler;
  private rateLimiter: RateLimiter;
  
  constructor(io: Server) {
    this.io = io;
    
    // Setup Redis adapter for scaling
    this.pubClient = new Redis(config.redis);
    this.subClient = this.pubClient.duplicate();
    
    io.adapter(createAdapter(this.pubClient, this.subClient));
    
    // Initialize managers
    this.connectionManager = new ConnectionManager(io, this.pubClient);
    this.roomManager = new RoomManager(io, this.pubClient);
    this.sessionManager = new SessionManager(io, this.pubClient);
    this.collaborationHandler = new CollaborationHandler(io, this.roomManager);
    this.rateLimiter = new RateLimiter(this.pubClient);
    
    this.setupMiddleware();
    this.setupEventHandlers();
  }
  
  private setupMiddleware(): void {
    // Authentication middleware
    this.io.use(authenticateSocket);
    
    // Rate limiting middleware
    this.io.use(this.rateLimiter.middleware());
    
    // Error handling middleware
    this.io.use((socket, next) => {
      socket.on('error', (error) => {
        logger.error({
          event: 'socket_error',
          socketId: socket.id,
          error,
        });
        errors.inc({ type: 'socket_error', event: 'unknown' });
      });
      next();
    });
  }
  
  private setupEventHandlers(): void {
    this.io.on(SocketEvent.CONNECTION, async (socket: AuthenticatedSocket) => {
      try {
        // Check connection limit
        const allowed = await this.rateLimiter.checkConnection(socket.userId);
        if (!allowed) {
          socket.emit(SocketEvent.ERROR, {
            message: 'Connection limit exceeded',
          });
          socket.disconnect();
          return;
        }
        
        // Handle new connection
        await this.connectionManager.handleConnection(socket);
        
        // Setup event listeners
        this.setupSocketEventListeners(socket);
        
        // Update presence
        await this.sessionManager.updatePresence(
          socket,
          'online' as any,
          undefined,
          undefined
        );
        
      } catch (error) {
        logger.error({
          event: 'connection_error',
          error,
          socketId: socket.id,
        });
        socket.disconnect();
      }
    });
  }
  
  private setupSocketEventListeners(socket: AuthenticatedSocket): void {
    // Track message sizes
    socket.use(([event, ...args], next) => {
      const size = JSON.stringify(args).length;
      messageSize.observe({ direction: 'incoming', event }, size);
      eventsReceived.inc({ event, status: 'received' });
      next();
    });
    
    // Room events
    socket.on(SocketEvent.JOIN_ROOM, async (payload: JoinRoomPayload) => {
      try {
        await this.roomManager.joinRoom(socket, payload.roomId, payload.roomType);
        await this.connectionManager.updateActivity(socket);
      } catch (error) {
        this.handleError(socket, SocketEvent.JOIN_ROOM, error);
      }
    });
    
    socket.on(SocketEvent.LEAVE_ROOM, async (payload: { roomId: string }) => {
      try {
        await this.roomManager.leaveRoom(socket, payload.roomId);
        await this.connectionManager.updateActivity(socket);
      } catch (error) {
        this.handleError(socket, SocketEvent.LEAVE_ROOM, error);
      }
    });
    
    // Presence events
    socket.on(SocketEvent.PRESENCE_UPDATE, async (payload: PresenceUpdatePayload) => {
      try {
        await this.sessionManager.updatePresence(
          socket,
          payload.status,
          undefined,
          payload.cursor
        );
        await this.connectionManager.updateActivity(socket);
      } catch (error) {
        this.handleError(socket, SocketEvent.PRESENCE_UPDATE, error);
      }
    });
    
    socket.on(SocketEvent.CURSOR_MOVE, async (payload: { roomId: string; cursor: any }) => {
      try {
        await this.sessionManager.handleCursorMove(socket, payload.roomId, payload.cursor);
      } catch (error) {
        this.handleError(socket, SocketEvent.CURSOR_MOVE, error);
      }
    });
    
    // Typing indicators
    socket.on(SocketEvent.TYPING_START, async (payload: { roomId: string }) => {
      try {
        await this.sessionManager.handleTypingStart(socket, payload.roomId);
      } catch (error) {
        this.handleError(socket, SocketEvent.TYPING_START, error);
      }
    });
    
    socket.on(SocketEvent.TYPING_STOP, async (payload: { roomId: string }) => {
      try {
        await this.sessionManager.handleTypingStop(socket, payload.roomId);
      } catch (error) {
        this.handleError(socket, SocketEvent.TYPING_STOP, error);
      }
    });
    
    // Collaboration events
    socket.on(SocketEvent.DATA_CHANGE, async (payload: any) => {
      try {
        await this.collaborationHandler.handleDataChange(
          socket,
          payload.roomId,
          payload
        );
        await this.connectionManager.updateActivity(socket);
      } catch (error) {
        this.handleError(socket, SocketEvent.DATA_CHANGE, error);
      }
    });
    
    socket.on(SocketEvent.CONTENT_CHANGE, async (payload: any) => {
      try {
        await this.collaborationHandler.handleContentChange(
          socket,
          payload.roomId,
          payload.content
        );
      } catch (error) {
        this.handleError(socket, SocketEvent.CONTENT_CHANGE, error);
      }
    });
    
    socket.on(SocketEvent.SELECTION_CHANGE, async (payload: any) => {
      try {
        await this.collaborationHandler.handleSelectionChange(
          socket,
          payload.roomId,
          payload.selection
        );
      } catch (error) {
        this.handleError(socket, SocketEvent.SELECTION_CHANGE, error);
      }
    });
    
    socket.on(SocketEvent.COMMENT_ADD, async (payload: any) => {
      try {
        await this.collaborationHandler.handleCommentAdd(
          socket,
          payload.roomId,
          payload.comment
        );
      } catch (error) {
        this.handleError(socket, SocketEvent.COMMENT_ADD, error);
      }
    });
    
    socket.on(SocketEvent.COMMENT_UPDATE, async (payload: any) => {
      try {
        await this.collaborationHandler.handleCommentUpdate(
          socket,
          payload.roomId,
          payload.commentId,
          payload.updates
        );
      } catch (error) {
        this.handleError(socket, SocketEvent.COMMENT_UPDATE, error);
      }
    });
    
    // Status events
    socket.on(SocketEvent.STATUS_UPDATE, async (payload: any) => {
      try {
        await this.collaborationHandler.handleStatusUpdate(socket, payload);
      } catch (error) {
        this.handleError(socket, SocketEvent.STATUS_UPDATE, error);
      }
    });
    
    socket.on(SocketEvent.PROGRESS_UPDATE, async (payload: any) => {
      try {
        await this.collaborationHandler.handleProgressUpdate(
          socket,
          payload.roomId,
          payload.progress
        );
      } catch (error) {
        this.handleError(socket, SocketEvent.PROGRESS_UPDATE, error);
      }
    });
    
    // Sync events
    socket.on(SocketEvent.SYNC_REQUEST, async (payload: any) => {
      try {
        await this.collaborationHandler.requestSync(
          socket,
          payload.roomId,
          payload.entityType,
          payload.entityId
        );
      } catch (error) {
        this.handleError(socket, SocketEvent.SYNC_REQUEST, error);
      }
    });
    
    // Disconnection
    socket.on(SocketEvent.DISCONNECT, async () => {
      try {
        await this.sessionManager.handleDisconnect(socket);
        await this.roomManager.leaveAllRooms(socket);
        await this.connectionManager.handleDisconnection(socket);
        await this.rateLimiter.releaseConnection(socket.userId);
      } catch (error) {
        logger.error({
          event: 'disconnect_error',
          error,
          socketId: socket.id,
        });
      }
    });
  }
  
  private handleError(socket: AuthenticatedSocket, event: string, error: any): void {
    logger.error({
      event: 'event_handler_error',
      socketEvent: event,
      error,
      socketId: socket.id,
      userId: socket.userId,
    });
    
    errors.inc({ type: 'handler_error', event });
    eventsReceived.inc({ event, status: 'error' });
    
    socket.emit(SocketEvent.ERROR, {
      event,
      message: error.message || 'An error occurred',
    });
  }
  
  async getStats(): Promise<any> {
    const activeSessions = await this.connectionManager.getActiveSessions();
    const activeRooms = await this.roomManager.getActiveRooms();
    
    return {
      connections: this.io.sockets.sockets.size,
      sessions: activeSessions.length,
      rooms: activeRooms.length,
      users: await this.connectionManager.getOnlineUsers(),
    };
  }
}