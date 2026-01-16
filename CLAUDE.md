# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

```
dyte-cms-starter/
└── cli-tool/               # The main CLI tool (see its own CLAUDE.md for details)
```

### cli-tool/

The main CLI project that scaffolds and provisions full-stack CMS projects. See `cli-tool/CLAUDE.md` for detailed documentation.

## Commands

```bash
# CLI development (in cli-tool/)
cd cli-tool && pnpm run dev        # Run CLI
cd cli-tool && pnpm run typecheck  # Type check
```

## Generated Project Structure

When the CLI runs successfully, it creates a project with this structure:

```
{project-name}/
├── payload/                # Payload CMS backend (Next.js)
│   └── src/collections/    # CMS collections
├── web/                    # Nuxt 4 frontend
│   ├── pages/
│   ├── components/
│   └── composables/
├── docker-compose.yml      # Local dev environment
└── .github/workflows/      # Deploy workflow
```

## Storybook (in generated projects)

### Known Limitations

**HMR (Hot Module Replacement) does not work** with `@storybook-vue/nuxt`. This is a known upstream bug: https://github.com/nuxt-modules/storybook/issues/891

The root cause is that `@storybook-vue/nuxt` loads Nuxt with `dev: false`, which disables HMR at the source level. File changes are detected but HMR updates are never sent to the browser.

**Workaround:** Use manual browser refresh after making component changes.

### Version Constraints

- `@storybook-vue/nuxt@9.0.x` (stable) only supports Nuxt 3.x, not Nuxt 4
- Prereleases (`9.1.0-*`) claim Nuxt 4 support but have broken internal dependencies
- The `.npmrc` file in `web/` is configured with `strict-peer-dependencies=false` for pnpm

### Story Location

Stories are co-located with components: `web/app/components/**/*.stories.ts`
