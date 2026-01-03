# Technology Stack & Build System

## Core Technologies

### Frontend
- **React 19** with TypeScript
- **Tailwind CSS 4** for styling
- **shadcn/ui** component library with Radix UI primitives
- **Wouter** for client-side routing
- **Framer Motion** for animations
- **@tanstack/react-query** for state management
- **@trpc/react-query** for type-safe API calls

### Backend
- **Node.js** with **Express 4**
- **tRPC 11** for type-safe API layer
- **TypeScript** throughout
- **Drizzle ORM** with PostgreSQL
- **Jose** for JWT authentication
- **Cloudinary** for media storage
- **Multer** for file uploads

### Build System
- **Vite 7** for frontend bundling and dev server
- **esbuild** for backend bundling
- **TypeScript 5.9** for type checking
- **Vitest** for testing
- **pnpm** as package manager

### Database
- **PostgreSQL** with Drizzle ORM
- **drizzle-kit** for migrations and schema generation

## Common Commands

### Development
```bash
pnpm dev          # Start development server (frontend + backend)
pnpm check        # TypeScript type checking
pnpm format       # Format code with Prettier
pnpm test         # Run test suite with Vitest
```

### Database
```bash
pnpm db:push      # Generate and run database migrations
```

### Production
```bash
pnpm build        # Build frontend (Vite) + backend (esbuild)
pnpm start        # Start production server
```

## Development Setup

- Frontend runs on Vite dev server (typically port 3000)
- Backend runs on Express with auto-reload via tsx watch
- Database migrations handled by Drizzle Kit
- Environment variables in `.env` file
- Static admin credentials: admin/glunet

## Deployment

### Vercel (Recommended)
- Frontend: Static files served from `dist/public/`
- Backend: Serverless functions via `api/index.ts`
- Build command: `pnpm run build`
- Environment variables configured in Vercel dashboard

### Local Production
- Single Express server serves both static files and API
- Built files in `dist/` directory
- NODE_ENV=production for production mode