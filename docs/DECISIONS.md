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
