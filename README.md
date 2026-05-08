# StreamVault - Next.js Streaming Platform

A Next.js streaming platform that uses the TMDB API for movie/TV data and VidKing for streaming.

## Features

- Browse trending movies and TV shows
- Search functionality
- Movie and TV detail pages with cast info
- Episode selection for TV shows
- User authentication (email/password + OAuth)
- Watch history tracking
- Responsive design

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

### Prerequisites

1. **Vercel Account** - Sign up at [vercel.com](https://vercel.com)
2. **Vercel Postgres** - Add from Vercel Dashboard (Storage tab)
3. **TMDB API Key** - Already included in the env.example

### Environment Variables

Set these in your Vercel project settings:

```
POSTGRES_URL="your-vercel-postgres-url"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="https://your-domain.vercel.app"
TMDB_API_KEY="your-tmdb-token"
```

### Database Setup

After deploying, run the migration:

```bash
npx drizzle-kit migrate
```

Or set up in Vercel Dashboard:
1. Go to your project Settings
2. Click "Build & Deployment"
3. Add Build Command: `npm run build && npm run db:migrate`

## Local Development

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Update .env.local with your values

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

## Project Structure

```
src/
  app/              # Next.js App Router pages
  components/       # React components
  lib/              # Utilities and database
  hooks/            # Custom React hooks
```

## Tech Stack

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- NextAuth.js v5
- Drizzle ORM
- Vercel Postgres
- Framer Motion
- Lucide Icons

## API Routes

- `/api/auth/*` - Authentication (NextAuth.js)
- `/api/tmdb/*` - TMDB API proxy routes
- `/api/watch-history` - User watch history

## Original Project

This is a conversion of the original Vite + React + Express app to Next.js for Vercel deployment.
