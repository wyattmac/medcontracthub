import { Socket } from 'socket.io';

export interface AuthenticatedSocket extends Socket {
  userId: string;
  companyId: string;
  role: UserRole;
  sessionId: string;
}

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  VIEWER = 'viewer',
}

export interface User {
  id: string;
  email: string;
  name: string;
  companyId: string;
  role: UserRole;
  avatar?: string;
}

export interface Session {
  id: string;
  userId: string;
  socketId: string;
  connectedAt: Date;
  lastActivity: Date;
  metadata?: Record<string, any>;
}

export interface Room {
  id: string;
  type: RoomType;
  participants: Set<string>; // User IDs
  createdAt: Date;
  metadata?: Record<string, any>;
}

export enum RoomType {
  OPPORTUNITY = 'opportunity',
  PROPOSAL = 'proposal',
  COMPLIANCE = 'compliance',
  DASHBOARD = 'dashboard',
}

export interface Presence {
  userId: string;
  user: User;
  status: PresenceStatus;
  lastSeen: Date;
  currentRoom?: string;
  cursor?: CursorPosition;
}

export enum PresenceStatus {
  ONLINE = 'online',
  AWAY = 'away',
  BUSY = 'busy',
  OFFLINE = 'offline',
}

export interface CursorPosition {
  x: number;
  y: number;
  elementId?: string;
}

// WebSocket Events
export enum SocketEvent {
  // Connection events
  CONNECTION = 'connection',
  DISCONNECT = 'disconnect',
  ERROR = 'error',
  
  // Authentication
  AUTHENTICATE = 'authenticate',
  AUTHENTICATED = 'authenticated',
  UNAUTHORIZED = 'unauthorized',
  
  // Room events
  JOIN_ROOM = 'join_room',
  LEAVE_ROOM = 'leave_room',
  ROOM_JOINED = 'room_joined',
  ROOM_LEFT = 'room_left',
  ROOM_USERS = 'room_users',
  
  // Presence events
  PRESENCE_UPDATE = 'presence_update',
  USER_JOINED = 'user_joined',
  USER_LEFT = 'user_left',
  CURSOR_MOVE = 'cursor_move',
  
  // Data sync events
  SYNC_REQUEST = 'sync_request',
  SYNC_UPDATE = 'sync_update',
  DATA_CHANGE = 'data_change',
  
  // Collaboration events
  SELECTION_CHANGE = 'selection_change',
  CONTENT_CHANGE = 'content_change',
  COMMENT_ADD = 'comment_add',
  COMMENT_UPDATE = 'comment_update',
  
  // Notification events
  NOTIFICATION = 'notification',
  ALERT = 'alert',
  
  // Status events
  STATUS_UPDATE = 'status_update',
  PROGRESS_UPDATE = 'progress_update',
  
  // Typing indicators
  TYPING_START = 'typing_start',
  TYPING_STOP = 'typing_stop',
}

// Event Payloads
export interface JoinRoomPayload {
  roomId: string;
  roomType: RoomType;
}

export interface LeaveRoomPayload {
  roomId: string;
}

export interface PresenceUpdatePayload {
  status: PresenceStatus;
  cursor?: CursorPosition;
}

export interface DataChangePayload {
  entityType: string;
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  data: any;
  timestamp: Date;
}

export interface NotificationPayload {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  metadata?: Record<string, any>;
}

export enum NotificationType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
  OPPORTUNITY = 'opportunity',
  PROPOSAL = 'proposal',
  COMPLIANCE = 'compliance',
}

export interface TypingIndicator {
  userId: string;
  roomId: string;
  isTyping: boolean;
}

// Kafka Message Types
export interface KafkaMessage {
  topic: string;
  partition: number;
  offset: string;
  timestamp: string;
  key?: string;
  value: any;
}

export interface BroadcastMessage {
  event: SocketEvent;
  roomId?: string;
  userId?: string;
  payload: any;
}