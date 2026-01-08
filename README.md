# Kaka Malem

A multitenant shop builder SaaS for the Afghan market. Users can create and manage their own online stores.

## Tech Stack

- **Framework**: Next.js 16 (App Router, React Server Components)
- **Database**: PostgreSQL 18 + PgBouncer + Drizzle ORM
- **Auth**: Better Auth (self-hosted)
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **Deployment**: Docker + native PostgreSQL/Nginx

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your database credentials

# Run migrations
pnpm db:migrate

# Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Commands

```bash
pnpm dev          # Development server (Turbopack)
pnpm build        # Production build
pnpm start        # Start production server
pnpm lint         # Run ESLint

# Database
pnpm db:generate  # Generate migrations from schema changes
pnpm db:migrate   # Apply migrations
pnpm db:studio    # Open Drizzle Studio
```

## Project Structure

```
app/
├── (auth)/           # Login, signup, logout
├── dashboard/        # Store management
│   └── [slug]/       # Per-store dashboard pages
└── store/[slug]/     # Public storefronts

lib/
├── auth/             # Better Auth configuration
├── db/               # Drizzle schema and queries
├── actions/          # Server actions
└── storage/          # File upload utilities

components/
├── ui/               # shadcn/ui components
├── dashboard/        # Dashboard components
└── store/            # Storefront components
```

## Documentation

- [CLAUDE.md](CLAUDE.md) - Development guidelines
- [ROADMAP.md](ROADMAP.md) - Feature roadmap
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) - Deployment guide

## Deployment

Push to `main` branch triggers automatic deployment via GitHub Actions.

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for full setup instructions.
