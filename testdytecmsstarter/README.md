# testdytecmsstarter

A full-stack CMS project with Nuxt frontend and Payload CMS backend.

## Local Development

```bash
# Start all services with Docker Compose
docker-compose up

# Access the services:
# - Frontend: http://localhost:3000
# - CMS Admin: http://localhost:4001/admin
```

## Project Structure

```
├── payload/          # Payload CMS (backend)
│   └── src/
│       ├── collections/
│       └── payload.config.ts
├── web/              # Nuxt frontend
│   ├── pages/
│   ├── components/
│   └── composables/
└── docker-compose.yml
```

## Deployment

- **CMS:** Deployed on Railway
- **Frontend:** Static site generated and deployed via FTP

Content changes in the CMS automatically trigger a rebuild of the static site.
