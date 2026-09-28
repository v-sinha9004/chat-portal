# Design Decisions

## Q1. Choosing connection protocol for chat between client and chat server

| Protocol | Communication Model | Decision Parameter | Recommendation for Real-Time Chat |
| :--- | :--- | :--- | :--- |
| **WebSockets** | Full-duplex, bidirectional over a single TCP connection | • True real-time bidirectional communication<br>• Low latency and minimal bandwidth waste<br>• Server can push messages instantly<br>• Efficient for high-frequency messaging | **Primary Choice (Recommended)** |
| **Long Polling** | Unidirectional HTTP request held open until new data arrives or a timeout threshold is reached | • Still periodic connection after timeout<br>• Server cannot say if client is disconnected | **Fallback Option** |
| **Polling** | Periodic client requests at fixed intervals (e.g., every 2-5s) | • High server load at scale<br>• No new message most of the time, so wastage of resources | **Not Recommended for Chat** |

