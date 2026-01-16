# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

dyte-cms-starter is a CLI tool that scaffolds and provisions a full-stack CMS project with:
- **Frontend:** Vue/Nuxt 3 static site
- **Backend:** Payload CMS 3.x with PostgreSQL
- **Deployment:** Railway (CMS) + FTP (static frontend)

The CLI uses Ink (React for terminals) for the interactive UI and Claude API for LLM-powered collection generation.

## Commands

```bash
# Development
pnpm run dev          # Run CLI in development mode (tsx)
pnpm run build        # Compile TypeScript to dist/
pnpm run typecheck    # Type-check without emitting
pnpm start            # Run compiled CLI from dist/

# The CLI itself
pnpm dlx dyte-cms-starter # Run the scaffolder (after pnpm link or publishing)

# CLI flags
pnpm run dev -- --withTestValues      # Use cached test values (requires pre-cached node_modules)
pnpm run dev -- --skipToHomePageStep --debugServiceUrl=<url>  # Debug: skip to home page creation
```

## Architecture

### CLI Flow (State Machine)

The CLI follows a state machine defined in `src/cli.tsx`:

1. `auth-check` - Verify Railway, GitHub, and Claude API credentials
2. `mode-selection` - Choose between creating new project or deleting existing
3. `delete-project` - (optional) Delete existing Railway/GitHub resources
4. `questionnaire` - Collect project config (name, admin email, FTP creds)
5. `collection-generation` - LLM generates Payload collections from natural language
6. `collection-preview` - User reviews/rejects generated collections
7. `provisioning` - Execute infrastructure setup steps (13 steps total)
8. `complete` / `error` - Final states

### Source Structure

```
src/
├── index.tsx                 # Entry point - renders Ink App
├── cli.tsx                   # Main App component with state machine
├── types/index.ts            # Zod schemas and TypeScript interfaces
├── components/               # Ink UI components (AuthCheck, Questionnaire, etc.)
└── services/                 # Business logic
    ├── llm.ts                # Claude API integration
    ├── scaffolder.ts         # File generation (inline, no templates)
    ├── railway.ts            # Railway GraphQL API
    ├── github.ts             # Octokit + gh CLI
    ├── payload.ts            # Payload CMS REST API client
    ├── auth.ts               # Credential management
    └── config.ts             # Config file persistence
```

### Key Patterns

**Inline Templates:** The scaffolder generates files programmatically in `src/services/scaffolder.ts` rather than using template files. All Payload and Nuxt code is constructed as strings.

**LLM Collection Generation:** `src/services/llm.ts` sends a structured prompt to Claude, validates the JSON response against Zod schemas (`LLMResponseSchema`), and returns typed `GeneratedCollection[]`.

**Railway Integration:** Uses Railway's GraphQL API directly (not the CLI). Key operations: create project, provision postgres, create service from GitHub repo, set env vars, deploy.

**Rollback on Failure:** The provisioning flow tracks created resources (GitHub repo, Railway project) and attempts cleanup if any step fails.

**Provisioning Steps:** The 13-step provisioning flow in `src/cli.tsx`:
1. Scaffold project files → 2. Install dependencies (pnpm install) → 3. Create Railway project → 4. Provision PostgreSQL → 5. Generate migrations → 6. Create GitHub repo → 7. Push code → 8. Deploy Payload CMS service → 9. Configure GitHub Secrets → 10. Wait for Payload ready (~3-5 min) → 11. Create initial Home page → 12. Enable webhook + trigger deploy → 13. Wait for GitHub Actions workflow

## Railway API Testing

When debugging Railway integration issues, use standalone test scripts with `tsx`:

```bash
RAILWAY_TOKEN=your-token pnpm exec tsx test-railway.ts
```

### Testing Workflow

1. **Discover schema via introspection:**
```typescript
const schema = await railwayRequest(`{
  __type(name: "ProjectCreateInput") {
    inputFields { name type { name kind } }
  }
}`)
```

2. **Test individual operations** before integrating into the CLI flow.

3. **Always clean up** test resources with `projectDelete`.

### Railway API Gotchas

- **Token types:** User tokens (from `railway login` in `~/.railway/config.json`) work with `me { email }`. API tokens work with `apiToken { workspaces }`. The CLI supports both.
- **Project creation:** Use `workspaceId` (not `teamId`). For personal workspaces, omit it entirely.
- **Variables type:** The GraphQL type is `EnvironmentVariables!` (not `Json!` or `JSON!`).
- **Deploy mutation:** Use `serviceInstanceDeploy(environmentId, serviceId)` - there is no `deploymentCreate`.
- **GitHub connection:** Check with `gitHubRepos { fullName }` query. If it fails, user needs to connect GitHub at railway.app/account.

### Key Mutations

```graphql
# Create project (personal workspace - no workspaceId needed)
mutation { projectCreate(input: { name: $name }) { id } }

# Create project (team workspace)
mutation { projectCreate(input: { name: $name, workspaceId: $id }) { id } }

# Set environment variables
mutation {
  variableCollectionUpsert(input: {
    projectId: $projectId
    environmentId: $environmentId
    serviceId: $serviceId
    variables: $variables  # type: EnvironmentVariables!
  })
}

# Deploy a service
mutation { serviceInstanceDeploy(environmentId: $envId, serviceId: $svcId) }
```

## Type Definitions

Core types in `src/types/index.ts`:
- `ProjectConfig` - User input from questionnaire (name, email, FTP creds, etc.)
- `GeneratedCollection` / `CollectionField` - LLM output schema (Zod validated)
- `TemplateContext` - Variables passed to scaffolder
- `CLIStep` - Union type for state machine states
- `ProvisioningStep` - Status tracking for each provisioning step (with live output details)
- `AuthStatus` - Railway/GitHub/Claude authentication state
- `StoredCredentials` - Persisted API keys/tokens

## Generated Project Structure

When the CLI runs successfully, it creates:

```
{project-name}/
├── payload/                  # Payload CMS (Next.js app)
│   ├── src/
│   │   ├── collections/      # Pages, Media, Users + LLM-generated
│   │   ├── hooks/            # triggerDeploy.ts for webhook
│   │   └── payload.config.ts
│   ├── Dockerfile            # Production build
│   └── nixpacks.toml         # Railway config
├── web/                      # Nuxt 3 frontend
│   ├── pages/
│   ├── components/
│   ├── composables/usePayload.ts
│   └── nuxt.config.ts
├── docker-compose.yml        # Local dev environment
└── .github/workflows/deploy.yml
```

## Environment Variables

The CLI requires:
- `ANTHROPIC_API_KEY` - For Claude API (collection generation)
- Railway API token (via Railway CLI auth or prompt)
- GitHub token (via gh CLI auth or prompt)
