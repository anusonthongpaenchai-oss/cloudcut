# CloudCut - Collaborative Video Editing Platform

CloudCut is a web-based, non-linear video editing platform designed for real-time collaboration. Users can upload video assets, organize them on a multi-track timeline, apply effects and transitions, collaborate live with other editors (with active presence, collaborator list, and remote cursor tracking), and trigger asynchronous high-quality video exports processed by a background worker pipeline.

---

## Tech Stack

The project is structured as a monorepo managed via `pnpm` workspaces:

* **Frontend**:
  * **Core**: React 19, TypeScript, Vite
  * **Styling**: TailwindCSS v4, Geist Sans font family, Lucide React icons
  * **State Management**: Zustand
  * **Real-time Collaboration**: Pusher-js (WebSockets)
* **Backend API**:
  * **Runtime/Framework**: Node.js, Fastify (TypeScript)
  * **Database ORM**: Prisma ORM with PostgreSQL client
  * **Authentication**: JSON Web Tokens (`@fastify/jwt`)
  * **Job Queue Management**: BullMQ (backed by Redis)
  * **Real-time Services**: Pusher SDK
* **Background Worker**:
  * **Core**: Node.js, TypeScript
  * **Queue Processing**: BullMQ Workers, ioredis
  * **Video Processing/Rendering Engine**: FFmpeg (via local system commands)
  * **Object Storage Client**: AWS S3 SDK (configured for S3-compatible storage)
* **Infrastructure**:
  * **PostgreSQL**: Relational database for transactional data and logs.
  * **Redis**: Fast, in-memory key-value store for queue management.
  * **MinIO**: S3-compatible local object storage for raw videos, proxies, and exports.
  * **Pusher**: Real-time websocket gateway.

---

## Architecture Diagram

```mermaid
graph TD
    User([User Browser])
    
    subgraph Frontend [Frontend - React / Vite]
        UI[Timeline & Video Player]
        ZS[Zustand Store]
        PusherClient[Pusher JS client]
    end
    
    subgraph Backend [Backend API - Fastify]
        Router[API Router]
        Auth[JWT Authentication]
        PrismaBE[Prisma ORM]
        BullQueue[BullMQ Queues]
        PusherSDK[Pusher SDK]
    end

    subgraph Workers [Background Worker Node]
        BullWorker[BullMQ Worker]
        FFmpegProc[FFmpeg Command runner]
        PrismaWorker[Prisma ORM]
        PusherWorker[Pusher SDK]
    end

    subgraph Infrastructure
        DB[(PostgreSQL)]
        Cache[(Redis)]
        Storage[(MinIO / S3 compatible)]
        PusherService[Pusher Cloud Service]
    end

    %% Interactions
    User -->|Interacts| UI
    UI -->|Updates State| ZS
    ZS -->|REST API Requests / S3 Presigned URL Request| Router
    Router -->|Authenticate JWT| Auth
    Router -->|Write metadata / logs| PrismaBE
    Router -->|Dispatch tasks| BullQueue
    Router -->|Authorize private channels| PusherSDK
    
    PrismaBE --> DB
    BullQueue --> Cache
    
    %% Direct S3 upload from Frontend
    UI -->|Upload video via Presigned URL| Storage
    
    %% Realtime Collaboration channel
    PusherClient <-->|WebSockets| PusherService
    PusherSDK -->|Broadcast updates| PusherService
    PusherWorker -->|Broadcast job progress| PusherService
    
    %% Workers processing
    BullWorker <-->|Poll jobs / Update status| Cache
    BullWorker -->|Read & Update job details| PrismaWorker
    PrismaWorker --> DB
    BullWorker -->|Download / Process / Cut / Render| FFmpegProc
    FFmpegProc -->|Read input / Write outputs| Storage
    BullWorker -->|Publish task updates| PusherWorker
```

---

## Environment Variables

### Root Configuration
Create a `.env` file in the root workspace folder to configure your database and storage credentials used by Docker Compose:

```bash
# Database Credentials
POSTGRES_USER=root
POSTGRES_PASSWORD=password
POSTGRES_DB=cloudcut

# MinIO Object Storage Credentials
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=password123
```

### Backend Services (`/backend/.env`)
Create `/backend/.env` containing the configuration for the Fastify server:

```bash
DATABASE_URL="postgresql://root:password@localhost:5433/cloudcut"
JWT_SECRET="your-jwt-super-secret"

# ===== Redis / BullMQ =====
REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_PASSWORD=""

# ===== MinIO (S3 Compatible Object Storage) =====
S3_REGION="us-east-1"
S3_ENDPOINT="http://localhost:9000"
S3_ACCESS_KEY="admin"
S3_SECRET_KEY="password123"
S3_BUCKET="cloudcut-assets"

# ===== Pusher (Real-time Websockets) =====
PUSHER_APP_ID="your-pusher-app-id"
PUSHER_KEY="your-pusher-key"
PUSHER_SECRET="your-pusher-secret"
PUSHER_CLUSTER="ap1"
```

### Worker Node (`/worker/.env`)
Create `/worker/.env` (or let the worker read from root/backend if sharing variables):

```bash
DATABASE_URL="postgresql://root:password@localhost:5433/cloudcut"

# ===== Redis / BullMQ =====
REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_PASSWORD=""

# ===== S3 Compatible Object Storage =====
AWS_REGION="us-east-1"
AWS_ENDPOINT_URL_S3="http://localhost:9000"
AWS_ACCESS_KEY_ID="admin"
AWS_SECRET_ACCESS_KEY="password123"
AWS_S3_BUCKET="cloudcut-assets"

# ===== Pusher =====
PUSHER_APP_ID="your-pusher-app-id"
PUSHER_KEY="your-pusher-key"
PUSHER_SECRET="your-pusher-secret"
PUSHER_CLUSTER="ap1"
```

### Frontend Web (`/frontend/.env`)
Create `/frontend/.env` to configure the client build:

```bash
VITE_API_URL=http://localhost:3000
VITE_PUSHER_KEY=your-pusher-key
VITE_PUSHER_CLUSTER=ap1
```

---

## Setup Instructions

Ensure you have [Node.js](https://nodejs.org/), [pnpm](https://pnpm.io/), and [Docker](https://www.docker.com/) installed on your machine.

### 1. Install Workspace Dependencies
Run the install command from the project root:
```bash
pnpm install
```

### 2. Launch Local Infrastructure Services
Start the preconfigured PostgreSQL database, Redis instance, and MinIO storage using Docker Compose. The `createbuckets` service will automatically initialize the `cloudcut-assets` bucket:
```bash
docker compose up -d
```

### 3. Generate Prisma Client
Generate the TypeScript client bindings from the Prisma schema:
```bash
pnpm --filter backend exec prisma generate
pnpm --filter worker run prisma:generate
```

---

## Database Migration Command

Create tables, run pending schema changes, and seed initial demo data (like default workspaces, users, and projects):

### Run Migrations
```bash
pnpm --filter backend exec prisma migrate dev
```

### Seed Database
```bash
pnpm --filter backend exec prisma db seed
```

---

## Running the Application

You can spin up each service individually or run them concurrently.

### Backend Run Command
Starts the Fastify development server with `tsx` hot-reloading:
```bash
pnpm --filter backend start
```
*The server will start listening at [http://localhost:3000](http://localhost:3000).*

### Worker Run Command
Starts the BullMQ task worker queue and daily cron processors:
```bash
pnpm --filter worker dev
```

### Frontend Run Command
Starts the Vite dev server for the React application:
```bash
pnpm --filter frontend dev
```
*The frontend web app will be available at [http://localhost:5173](http://localhost:5173).*

---

## API Documentation Link

API routes and validation rules are structured in [router.ts](file:///d:/Project/Personal/cloudcut/backend/src/router/router.ts) under the `/backend` directory.

To inspect route endpoints and JSON payload validation structures:
* View details in the backend design specifications: [DESIGN.md](file:///d:/Project/Personal/cloudcut/backend/DESIGN.md)
* Future Swagger/OpenAPI support can be registered at: `http://localhost:3000/docs` once `@fastify/swagger` registration is added.

---

## Known Limitations

1. **Hosted Pusher WebSocket Scale Limits**: Pusher has strict concurrent connection thresholds and message payload size limits on free plans.
2. **Local FFmpeg Dependency**: The background worker depends on local binary installations of FFmpeg. If FFmpeg is not in the system's `PATH`, video transcoding and thumbnail generation will fail.
3. **Sequential Processing**: Workers process rendering jobs sequentially per queue worker node. Heavy video jobs might block minor tasks if no additional worker scaling is configured.
4. **Optimistic Locking**: Current timeline sync uses server-sequence numbers for operation logs, but does not fully support automatic operational merge conflict resolution (CRDTs) when two users edit the exact same element offline.

---

## Future Improvements

* **Soketi / Self-hosted WebSockets**: Transition from hosted Pusher to an open-source, high-performance, self-hosted WebSocket engine to scale connection counts.
* **Distributed chunked S3 Uploads**: Implement S3 multipart uploads in the frontend to support resilient, large-file resume capabilities.
* **Timeline CRDTs Integration**: Implement Yjs or a custom OT library to handle complex edge-case conflict resolutions on high-density collaborative edits.
* **Dynamic Worker Scaling**: Introduce containerized execution (e.g., AWS ECS, Kubernetes KEDA) to autoscale worker pods dynamically based on BullMQ queue load metrics.
* **Dockerized Execution Environment for Worker**: Bundle FFmpeg directly inside a worker Docker image to make worker deployments environment-agnostic.
