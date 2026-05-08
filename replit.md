# DesaMart - Marketplace UMKM & Desa Wisata

## Project Overview
DesaMart is a multi-role e-commerce platform and tourism directory for Indonesian villages (UMKM). It supports multiple user roles: buyers, merchants, couriers, verifikators (village-level coordinators), and system administrators. It also includes a full POS SaaS module (6 phases) for merchant point-of-sale management.

## Tech Stack
- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite (port 5000)
- **Styling**: Tailwind CSS + shadcn/ui components
- **Backend/Database**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **API Server**: Express (port 3001) — proxies sensitive operations server-side
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
- `supabase/` - DB migrations (schema reference) and Edge Functions (reference only)
- `public/` - Static assets and PWA manifest
- `server/` - Express API server (index.ts) — replaces Supabase Edge Functions

## Server API Routes (server/index.ts)
All Supabase Edge Functions have been ported to local Express routes:
- `GET /api/wilayah` - Indonesian region data proxy (replaces wilayah-proxy edge function)
- `POST /api/assign-courier` - Auto-assign nearest courier to order (replaces assign-courier edge function)
- `POST /api/xendit/create-invoice` - Create Xendit payment invoice (replaces xendit-payment edge function)
- `GET /api/xendit/check-status` - Check Xendit payment status
- `POST /api/xendit/webhook` - Xendit payment webhook handler (replaces xendit-webhook edge function)

Vite dev server proxies `/api/*` to the Express server at port 3001.

## Environment Variables (set in Replit Env Vars)
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase anon/public key
- `VITE_SUPABASE_PROJECT_ID` - Supabase project ID
- `SUPABASE_URL` - Supabase URL for server-side use (set if different from VITE_SUPABASE_URL)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key for server-side admin operations (optional — falls back to anon key)

## Development
- Frontend dev server runs on port 5000 (host: 0.0.0.0)
- API server runs on port 3001
- `npm run dev` - Start Vite frontend dev server
- `npm run server` - Start Express API server
- `npm run build` - Build for production
- `npm test` - Run tests

## User Roles
- `buyer` - Default role, browses and orders products
- `merchant` - Manages products, orders, and store settings
- `courier` - Handles deliveries and ride-hailing (Ojek Desa)
- `verifikator` - Village-level trade group coordinator
- `admin_desa` - Village administrator (tourism, desa dashboard)
- `admin` - System administrator (full access)

## POS SaaS Roles (within pos_tenants)
- `owner` - Full POS access
- `manager` - Management access
- `kasir` - Cashier
- `staff_gudang` - Warehouse staff
- `purchasing` - Purchasing team
- `finance` - Finance team
- `auditor` - Read-only auditor

## User Preferences
- Use Indonesian/English bilingual comments where relevant
- Follow existing role-based page/component organization
- App language: Indonesian (Bahasa Indonesia)
