# Railway Deployment Report - Payload CMS

**Date:** 2026-01-02 (initial attempt) → 2026-01-05 (successful)
**Status:** Success
**Project:** safeandbrave

## Objective

Deploy Payload CMS (Next.js-based) to Railway to provide an online admin panel, with the Vue.js frontend to be hosted on Combell shared hosting.

## Architecture Deployed

```
Railway (Node.js)          Combell (PHP/Static)
┌─────────────────┐        ┌─────────────────┐
│  Payload CMS    │  API   │  Nuxt Frontend  │
│  + PostgreSQL   │◄──────►│  (Static/SSG)   │
│  /admin         │        │                 │
└─────────────────┘        └─────────────────┘
         │
         └── https://safeandbrave-production-b1ce.up.railway.app
```

## What Worked

### 1. Proper PORT Handling (Fixed 502 Bad Gateway)

The critical fix was using shell form in the Dockerfile CMD to properly expand the PORT environment variable:

**File:** `payload/Dockerfile`
```dockerfile
# WRONG - exec form doesn't expand variables
CMD ["npm", "run", "start"]

# CORRECT - shell form expands ${PORT}
CMD ["sh", "-c", "npm run migrate && npm run start -- -p ${PORT:-3000}"]
```

**Why it works:** Railway dynamically assigns a PORT via environment variable. The exec form `["npm", "run", "start"]` doesn't expand shell variables, so the app would bind to a hardcoded port (3000 or 8080) while Railway's proxy expected the dynamic PORT. The shell form allows `${PORT:-3000}` to be evaluated at runtime.

### 2. Database Migrations (Fixed "relation does not exist")

After fixing the port issue, the app started but showed "relation 'users' does not exist" - the PostgreSQL database had no tables.

**Problem:** Payload 3.x uses Drizzle ORM with explicit migrations. The `push: true` option (schema sync) doesn't work reliably in production containers.

**Solution:** Generate and commit migration files:

```bash
# Connect to Railway PostgreSQL from local machine using public URL
DATABASE_URL="postgresql://postgres:xxx@switchback.proxy.rlwy.net:34324/railway" \
  npx payload migrate:create --name initial

DATABASE_URL="postgresql://postgres:xxx@switchback.proxy.rlwy.net:34324/railway" \
  npm run migrate
```

**Files created:**
- `payload/src/migrations/20260102_170507.ts` - Migration SQL
- `payload/src/migrations/20260102_170507.json` - Migration metadata
- `payload/src/migrations/index.ts` - Migration index

The Dockerfile CMD now runs `npm run migrate` before starting the server, ensuring tables exist.

### 3. Server URL Configuration (Fixed media URLs)

Added `serverURL` to Payload config so media URLs point to the correct domain:

**File:** `payload/src/payload.config.ts`
```typescript
export default buildConfig({
  serverURL: process.env.PAYLOAD_PUBLIC_SERVER_URL || '',
  // ...
})
```

### 4. Railway Healthcheck (Replaced sleep hack)

**File:** `payload/railway.toml`
```toml
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile"

[deploy]
healthcheckPath = "/admin"
healthcheckTimeout = 120
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
```

**Why it works:** Instead of using `sleep 5 && npm run start` as a workaround for startup timing, a proper healthcheck gives Railway time to wait for the app to be ready before routing traffic.

## Environment Variables (Railway)

```
DATABASE_URL="${{Postgres.DATABASE_URL}}"
PAYLOAD_SECRET="[redacted - 40 char string]"
PAYLOAD_PUBLIC_SERVER_URL="https://safeandbrave-production-b1ce.up.railway.app"
FRONTEND_URL="https://safeandbrave.be"
```

## Final Dockerfile

```dockerfile
FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package*.json ./
RUN npm ci

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs

# Create uploads directory
RUN mkdir -p ./public/uploads && chown -R nextjs:nodejs ./public

USER nextjs

# Railway sets PORT dynamically - use shell form to expand variable
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000

# Run migrations then start the app on Railway's PORT
CMD ["sh", "-c", "npm run migrate && npm run start -- -p ${PORT:-3000}"]
```

## Issues From Previous Attempt (Now Resolved)

| Issue | Previous State | Fix |
|-------|---------------|-----|
| 502 Bad Gateway | App bound to wrong port | Shell form CMD with `${PORT}` expansion |
| Database tables missing | `push: true` didn't sync schema | Generated explicit migrations |
| Media URLs broken | No serverURL configured | Added `PAYLOAD_PUBLIC_SERVER_URL` |
| Startup race condition | `sleep 5` hack | Proper Railway healthcheck |

## Key Learnings

1. **Always use shell form for PORT in Docker** - Railway, Heroku, Render all set PORT dynamically. Exec form (`["npm", "start"]`) won't expand environment variables.

2. **Payload 3.x requires explicit migrations** - Unlike Payload 2.x, the new Drizzle-based ORM needs `migrate:create` and `migrate` commands. Don't rely on `push: true` in production.

3. **Generate migrations locally, run in container** - Use Railway's public PostgreSQL URL to generate migrations locally, then commit them. The Dockerfile runs them at startup.

4. **Use healthchecks, not sleep** - Railway's healthcheck configuration is the proper way to handle startup timing.

## URLs

- **Admin Panel:** https://safeandbrave-production-b1ce.up.railway.app/admin
- **REST API:** https://safeandbrave-production-b1ce.up.railway.app/api
- **GraphQL:** https://safeandbrave-production-b1ce.up.railway.app/api/graphql

## Files Modified (Final State)

- `payload/Dockerfile` - Multi-stage build with shell form CMD
- `payload/railway.toml` - Healthcheck configuration
- `payload/src/payload.config.ts` - Added serverURL
- `payload/.env.example` - Complete environment variable documentation
- `payload/src/migrations/*` - Database migration files

## Next Steps

- Phase 2: Set up GitHub Actions workflow for Nuxt SSG build and FTP deploy
- Phase 3: Configure custom domain `cms.safeandbrave.be`
