import { Server } from 'socket.io';
import { AuthenticatedSocket, SocketEvent, DataChangePayload } from '../types';
import { createLogger } from '../utils/logger';
import { eventsEmitted, messageProcessingDuration } from '../utils/metrics';
import { RoomManager } from '../managers/RoomManager';

const logger = createLogger('collaboration-handler');

export class CollaborationHandler {
  private io: Server;
  private roomManager: RoomManager;
  
  constructor(io: Server, roomManager: RoomManager) {
    this.io = io;
    this.roomManager = roomManager;
  }
  
  async handleDataChange(
    socket: AuthenticatedSocket,
    roomId: string,
    payload: DataChangePayload
  ): Promise<void> {
    const timer = messageProcessingDuration.startTimer({ event: SocketEvent.DATA_CHANGE });
    
    try {
      logger.info({
        event: 'data_change',
        userId: socket.userId,
        roomId,
        entityType: payload.entityType,
        entityId: payload.entityId,
        operation: payload.operation,
      });
      
      // Validate user is in room
      const userRooms = await this.roomManager.getUserRooms(socket.userId);
      const isInRoom = userRooms.some(room => room.id === roomId);
      
      if (!isInRoom) {
        socket.emit(SocketEvent.ERROR, {
          message: 'You are not in this room',
        });
        return;
      }
      
      // Add timestamp and user info
      const enrichedPayload = {
        ...payload,
        userId: socket.userId,
        timestamp: new Date(),
      };
      
      // Broadcast to room except sender
      await this.roomManager.broadcastToRoom(
        roomId,
        SocketEvent.DATA_CHANGE,
        enrichedPayload,
        socket.userId
      );
      
      eventsEmitted.inc({ event: SocketEvent.DATA_CHANGE, broadcast: 'true' });
    } finally {
      timer();
    }
  }
  
  async handleContentChange(
    socket: AuthenticatedSocket,
    roomId: string,
    content: any
  ): Promise<void> {
    const timer = messageProcessingDuration.startTimer({ event: SocketEvent.CONTENT_CHANGE });
    
    try {
      logger.debug({
        event: 'content_change',
        userId: socket.userId,
        roomId,
      });
      
      // Broadcast content change to room
      await this.roomManager.broadcastToRoom(
        roomId,
        SocketEvent.CONTENT_CHANGE,
        {
          userId: socket.userId,
          content,
          timestamp: new Date(),
        },
        socket.userId
      );
      
      eventsEmitted.inc({ event: SocketEvent.CONTENT_CHANGE, broadcast: 'true' });
    } finally {
      timer();
    }
  }
  
  async handleSelectionChange(
    socket: AuthenticatedSocket,
    roomId: string,
    selection: any
  ): Promise<void> {
    logger.debug({
      event: 'selection_change',
      userId: socket.userId,
      roomId,
      selection,
    });
    
    // Broadcast selection to room
    socket.to(roomId).emit(SocketEvent.SELECTION_CHANGE, {
      userId: socket.userId,
      selection,
      timestamp: new Date(),
    });
    
    eventsEmitted.inc({ event: SocketEvent.SELECTION_CHANGE, broadcast: 'false' });
  }
  
  async handleCommentAdd(
    socket: AuthenticatedSocket,
    roomId: string,
    comment: any
  ): Promise<void> {
    logger.info({
      event: 'comment_add',
      userId: socket.userId,
      roomId,
      commentId: comment.id,
    });
    
    // Broadcast new comment to room
    await this.roomManager.broadcastToRoom(
      roomId,
      SocketEvent.COMMENT_ADD,
      {
        userId: socket.userId,
        comment,
        timestamp: new Date(),
      }
    );
    
    eventsEmitted.inc({ event: SocketEvent.COMMENT_ADD, broadcast: 'true' });
  }
  
  async handleCommentUpdate(
    socket: AuthenticatedSocket,
    roomId: string,
    commentId: string,
    updates: any
  ): Promise<void> {
    logger.info({
      event: 'comment_update',
      userId: socket.userId,
      roomId,
      commentId,
    });
    
    // Broadcast comment update to room
    await this.roomManager.broadcastToRoom(
      roomId,
      SocketEvent.COMMENT_UPDATE,
      {
        userId: socket.userId,
        commentId,
        updates,
        timestamp: new Date(),
      }
    );
    
    eventsEmitted.inc({ event: SocketEvent.COMMENT_UPDATE, broadcast: 'true' });
  }
  
  async requestSync(
    socket: AuthenticatedSocket,
    roomId: string,
    entityType: string,
    entityId: string
  ): Promise<void> {
    logger.info({
      event: 'sync_request',
      userId: socket.userId,
      roomId,
      entityType,
      entityId,
    });
    
    // In a real implementation, this would fetch the latest data from database
    // and send it back to the requesting client
    socket.emit(SocketEvent.SYNC_UPDATE, {
      entityType,
      entityId,
      data: {}, // Would be actual data
      timestamp: new Date(),
    });
    
    eventsEmitted.inc({ event: SocketEvent.SYNC_REQUEST, broadcast: 'false' });
  }
  
  async handleStatusUpdate(
    socket: AuthenticatedSocket,
    status: any
  ): Promise<void> {
    const { userId, companyId } = socket;
    
    logger.info({
      event: 'status_update',
      userId,
      status,
    });
    
    // Broadcast status to company
    this.io.to(`company:${companyId}`).emit(SocketEvent.STATUS_UPDATE, {
      userId,
      status,
      timestamp: new Date(),
    });
    
    eventsEmitted.inc({ event: SocketEvent.STATUS_UPDATE, broadcast: 'true' });
  }
  
  async handleProgressUpdate(
    socket: AuthenticatedSocket,
    roomId: string,
    progress: any
  ): Promise<void> {
    logger.debug({
      event: 'progress_update',
      userId: socket.userId,
      roomId,
      progress,
    });
    
    // Broadcast progress to room
    await this.roomManager.broadcastToRoom(
      roomId,
      SocketEvent.PROGRESS_UPDATE,
      {
        userId: socket.userId,
        progress,
        timestamp: new Date(),
      }
    );
    
    eventsEmitted.inc({ event: SocketEvent.PROGRESS_UPDATE, broadcast: 'true' });
  }
}