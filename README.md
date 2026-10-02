# Chat Portal

A scalable, multi-tenant real-time chat application built with a microservices architecture on NestJS, Socket.IO, Redis, PostgreSQL, MongoDB, and React with TypeScript.

🚀 **Live Demo:** [https://chat-portal-gamma.vercel.app](https://chat-portal-gamma.vercel.app/)

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| **Frontend** | React 19, TypeScript, Vite, Vanilla CSS |
| **Backend Framework** | NestJS |
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

### Option 2: Docker Installation

Run using Docker Compose — choose between spinning up the **Full-Stack (all services + databases)** or **Infrastructure Only (databases & backing services)**.

#### Prerequisites

- **Docker**: Engine 20.10+ / Desktop 4+
- **Docker Compose**: v2.0+

#### 1. Environment Configuration

Copy the root environment template:

```bash
cp .env.example .env
```

#### 2. Launch Containers

##### Option A: Full-Stack (All Microservices + Databases)
Builds and launches the frontend client (`http://localhost:8080`), API Gateway (`http://localhost:3000`), all backend microservices, PostgreSQL, MongoDB, Redis, and MinIO in detached mode:

```bash
docker compose -f docker-compose.local.yml up -d --build
```

> **Note:** Database migrations and Prisma schema sync (`npx prisma db push`) execute automatically upon container startup for both `auth-service` and `user-service`.

##### Option B: Local Infrastructure Only (Databases, Cache & Storage)
Launches only the backing infrastructure (PostgreSQL 16, MongoDB 7, Redis 7, and MinIO) using `docker-compose.yml`:

```bash
docker compose up -d
```

#### 3. Manage & Monitor

```bash
# View aggregated live logs across all containers (Full-Stack)
docker compose -f docker-compose.local.yml logs -f

# Check status of running containers
docker compose -f docker-compose.local.yml ps
# Or for local infrastructure:
docker compose ps

# Stop and remove all containers
docker compose -f docker-compose.local.yml down
# Or for local infrastructure:
docker compose down
```

---

## Deployment

- **Frontend**: Deployed on **[Vercel](https://chat-portal-gamma.vercel.app/)** with automated continuous deployment.
- **Backend Services**: Hosted on **AWS** with infrastructure fully provisioned and managed via **Terraform** (`terraform/` directory), orchestrating containerized microservices, API Gateway, databases, cache, and object storage.

---

## Sample Login Credentials

Pre-seeded accounts are available for instant testing.:

| Email | Password | Role |
| --- | --- | --- |
| `raghav@unsaidtalks.com` | `Unsaidtalks@123` | **ADMIN** |
| `shubhankar@unsaidtalks.com` | `Unsaidtalks@123` | **MENTOR** |
| `vishalsinha15456@gmail.com` | `Unsaidtalks@123` | **MENTEE** |
| `aradhanakund@gmail.com` | `Unsaidtalks@123` | **MENTEE** |

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

### Design Rationale: Rooms & Event Architecture

1. **User-Centric Private Room Model (`user:<userId>`)**:
   - Rather than forcing sockets to join and leave dozens of dynamic group rooms, every user socket connects to **only one** permanent private room: `user:<userId>`.
   - All inbound events — direct messages, group messages, delivery acknowledgments, read watermarks, and multi-device/multi-tab sync — are routed directly to the recipient's user room.
   - **Why?** This eliminates cross-server room synchronization overhead in Redis whenever group membership changes, minimizes memory consumption, and ensures multi-tab synchronization works out of the box.

2. **Dynamic Group Fanout**:
   - When a user sends a message to a group, `chat-service` fetches the group member list from `user-service` and emits the event across the Redis adapter directly to `user:<memberId>` rooms.
   - Group membership changes in the database take effect immediately without requiring client socket reconnects or room joins/leaves.

3. **On-Demand Ephemeral Presence Rooms**:
   - `presence:user:<userId>` and `presence:group:<groupId>` operate as lightweight subscription rooms.
   - Clients subscribe only when actively viewing a direct chat or group, preventing broadcast spam to idle users across the platform.

---

### 3. WebSocket Event Reference

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

- [x] **Authentication & Roles**: Sign up and log in (email + password, JWT) supporting Admin, Mentor, and Mentee roles.
- [x] **Mentorship Groups**: Program and batch groups with admin group creation.
- [x] **Real-Time Messaging**: WebSockets (Socket.IO / NestJS Gateway) with instant delivery, sender role badges, and timestamps.
- [x] **Older Messages on Scroll**: Paginated history loading in batches on upward scroll and durable database persistence.
- [x] **Typing Indicator**: Live typing notifications.
- [x] **Online/Offline Status**: Real-time user presence tracking.
- [x] **One-to-One Chat**: Private mentor–mentee conversations with mentee-to-mentee private chats restricted by default.
- [x] **Announcements**: Mentor tools to broadcast highlighted messages and notices distinct from casual chat.
- [x] **Pin Messages**: Keep important links and schedules pinned to the top of a group.
- [x] **Doubts**: Mentee marks a message as a doubt; mentor marks it resolved.
- [x] **Reply to Message**: Quote and reply directly to a specific message, like WhatsApp.
- [x] **File Sharing**: Share images and PDFs (max 5 MB) with inline preview for images and download links for PDFs.
- [x] **Message Deletion**: Users delete their own messages; mentors/admins delete any message in their groups.
- [x] **Read Receipts**: Real-time read status watermarks and delivery tracking.
- [x] **Unread Count**: Unread message count badges per chat in the conversation list.
- [x] **Report Message**: Report a message; reported messages appear on an admin screen.
- [x] **Historical Message Access**: Late joiners and new members can read earlier group discussions.
- [x] **Privacy & Data Protection**: No phone numbers or personal emails exposed in UI or API responses.
- [x] **Role-Based Access Control**: Each role sees and interacts only with its permitted groups and chats.
- [x] **Deployed Live Link**: Cloud deployment with live accessible URL.


### Features Pending / Roadmap

- [ ] **Emoji Reactions**: Emoji reactions on individual message bubbles.
- [ ] **Edit a Message**: Edit sent messages within a 5-minute window.
- [ ] **Message Search**: Message and keyword search within a group.
- [ ] **WhatsApp Import**: Upload exported chat (`.txt`) and convert it into a group's history.
- [ ] **AI Summary**: AI summary of unresolved doubts for the mentor.
- [ ] **Browser Push Notifications**: Web push notifications for background offline alerts.

---

## Project Structure

```text
chat-portal/
├── client/                     # React + Vite TypeScript frontend
│   ├── src/
│   │   ├── components/         # Chat, auth, doubts, pins, modals, media
│   │   ├── hooks/              # Custom React hooks
│   │   ├── services/           # Socket service, REST API clients
│   │   └── store/              # Zustand state management
├── services/
│   ├── api-gateway/            # Reverse proxy, auth guards, rate limiting
│   ├── auth-service/           # User authentication, JWT tokens, bcrypt, Prisma
│   ├── user-service/           # User profiles, groups, memberships, Prisma
│   ├── chat-service/           # Real-time WebSocket gateway, chat REST APIs
│   ├── message-worker/         # BullMQ queue consumer for MongoDB persistence
│   └── media-service/          # MinIO / S3 file upload handler
├── scripts/                    # Database init, seeding, and E2E test scripts
├── terraform/                  # Cloud infrastructure as code
├── docker-compose.yml          # Backing infrastructure (Postgres, Mongo, Redis, MinIO)
├── docker-compose.local.yml    # Local full-stack container compose
├── docker-compose.prod.yml     # Production full-stack compose (Services, DBs, Caddy)
└── .env.example                # Root environment configuration template
```
