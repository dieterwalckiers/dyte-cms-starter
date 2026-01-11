# safeandbrave

A full-stack CMS project with Nuxt frontend and Payload CMS backend.

## Local Development

```bash
# Start all services with Docker Compose
docker-compose up

# Access the services:
# - Frontend: http://localhost:3201
# - CMS Admin: http://localhost:3202/admin
# - Storybook: http://localhost:6006
```

## Project Structure

```
├── payload/          # Payload CMS (backend)
│   └── src/
│       ├── collections/
│       ├── blocks/
│       └── payload.config.ts
├── web/              # Nuxt frontend
│   ├── app/
│   │   ├── pages/
│   │   ├── components/
│   │   └── composables/
│   └── .storybook/
└── docker-compose.yml
```

## Deployment

- **CMS:** Deployed on Railway
- **Frontend:** Static site generated and deployed via FTP

Content changes in the CMS automatically trigger a rebuild of the static site.
