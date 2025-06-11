import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { createLogger } from '../utils/logger';
import { authAttempts, authDuration } from '../utils/metrics';
import { AuthenticatedSocket, SocketEvent } from '../types';

const logger = createLogger('auth-middleware');

export interface JWTPayload {
  sub: string; // userId
  email: string;
  companyId: string;
  role: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

export const authenticateSocket = async (socket: Socket, next: (err?: Error) => void) => {
  const timer = authDuration.startTimer();
  
  try {
    // Get token from handshake auth or query
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    
    if (!token) {
      authAttempts.inc({ status: 'missing_token' });
      timer();
      return next(new Error('Authentication token required'));
    }
    
    // Verify JWT token
    const decoded = jwt.verify(token, config.jwt.secret, {
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    }) as JWTPayload;
    
    // Check token expiration
    if (decoded.exp * 1000 < Date.now()) {
      authAttempts.inc({ status: 'expired' });
      timer();
      return next(new Error('Token expired'));
    }
    
    // Attach user info to socket
    const authenticatedSocket = socket as AuthenticatedSocket;
    authenticatedSocket.userId = decoded.sub;
    authenticatedSocket.companyId = decoded.companyId;
    authenticatedSocket.role = decoded.role as any;
    authenticatedSocket.sessionId = `${decoded.sub}-${socket.id}`;
    
    logger.info({
      event: 'auth_success',
      userId: decoded.sub,
      socketId: socket.id,
      role: decoded.role,
    });
    
    authAttempts.inc({ status: 'success' });
    timer();
    
    // Emit authenticated event
    socket.emit(SocketEvent.AUTHENTICATED, {
      userId: decoded.sub,
      sessionId: authenticatedSocket.sessionId,
    });
    
    next();
  } catch (error) {
    logger.error({
      event: 'auth_error',
      error,
      socketId: socket.id,
    });
    
    authAttempts.inc({ status: 'failed' });
    timer();
    
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new Error('Invalid token'));
    }
    
    return next(new Error('Authentication failed'));
  }
};

export const requireAuth = (socket: AuthenticatedSocket): boolean => {
  if (!socket.userId) {
    socket.emit(SocketEvent.UNAUTHORIZED, {
      message: 'Authentication required',
    });
    socket.disconnect();
    return false;
  }
  return true;
};

export const requireRole = (socket: AuthenticatedSocket, roles: string[]): boolean => {
  if (!requireAuth(socket)) {
    return false;
  }
  
  if (!roles.includes(socket.role)) {
    socket.emit(SocketEvent.UNAUTHORIZED, {
      message: 'Insufficient permissions',
    });
    return false;
  }
  
  return true;
};