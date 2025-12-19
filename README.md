# Music Hosting & Distribution Platform

A comprehensive media management and distribution platform with secure admin access, hierarchical organization, social features, and public sharing capabilities.

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
- **Database**: MySQL/TiDB with Drizzle ORM
- **Storage**: AWS S3
- **Authentication**: JWT-based sessions
- **Testing**: Vitest

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
