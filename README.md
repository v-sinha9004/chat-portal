# Chat Portal

A scalable, multi-tenant real-time chat application built with a microservices architecture on NestJS, Socket.IO, Redis, PostgreSQL, MongoDB, and React with TypeScript.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| **Frontend** | React 19, TypeScript, Vite, Vanilla CSS |
| **Backend Framework** | NestJS (Express adapter) |
| **API Gateway** | NestJS HTTP reverse proxy & WebSocket upgrade routing (`http-proxy-middleware`) |
| **Real-time Engine** | Socket.IO with `@socket.io/redis-adapter` for horizontal multi-instance scaling |
| **Relational Data** | PostgreSQL 16 (DBs for Auth & Users, managed via Prisma ORM) |
| **Document Storage** | MongoDB 7.0 (Mongoose schemas for messages, reactions, pins, and reports) |
| **In-Memory Cache & Queues** | Redis 7 & BullMQ (presence state, unread counts, async message persistence) |
| **Object / Media Storage** | MinIO (local S3-compatible) / AWS S3 / Cloudflare R2 |

---

## Setup Steps

Choose either **Option 1: Local Installation (Development)** or **Option 2: Docker Installation (Full-Stack / Production)**.

---

### Option 1: Local Installation (Development)

Run the backend services and React frontend locally with database infrastructure managed via Docker Compose.

#### Prerequisites

- **Node.js**: v18 or higher (v20+ recommended)
- **npm**: v9 or higher
- **Docker & Docker Compose**: For PostgreSQL, MongoDB, Redis, and MinIO

#### 1. Environment Configuration

Copy the root environment configuration template:

```bash
cp .env.example .env
```

Ensure default environment values match your local setup:

```dotenv
# PostgreSQL
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=chat_portal
POSTGRES_PORT=5432
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/chat_portal?schema=public

# MongoDB
MONGO_INITDB_ROOT_USERNAME=admin
MONGO_INITDB_ROOT_PASSWORD=password
MONGO_INITDB_DATABASE=chat_portal
MONGO_PORT=27017
MONGODB_URI=mongodb://admin:password@localhost:27017/chat_portal?authSource=admin

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# MinIO / Object Storage
MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
STORAGE_ENDPOINT=http://localhost:9000
STORAGE_REGION=us-east-1
STORAGE_ACCESS_KEY=minioadmin
STORAGE_SECRET_KEY=minioadmin
STORAGE_BUCKET=chat-portal-attachments
STORAGE_PUBLIC_URL=http://localhost:9000/chat-portal-attachments
STORAGE_FORCE_PATH_STYLE=true
```

#### 2. Start Infrastructure via Docker Compose

Launch PostgreSQL, MongoDB, Redis, and MinIO:

```bash
docker compose up -d
```

Verify all database containers are healthy:

```bash
docker compose ps
```

> **Note:** The `scripts/init-postgres.sh` script runs automatically during container initialization and creates two separate logical PostgreSQL databases: `chat_portal_auth` and `chat_portal_users`.

#### 3. Install Dependencies

Install root workspace and all microservices dependencies:

```bash
npm run install:all
```

#### 4. Database Migrations & Prisma Client Generation

Generate Prisma clients for both `auth-service` and `user-service`:

```bash
npm run prisma:generate:all
```

Push database schema to the databases:

```bash
# Push Auth Service schema (chat_portal_auth)
npm run prisma:db:push --prefix services/auth-service

# Push User Service schema (chat_portal_users)
npm run prisma:db:push --prefix services/user-service
```

#### 5. Start the Application

Start all 6 backend services concurrently:

```bash
npm run dev:all
```

In a separate terminal, start the React frontend:

```bash
npm run dev:client
```

The frontend will be running at `http://localhost:5173` and the API Gateway at `http://localhost:3000`.

---

### Option 2: Docker Installation (Full-Stack / Production)

Run the entire stack (databases, microservices, API Gateway, and reverse proxy) containerized via Docker Compose.

#### Prerequisites

- **Docker**: Engine 20.10+ / Desktop 4+
- **Docker Compose**: v2.0+

#### 1. Environment Configuration

Copy the root environment template:

```bash
cp .env.example .env
```

#### 2. Build & Launch All Containers

Build and run all services and databases in detached mode:

```bash
npm run compose:prod
# Or directly:
# docker compose -f docker-compose.prod.yml up -d --build
```

> **Note:** Database migrations and Prisma schema sync (`npx prisma db push`) execute automatically upon container startup for both `auth-service` and `user-service`.

#### 3. Manage & Monitor

```bash
# View aggregated live logs across all containers
npm run compose:prod:logs

# Check status of running containers
docker compose -f docker-compose.prod.yml ps

# Stop and remove all containers
npm run compose:prod:down
```

---

## Sample Login Credentials

Pre-seeded accounts are available for instant testing. You can also use the **Quick Test Login** buttons directly on the login page:

| Email | Password | Role | Description |
| --- | --- | --- | --- |
| `mentor_alice@chatportal.com` | `Password123!` | **MENTOR** | Full messaging, can answer doubts, post announcements, and create groups. |
| `test_plan_user@chatportal.com` | `Password123!` | **MENTEE** | Can chat with mentors, raise doubts in groups, and view announcements. Direct mentee-to-mentee chats are restricted. |
| `vishalsinha15456@gmail.com` | `Password123!` | **ADMIN** | Administrative permissions, moderation, and full channel access. |

You can also create new users using the **Sign Up** tab in the client interface.

---

## Real-Time Design: WebSocket Events & Rooms

The real-time layer is implemented with **NestJS WebSockets** and **Socket.IO**, scaled horizontally via the **Redis Adapter** (`@socket.io/redis-adapter`).

### 1. Connection & Handshake Authentication

1. The client connects to the WebSocket endpoint at `/socket.io`.
2. The Gateway transparently proxies the connection to `chat-service` (Port 3001).
3. The client passes the JWT access token in the handshake:
   ```ts
   io('http://localhost:3000', {
     auth: { token: '<JWT_ACCESS_TOKEN>' },
     transports: ['websocket'],
   });
   ```
4. `chat-service` validates the JWT token against `JWT_ACCESS_SECRET`.
5. Upon successful verification:
   - The socket is assigned the user's metadata (`userId`, `role`, `email`).
   - The socket automatically joins the private user room: `user:<userId>`.

---

### 2. Room Architecture

| Room Name | Scope | Description |
| --- | --- | --- |
| `user:<userId>` | Private User Room | Each user socket joins their own room. Messages, personal read receipts, delivery acks, and multi-tab sync events are dispatched directly to this room. |
| `presence:user:<userId>` | Presence Subscription Room | Clients subscribe to this room to receive real-time presence updates (`user_presence_changed`) for a specific user. |
| `presence:group:<groupId>` | Group Presence Room | Clients subscribe to this room to receive member presence and typing notifications (`group_presence_changed`, `user_typing`) within a group. |

> **Design Choice**: Rather than having sockets join group rooms directly (which requires heavy socket room joins/leaves when group membership changes across clustered servers), group messages are routed using **targeted user room delivery**:
> 1. The gateway queries member IDs for the group from `user-service`.
> 2. `chat-service` broadcasts the event directly to `user:<memberId>` rooms across the Redis cluster.

---

### 3. Presence Architecture & Disconnect Grace Period

- **Multi-Device / Multi-Tab Support**: Active sockets per user are tracked in Redis Sorted Sets (`presence:sockets:<userId>`) with millisecond timestamps and a 15-second heartbeat cadence.
- **10-Second Tunnel/Grace Period**: When a user's last socket disconnects (e.g., page refresh, network fluctuation, tunnel switch), a **10-second grace timer** is initiated.
  - If the user reconnects within 10 seconds, the grace timer is aborted and the user remains `isOnline: true` with zero flicker.
  - If the timer expires without reconnection, the user is transitioned to `isOnline: false` with a `lastSeen` timestamp, which is broadcasted and asynchronously persisted to PostgreSQL via `user-service`.
- **Immediate Offline on Logout**: When a user clicks **Logout**, the client emits `user_logout`, bypassing the 10-second grace period and marking the user offline immediately.

---

### 4. WebSocket Event Reference

#### Client-to-Server (Emitters)

| Event | Payload | Purpose |
| --- | --- | --- |
| `send_direct_message` | `{ recipientId, message?, attachments?, clientMessageId?, replyTo?, isDoubt?, doubtTopic? }` | Sends a 1-on-1 direct message. Enforces mentee-to-mentee restriction. |
| `send_group_message` | `{ groupId, message?, attachments?, clientMessageId?, isAnnouncement?, heading?, replyTo?, isDoubt?, doubtTopic? }` | Sends a group message. Validates group membership and mentor role for announcements. |
| `subscribe_user_presence` | `{ targetUserId }` | Subscribes socket to user presence room and receives current online/lastSeen status. |
| `unsubscribe_user_presence`| `{ targetUserId }` | Leaves user presence room. |
| `subscribe_group_presence`| `{ groupId }` | Subscribes socket to group presence room and receives counts of online members. |
| `unsubscribe_group_presence`| `{ groupId }` | Leaves group presence room. |
| `typing_start` | `{ recipientId?, groupId? }` | Broadcasts typing indicator to recipient or group presence room. |
| `typing_stop` | `{ recipientId?, groupId? }` | Clears typing indicator. |
| `mark_read` | `{ conversationId, lastReadMessageId }` | Marks conversation as read up to the given message ID. Updates Redis unread counts and syncs across devices. |
| `ack_delivery` | `{ conversationId, messageId, senderId }` | Confirms receipt of an incoming message by the recipient client. |
| `update_doubt_status` | `{ conversationId, messageId, status: 'OPEN' \| 'RESOLVED' }` | Updates doubt status (accessible by mentors and doubt creators). |
| `delete_message` | `{ messageId }` | Soft-deletes a message (accessible by sender or admin/moderator). |
| `user_logout` | `{}` | Informs the server of intentional sign-out to immediately mark user offline. |

#### Server-to-Client (Listeners)

| Event | Payload | Purpose |
| --- | --- | --- |
| `direct_message` | `NewMessageEvent` | Received by recipient when a direct message arrives. |
| `group_message` | `GroupMessageEvent` | Received by group members when a new message is posted. |
| `message_delivered` | `MessageDeliveredEvent` | Notifies sender that the message was successfully delivered to the recipient. |
| `messages_read` | `MessagesReadEvent` | Notifies sender that the direct message was opened/read by recipient (double blue check). |
| `group_messages_read` | `GroupMessagesReadEvent` | Watermark read update for group members. |
| `conversation_read_ack` | `ConversationReadAckEvent` | Multi-tab sync acknowledging read status for the current user. |
| `user_presence_changed` | `{ userId, isOnline, lastSeen }` | Emitted when user connects or goes offline. |
| `group_presence_changed`| `{ groupId, userId, isOnline }` | Emitted when group member presence changes. |
| `user_typing` | `{ userId, isTyping, recipientId?, groupId? }` | Real-time typing notification. |
| `doubt_status_changed` | `DoubtStatusChangedEvent` | Emitted when a doubt is marked OPEN or RESOLVED. |
| `message_pinned` | `MessagePinnedEvent` | Emitted when an announcement or message is pinned in a conversation. |
| `message_unpinned` | `MessageUnpinnedEvent` | Emitted when a message is unpinned. |
| `message_deleted` | `MessageDeletedEvent` | Emitted when a message is deleted. |

---

## Features Completed & Pending

### Features Completed

- [x] **Microservices Architecture**: Clean separation between API Gateway, Auth, User, Chat, Media, and Message Worker services.
- [x] **Authentication & RBAC**:
  - JWT Access & Refresh token rotation with secure HTTP-only cookies and header fallbacks.
  - Role-based permissions supporting `MENTOR`, `MENTEE`, and `ADMIN`.
  - Mentee-to-Mentee direct chat restrictions (mentees can only DM mentors).
- [x] **Real-Time Direct & Group Messaging**:
  - Socket.IO with Redis Adapter cluster support.
  - Asynchronous durable persistence via BullMQ worker to MongoDB.
  - Multi-tab synchronization and offline delivery detection.
- [x] **Delivery & Read Watermarks**:
  - Delivered receipt (`message_delivered`) and read receipt (`messages_read`) tracking.
  - In-memory sub-millisecond unread counts powered by Redis hashes.
- [x] **Presence & Activity Tracking**:
  - Online/offline indicator with 10-second grace period preventing disconnect flickering.
  - `lastSeenAt` tracking stored in Redis and persisted to PostgreSQL.
  - Real-time typing indicators with auto-cancellation timeouts.
- [x] **Doubt Resolution System**:
  - Messages flaggable as doubts with topic tags.
  - Filterable Doubts view (Open vs. Resolved).
  - One-click resolution status toggling with real-time sync across participants.
- [x] **Announcements & Broadcasts**:
  - Mentor-only announcement composer with bold headings.
  - Dedicated visual treatment in chat streams.
- [x] **Pinned Messages Carousel**:
  - Pin important messages and announcements to the top banner.
  - Pinned carousel with instant jump-to-message navigation.
- [x] **Media & File Attachments**:
  - Direct S3/MinIO upload flow via `media-service`.
  - Image preview, lightbox dialog, and document file download cards.
- [x] **Message Moderation**:
  - Soft deletion of messages.
  - Reporting messages with reason categorization and admin review capabilities.
- [x] **Search & Chat Filter**:
  - Search conversation history and filter active chats by Mentors, Groups, and Doubts.

### Features Pending / Roadmap

- [ ] **End-to-End Encryption (E2EE)**: Client-side Signal protocol / Web Crypto key exchange for private 1-on-1 conversations.
- [ ] **Voice & Video Calling**: WebRTC signaling integration for peer-to-peer 1-on-1 or group video sessions.
- [ ] **Rich Text & Code Block Syntax Highlighting**: Markdown parser with embedded code blocks and syntax highlighting in composer.
- [ ] **Message Reactions**: Quick emoji reactions on individual message bubbles.
- [ ] **Threaded Message Replies**: Nested side-panel comment threads for deep question discussions.
- [ ] **Push Notifications**: Web Push / FCM integration for background offline alerts.
- [ ] **Kafka Event Bus**: Transitioning from BullMQ to Apache Kafka for high-throughput enterprise event streams.

---

## Project Structure

```text
chat-portal/
├── client/                     # React + Vite TypeScript frontend
│   ├── src/
│   │   ├── components/         # Chat, auth, doubts, pins, modals, media
│   │   ├── hooks/              # Custom React hooks
│   │   ├── services/           # Socket service, REST API clients
│   │   └── store/              # State management
├── services/
│   ├── api-gateway/            # Reverse proxy, auth guards, rate limiting
│   ├── auth-service/           # User authentication, JWT tokens, bcrypt
│   ├── user-service/           # User profiles, groups, memberships
│   ├── chat-service/           # Real-time WebSocket gateway, chat REST APIs
│   ├── message-worker/         # BullMQ queue consumer for MongoDB persistence
│   └── media-service/          # MinIO / S3 file upload handler
├── scripts/                    # Database init and testing scripts
├── terraform/                  # Cloud infrastructure as code
└── docker-compose.yml          # Local infrastructure (Postgres, Mongo, Redis, MinIO)
```
