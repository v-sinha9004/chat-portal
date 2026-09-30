# Daily Progress & Project Status

**Date:** September 28, 2026  
**Project:** Mentor–Mentee Chat Portal (UnsaidTalks)

---
## Learning

| # | Concept |
| :-: | :--- |
| 1 | Nestjs basics |
| 2 | Socket.io basics, what it offers on top of websockets |
| 3 | Nestjs websocket gateways lifecycle hooks |
| 4 | Bullmq |
| 5 | Zustand |

---

## 🗓️ September 28, 2026

| # | Task Description | Status |
| :-: | :--- | :-: |
| 1 | Initialized repository | ✅ |
| 2 | Figuring out what might be correct file structure for all microservices | ✅ |
| 3 | Reading few system design of chat applications | ✅ |
| 4 | Reading about different request type (websockets/long polling/polling, etc.) | ✅ |
| 5 | Add docs for design choices  | ✅ |
| 6 | Add draft hld architecture  | ✅ |
| 7 | Add nest.js project scaffolding for chat service  | ✅ |
| 8 | Make websocket endpoint for chat service & run a test chat between two users  | ✅ |
| 9 | Testing emitToRoom feature of socket.io  | ✅ |
| 10 | Reading and testing: room-per-chat (join all rooms per user) vs user-room (join only user room) - documented in DECISIONS.md  | ✅ |
| 11 | Read on database choice - documented in DECISIONS.md  | ✅ |
| 12 | Setup database locally with docker  | ✅ |
| 13 | Initialise user service   | ✅ |
| 14 | Add orm in user service for postgresql | ✅ |
| 15 | Add basic user crud endpoints with dummy users in user service | ✅ |
| 16 | Initialise api gateway | ✅ |
| 17 | Implement proxy, rate limiter in api gateway | ✅ |
| 18 | Scafolld frontend with react, vite, typescript | ✅ |
| 19 | Add basic chat UI for testing and setting up initial connections | ✅ |
| 20 | Integrate user API for displaying users in UI without role logic | ✅ |

---

## 🗓️ September 29, 2026

| # | Task Description | Status |
| :-: | :--- | :-: |  
| 1 | Integrating frontend client with our backend for testing websocket connection for chat | ✅ |
| 2 | Initialise auth service | ✅ |
| 3 | Implement auth service - JWT, login, signup | ✅ |
| 4 | Figuring out correct place to implement jwt authentication | ✅ |
| 5 | Figuring out jwt verification process for socket connection as it is persistent connection | ✅ |
| 6 | Create separate db for auth and user service within single database instance | ✅ |
| 7 | Bug fix: user and auth service breaking due to referencing to overiding generated prisma | ✅ |
| 8 | Refactor: shift from workspace architecture to complete microservices architecture - documented in DECISIONS.md | ✅ |
| 9 | Create login page in UI | ✅ |
| 10 | Testing authentication feature with dummmy users created | ✅ |
| 11 | Testing one-on-one chat with two logged in users | ✅ |
| 12 | On successful authentication, create a user in db | ✅ |
| 13 | Add jwt verification logic in api gateway for http and websocket requests | ✅ |
| 14 | Create public routes configuration for api gateway | ✅ |
| 15 | Send access token on registration & login to frontend | ✅ |
| 16 | Integrate auth flow with login UI | ✅ |
| 17 | Storing access token in front-end in react memory instead of localStorage to avoid security issues | ✅ |
| 18 | Exploring on what queue we can use for now for our application for message persistence in db - Documented in DECISIONS.md | ✅ |
| 19 | Multiple tab able to receive messages in real time of same user | ✅ |
| 20 | Decouple components in frontend for modular code | ✅ |
| 21 | Create basic Group chat feature | ✅ |
| 22 | Test group creation, message fan-out feature | ✅ |
| 24 | Integrating bullmq and publish events into it | ✅ |
| 25 | Add message worker on top of bullmq to store messages into mongodb | ✅ |
| 26 | Testing bullmq and message worker for message persistence | ✅ |
| 27 | Looking into reliable way to get sorted message response via appropriate indexing - Documented in DECISIONS.md | ✅ |
| 28 | Add conversation_id in message schema - so that we can index this for one-to-one message filtering | ✅ |
| 29 | Checking if we should create a separate collection for group messages | ✅ |
| 30 | Add ULID for unique sortable indentifier for messages | ✅ |
| 31 | Test if ulid idetifier are sortable in javascript | ✅ |
| 32 | Add chat endpoints to retrieve previous chats from database | ✅ |

---

## 🗓️ September 30, 2026

| # | Task Description | Status |
| :-: | :--- | :-: |  
| 1 | Show past chats in UI | ✅ |
| 2 | Introduce zustand in client for state management | ✅ |
| 3 | Refactor - move from context store to zustand for auth states for code consistency | ✅ |
| 4 | Test zustand changes | ✅ |
| 5 | Online/Offline status | ✅ |
| 6 | Typing Indicator | ✅ |
| 7 | Read receipts | ✅ |
| 8 | Show unread messages and its count | ✅ |
| 9 | Fix: scroll to bottom transition on message load on chat area | ✅ |
| 10 | Add script to seed 500 messages into a chat | ✅ |
| 11 | Load only 50 messages initially | ✅ |
| 12 | Load more messages in batches of 50 upon scrolling smoothly upwards | ✅ |
| 13 | Pin message feature | ⏳ |
| 14 | Save opened chat messages in memory, even when user navigates to other chats | ⏳ |
| 15 | Initialise media service | ✅ |
| 16 | Scroll to older messages even when message is not loaded in the memory | ⏳ |
| 17 | Setting up minIO for file storage - local development | ⏳ |

---

## ⏳ Upcoming tasks

| # | Task Description | Status |
| :-: | :--- | :-: |
| 1 | Show past chats in UI | ⏳ |
| 2 | Add central redis for caching  | ⏳ |
| 3 | Message deliver when user is connected to different chat server | ⏳ |
| 4 | Cache groupUsers response in chat-service for faster group chat fan-out | ⏳ |
| 5 | Role based access | ⏳ |
| 6 | Typing Indicator | ⏳ |
| 7 | Online/Offline Status | ⏳ |
| 8 | Group Chat Management | ⏳ |
| 9 | Read receipts| ⏳ |
| 10 | Announcement feature | ⏳ |
| 11 | Pin message feature | ⏳ |
| 12 | Doubt feature | ⏳ |
| 13 | Report message feature | ⏳ |
| 14 | Message search feature | ⏳ |
| 15 | Message edit feature | ⏳ |
| 16 | Message delete feature | ⏳ |
| 17 | File sharing feature | ⏳ |
| 18 | Message reaction feature | ⏳ |
| 19 | Image preview | ⏳ |
| 20 | Implement Media Service | ⏳ |
| 21 | In app notification | ⏳ |
| 22 | Enqueue before emitting message | ⏳ |
| 23 | Catch enqueue errors | ⏳ |
| 24 | Smooth Data Load on UI | ⏳ |
| 25 | Resposive UI | ⏳ |
| 26 | Test on mobile view | ⏳ |
| 27 | Test on real devices | ⏳ |
| 28 | Deployment of all services | ⏳ |
| 29 | Clean Up Codebase & documentation | ⏳ |
| 30 | Cache implementation at multiple levels for smooth loading and functioning | ⏳ |
| 31 | Cache invalidation when needed | ⏳ |
| 32 | Monitoring system | ⏳ |
| 33 | Limit character count of messages | ⏳ |
| 34 | Merge groups and direct chats | ⏳ |
| 35 | Sort groups and direct chats by last message time | ⏳ |
...More