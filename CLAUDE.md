# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Music hosting & distribution platform — full-stack React/Express app with social engagement features, media management, and public sharing. Deployed on Vercel.

## Commands

```bash
pnpm dev          # Start dev server (Express + Vite HMR on port 3000)
pnpm build        # Production build (sync videos → vite build → esbuild backend)
pnpm start        # Run production server (node dist/index.js)
pnpm check        # TypeScript type checking (tsc --noEmit)
pnpm format       # Prettier formatting
pnpm test         # Run tests (vitest)
pnpm db:push      # Generate and apply database migrations (drizzle-kit)
```

## Tech Stack

- **Frontend**: React 19, Tailwind CSS 4, shadcn/ui, Wouter (routing), Framer Motion
- **Backend**: Express, tRPC 11 (React Query integration), Multer (uploads)
- **Database**: PostgreSQL (Neon) with Drizzle ORM
- **Storage**: Cloudinary (chunked uploads for files >95MB, max 250MB video)
- **Auth**: JWT via jose, cookie-based sessions (7-day expiry)
- **Testing**: Vitest with fast-check property-based tests
- **Build**: Vite (frontend), esbuild (backend), pnpm

## Architecture

### Request Flow

Express middleware chain: CORS → Body Parser → OAuth → Upload → External API → SSE → tRPC → Vite/Static

tRPC has three procedure levels: `publicProcedure`, `protectedProcedure` (requires session), `adminProcedure` (requires admin role).

### Frontend Structure (`client/src/`)

- **Pages** — route-level components (Dashboard, SectionView, CategoryView, MediaDetail, ShareView, Distribution, Settings, Login)
- **Contexts** — `MusicPlayerContext` (1200+ lines, manages global playback state, queue, shuffle/loop, video element registration, play tracking) and `ThemeContext`
- **lib/** — tRPC client setup (`trpc.ts`), Cloudinary upload helpers (`storage.ts`)
- **components/** — app components at top level, shadcn/ui primitives in `ui/`

Routing uses Wouter. `/share/:token` is the only public route; all others require auth.

### Backend Structure (`server/`)

- **`_core/`** — framework plumbing (Express setup, tRPC init, context creation, session cookies, env validation). Avoid modifying unless changing infrastructure.
- **`routers.ts`** — all tRPC API procedures (sections, categories, mediaFiles, tags, ratings, comments, votes, engagement, activity, upload, auth)
- **`db.ts`** — database query functions (all Drizzle queries live here)
- **`engagement.ts`** — social features: voting, play/view/download tracking, trending/popular/hot algorithms, activity feed, rate limiting, IP hashing
- **`sse.ts`** — Server-Sent Events broadcaster for real-time activity feed
- **`storage.ts`** — Cloudinary integration and upload signatures
- **`external-api.ts`** — REST endpoints for third-party tools

### Database (`drizzle/schema.ts`)

15 tables. Key relationships:
- Users → Sections → Categories → MediaFiles (hierarchical)
- MediaFiles have engagement columns (playCount, downloadCount, viewCount, upvotes, downvotes, hotnessScore)
- Comments support threading via `parentCommentId`
- Votes are unique per IP/media pair
- PlayLogs, DownloadLogs, ViewLogs store event history

### File Upload Flow

1. Client gets upload signature from `trpc.upload.getSignature`
2. Files >95MB use chunked upload (20MB chunks with Content-Range headers) directly to Cloudinary
3. Cloudinary returns URL → client calls `trpc.mediaFiles.create` to store metadata

### Deployment

Vercel: static files from `dist/public/`, serverless functions via `api/index.ts`. Build uses `pnpm run build:vercel` which outputs to `.vercel/output`.

## Testing

Tests are server-side only in `server/*.test.ts`. The engagement test suite uses property-based testing (fast-check) with 65 tests covering voting, play tracking, rate limiting, trending algorithms, and activity feed.

Run a single test file: `pnpm vitest run server/engagement.test.ts`

## Environment Variables

Required: `DATABASE_URL`, `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
