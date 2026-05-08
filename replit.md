# DesaMart - Marketplace UMKM & Desa Wisata

## Project Overview
DesaMart is a multi-role e-commerce platform and tourism directory for Indonesian villages (UMKM). It supports multiple user roles: buyers, merchants, couriers, verifikators (village-level coordinators), and system administrators.

## Tech Stack
- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite (port 5000)
- **Styling**: Tailwind CSS + shadcn/ui components
- **Backend/Database**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **State Management**: TanStack Query (React Query)
- **Routing**: React Router v6
- **Package Manager**: npm

## Project Structure
- `src/` - Main application source
  - `components/` - UI components by feature/role
  - `pages/` - Routed pages by user role (admin, merchant, courier, verifikator, buyer, desa, pos, ride)
  - `hooks/` - Custom React hooks
  - `integrations/supabase/` - Supabase client config and generated types
  - `integrations/lovable/` - Stub (social OAuth disabled on Replit)
  - `lib/` - Utilities, API wrappers, i18n
  - `contexts/` - React Contexts (Auth, Cart, Whitelabel, POS)
  - `types/` - TypeScript definitions
- `supabase/` - DB migrations (schema reference)
- `public/` - Static assets and PWA manifest
- `server/` - Server-side DB connection (Drizzle/pg, provisioned but not yet used by frontend)

## Environment Variables (set in Replit Secrets/Env Vars)
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase anon/public key
- `VITE_SUPABASE_PROJECT_ID` - Supabase project ID
- `DATABASE_URL` - Replit-provisioned PostgreSQL (available for future server-side use)

## Development
- Dev server runs on port 5000 (host: 0.0.0.0)
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests

## User Roles
- `buyer` - Default role, browses and orders products
- `merchant` - Manages products, orders, and store settings
- `courier` - Handles deliveries and ride-hailing (Ojek Desa)
- `verifikator` - Village-level trade group coordinator
- `admin_desa` - Village administrator (tourism, desa dashboard)
- `admin` - System administrator (full access)

## User Preferences
- Use Indonesian/English bilingual comments where relevant
- Follow existing role-based page/component organization
- App language: Indonesian (Bahasa Indonesia)
