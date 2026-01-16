# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

This is a monorepo containing the CLI tool and a test output project:

```
dyte-cms-starter-project/
├── cli-tool/               # The main CLI tool (see its own CLAUDE.md for details)
└── testdytecmsstarter/     # Example output from CLI, used for testing
```

### cli-tool/

The main CLI project that scaffolds and provisions full-stack CMS projects. See `cli-tool/CLAUDE.md` for detailed documentation.

### testdytecmsstarter/

A pre-generated project output from the CLI, used for testing changes without regenerating a new project each time. Structure:

```
testdytecmsstarter/
├── payload/                # Payload CMS backend (Next.js)
│   └── src/collections/    # CMS collections
├── web/                    # Nuxt 4 frontend
│   ├── pages/
│   ├── components/
│   └── composables/
├── docker-compose.yml      # Local dev environment
└── .github/workflows/      # Deploy workflow
```

## Development Workflow

When making changes to the CLI:
1. Edit code in `cli-tool/`
2. Test template/output changes against `testdytecmsstarter/` without full regeneration
3. Run full CLI (`npm run dev` in cli-tool/) only when needed for end-to-end testing

## Commands

```bash
# CLI development (in cli-tool/)
cd cli-tool && pnpm run dev        # Run CLI
cd cli-tool && pnpm run typecheck  # Type check

# Test project (in testdytecmsstarter/)
cd testdytecmsstarter && docker-compose up  # Run local dev environment

# Storybook (in testdytecmsstarter/web/)
cd testdytecmsstarter/web && pnpm exec storybook dev -p 6006  # Run locally
# Or via Docker:
cd testdytecmsstarter && docker-compose up storybook   # http://localhost:6006
```

## Storybook

### Known Limitations

**HMR (Hot Module Replacement) does not work** with `@storybook-vue/nuxt`. This is a known upstream bug: https://github.com/nuxt-modules/storybook/issues/891

The root cause is that `@storybook-vue/nuxt` loads Nuxt with `dev: false`, which disables HMR at the source level. File changes are detected but HMR updates are never sent to the browser.

**Workaround:** Use manual browser refresh after making component changes.

### Version Constraints

- `@storybook-vue/nuxt@9.0.x` (stable) only supports Nuxt 3.x, not Nuxt 4
- Prereleases (`9.1.0-*`) claim Nuxt 4 support but have broken internal dependencies
- The `.npmrc` file in `web/` is configured with `strict-peer-dependencies=false` for pnpm

### Storybook-specific Nuxt Config

The following settings in `nuxt.config.ts` are required for Storybook compatibility:

```typescript
app: {
  // Storybook doesn't handle custom baseURL well
  baseURL: process.env.STORYBOOK === 'true' ? '/' : '/testdytecmsstarter/',
},
experimental: {
  // App manifest not supported in Storybook context
  appManifest: process.env.STORYBOOK !== 'true',
},
```

The `STORYBOOK=true` environment variable is set in docker-compose.yml for the storybook service.

### Story Location

Stories are co-located with components: `web/app/components/**/*.stories.ts`
