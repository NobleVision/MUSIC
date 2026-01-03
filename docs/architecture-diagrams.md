# Architecture Diagrams (Mermaid Source)

This file contains the editable Mermaid diagram source code for the Music Hosting Platform architecture.
These diagrams can be edited and rendered using any Mermaid-compatible viewer or the [Mermaid Live Editor](https://mermaid.live/).

---

## 1. System Overview

Shows the high-level architecture of the application including React frontend, Vercel deployment, tRPC backend, and external services.

```mermaid
graph TB
    subgraph "Client Browser"
        UI[React Frontend]
        TQ[TanStack Query]
    end

    subgraph "Vercel Edge"
        SF[Static Files<br/>dist/public]
        API[Serverless Functions<br/>api/index.ts]
    end

    subgraph "Backend Services"
        TRPC[tRPC Router]
        EXPRESS[Express Middleware]
        AUTH[Auth Module]
    end

    subgraph "External Services"
        DB[(PostgreSQL<br/>Database)]
        CLOUD[Cloudinary<br/>Media Storage]
    end

    UI --> TQ
    TQ -->|tRPC Calls| API
    UI -->|Static Assets| SF
    API --> EXPRESS
    EXPRESS --> TRPC
    TRPC --> AUTH
    AUTH --> DB
    TRPC --> DB
    TRPC --> CLOUD
```

---

## 2. Authentication Flow

Sequence diagram showing the complete login flow from user interaction to JWT token generation.

```mermaid
sequenceDiagram
    participant U as User
    participant C as Client App
    participant A as API Server
    participant DB as Database

    U->>C: Navigate to /login
    C->>U: Show login form
    U->>C: Enter credentials<br/>(admin/glunet)
    C->>A: POST /api/trpc/auth.adminLogin
    A->>A: Verify credentials
    A->>DB: Get/Create user record
    DB-->>A: User data
    A->>A: Generate JWT token
    A-->>C: Set session cookie
    C->>C: Redirect to dashboard
    C->>A: Subsequent requests<br/>with cookie
    A->>A: Validate JWT
    A-->>C: Authorized response
```

---

## 3. API Request Flow

Flowchart showing how tRPC requests travel from React components through the network to the server and back.

```mermaid
flowchart LR
    subgraph "Client"
        A[React Component]
        B[tRPC Client]
    end

    subgraph "Network"
        C[HTTP Request]
    end

    subgraph "Server"
        D[Express Server]
        E[tRPC Middleware]
        F[Context Creator]
        G[Router Handler]
        H[Database Query]
    end

    A -->|useQuery/useMutation| B
    B -->|Serialize| C
    C -->|/api/trpc/*| D
    D --> E
    E --> F
    F -->|Auth Check| G
    G --> H
    H -->|Response| G
    G -->|Serialize| C
    C --> B
    B --> A
```

---

## 4. Vercel Deployment Architecture

Shows the build and deployment process on Vercel, including how routes are handled.

```mermaid
graph TB
    subgraph "GitHub Repository"
        SRC[Source Code]
    end

    subgraph "Vercel Build"
        BUILD[pnpm run build]
        VITE[Vite Build<br/>→ dist/public/]
        ESB[esbuild<br/>→ dist/index.js]
    end

    subgraph "Vercel Deployment"
        CDN[CDN Edge<br/>Static Files]
        FN[Serverless Functions<br/>api/index.ts]
    end

    subgraph "Routing"
        R1["/api/*" → Serverless]
        R2["/*" → index.html]
    end

    SRC -->|Push| BUILD
    BUILD --> VITE
    BUILD --> ESB
    VITE --> CDN
    FN --> R1
    CDN --> R2
```

---

## 5. File Upload Flow

Sequence diagram showing the complete file upload process from user selection to database storage.

```mermaid
sequenceDiagram
    participant U as User
    participant C as Client
    participant A as API Server
    participant CL as Cloudinary
    participant DB as Database

    U->>C: Select file + metadata
    C->>C: Validate file type/size
    C->>A: POST /api/upload<br/>(multipart/form-data)
    A->>A: Multer processes file
    A->>CL: Upload to Cloudinary
    CL-->>A: Return URL + metadata
    A->>DB: Create media_files record
    DB-->>A: Record created
    A-->>C: Success + file data
    C->>C: Update UI
    C-->>U: Show uploaded file
```

---

## Generating Images

To generate PNG images from these diagrams, you can use the Mermaid CLI:

```bash
# Install Mermaid CLI
npm install -g @mermaid-js/mermaid-cli

# Generate PNG from a .mmd file
mmdc -i diagram.mmd -o diagram.png -b transparent
```

Or use the [Mermaid Live Editor](https://mermaid.live/) to export diagrams manually.

