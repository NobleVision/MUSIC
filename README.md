# Music Hosting & Distribution Platform

A comprehensive media management and distribution platform with secure admin access, hierarchical organization, social features, and public sharing capabilities.

## Recent Changes (December 2024)

### Vercel Deployment Configuration
- **Added `vercel.json`**: Configured Vercel deployment with proper build commands, output directory, and URL rewrites
- **Added `api/index.ts`**: Created serverless API handler for Express/tRPC backend on Vercel
- **Updated `tsconfig.json`**: Added `api/**/*` to TypeScript includes

### Console Error Fixes
- **Removed Umami analytics script**: Cleaned up `client/index.html` to remove unused analytics that caused console errors
- **Simplified login URL**: Updated `client/src/const.ts` to return `/login` directly instead of constructing OAuth URLs with undefined environment variables

### Files Modified
- `vercel.json` (new)
- `api/index.ts` (new)
- `tsconfig.json`
- `client/index.html`
- `client/src/const.ts`

## Features

### Core Functionality
- **Static Admin Authentication**: Secure login with username `admin` and password `glunet`
- **Hierarchical Dashboard**: Organize music into customizable sections and nested categories
- **File Management**: Upload, download, delete, and rename songs/videos with full metadata support
- **S3 Storage Integration**: Reliable cloud storage for all media files and cover art
- **Public Sharing**: Generate shareable links for songs/videos that work without login
- **Media Player**: Built-in audio and video player with streaming support

### Social Features
- **5-Star Rating System**: Rate tracks with average rating display
- **Threaded Comments**: Engage with nested comment threads
- **Collaborative Tagging**: Add, edit, and discover content through user-generated tags
- **Tag Cloud Visualization**: Browse content by popular tags

### Distribution Tools
- **Metadata Builder**: Comprehensive metadata editor for distribution
- **Artist Information**: Name, bio, ISRC/UPC codes, writer credits
- **Genre & Mood Tagging**: Categorize tracks for better discovery
- **AI Disclosure**: Flag AI-assisted content appropriately
- **Compliance Checklist**: 2025 U.S. Copyright Office guidelines compliance modal
- **Rights Verification**: Voice impersonation and human contribution checks

### External Integration
- **RESTful API**: Third-party tool integration support
- **API Key Authentication**: Secure API access management
- **Bulk Import Endpoint**: Import files from external tools
- **Section/Category Selection**: Target specific locations for imports

## Tech Stack

- **Frontend**: React 19, Tailwind CSS 4, shadcn/ui components
- **Backend**: Express 4, tRPC 11, Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **Storage**: Cloudinary (media files and cover art)
- **Authentication**: JWT-based sessions
- **Deployment**: Vercel (static + serverless functions)
- **Testing**: Vitest

## Architecture

### System Overview

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

### Authentication Flow

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

### API Request Flow

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

### Vercel Deployment Architecture

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

### File Upload Flow

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

## Getting Started

### Prerequisites

- Node.js 22.x or higher
- pnpm 10.x or higher
- MySQL database (or TiDB)
- AWS S3 bucket (or compatible storage)

### Installation

1. **Extract the zip file**
   ```bash
   unzip music-hosting-app.zip
   cd music-hosting-app
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Configure environment variables**
   
   Create a `.env` file in the root directory with the following variables:
   
   ```env
   # Database
   DATABASE_URL=mysql://user:password@host:port/database
   
   # JWT Secret (generate a random string)
   JWT_SECRET=your-secure-random-string-here
   
   # AWS S3 Storage (if running locally)
   AWS_ACCESS_KEY_ID=your-access-key
   AWS_SECRET_ACCESS_KEY=your-secret-key
   AWS_REGION=us-east-1
   AWS_S3_BUCKET=your-bucket-name
   
   # OAuth (for Manus platform, can be omitted for local dev)
   OAUTH_SERVER_URL=https://api.manus.im
   VITE_OAUTH_PORTAL_URL=https://portal.manus.im
   VITE_APP_ID=your-app-id
   OWNER_OPEN_ID=admin-open-id
   OWNER_NAME=Admin
   ```

4. **Initialize the database**
   ```bash
   pnpm db:push
   ```

5. **Run the development server**
   ```bash
   pnpm dev
   ```

6. **Access the application**
   
   Open your browser and navigate to `http://localhost:3000`
   
   Login with:
   - Username: `admin`
   - Password: `glunet`

### Building for Production

```bash
# Build the application
pnpm build

# Start the production server
pnpm start
```

### Deploying to Vercel

1. **Connect your repository** to Vercel via the dashboard

2. **Configure environment variables** in Vercel Project Settings:
   - `DATABASE_URL` - PostgreSQL connection string
   - `JWT_SECRET` - Random secret for JWT signing
   - `CLOUDINARY_CLOUD_NAME` - Cloudinary cloud name
   - `CLOUDINARY_API_KEY` - Cloudinary API key
   - `CLOUDINARY_API_SECRET` - Cloudinary API secret

3. **Deploy** - Vercel will automatically:
   - Run `pnpm run build`
   - Serve static files from `dist/public/`
   - Deploy `api/index.ts` as serverless functions
   - Route `/api/*` to serverless functions
   - Route all other paths to `index.html` (SPA)

4. **Verify deployment** at your Vercel URL

### Vercel Configuration

The `vercel.json` file configures:

```json
{
  "buildCommand": "pnpm run build",
  "outputDirectory": "dist/public",
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api/index.ts" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

## Project Structure

```
music-hosting-app/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── lib/           # Utilities and tRPC client
│   │   └── App.tsx        # Main app with routing
├── server/                # Backend Express + tRPC
│   ├── _core/            # Framework and infrastructure
│   ├── routers.ts        # tRPC API routes
│   ├── db.ts             # Database queries
│   ├── auth.ts           # Authentication logic
│   ├── upload.ts         # File upload handler
│   └── external-api.ts   # External API endpoints
├── drizzle/              # Database schema and migrations
│   └── schema.ts         # Database tables
├── shared/               # Shared types and constants
└── package.json          # Dependencies and scripts
```

## API Documentation

### Authentication

All protected endpoints require authentication via session cookie or API key.

**Admin Login**
```typescript
POST /api/trpc/auth.adminLogin
Body: { username: "admin", password: "glunet" }
```

### External API Endpoints

**Export to Dashboard**
```bash
POST /api/external/export-to-dashboard
Headers: X-API-Key: your-api-key
Body: {
  "sectionId": 123,
  "categoryId": 456,
  "files": [
    {
      "title": "Song Title",
      "fileUrl": "https://...",
      "filename": "song.mp3",
      "mediaType": "audio",
      "mimeType": "audio/mpeg",
      "lyrics": "...",
      "musicStyle": "Pop",
      "coverArtUrl": "https://..."
    }
  ]
}
```

**List Sections**
```bash
GET /api/external/sections
Headers: X-API-Key: your-api-key
```

**List Categories**
```bash
GET /api/external/categories/:sectionId
Headers: X-API-Key: your-api-key
```

## Testing

Run the test suite:

```bash
pnpm test
```

Tests cover:
- Authentication flows
- Section and category management
- Media file operations
- API endpoints

## Additional Documentation

- **todo.md**: Feature roadmap and future enhancements
- **b-roll-video-prompts.md**: 50 video prompts for login and dashboard backgrounds

## License

MIT

## Support

For issues or questions, please refer to the todo.md file for planned features and known limitations.
