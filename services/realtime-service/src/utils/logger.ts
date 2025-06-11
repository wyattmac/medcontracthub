import pino from 'pino';
import { config } from '../config';

const isProduction = config.environment === 'production';

export const logger = pino({
  level: config.monitoring.logLevel,
  transport: isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname',
          translateTime: 'SYS:standard',
        },
      },
  base: {
    service: 'realtime-service',
    environment: config.environment,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
    req: (req: any) => ({
      method: req.method,
      url: req.url,
      headers: req.headers,
      remoteAddress: req.socket?.remoteAddress,
    }),
    socket: (socket: any) => ({
      id: socket.id,
      userId: socket.userId,
      rooms: Array.from(socket.rooms || []),
    }),
  },
});

// Create child loggers for specific components
export const createLogger = (component: string) => logger.child({ component });