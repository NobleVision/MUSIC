# Project Structure & Organization

## Directory Layout

```
music-hosting-app/
├── api/                    # Vercel serverless functions
│   └── index.ts           # API entry point for Vercel deployment
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   │   └── ui/        # shadcn/ui components
│   │   ├── pages/         # Page-level components
│   │   ├── contexts/      # React contexts (theme, etc.)
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utilities and tRPC client setup
│   │   └── _core/         # Core frontend infrastructure
│   ├── public/            # Static assets
│   └── index.html         # HTML template
├── server/                # Backend Express + tRPC
│   ├── _core/            # Backend framework and infrastructure
│   ├── *.ts              # Feature modules (auth, db, storage, etc.)
│   └── *.test.ts         # Test files
├── shared/               # Shared types and constants
│   ├── _core/           # Core shared utilities
│   ├── types.ts         # Type exports
│   └── const.ts         # Shared constants
├── drizzle/             # Database schema and migrations
│   ├── schema.ts        # Database table definitions
│   └── migrations/      # Generated migration files
└── public/              # Public assets (videos, etc.)
```

## Naming Conventions

### Files & Directories
- **PascalCase**: React components (`CategoryCard.tsx`, `MediaDetail.tsx`)
- **camelCase**: Utilities, hooks, and non-component files (`useAuth.ts`, `storage.ts`)
- **kebab-case**: Configuration files (`.prettierrc`, `drizzle.config.ts`)
- **lowercase**: Directories (`components`, `pages`, `server`)

### Code Conventions
- **Components**: PascalCase exports (`export default CategoryCard`)
- **Functions**: camelCase (`createMediaFile`, `getUserSections`)
- **Constants**: UPPER_SNAKE_CASE (`COOKIE_NAME`, `JWT_SECRET`)
- **Types**: PascalCase (`MediaFile`, `InsertSection`)

## Architecture Patterns

### Frontend Organization
- **Pages**: Top-level route components in `client/src/pages/`
- **Components**: Reusable UI in `client/src/components/`
- **UI Components**: shadcn/ui components in `client/src/components/ui/`
- **Hooks**: Custom hooks in `client/src/hooks/` and `client/src/_core/hooks/`
- **Contexts**: React contexts in `client/src/contexts/`

### Backend Organization
- **Routers**: tRPC route definitions in `server/routers.ts`
- **Database**: Queries and operations in `server/db.ts`
- **Core Infrastructure**: Framework code in `server/_core/`
- **Feature Modules**: Domain logic in individual files (`auth.ts`, `storage.ts`)

### Shared Code
- **Types**: All type exports through `shared/types.ts`
- **Constants**: Shared constants in `shared/const.ts`
- **Core Utilities**: Framework utilities in `shared/_core/`

## Import Patterns

### Path Aliases
- `@/*` → `client/src/*` (frontend code)
- `@shared/*` → `shared/*` (shared code)

### Import Organization
1. External libraries
2. Internal modules (using aliases)
3. Relative imports
4. Type-only imports last

## File Responsibilities

### Key Files
- `server/_core/index.ts`: Development server entry point
- `api/index.ts`: Vercel serverless function entry
- `server/routers.ts`: All tRPC API routes
- `drizzle/schema.ts`: Database schema and types
- `client/src/App.tsx`: Frontend routing and auth
- `shared/types.ts`: Unified type exports

### Configuration Files
- `vite.config.ts`: Frontend build configuration
- `vitest.config.ts`: Test configuration
- `drizzle.config.ts`: Database configuration
- `vercel.json`: Deployment configuration
- `tsconfig.json`: TypeScript configuration