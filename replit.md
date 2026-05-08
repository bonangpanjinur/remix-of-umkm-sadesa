# DesaMart - Marketplace UMKM & Desa Wisata

## Project Overview
DesaMart is a multi-role e-commerce platform and tourism directory for Indonesian villages (UMKM). It supports multiple user roles: buyers, merchants, couriers, verifikators (village-level coordinators), and system administrators.

## Tech Stack
- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + shadcn/ui components
- **Backend/Database**: Supabase (PostgreSQL, Auth, Edge Functions, Storage)
- **State Management**: TanStack Query (React Query)
- **Routing**: React Router v6
- **Package Manager**: npm

## Project Structure
- `src/` - Main application source
  - `components/` - UI components by feature/role
  - `pages/` - Routed pages by user role (admin, merchant, courier, verifikator, buyer)
  - `hooks/` - Custom React hooks
  - `integrations/` - Supabase client config
  - `lib/` - Utilities, API wrappers, i18n
  - `contexts/` - React Contexts (Auth, Cart, Whitelabel)
  - `types/` - TypeScript definitions
- `supabase/` - Edge Functions and DB migrations
- `public/` - Static assets and PWA manifest

## Environment Variables
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase anon/public key
- `VITE_SUPABASE_PROJECT_ID` - Supabase project ID

## Development
- Dev server runs on port 5000 (host: 0.0.0.0)
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests

## User Preferences
- Use Indonesian/English bilingual comments where relevant
- Follow existing role-based page/component organization
