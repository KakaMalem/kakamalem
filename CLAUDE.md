# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Kaka Malem** is a multitenant shop builder SaaS application. Users can create and manage their own online stores through the platform.

## Development Commands

```bash
pnpm dev      # Start development server with hot reload
pnpm build    # Production build
pnpm start    # Start production server
pnpm lint     # Run ESLint
```

Add shadcn/ui components:

```bash
pnpm dlx shadcn-ui@latest add [component-name]
```

## Tech Stack

- **Framework**: Next.js 16 with App Router (not Pages Router)
- **Language**: TypeScript 5 (strict mode enabled)
- **Styling**: Tailwind CSS 4 with CSS variables in OKLCH color space
- **State Management**: Zustand
- **Database**: Supabase PostgreSQL with Drizzle ORM (multitenant data model)
- **File Storage**: Supabase Storage (for product images, shop assets)
- **UI Components**: shadcn/ui (new-york style, configured but components not yet added)
- **Package Manager**: pnpm

## Architecture

**Multitenancy Model** (follows [Next.js multi-tenant guide](https://nextjs.org/docs/app/guides/multi-tenant)):

- Path-based routing: `kakamalem.com/store/[store-slug]` for individual stores
- Main app routes: `kakamalem.com/dashboard` for store management
- Dynamic route `app/store/[slug]/` handles tenant resolution
- All tenant data isolated via `tenant_id` foreign key
- Carts, checkout, and orders are tenant-isolated (separate cart per shop, not cross-shop)

**Multi-Zones** (see [Next.js multi-zones guide](https://nextjs.org/docs/app/guides/multi-zones)):

- Not currently using multi-zones (single Next.js app)
- If splitting into zones later: use `<a>` tags (not `<Link>`) for cross-zone navigation

**App Router Structure**:

- `app/layout.tsx` - Root layout with Geist fonts and metadata
- `app/page.tsx` - Home page route
- `app/globals.css` - Tailwind imports and CSS theme variables

**Key Utilities**:

- `lib/utils.ts` - Contains `cn()` function for merging Tailwind classes safely (clsx + tailwind-merge)

**Path Alias**: `@/*` maps to project root (use `@/lib/utils`, `@/components/...`)

## Styling Patterns

- **Mobile-first design** - ALWAYS write mobile styles first.
- Use Tailwind utility classes
- Use `cn()` helper when conditionally combining classes
- Theme colors defined as CSS variables in globals.css
- **No dark mode** - do not use `dark:` variants or implement dark mode features

## Database

Environment variables for Supabase are in `.env`:

- `DATABASE_URL` - Supabase connection URL
- `PUBLISHABLE_API_KEY` - Supabase public API key

**Multitenancy Pattern**:

- Use Supabase Row Level Security (RLS) policies for tenant data isolation
- All tenant-scoped tables must include `tenant_id` column
- Drizzle queries should always filter by `tenant_id` from authenticated context

Drizzle ORM is installed but no schema/models defined yet.

## Notes

- No test framework configured
- ESLint 9+ flat config format in `eslint.config.mjs`
- React Server Components enabled by default
