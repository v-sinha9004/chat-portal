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
| **Monorepo with Workspaces (Current)** | Single repository with npm workspaces (`services/*`) and hoisted root `node_modules`. | • **Pros**: Single `npm install` for all backend services, atomic commits across services, centralized dev scripts (`npm run dev:all`), lower disk usage.<br>• **Cons**: Prisma client collision in root `node_modules` (requires custom `@prisma/*-client` output paths), Docker builds require root context, risk of ghost dependencies. | **Previous Approach** |
| **Completely Independent Microservices** | Each service has isolated `node_modules`, own lockfile, and standalone Dockerfile (can remain in monorepo or separate repos). | • **Pros**: Zero tooling/Prisma collisions (standard `@prisma/client`), simple and fast isolated Docker builds (`docker build ./services/chat-service`), independent package upgrade lifecycles.<br>• **Cons**: Duplicate disk usage (~1-2 GB for repeated NestJS/TS packages), multiple `npm install` commands and lockfiles to maintain, harder to share internal code/DTOs. | **Current Approach** |

### Key Decision Points:
1. **Developer Velocity vs Deployment Isolation**: The current monorepo setup maximizes developer velocity during early stages with unified scripts and single-command setups.
2. **Tooling Trade-offs**: Root dependency hoisting forces custom output paths for tools like Prisma (`@prisma/auth-client`) to avoid overwriting generated artifacts.
3. **Evolution Path**: Maintain the monorepo for repository management, while gradually decoupling service `node_modules` and Docker contexts as independent deployment and scaling needs arise.

### Rollback Plan
If any unforeseen issues arise, the changes can be reverted by:
- Re-adding "workspaces": ["services/*"] to the root package.json.
- Restoring output lines in the two schema.prisma files.
- Running npm install at the repository root.

## Q6. Reliable Message Queue

### Decision: What to Use Now vs. Later

| Stage | Solution | Why |
| :--- | :--- | :--- |
| **Now** | **Redis + BullMQ** | **Zero extra infrastructure.** Socket.io already requires Redis for multi-instance scaling and presence tracking. Has first-party `@nestjs/bullmq` support and takes minutes to set up. |
| **Later** *(if scale explodes)* | **Apache Kafka** *(or RabbitMQ)* | **Multi-consumer event streaming.** When multiple separate services (persistence worker, push notifications, search indexer, analytics) need to consume the same message stream without re-querying the database. |

### Broker Comparison & Trade-offs

| Broker | Status | Key Pros | Key Cons | Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| **Redis + BullMQ** | **Use Now** | • **Zero footprint**: Reuses the Redis instance needed for Socket.io clustering.<br>• **Native NestJS**: Cleanest integration via `@nestjs/bullmq`.<br>• **Built-in features**: Retries with backoff, concurrency controls, and DLQ out of the box. | • **Memory-bound**: Queues reside in RAM; large unconsumed backlogs eat memory.<br>• Not meant for multi-day message log retention. | **Chosen Approach (Recommended)** |
| **RabbitMQ** | **Alternative** | • **Disk-backed durability**: Minimal memory pressure during backlogs.<br>• **Advanced routing**: Flexible exchanges, routing keys, and dead-letter exchanges. | • Extra service container to manage.<br>• Redundant if Redis is already running for WebSockets. | **Alternative for Strict Durability** |
| **Apache Kafka** | **Use Later** | • **Massive throughput**: Millions of msgs/sec with partitioned scaling.<br>• **Replayable event log**: Multiple consumer groups can read at their own pace. | • **High complexity**: Partition rebalancing, offset tracking, heavy operational overhead.<br>• Overkill for simple queue-to-DB persistence. | **Future Scale (Multi-consumer Event Mesh)** |

### My Take
- Using bullmq for now, will see how it works
- If it has any issue for our use case, we will switch to RabbitMQ

## Q7. Ensuring Time-Sorted Message Delivery (Message Ordering Strategy)

**Problem:** We cannot rely on `created_at` to decide the message sequence because two messages can be created at the same time.

### 1. Architectural Options for Sequence Durability & Ordering

| Strategy | Mechanism & State Storage | Pros & Cons | Recommendation |
| :--- | :--- | :--- | :--- |
| **Stateless Sortable IDs (ULID / Snowflake)** | **Zero state in Redis or DB**.<br>Generates time-ordered unique IDs in memory using timestamp prefix + monotonic random/sequence bits. | • **Pros**: Zero risk of counter loss or rollbacks on crash/restart; microsecond in-memory generation; zero network hops.<br>• **Cons**: No contiguous integer sequence ($1, 2, 3\dots$), cannot do arithmetic gap detection. | **Chosen Approach (Recommended)** |
| **Durable DB Atomic Counter (MongoDB `$inc` / Postgres)** | **Persisted to disk**.<br>Atomic counter on the conversation document/row updated via MongoDB `findOneAndUpdate({ $inc: { lastSeq: 1 } })` or Postgres `RETURNING`. | • **Pros**: 100% ACID durability; strict monotonic integer sequence ($1, 2, 3\dots$); trivial gap/loss detection.<br>• **Cons**: Adds 1–3ms database round-trip before broadcasting every message. | **Alternative for Strict Gap Detection** |
| **Redis In-Memory Counter + DB Hydration** | **In-memory cache with fallback**.<br>Redis `INCR seq:<convoId>`. On Redis restart/cache-miss, query max sequence from DB to re-hydrate counter. | • **Pros**: Sub-millisecond execution ($<1\text{ms}$).<br>• **Cons**: High failure risk; asynchronous persistence can cause rollbacks/duplicate IDs if Redis dies before DB writes commit. | **Not Recommended (Too Fragile)** |

### 2. ULID vs. Twitter Snowflake Comparison

| Feature / Dimension | ULID | Twitter Snowflake | Verdict for `chat-portal` |
| :--- | :--- | :--- | :--- |
| **Worker / Machine Coordination** | **Zero configuration.** Works out of the box across any number of server replicas. | **Requires coordination.** Each pod/node needs a unique `worker_id` ($0\text{–}1023$) via ZooKeeper, etcd, or manual env vars. | **ULID wins** (Zero operational overhead in Docker/K8s). |
| **JS / JSON Precision** | **100% Safe.** 26-char Crockford Base32 string. Native JSON support. | **Unsafe in JS.** 64-bit integer exceeds `Number.MAX_SAFE_INTEGER` ($2^{53}-1$); silently corrupts in `JSON.parse` unless manually cast to string. | **ULID wins** (Zero serialization bugs in Node & React). |
| **Codebase Integration** | **Drop-in replacement** for current `randomUUID()`. Preserves existing `string` types in MongoDB, Socket.io, and React. | Requires migrating ID types to `BigInt` or specialized custom string wrappers. | **ULID wins** (Zero breaking schema migrations). |
| **Sub-Millisecond Collisions** | Built-in monotonic factory increments the 80-bit random component within the same ms. | 12-bit sequence counter ($4,096\text{ IDs/ms}$ per worker). | **Tie** (Both handle millisecond bursts). |
| **Storage & Index Size** | 26-byte string (or 16-byte binary BSON). | 8-byte 64-bit integer (`Long` / `BIGINT`). | **Snowflake wins on raw storage**, but negligible difference in MongoDB. |
| **Client-Side Sorting** | Standard string comparison: `a.id.localeCompare(b.id)` or `a.id < b.id`. | Custom `BigInt(a.id) < BigInt(b.id)` or string comparison. | **ULID wins** (Native string sorting in React). |

### Key Decision Points:
1. **No Counter to Lose**: In-memory Redis counters risk rolling back on server restart or eviction. ULID is completely stateless—subsequent IDs are guaranteed to be larger because physical time moves forward.
2. **Node.js & React Compatibility**: Snowflake's 64-bit integer creates subtle precision loss bugs in JavaScript browsers. ULID uses Crockford Base32 strings which sort lexicographically out of the box.
3. **Drop-in Simplicity**: ULID directly replaces `randomUUID()` across `chat-service`, MongoDB `MessageSchema`, and React `ChatMessage` without any database schema refactoring.

### 3. Performance Reality: String (ULID) vs. Integer (BigInt)

| Dimension | Integer (`BigInt` / Snowflake) | String (`ULID`) | Reality for Real-World Chat |
| :--- | :--- | :--- | :--- |
| **CPU Comparison Speed** | 1 assembly instruction (`CMP`, $\approx 0.5\text{ns}$) | 2–3 assembly instructions ($\approx 2\text{ns}$) | **Negligible difference** ($\approx 2\text{ns}$ vs $20\text{ms}$ network transit latency). |
| **Index RAM Footprint** | 8 bytes per record ($\approx 800\text{ MB}$ for 100M msgs) | 26 bytes per record ($\approx 2.6\text{ GB}$ for 100M msgs) | Both fit comfortably in memory; only matters at massive billions-scale. |
| **Generation Latency** | $\approx 1\text{–}3\text{ms}$ if using DB `$inc` counter | $< 0.01\text{ms}$ in-memory CPU | **ULID is faster overall** by eliminating counter network/disk hops. |
| **JS / JSON Serialization** | Requires string conversion to avoid $2^{53}-1$ truncation | Native string handling | **ULID avoids serialization overhead** in Node.js and React. |

### 4. Indexing Strategy: Unified `conversationId` for Direct & Group Chats

To avoid slow `$or` queries across separate `senderId` and `recipientId` fields for direct messages:
* **Deterministic `conversationId`:**
  * Direct chats: `[senderId, recipientId].sort().join(':')` (e.g., `userA:userB`)
  * Group chats: `group:<groupId>`
* **Single Compound Index (ESR Rule):**
  `MessageSchema.index({ conversationId: 1, messageId: -1 });`
  * Replaces 2 separate directional `$or` indexes with **1 unified index**.
  * Eliminates in-memory sorting and cuts index memory usage by 50%.

### 5. Cursor-Based Pagination for Infinite Scroll

* **Never use `skip(offset)` in chat:** Offset pagination is $O(N)$ slow and breaks when live messages arrive (causes duplicate or skipped messages).
* **Use Keyset Cursor Pagination:** ULID itself serves as the cursor:
  ```typescript
  // Query 50 messages older than the oldest visible message:
  db.messages.find({ conversationId, messageId: { $lt: cursor } })
    .sort({ messageId: -1 })
    .limit(50);
  ```
* **Coexistence with Real-Time Sockets:** Live socket messages append to the bottom (`[...prev, newMsg]`), while historical messages prepend to the top (`[...olderMsgs, ...prev]`) with zero offset drift.

## Q8. Single Messages Collection vs. Separate Collections (Direct vs. Group)

| Strategy | Architecture & Mechanics | Pros & Cons | Recommendation |
| :--- | :--- | :--- | :--- |
| **Single Unified Collection (`messages`)** | All messages live in one collection with a `conversationId` (`direct:userA:userB` or `group:groupId`) and compound index `{ conversationId: 1, messageId: -1 }`. | • **Pros**: Identical $< 2\text{ms}$ fetch speed (B-Tree index isolates conversations); single query for global search and sidebar "last message" previews; zero code duplication.<br>• **Cons**: Slightly larger single collection on disk. | **Chosen Approach (Recommended)** |
| **Separate Collections (`direct_messages` & `group_messages`)** | Split into two distinct collections and schemas based on chat type. | • **Pros**: Physically separates direct vs group data.<br>• **Cons**: Zero fetch speed improvement ($O(\log N)$ index seek is identical); requires querying both collections and merging in memory for global search and sidebar previews; duplicates schemas, workers, and DTOs. | **Not Recommended** |

### Key Decision Points:
1. **Query Speed is Identical**: MongoDB uses B-Tree index seeks, not full collection scans. The compound index `{ conversationId: 1, messageId: -1 }` isolates conversations into dedicated index branches, delivering identical $< 2\text{ms}$ response times.
2. **Avoids Dual-Query Merging**: Rendering the sidebar with recent conversations or performing full-text search requires a single query instead of querying two collections and merge-sorting in application memory.
3. **No Code Duplication**: Backend schemas, BullMQ persistence processors, and future features (reactions, attachments, message edits) are written once.

