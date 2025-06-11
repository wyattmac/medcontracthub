# Real-time Service

WebSocket-based real-time collaboration service for MedContractHub platform.

## Features

- **WebSocket Communication**: Real-time bidirectional communication
- **Room Management**: Collaborative spaces for documents and proposals
- **Presence Tracking**: See who's online and their current activity
- **Typing Indicators**: Real-time typing status
- **Cursor Tracking**: Collaborative cursor positions
- **Data Synchronization**: Keep all clients in sync
- **Notifications**: Push real-time alerts and updates
- **Horizontal Scaling**: Redis-based scaling across multiple instances
- **Event Processing**: Kafka consumer for system-wide events

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│  Socket.IO  │────▶│    Redis    │
└─────────────┘     └─────────────┘     └─────────────┘
                           │                     │
                           ▼                     ▼
                    ┌─────────────┐     ┌─────────────┐
                    │   Managers  │     │  Pub/Sub    │
                    └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │    Kafka    │
                    └─────────────┘
```

## API

### Events

#### Client → Server

- `authenticate`: Authenticate with JWT token
- `join_room`: Join a collaborative room
- `leave_room`: Leave a room
- `presence_update`: Update user presence status
- `cursor_move`: Share cursor position
- `typing_start`: Start typing indicator
- `typing_stop`: Stop typing indicator
- `data_change`: Sync data changes
- `content_change`: Sync content changes
- `selection_change`: Share text selection
- `comment_add`: Add a comment
- `comment_update`: Update a comment
- `status_update`: Update user status
- `progress_update`: Update progress indicator

#### Server → Client

- `authenticated`: Authentication successful
- `unauthorized`: Authentication failed
- `room_joined`: Successfully joined room
- `room_left`: Successfully left room
- `room_users`: List of users in room
- `user_joined`: User joined the room
- `user_left`: User left the room
- `presence_update`: User presence changed
- `cursor_move`: Another user's cursor moved
- `typing_start`: User started typing
- `typing_stop`: User stopped typing
- `data_change`: Data was changed
- `notification`: New notification
- `error`: Error occurred

## Configuration

Environment variables:

```bash
# Service
REALTIME_PORT=8400
NODE_ENV=development

# CORS
CORS_ORIGINS=http://localhost:3000

# JWT
JWT_SECRET=your-secret-key
JWT_ISSUER=medcontracthub
JWT_AUDIENCE=medcontracthub-realtime

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=2

# Kafka
KAFKA_BROKERS=kafka:9092

# WebSocket
WS_PING_INTERVAL=25000
WS_PING_TIMEOUT=5000
WS_MAX_PAYLOAD=10485760

# Monitoring
METRICS_PORT=9090
LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT_WINDOW=60000
MAX_CONNECTIONS=5
MAX_EVENTS_PER_MINUTE=100
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build
npm run build

# Run tests
npm test

# Lint
npm run lint
```

## Production

```bash
# Build Docker image
docker build -t medcontracthub/realtime-service .

# Run with Docker
docker run -p 8400:8400 medcontracthub/realtime-service
```

## Monitoring

- Health endpoint: `GET /health`
- Metrics endpoint: `GET /metrics`
- Stats endpoint: `GET /stats`

## Security

- JWT-based authentication
- Rate limiting per user
- Connection limits
- Input validation
- Secure WebSocket (WSS) in production

## Scaling

The service uses Redis adapter for Socket.IO to enable horizontal scaling:

1. Deploy multiple instances
2. Use a load balancer with sticky sessions
3. All instances share state via Redis
4. Kafka ensures event consistency

## Testing

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# Load testing with Artillery
npm run test:load
```