# System Architecture

## High-Level Design (HLD) - Draft

```mermaid
flowchart TD
    classDef client fill:#2563eb,stroke:#1d4ed8,stroke-width:2px,color:#fff;
    classDef gateway fill:#7c3aed,stroke:#6d28d9,stroke-width:2px,color:#fff;
    classDef service fill:#0284c7,stroke:#0369a1,stroke-width:2px,color:#fff;
    classDef queue fill:#d97706,stroke:#b45309,stroke-width:2px,color:#fff;
    classDef storage fill:#059669,stroke:#047857,stroke-width:2px,color:#fff;

    USER_A["<b>User A</b>"]:::client
    USER_B["<b>User B</b>"]:::client

    GATEWAY["<b>API GATEWAY</b>"]:::gateway

    AUTH["<b>AUTH SERVICE</b>"]:::service
    USER["<b>USER SERVICE</b>"]:::service
    CHAT["<b>CHAT SERVICE</b>"]:::service
    MEDIA["<b>MEDIA SERVICE</b>"]:::service
    IDGEN["<b>MESSAGE ID GENERATOR</b>"]:::service

    MQ["<b>MESSAGE QUEUE</b>"]:::queue

    POSTGRES[("<b>PostgreSQL</b>")]:::storage
    MONGO[("<b>MongoDB</b>")]:::storage
    REDIS[("<b>Redis</b>")]:::storage

    USER_A -->|HTTP / WebSocket| GATEWAY

    GATEWAY --> AUTH
    GATEWAY --> USER
    GATEWAY --> CHAT
    GATEWAY --> MEDIA

    CHAT --> IDGEN
    USER --> POSTGRES
    CHAT --> MQ
    MQ --> MONGO
    MQ --> USER_B
    CHAT ~~~ REDIS
```








