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
├── web/                    # Nuxt 3 frontend
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
cd cli-tool && npm run dev        # Run CLI
cd cli-tool && npm run typecheck  # Type check

# Test project (in testdytecmsstarter/)
cd testdytecmsstarter && docker-compose up  # Run local dev environment
```
