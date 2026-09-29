# Design Decisions

## Q1. Choosing connection protocol for chat between client and chat server

| Protocol | Communication Model | Decision Parameter | Recommendation for Real-Time Chat |
| :--- | :--- | :--- | :--- |
| **WebSockets** | Full-duplex, bidirectional over a single TCP connection | • True real-time bidirectional communication<br>• Low latency and minimal bandwidth waste<br>• Server can push messages instantly<br>• Efficient for high-frequency messaging | **Primary Choice (Recommended)** |
| **Long Polling** | Unidirectional HTTP request held open until new data arrives or a timeout threshold is reached | • Still periodic connection after timeout<br>• Server cannot say if client is disconnected | **Fallback Option** |
| **Polling** | Periodic client requests at fixed intervals (e.g., every 2-5s) | • High server load at scale<br>• No new message most of the time, so wastage of resources | **Not Recommended for Chat** |

## Q2. Choosing between relational databases and NoSQL databases

| Database Type | Data Category & Read/Write Patterns | Decision Parameters & Reasons | Recommendation |
| :--- | :--- | :--- | :--- |
| **PostgreSQL** | **Generic Data**<br>• User profile, setting, user friends list | • Robust and reliable<br>• Replication and sharding to satisfy availability and scalability requirements | **Recommended for Generic Data** |
| **MongoDB (NoSQL)** | **Chat History Data**<br>• Enormous messages data <br> | • Easy horizontal scaling<br>• Very low latency to access data<br>• Relational databases do not handle long tail of data well (when indexes grow large, random access is expensive)<br>• Adopted by proven reliable chat apps (Facebook Messenger uses HBase, Discord uses Cassandra) | **Recommended for Chat History Data** |


## Q3. room-per-chat (join all rooms per user) vs user-room (join only user room)

| Strategy | Architecture & Mechanics | Pros & Cons | Recommendation |
| :--- | :--- | :--- | :--- |
| **User-Room (`user:<userId>`)** | • Each user socket automatically joins a single room per user upon connection (`user:<userId>`).<br>• 1:1 and group messages are dispatched to the recipient user rooms (`emitToUser` / `emitToUsers`). | • **Pros**: Minimal memory footprint, no connection spike joining hundreds of rooms, seamless multi-device sync.<br>• **Cons**: Group fan-out happens in application/service layer. | **Chosen Approach (Recommended)** |
| **Room-per-Chat (`chat:<chatId>`)** | • Sockets join individual rooms for every 1:1 conversation and group chat they belong to.<br>• Messages are broadcast directly to the `chat:<chatId>` room. | • **Pros**: Simple broadcast logic for active chat.<br>• **Cons**: High memory and CPU overhead joining/leaving rooms on connect or chat switch; complex multi-device sync and cache invalidation. | **Not Recommended** |

### Key Decision Points:
1. **Connection & Memory Efficiency**: Users join only their personal `user:<userId>` room on connection, avoiding heavy room join overhead and high memory consumption when users belong to hundreds of chats.
2. **Multi-Device Synchronization**: Emitting to a single user room automatically reaches all active sockets (phone, desktop, web tabs) belonging to that user.

## Q4. Database strategy for Auth Service vs User Service (Shared DB vs Separate DB)

| Approach | Architecture & Description | Pros & Cons | Recommendation |
| :--- | :--- | :--- | :--- |
| **Logical Separation (Same Postgres Instance, Separate DBs)** | Run one Postgres container/server, but create two separate databases (`chat_portal_auth` and `chat_portal_users`) or schemas. | • **Pros**: Low resource usage (single DB container), clean service boundaries, prevents Prisma migration conflicts, isolates password hashes from user profile queries, seamless upgrade to separate servers later.<br>• **Cons**: Inter-service communication needed during signup to create user profile. | **Chosen Approach (Recommended)** |
| **Shared Database & Tables** | Both `auth-service` and `user-service` connect to the same database and access the same `users` table. | • **Pros**: Simple initial setup, no cross-service API calls or data sync needed.<br>• **Cons**: Tight coupling (creates a "distributed monolith"), Prisma migration clashes, security risk (profile queries can access password hashes). | **Not Recommended** |
| **Physical Separation (Separate Database Containers / Servers)** | Run two separate Postgres containers locally, or two distinct managed database servers in production. | • **Pros**: Complete isolation, independent scaling, failure in one DB does not affect the other.<br>• **Cons**: Doubles RAM and CPU usage on local machine (two database engines running), higher operational cost. | **Future Scale (Production)** |

### Key Decision Points:
1. **Decoupled Schemas & Migrations**: Giving `auth-service` and `user-service` their own databases avoids Prisma migration collisions and keeps credentials separate from user profile details.
2. **Developer & Resource Friendly**: Running two logical databases on one Postgres instance avoids running multiple heavy Docker containers locally.
3. **Production Readiness**: Moving to physically separate database clusters later only requires updating the connection strings in `.env` without changing any application code.

## Q5. Monorepo (Shared Workspaces) vs Complete Independent Microservices

| Architecture Approach | Description | Pros & Cons | Recommendation |
| :--- | :--- | :--- | :--- |
| **Monorepo with Workspaces (Current)** | Single repository with npm workspaces (`services/*`) and hoisted root `node_modules`. | • **Pros**: Single `npm install` for all backend services, atomic commits across services, centralized dev scripts (`npm run dev:all`), lower disk usage.<br>• **Cons**: Prisma client collision in root `node_modules` (requires custom `@prisma/*-client` output paths), Docker builds require root context, risk of ghost dependencies. | **Chosen Approach (Current Stage)** |
| **Completely Independent Microservices** | Each service has isolated `node_modules`, own lockfile, and standalone Dockerfile (can remain in monorepo or separate repos). | • **Pros**: Zero tooling/Prisma collisions (standard `@prisma/client`), simple and fast isolated Docker builds (`docker build ./services/chat-service`), independent package upgrade lifecycles.<br>• **Cons**: Duplicate disk usage (~1-2 GB for repeated NestJS/TS packages), multiple `npm install` commands and lockfiles to maintain, harder to share internal code/DTOs. | **Recommended for Production & Scale** |

### Key Decision Points:
1. **Developer Velocity vs Deployment Isolation**: The current monorepo setup maximizes developer velocity during early stages with unified scripts and single-command setups.
2. **Tooling Trade-offs**: Root dependency hoisting forces custom output paths for tools like Prisma (`@prisma/auth-client`) to avoid overwriting generated artifacts.
3. **Evolution Path**: Maintain the monorepo for repository management, while gradually decoupling service `node_modules` and Docker contexts as independent deployment and scaling needs arise.
