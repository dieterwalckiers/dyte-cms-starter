import { mkdirSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import type { TemplateContext, GeneratedCollection, CollectionField } from '../types/index.js'

export async function scaffoldProject(
  targetDir: string,
  context: TemplateContext
): Promise<void> {
  try {
    // Create target directory
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true })
    }

    // Generate static files
    await generatePayloadFiles(targetDir, context)
    await generateWebFiles(targetDir, context)
    await generateRootFiles(targetDir, context)
    await generateGithubWorkflow(targetDir)

    // Generate collection files from LLM output
    for (const collection of context.collections) {
      await generateCollectionFile(targetDir, collection)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to scaffold project: ${message}`)
  }
}

async function generatePayloadFiles(
  targetDir: string,
  context: TemplateContext
): Promise<void> {
  const payloadDir = join(targetDir, 'payload')
  const srcDir = join(payloadDir, 'src')
  const collectionsDir = join(srcDir, 'collections')
  const blocksDir = join(srcDir, 'blocks')
  const hooksDir = join(srcDir, 'hooks')
  const migrationsDir = join(srcDir, 'migrations')
  const appDir = join(srcDir, 'app', '(payload)')

  // Create directories
  mkdirSync(collectionsDir, { recursive: true })
  mkdirSync(blocksDir, { recursive: true })
  mkdirSync(hooksDir, { recursive: true })
  mkdirSync(migrationsDir, { recursive: true })
  mkdirSync(join(appDir, 'admin', '[[...segments]]'), { recursive: true })
  mkdirSync(join(appDir, 'api', '[...slug]'), { recursive: true })
  mkdirSync(join(appDir, 'api', 'graphql'), { recursive: true })
  mkdirSync(join(payloadDir, 'data'), { recursive: true })
  mkdirSync(join(payloadDir, 'public', 'uploads'), { recursive: true })

  // payload/package.json
  const payloadPackageJson = {
    name: `${context.projectSlug}-cms`,
    version: '1.0.0',
    description: `Payload CMS for ${context.projectName}`,
    type: 'module',
    scripts: {
      dev: 'next dev',
      build: 'payload generate:importmap && next build',
      start: 'next start',
      migrate: 'payload migrate',
      'generate:types': 'payload generate:types',
      'generate:graphQLSchema': 'payload generate:graphQLSchema',
      'generate:importmap': 'payload generate:importmap',
    },
    dependencies: {
      '@payloadcms/db-postgres': '^3.0.0',
      '@payloadcms/next': '^3.0.0',
      '@payloadcms/richtext-lexical': '^3.0.0',
      graphql: '^16.9.0',
      next: '^15.0.0',
      payload: '^3.0.0',
      react: '^19.0.0',
      'react-dom': '^19.0.0',
      sharp: '^0.33.5',
    },
    devDependencies: {
      '@types/node': '^22.10.0',
      '@types/react': '^19.0.0',
      '@types/react-dom': '^19.0.0',
      typescript: '^5.7.0',
    },
  }
  writeFileSync(
    join(payloadDir, 'package.json'),
    JSON.stringify(payloadPackageJson, null, 2)
  )

  // payload/tsconfig.json
  const payloadTsConfig = {
    compilerOptions: {
      target: 'ES2017',
      lib: ['DOM', 'DOM.Iterable', 'ES2017'],
      allowJs: true,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: 'ESNext',
      moduleResolution: 'bundler',
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: 'preserve',
      incremental: true,
      plugins: [{ name: 'next' }],
      paths: {
        '@/*': ['./src/*'],
        '@payload-config': ['./src/payload.config.ts'],
      },
      baseUrl: '.',
    },
    include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
    exclude: ['node_modules'],
  }
  writeFileSync(
    join(payloadDir, 'tsconfig.json'),
    JSON.stringify(payloadTsConfig, null, 2)
  )

  // payload/next.config.mjs
  writeFileSync(
    join(payloadDir, 'next.config.mjs'),
    `import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
}

export default withPayload(nextConfig)
`
  )

  // Generate collection imports for config
  const collectionImports = context.collections
    .map((c) => `import { ${c.name} } from './collections/${c.name}'`)
    .join('\n')
  const collectionNames = context.collections.map((c) => c.name).join(', ')

  // payload/src/payload.config.ts
  const payloadConfig = `import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor, UploadFeature } from '@payloadcms/richtext-lexical'
import sharp from 'sharp'

import { Pages } from './collections/Pages'
import { Media } from './collections/Media'
import { Users } from './collections/Users'
${collectionImports ? collectionImports + '\n' : ''}
const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  serverURL: process.env.PAYLOAD_PUBLIC_SERVER_URL || '',
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Pages, Media, Users${collectionNames ? ', ' + collectionNames : ''}],
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
    push: process.env.NODE_ENV === 'development',
  }),
  editor: lexicalEditor({
    features: ({ defaultFeatures }) => [
      ...defaultFeatures,
      UploadFeature({
        collections: {
          media: {
            fields: [
              {
                name: 'size',
                type: 'select',
                defaultValue: 'medium',
                options: [
                  { label: 'Small (400px)', value: 'small' },
                  { label: 'Medium (600px)', value: 'medium' },
                  { label: 'Large (900px)', value: 'large' },
                  { label: 'Full Width', value: 'full' },
                ],
                admin: {
                  description: 'Display size of the image',
                },
              },
              {
                name: 'alignment',
                type: 'select',
                defaultValue: 'center',
                options: [
                  { label: 'Left', value: 'left' },
                  { label: 'Center', value: 'center' },
                  { label: 'Right', value: 'right' },
                ],
                admin: {
                  description: 'Image alignment',
                },
              },
              {
                name: 'caption',
                type: 'text',
                admin: {
                  description: 'Optional caption below the image',
                },
              },
            ],
          },
        },
      }),
    ],
  }),
  secret: process.env.PAYLOAD_SECRET || 'CHANGE_ME_IN_PRODUCTION',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  graphQL: {
    schemaOutputFile: path.resolve(dirname, 'generated-schema.graphql'),
  },
  cors: [
    'http://localhost:3201',
    'http://localhost:3202',
    process.env.FRONTEND_URL || '',
  ].filter(Boolean),
  upload: {
    limits: {
      fileSize: 10000000, // 10MB
    },
  },
  sharp,
  onInit: async (payload) => {
    // Auto-provision first admin user if none exists
    const adminEmail = process.env.PAYLOAD_ADMIN_EMAIL
    const adminPassword = process.env.PAYLOAD_ADMIN_PASSWORD

    if (!adminEmail || !adminPassword) {
      console.log('⚠️  PAYLOAD_ADMIN_EMAIL and PAYLOAD_ADMIN_PASSWORD not set. Skipping admin user creation.')
      return
    }

    try {
      // Check if any users exist
      const existingUsers = await payload.find({
        collection: 'users',
        limit: 1,
      })

      if (existingUsers.totalDocs === 0) {
        console.log('🔧 Creating first admin user...')
        await payload.create({
          collection: 'users',
          data: {
            email: adminEmail,
            password: adminPassword,
            role: 'admin',
          },
        })
        console.log(\`✅ Admin user created: \${adminEmail}\`)
      } else {
        console.log('ℹ️  Admin user already exists. Skipping creation.')
      }
    } catch (error) {
      console.error('❌ Error creating admin user:', error)
    }
  },
})
`
  writeFileSync(join(srcDir, 'payload.config.ts'), payloadConfig)

  // Default collections: Pages, Media, Users
  writeFileSync(
    join(collectionsDir, 'Pages.ts'),
    `import type { CollectionConfig } from 'payload'
import { triggerDeploy } from '../hooks/triggerDeploy'
import { Hero, RichText, SplitTextImage } from '../blocks'

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'showInMenu', 'menuOrder', 'updatedAt'],
  },
  access: {
    read: () => true,
  },
  hooks: {
    afterChange: [
      async ({ collection }) => {
        await triggerDeploy(collection.slug)
      },
    ],
    afterDelete: [
      async ({ collection }) => {
        await triggerDeploy(collection.slug)
      },
    ],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'URL slug for the page (e.g., "about-us")',
      },
    },
    {
      name: 'showInMenu',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Show this page in the main navigation menu',
      },
    },
    {
      name: 'menuOrder',
      type: 'number',
      admin: {
        description: 'Order in the menu (lower numbers appear first)',
        condition: (data) => data?.showInMenu,
      },
    },
    {
      name: 'content',
      type: 'blocks',
      blocks: [Hero, RichText, SplitTextImage],
      admin: {
        description: 'Add and arrange content blocks for this page',
      },
    },
  ],
}
`
  )

  writeFileSync(
    join(collectionsDir, 'Media.ts'),
    `import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
  },
  upload: {
    staticDir: './public/uploads',
    mimeTypes: ['image/*'],
    imageSizes: [
      {
        name: 'thumbnail',
        width: 400,
        height: 300,
        position: 'centre',
      },
      {
        name: 'small',
        width: 600,
        height: undefined,
        position: 'centre',
      },
      {
        name: 'medium',
        width: 900,
        height: undefined,
        position: 'centre',
      },
      {
        name: 'large',
        width: 1200,
        height: undefined,
        position: 'centre',
      },
    ],
    adminThumbnail: 'thumbnail',
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      admin: {
        description: 'Alternative text for accessibility',
      },
    },
    {
      name: 'caption',
      type: 'text',
      admin: {
        description: 'Optional caption to display below the image',
      },
    },
  ],
}
`
  )

  writeFileSync(
    join(collectionsDir, 'Users.ts'),
    `import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    useAsTitle: 'email',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'user',
      options: [
        {
          label: 'Admin',
          value: 'admin',
        },
        {
          label: 'User',
          value: 'user',
        },
      ],
      admin: {
        description: 'User role for access control',
      },
    },
  ],
}
`
  )

  // Blocks
  writeFileSync(
    join(blocksDir, 'Hero.ts'),
    `import type { Block } from 'payload'

export const Hero: Block = {
  slug: 'hero',
  labels: {
    singular: 'Hero',
    plural: 'Heroes',
  },
  fields: [
    {
      name: 'headline',
      type: 'text',
      required: true,
      admin: {
        description: 'The main headline text',
      },
    },
    {
      name: 'subheadline',
      type: 'textarea',
      admin: {
        description: 'Supporting text below the headline',
      },
    },
    {
      name: 'backgroundImage',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Background image for the hero section',
      },
    },
    {
      name: 'alignment',
      type: 'select',
      defaultValue: 'center',
      options: [
        { label: 'Left', value: 'left' },
        { label: 'Center', value: 'center' },
        { label: 'Right', value: 'right' },
      ],
      admin: {
        description: 'Text alignment within the hero',
      },
    },
    {
      name: 'links',
      type: 'array',
      maxRows: 2,
      admin: {
        description: 'Call-to-action buttons (max 2)',
      },
      fields: [
        {
          name: 'label',
          type: 'text',
          required: true,
        },
        {
          name: 'url',
          type: 'text',
          required: true,
          admin: {
            description: 'URL or path (e.g., /contact or https://example.com)',
          },
        },
        {
          name: 'variant',
          type: 'select',
          defaultValue: 'solid',
          options: [
            { label: 'Solid (Primary)', value: 'solid' },
            { label: 'Outline', value: 'outline' },
            { label: 'Ghost', value: 'ghost' },
          ],
        },
      ],
    },
  ],
}
`
  )

  writeFileSync(
    join(blocksDir, 'RichText.ts'),
    `import type { Block } from 'payload'

export const RichText: Block = {
  slug: 'richText',
  labels: {
    singular: 'Rich Text',
    plural: 'Rich Text',
  },
  fields: [
    {
      name: 'content',
      type: 'richText',
      required: true,
    },
  ],
}
`
  )

  writeFileSync(
    join(blocksDir, 'SplitTextImage.ts'),
    `import type { Block } from 'payload'

export const SplitTextImage: Block = {
  slug: 'splitTextImage',
  labels: {
    singular: 'Split Text + Image',
    plural: 'Split Text + Image',
  },
  fields: [
    {
      name: 'text',
      type: 'richText',
      required: true,
      admin: {
        description: 'Title and description text (use headings for the title)',
      },
    },
    {
      name: 'buttons',
      type: 'array',
      admin: {
        description: 'Call-to-action buttons',
      },
      fields: [
        {
          name: 'caption',
          type: 'text',
          required: true,
          admin: {
            description: 'Button text',
          },
        },
        {
          name: 'link',
          type: 'text',
          required: true,
          admin: {
            description: 'URL or path (e.g., /contact or https://example.com)',
          },
        },
      ],
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      required: true,
      admin: {
        description: 'Poster image (displayed in 5:6 portrait ratio)',
      },
    },
  ],
}
`
  )

  writeFileSync(
    join(blocksDir, 'index.ts'),
    `export { Hero } from './Hero'
export { RichText } from './RichText'
export { SplitTextImage } from './SplitTextImage'
`
  )

  // triggerDeploy hook
  writeFileSync(
    join(hooksDir, 'triggerDeploy.ts'),
    `/**
 * Triggers a GitHub Actions workflow via repository_dispatch event.
 * This is called when content changes in Payload CMS.
 */
export async function triggerDeploy(collectionSlug: string): Promise<void> {
  const token = process.env.GITHUB_TOKEN
  const repo = process.env.GITHUB_REPO // format: "owner/repo"

  if (!token || !repo) {
    console.log('[Deploy Hook] Skipping: GITHUB_TOKEN or GITHUB_REPO not configured')
    return
  }

  try {
    const response = await fetch(\`https://api.github.com/repos/\${repo}/dispatches\`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: \`Bearer \${token}\`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: 'content_update',
        client_payload: {
          collection: collectionSlug,
          timestamp: new Date().toISOString(),
        },
      }),
    })

    if (response.status === 204) {
      console.log(\`[Deploy Hook] Triggered deploy for \${collectionSlug} change\`)
    } else {
      const text = await response.text()
      console.error(\`[Deploy Hook] Failed to trigger deploy: \${response.status} \${text}\`)
    }
  } catch (error) {
    console.error('[Deploy Hook] Error triggering deploy:', error)
  }
}
`
  )

  // Dockerfile.dev
  writeFileSync(
    join(payloadDir, 'Dockerfile.dev'),
    `FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Generate import map for Payload admin UI (lexical editor components)
RUN pnpm exec payload generate:importmap

EXPOSE 3000

CMD ["pnpm", "run", "dev"]
`
  )

  // Dockerfile (production)
  writeFileSync(
    join(payloadDir, 'Dockerfile'),
    `FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN pnpm run build

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
# Use npm for runtime since node_modules is pre-installed and npm is always available
CMD ["sh", "-c", "npm run migrate && npm run start -- -p \${PORT:-3000}"]
`
  )

  // nixpacks.toml for Railway (fallback if Dockerfile is not used)
  writeFileSync(
    join(payloadDir, 'nixpacks.toml'),
    `[phases.setup]
nixPkgs = ["nodejs_22"]

[phases.install]
cmds = ["corepack enable && corepack prepare pnpm@9 --activate && pnpm install --frozen-lockfile"]

[phases.build]
cmds = ["pnpm run build"]

[start]
cmd = "pnpm run migrate && pnpm start"
`
  )

  // railway.toml for Railway (preferred - uses Dockerfile)
  writeFileSync(
    join(payloadDir, 'railway.toml'),
    `[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile"

[deploy]
healthcheckPath = "/admin"
healthcheckTimeout = 120
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
`
  )

  // .gitignore
  writeFileSync(
    join(payloadDir, '.gitignore'),
    `node_modules/
.next/
.env
*.log
data/
public/uploads/*
!public/uploads/.gitkeep
`
  )

  // .dockerignore
  writeFileSync(
    join(payloadDir, '.dockerignore'),
    `node_modules
.next
.git
*.md
`
  )

  // data/.gitkeep
  writeFileSync(join(payloadDir, 'data', '.gitkeep'), '')

  // public/uploads/.gitkeep (so directory structure is preserved in git)
  writeFileSync(join(payloadDir, 'public', 'uploads', '.gitkeep'), '')

  // Next.js app files
  writeFileSync(
    join(appDir, 'admin', '[[...segments]]', 'page.tsx'),
    `/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
import type { Metadata } from 'next'

import config from '@payload-config'
import { RootPage, generatePageMetadata } from '@payloadcms/next/views'
import { importMap } from '../importMap'

type Args = {
  params: Promise<{
    segments: string[]
  }>
  searchParams: Promise<{
    [key: string]: string | string[]
  }>
}

export const generateMetadata = ({ params, searchParams }: Args): Promise<Metadata> =>
  generatePageMetadata({ config, params, searchParams })

const Page = ({ params, searchParams }: Args) =>
  RootPage({ config, importMap, params, searchParams })

export default Page
`
  )

  writeFileSync(
    join(appDir, 'admin', '[[...segments]]', 'not-found.tsx'),
    `/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
import type { Metadata } from 'next'

import config from '@payload-config'
import { NotFoundPage, generatePageMetadata } from '@payloadcms/next/views'
import { importMap } from '../importMap'

type Args = {
  params: Promise<{
    segments: string[]
  }>
  searchParams: Promise<{
    [key: string]: string | string[]
  }>
}

export const generateMetadata = ({ params, searchParams }: Args): Promise<Metadata> =>
  generatePageMetadata({ config, params, searchParams })

const NotFound = ({ params, searchParams }: Args) =>
  NotFoundPage({ config, importMap, params, searchParams })

export default NotFound
`
  )

  writeFileSync(
    join(appDir, 'admin', 'importMap.ts'),
    `export const importMap = {}
`
  )

  writeFileSync(
    join(appDir, 'api', '[...slug]', 'route.ts'),
    `/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
import config from '@payload-config'
import { REST_DELETE, REST_GET, REST_OPTIONS, REST_PATCH, REST_POST, REST_PUT } from '@payloadcms/next/routes'

export const GET = REST_GET(config)
export const POST = REST_POST(config)
export const DELETE = REST_DELETE(config)
export const PATCH = REST_PATCH(config)
export const PUT = REST_PUT(config)
export const OPTIONS = REST_OPTIONS(config)
`
  )

  writeFileSync(
    join(appDir, 'api', 'graphql', 'route.ts'),
    `/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
import config from '@payload-config'
import { GRAPHQL_POST } from '@payloadcms/next/routes'

export const POST = GRAPHQL_POST(config)
`
  )

  writeFileSync(
    join(appDir, 'custom.css'),
    `/* Custom admin styles */
`
  )

  // payload/src/app/(payload)/layout.tsx
  writeFileSync(
    join(appDir, 'layout.tsx'),
    `/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import type { ServerFunctionClient } from 'payload'

import config from '@payload-config'
import { handleServerFunctions, RootLayout } from '@payloadcms/next/layouts'
import React from 'react'
import { importMap } from './admin/importMap'

/* Import Payload CSS */
import '@payloadcms/next/css'
/* Import custom styles */
import './custom.css'

type Args = {
  children: React.ReactNode
}

const serverFunction: ServerFunctionClient = async function (args) {
  'use server'
  return handleServerFunctions({
    ...args,
    config,
    importMap,
  })
}

const Layout = ({ children }: Args) => (
  <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
    {children}
  </RootLayout>
)

export default Layout
`
  )

  // payload/next-env.d.ts
  writeFileSync(
    join(payloadDir, 'next-env.d.ts'),
    `/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
`
  )
}

async function generateWebFiles(
  targetDir: string,
  context: TemplateContext
): Promise<void> {
  const webDir = join(targetDir, 'web')
  const appDir = join(webDir, 'app')
  const pagesDir = join(appDir, 'pages')
  const componentsDir = join(appDir, 'components')
  const blocksComponentsDir = join(componentsDir, 'blocks')
  const uiComponentsDir = join(componentsDir, 'ui')
  const composablesDir = join(appDir, 'composables')
  const layoutsDir = join(appDir, 'layouts')
  const typesDir = join(appDir, 'types')
  const assetsDir = join(appDir, 'assets', 'css')
  const storybookDir = join(webDir, '.storybook')

  // Create directories
  mkdirSync(pagesDir, { recursive: true })
  mkdirSync(componentsDir, { recursive: true })
  mkdirSync(blocksComponentsDir, { recursive: true })
  mkdirSync(uiComponentsDir, { recursive: true })
  mkdirSync(composablesDir, { recursive: true })
  mkdirSync(layoutsDir, { recursive: true })
  mkdirSync(typesDir, { recursive: true })
  mkdirSync(assetsDir, { recursive: true })
  mkdirSync(storybookDir, { recursive: true })

  // package.json
  const webPackageJson = {
    name: 'web',
    private: true,
    type: 'module',
    scripts: {
      build: 'nuxt build',
      dev: 'concurrently -n nuxt,storybook -c cyan,magenta "nuxt dev" "storybook dev -p 6006 --no-open"',
      'dev:nuxt': 'nuxt dev',
      'dev:storybook': 'storybook dev -p 6006',
      generate: 'nuxt generate',
      preview: 'nuxt preview',
      postinstall: 'nuxt prepare',
      storybook: 'storybook dev -p 6006 --no-open',
      'build-storybook': 'storybook build',
    },
    dependencies: {
      '@nuxt/ui': '^4',
      nuxt: '^4.2.2',
      vue: '^3.5.0',
      'vue-router': '^4.5.0',
    },
    devDependencies: {
      '@chromatic-com/storybook': '^4.1.3',
      '@nuxt/fonts': '^0.11.0',
      '@nuxtjs/storybook': '^9.0.1',
      '@storybook-vue/nuxt': '^9.0.1',
      '@storybook/addon-a11y': '^9.0.18',
      '@storybook/addon-docs': '^9.0.18',
      '@types/node': '^22',
      '@vitejs/plugin-vue': '^6.0.3',
      '@vitest/browser-playwright': '^4.0.16',
      '@vitest/coverage-v8': '^4.0.16',
      concurrently: '^9.2.1',
      playwright: '^1.57.0',
      storybook: '^9.0.18',
      tailwindcss: '^4',
      vitest: '^4.0.16',
    },
    overrides: {}
  }
  writeFileSync(
    join(webDir, 'package.json'),
    JSON.stringify(webPackageJson, null, 2)
  )

  // .npmrc for pnpm peer dependency handling
  writeFileSync(
    join(webDir, '.npmrc'),
    `auto-install-peers=true
strict-peer-dependencies=false
`
  )

  // nuxt.config.ts
  // Handle baseURL for both Storybook and production
  const baseURLPath = context.websitePath || `/${context.projectSlug}`
  const baseURLConfig = `
  app: {
    // Use root path for Storybook, custom path for production
    baseURL: process.env.STORYBOOK === 'true' ? '/' : '${baseURLPath}/',
  },

  // Disable app manifest for Storybook (not supported)
  // Disable shared prerender data to prevent page content from being cached incorrectly during SSG
  experimental: {
    appManifest: process.env.STORYBOOK !== 'true',
    sharedPrerenderData: false,
  },
`

  writeFileSync(
    join(webDir, 'nuxt.config.ts'),
    `// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },

  modules: ['@nuxt/ui', '@nuxt/fonts'],
  css: ['~/assets/css/main.css'],

  fonts: {
    families: [
      { name: 'Inter', provider: 'google', weights: [400, 500, 600, 700] },
      { name: 'Playfair Display', provider: 'google', weights: [400, 500, 600, 700] },
    ],
  },
${baseURLConfig}
  ssr: true,

  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ['/'],
      failOnError: false
    },
    routeRules: {
      '/api/**': {
        proxy: (process.env.NUXT_PUBLIC_PAYLOAD_API_URL || 'http://localhost:3202/api') + '/**'
      }
    }
  },

  runtimeConfig: {
    // Server-side only (can use Docker internal hostname)
    payloadApiUrl: process.env.PAYLOAD_API_URL || 'http://localhost:3202/api',
    public: {
      // Client-side (must be browser-accessible)
      payloadApiUrl: process.env.NUXT_PUBLIC_PAYLOAD_API_URL || 'http://localhost:3202/api'
    }
  },

  devServer: {
    host: '0.0.0.0',
    port: 3000
  },
})
`
  )

  // Dockerfile
  writeFileSync(
    join(webDir, 'Dockerfile'),
    `FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 3000

CMD ["pnpm", "run", "dev"]
`
  )

  // types/page.ts
  writeFileSync(
    join(typesDir, 'page.ts'),
    `import type { ContentBlock } from './blocks'

export interface Page {
  id: string
  title: string
  slug: string
  showInMenu: boolean
  menuOrder?: number
  content?: ContentBlock[]
  createdAt: string
  updatedAt: string
}

export interface PagesResponse {
  docs: Page[]
  totalDocs: number
  limit: number
  totalPages: number
  page: number
  pagingCounter: number
  hasPrevPage: boolean
  hasNextPage: boolean
  prevPage: number | null
  nextPage: number | null
}
`
  )

  // types/blocks.ts
  writeFileSync(
    join(typesDir, 'blocks.ts'),
    `import type { Media } from './media'

export interface HeroLink {
  label: string
  url: string
  variant?: 'solid' | 'outline' | 'ghost'
  id?: string
}

export interface HeroBlock {
  id: string
  blockType: 'hero'
  headline: string
  subheadline?: string
  backgroundImage?: Media | string
  alignment?: 'left' | 'center' | 'right'
  links?: HeroLink[]
}

export interface RichTextBlock {
  id: string
  blockType: 'richText'
  content: unknown
}

export interface SplitTextImageButton {
  id?: string
  caption: string
  link: string
}

export interface SplitTextImageBlock {
  id: string
  blockType: 'splitTextImage'
  text: unknown // Rich text content (Lexical format)
  buttons?: SplitTextImageButton[]
  image?: Media | string
}

// Union type for all block types - add more as they are created
export type ContentBlock = HeroBlock | RichTextBlock | SplitTextImageBlock
`
  )

  // types/media.ts
  writeFileSync(
    join(typesDir, 'media.ts'),
    `export interface Media {
  id: string
  alt?: string
  caption?: string
  url?: string
  thumbnailURL?: string
  filename?: string
  mimeType?: string
  filesize?: number
  width?: number
  height?: number
  sizes?: {
    thumbnail?: MediaSize
    small?: MediaSize
    medium?: MediaSize
    large?: MediaSize
  }
  createdAt: string
  updatedAt: string
}

export interface MediaSize {
  url?: string
  width?: number
  height?: number
  mimeType?: string
  filesize?: number
  filename?: string
}
`
  )

  // composables/usePayload.ts
  writeFileSync(
    join(composablesDir, 'usePayload.ts'),
    `import type { Page, PagesResponse } from '~/types/page'

// Returns the correct API URL based on context (server uses Docker internal, client uses public)
export function usePayloadApiUrl() {
  const config = useRuntimeConfig()
  return import.meta.server ? config.payloadApiUrl : config.public.payloadApiUrl
}

// Returns the public payload base URL (for media URLs that need to work in the browser)
export function usePayloadBaseUrl() {
  const config = useRuntimeConfig()
  // Always use public URL since media URLs are used in <img> tags rendered in the browser
  // Remove '/api' suffix to get base URL
  return config.public.payloadApiUrl.replace(/\\/api$/, '')
}

// Convert a relative media URL to an absolute URL
export function useMediaUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined
  // If already absolute, return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  // Prepend payload base URL
  const baseUrl = usePayloadBaseUrl()
  return \`\${baseUrl}\${url}\`
}

export function usePages() {
  const apiUrl = usePayloadApiUrl()
  const result = useFetch<PagesResponse>(\`\${apiUrl}/pages\`, {
    query: { limit: 100 },
    key: 'pages',
    timeout: 10000,
    retry: 1,
  })

  return {
    ...result,
    data: computed(() => result.data.value?.docs ?? [])
  }
}

export function useMenuPages() {
  const apiUrl = usePayloadApiUrl()
  const result = useFetch<PagesResponse>(\`\${apiUrl}/pages\`, {
    query: {
      where: {
        showInMenu: {
          equals: true
        }
      },
      sort: 'menuOrder',
      limit: 100
    },
    key: 'menuPages',
    timeout: 10000,
    retry: 1,
  })

  return {
    ...result,
    data: computed(() => result.data.value?.docs ?? [])
  }
}

export function usePage(slug: MaybeRefOrGetter<string>) {
  const apiUrl = usePayloadApiUrl()
  const slugValue = toValue(slug)

  const result = useFetch<PagesResponse>(\`\${apiUrl}/pages\`, {
    query: {
      where: {
        slug: {
          equals: slugValue
        }
      },
      limit: 1
    },
    key: \`page-\${slugValue}\`,
    timeout: 10000,
    retry: 1,
  })

  return {
    ...result,
    data: computed<Page | null>(() => result.data.value?.docs?.[0] ?? null)
  }
}
`
  )

  // app.vue
  writeFileSync(
    join(appDir, 'app.vue'),
    `<template>
  <UApp>
    <TheHeader />

    <UMain>
      <NuxtLayout>
        <NuxtPage :key="$route.fullPath" />
      </NuxtLayout>
    </UMain>

    <TheFooter />
  </UApp>
</template>
`
  )

  // error.vue
  writeFileSync(
    join(appDir, 'error.vue'),
    `<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{
  error: NuxtError
}>()
</script>

<template>
  <UApp>
    <TheHeader />

    <UError :error="error" />

    <TheFooter />
  </UApp>
</template>
`
  )

  // app.config.ts
  writeFileSync(
    join(appDir, 'app.config.ts'),
    `export default defineAppConfig({
  ui: {
    colors: {
      primary: 'primary',
      neutral: 'slate',
    },
    button: {
      slots: {
        base: 'rounded-[var(--radius-button)] font-medium inline-flex items-center disabled:cursor-not-allowed aria-disabled:cursor-not-allowed disabled:opacity-75 aria-disabled:opacity-75 transition-colors',
      },
    },
  },
})
`
  )

  // layouts/default.vue
  writeFileSync(
    join(layoutsDir, 'default.vue'),
    `<template>
  <slot />
</template>
`
  )

  // components/TheHeader.vue
  writeFileSync(
    join(componentsDir, 'TheHeader.vue'),
    `<script setup lang="ts">
import type { PagesResponse } from '~/types/page'

interface NavItem {
  label: string
  to: string
  active?: boolean
}

const route = useRoute()
const apiUrl = usePayloadApiUrl()

const { data: response } = await useFetch<PagesResponse>(\`\${apiUrl}/pages\`, {
  query: {
    where: {
      showInMenu: {
        equals: true
      }
    },
    sort: 'menuOrder',
    limit: 100
  },
  key: 'menuPages',
  dedupe: 'defer',
  timeout: 10000,
  retry: 1,
})

const navItems = computed<NavItem[]>(() => {
  const pages = response.value?.docs ?? []
  return pages.map((page) => ({
    label: page.title,
    to: \`/\${page.slug}\`,
    active: route.path === \`/\${page.slug}\`,
  }))
})
</script>

<template>
  <UHeader>
    <template #title>
      <NuxtLink to="/" class="text-xl font-bold font-display">
        ${context.projectName}
      </NuxtLink>
    </template>

    <UNavigationMenu :items="navItems" />

    <template #body>
      <UNavigationMenu :items="navItems" orientation="vertical" class="-mx-2.5" />
    </template>
  </UHeader>
</template>
`
  )

  // components/TheFooter.vue
  writeFileSync(
    join(componentsDir, 'TheFooter.vue'),
    `<script setup lang="ts">
import type { PagesResponse } from '~/types/page'

interface NavItem {
  label: string
  to: string
}

const apiUrl = usePayloadApiUrl()

const { data: response } = await useFetch<PagesResponse>(\`\${apiUrl}/pages\`, {
  query: {
    where: {
      showInMenu: {
        equals: true
      }
    },
    sort: 'menuOrder',
    limit: 100
  },
  key: 'menuPages',
  dedupe: 'defer',
  timeout: 10000,
  retry: 1,
})

const footerLinks = computed<NavItem[]>(() => {
  const pages = response.value?.docs ?? []
  return pages.map((page) => ({
    label: page.title,
    to: \`/\${page.slug}\`,
  }))
})
</script>

<template>
  <USeparator />

  <UFooter>
    <template #left>
      <p class="text-muted text-sm">
        &copy; {{ new Date().getFullYear() }} ${context.projectName}
      </p>
    </template>

    <UNavigationMenu :items="footerLinks" variant="link" />
  </UFooter>
</template>
`
  )

  // components/RichTextRenderer.vue
  writeFileSync(
    join(componentsDir, 'RichTextRenderer.vue'),
    `<script setup lang="ts">
import type { Media } from '~/types/media'

defineProps<{
  content: unknown
}>()

// Get the base URL for media - needs to be called at setup time
const payloadBaseUrl = usePayloadBaseUrl()

// Escape HTML entities to prevent XSS
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function getMediaUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return \`\${payloadBaseUrl}\${url}\`
}

// Lexical format bitmask values
const IS_BOLD = 1
const IS_ITALIC = 2
const IS_STRIKETHROUGH = 4
const IS_UNDERLINE = 8
const IS_CODE = 16
const IS_SUBSCRIPT = 32
const IS_SUPERSCRIPT = 64

interface LexicalNode {
  type?: string
  tag?: string
  format?: number | string
  indent?: number
  direction?: string
  version?: number
  text?: string
  children?: LexicalNode[]
  listType?: 'bullet' | 'number' | 'check'
  checked?: boolean
  url?: string
  newTab?: boolean
  rel?: string
  fields?: Record<string, unknown>
  // For upload nodes - value can be list value (number) or media object
  value?: number | Media | string | null
  relationTo?: string
}

function renderNode(node: LexicalNode): string {
  if (!node || typeof node !== 'object') return ''

  const type = node.type
  const children = node.children
  const text = node.text

  // Handle text nodes
  if (text !== undefined) {
    let result = escapeHtml(text)
    const format = typeof node.format === 'number' ? node.format : 0

    if (format & IS_BOLD) result = \`<strong>\${result}</strong>\`
    if (format & IS_ITALIC) result = \`<em>\${result}</em>\`
    if (format & IS_UNDERLINE) result = \`<u>\${result}</u>\`
    if (format & IS_STRIKETHROUGH) result = \`<s>\${result}</s>\`
    if (format & IS_CODE) result = \`<code class="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono">\${result}</code>\`
    if (format & IS_SUBSCRIPT) result = \`<sub>\${result}</sub>\`
    if (format & IS_SUPERSCRIPT) result = \`<sup>\${result}</sup>\`
    return result
  }

  // Recursively render children
  const childrenHtml = children?.map(renderNode).join('') || ''

  switch (type) {
    case 'root':
      return childrenHtml

    case 'paragraph': {
      if (!childrenHtml.trim()) return '<p class="mb-4">&nbsp;</p>' // Empty paragraph
      const align = getTextAlign(node.format)
      return \`<p class="mb-4\${align}">\${childrenHtml}</p>\`
    }

    case 'heading': {
      const level = node.tag?.replace('h', '') || '2'
      const align = getTextAlign(node.format)
      const sizeClass = getHeadingSize(level)
      return \`<h\${level} class="\${sizeClass} font-bold mb-4\${align}">\${childrenHtml}</h\${level}>\`
    }

    case 'list': {
      const listTag = node.listType === 'number' ? 'ol' : 'ul'
      const listClass = node.listType === 'number'
        ? 'list-decimal list-inside mb-4 space-y-1'
        : 'list-disc list-inside mb-4 space-y-1'
      return \`<\${listTag} class="\${listClass}">\${childrenHtml}</\${listTag}>\`
    }

    case 'listitem': {
      const indent = node.indent ? \` style="margin-left: \${node.indent * 1.5}rem"\` : ''
      if (node.checked !== undefined) {
        // Checkbox list item
        const checked = node.checked ? 'checked' : ''
        return \`<li\${indent} class="flex items-start gap-2"><input type="checkbox" \${checked} disabled class="mt-1" /><span>\${childrenHtml}</span></li>\`
      }
      return \`<li\${indent}>\${childrenHtml}</li>\`
    }

    case 'link': {
      const url = node.url || '#'
      const target = node.newTab ? ' target="_blank"' : ''
      const rel = node.newTab ? ' rel="noopener noreferrer"' : ''
      return \`<a href="\${escapeHtml(url)}" class="text-primary-600 hover:text-primary-700 underline"\${target}\${rel}>\${childrenHtml}</a>\`
    }

    case 'autolink': {
      const url = node.url || '#'
      return \`<a href="\${escapeHtml(url)}" class="text-primary-600 hover:text-primary-700 underline">\${childrenHtml}</a>\`
    }

    case 'quote': {
      return \`<blockquote class="border-l-4 border-gray-300 dark:border-gray-600 pl-4 my-4 italic text-gray-600 dark:text-gray-400">\${childrenHtml}</blockquote>\`
    }

    case 'horizontalrule': {
      return '<hr class="my-8 border-gray-200 dark:border-gray-700" />'
    }

    case 'linebreak': {
      return '<br />'
    }

    case 'tab': {
      return '&nbsp;&nbsp;&nbsp;&nbsp;'
    }

    case 'code': {
      // Code block (multi-line code)
      const language = (node as LexicalNode & { language?: string }).language || ''
      return \`<pre class="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto my-4"><code class="text-sm font-mono"\${language ? \` data-language="\${escapeHtml(language)}"\` : ''}>\${childrenHtml}</code></pre>\`
    }

    case 'upload': {
      // Handle uploaded media (images)
      const mediaValue = node.value as Media | string | null | undefined
      if (!mediaValue || typeof mediaValue === 'string') return ''
      const url = getMediaUrl(mediaValue.url)
      if (!url) return ''
      const alt = escapeHtml(mediaValue.alt || '')
      const fields = node.fields || {}
      const size = (fields.size as string) || 'medium'
      const alignment = (fields.alignment as string) || 'center'
      const caption = fields.caption as string | undefined

      // Size classes
      const sizeStyles: Record<string, string> = {
        small: 'max-w-[400px]',
        medium: 'max-w-[600px]',
        large: 'max-w-[900px]',
        full: 'max-w-full',
      }
      const sizeClass = sizeStyles[size] || sizeStyles.medium

      // Alignment classes for figure container
      const alignmentStyles: Record<string, string> = {
        left: 'mr-auto',
        center: 'mx-auto',
        right: 'ml-auto',
      }
      const alignClass = alignmentStyles[alignment] || alignmentStyles.center

      let html = \`<figure class="my-6 \${sizeClass} \${alignClass}">\`
      html += \`<img src="\${url}" alt="\${alt}" class="rounded-lg w-full h-auto" loading="lazy" />\`
      if (caption) {
        html += \`<figcaption class="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">\${escapeHtml(caption)}</figcaption>\`
      }
      html += '</figure>'
      return html
    }

    default:
      // For unknown node types, just render children
      return childrenHtml
  }
}

function getTextAlign(format: number | string | undefined): string {
  if (typeof format === 'string') {
    switch (format) {
      case 'left': return ' text-left'
      case 'center': return ' text-center'
      case 'right': return ' text-right'
      case 'justify': return ' text-justify'
      default: return ''
    }
  }
  // Lexical also uses numeric format for alignment on block nodes
  // These are different from text formatting bitmasks
  return ''
}

function getHeadingSize(level: string): string {
  switch (level) {
    case '1': return 'text-4xl'
    case '2': return 'text-3xl'
    case '3': return 'text-2xl'
    case '4': return 'text-xl'
    case '5': return 'text-lg'
    case '6': return 'text-base'
    default: return 'text-2xl'
  }
}

function renderContent(content: unknown): string {
  if (!content || typeof content !== 'object') return ''
  const root = content as { root?: LexicalNode }
  if (!root.root?.children) return ''
  return root.root.children.map(renderNode).join('')
}
</script>

<template>
  <div class="prose prose-gray dark:prose-invert max-w-none" v-html="renderContent(content)" />
</template>
`
  )

  // pages/index.vue
  writeFileSync(
    join(pagesDir, 'index.vue'),
    `<script setup lang="ts">
import type { Page, PagesResponse } from '~/types/page'

const apiUrl = usePayloadApiUrl()

// Use native fetch to avoid $fetch caching issues during SSG
const { data: response } = await useAsyncData(
  'page-index-home',
  async () => {
    const url = new URL(\`\${apiUrl}/pages\`)
    url.searchParams.set('where[slug][equals]', 'home')
    url.searchParams.set('limit', '1')
    url.searchParams.set('depth', '2')
    const res = await fetch(url.toString())
    return res.json() as Promise<PagesResponse>
  }
)

const page = computed<Page | null>(() => response.value?.docs?.[0] || null)
</script>

<template>
  <UContainer>
    <!-- Default welcome when no home page exists -->
    <UPageHero
      v-if="!page"
      title="Welcome to ${context.projectName}"
      description="Your CMS-powered website is ready. Create a page with slug 'home' to customize this."
      align="center"
      :links="[{ label: 'Open CMS', to: 'http://localhost:3202/admin', variant: 'solid', size: 'lg' }]"
    />

    <!-- Render page content -->
    <article v-else>
      <BlocksBlockRenderer v-if="page.content?.length" :blocks="page.content" />

      <!-- Empty state -->
      <div v-else class="py-12 text-center text-neutral-500">
        <h1 class="text-4xl font-bold mb-6">{{ page.title }}</h1>
        <p>No content yet. Add blocks in the CMS.</p>
      </div>
    </article>
  </UContainer>
</template>
`
  )

  // pages/[...slug].vue
  writeFileSync(
    join(pagesDir, '[...slug].vue'),
    `<script setup lang="ts">
import type { Page, PagesResponse } from '~/types/page'

const route = useRoute()
const apiUrl = usePayloadApiUrl()

// Get slug from route params - handle array (catch-all) or string
const slugParam = route.params.slug
const slugParts = Array.isArray(slugParam) ? slugParam : slugParam ? [slugParam] : []
const slug = slugParts.join('/')

// If slug is empty, this route shouldn't handle it (index.vue handles /)
// But during SSG this can happen, so redirect to home
if (!slug) {
  await navigateTo('/', { replace: true })
}

// Use native fetch to avoid $fetch caching issues during SSG
const { data: response, error } = await useAsyncData(
  \`page-\${slug}\`,
  async () => {
    const url = new URL(\`\${apiUrl}/pages\`)
    url.searchParams.set('where[slug][equals]', slug)
    url.searchParams.set('limit', '1')
    url.searchParams.set('depth', '2')
    const res = await fetch(url.toString())
    return res.json() as Promise<PagesResponse>
  }
)

const page = computed<Page | null>(() => response.value?.docs?.[0] || null)

// Show 404 error if page not found
if (!page.value && !error.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Page Not Found',
    message: \`The page "\${slug}" could not be found.\`,
  })
}
</script>

<template>
  <UContainer>
    <article v-if="page">
      <BlocksBlockRenderer v-if="page.content?.length" :blocks="page.content" />

      <!-- Empty state -->
      <div v-else class="py-12 text-center text-neutral-500">
        <h1 class="text-4xl font-bold mb-6">{{ page.title }}</h1>
        <p>No content yet. Add blocks in the CMS.</p>
      </div>
    </article>
  </UContainer>
</template>
`
  )

  // assets/css/main.css (Tailwind v4 syntax)
  writeFileSync(
    join(assetsDir, 'main.css'),
    `@import "tailwindcss";
@import "@nuxt/ui";

@theme {
  /* Font families */
  --font-sans: "Inter", system-ui, sans-serif;
  --font-display: "Playfair Display", Georgia, serif;

  /* Component styling */
  --radius-button: .7rem;

  --color-brandprimarymedium: #f15b4e;
  --color-brandprimarydark: #6b081d;
  --color-brandprimaryverydark: #373031;
  --color-brandsecondarylight: #efebe7;
  --color-brandsecondarymedium: #e3cac0;
  --color-brandsecondarymedium2: #7c9198;

  --color-warning-50: #fffbeb;
  --color-warning-100: #fef3c7;
  --color-warning-500: #f59e0b;
  --color-warning-600: #d97706;
  --color-warning-700: #b45309;

  --color-error-50: #fef2f2;
  --color-error-100: #fee2e2;
  --color-error-500: #ef4444;
  --color-error-600: #dc2626;
  --color-error-700: #b91c1c;

  --color-info-50: #eff6ff;
  --color-info-100: #dbeafe;
  --color-info-500: #3b82f6;
  --color-info-600: #2563eb;
  --color-info-700: #1d4ed8;

  /* Typography */
  --color-font: #1a1918;

  /* Accent */
  --color-accent: #8B5A4A;
}

@source "../../../app/components/**/*.vue";
@source "../../../app/layouts/**/*.vue";
@source "../../../app/pages/**/*.vue";
@source "../../../app/app.vue";
@source "../../../app/app.config.ts";
`
  )

  // .gitignore
  writeFileSync(
    join(webDir, '.gitignore'),
    `node_modules/
.nuxt/
.output/
.env
*.log

*storybook.log
storybook-static
`
  )

  // components/blocks/BlockRenderer.vue
  writeFileSync(
    join(blocksComponentsDir, 'BlockRenderer.vue'),
    `<script setup lang="ts">
import type { ContentBlock } from '~/types/blocks'

defineProps<{
  blocks: ContentBlock[]
}>()
</script>

<template>
  <div class="blocks-container space-y-8">
    <template v-for="block in blocks" :key="block.id">
      <BlocksHeroBlock v-if="block.blockType === 'hero'" :block="block" />
      <BlocksRichTextBlock v-else-if="block.blockType === 'richText'" :block="block" />
      <BlocksSplitTextImage v-else-if="block.blockType === 'splitTextImage'" :block="block" />
    </template>
  </div>
</template>
`
  )

  // components/blocks/HeroBlock.vue
  writeFileSync(
    join(blocksComponentsDir, 'HeroBlock.vue'),
    `<script setup lang="ts">
import type { HeroBlock as HeroBlockType } from '~/types/blocks'

const props = defineProps<{
  block: HeroBlockType
}>()

const alignmentClass = computed(() => {
  switch (props.block.alignment) {
    case 'left':
      return 'left'
    case 'right':
      return 'right'
    default:
      return 'center'
  }
})

const links = computed(() => {
  if (!props.block.links) return []
  return props.block.links.map((link) => ({
    label: link.label,
    to: link.url,
    variant: link.variant || 'solid',
    size: 'lg' as const,
  }))
})

const backgroundImageUrl = computed(() => {
  if (!props.block.backgroundImage) return undefined
  if (typeof props.block.backgroundImage === 'string') return undefined
  return useMediaUrl(props.block.backgroundImage.url)
})
</script>

<template>
  <div class="relative">
    <div
      v-if="backgroundImageUrl"
      class="absolute inset-0 z-0"
    >
      <img
        :src="backgroundImageUrl"
        :alt="block.headline"
        class="w-full h-full object-cover"
      />
      <div class="absolute inset-0 bg-black/50" />
    </div>
    <UPageHero
      :title="block.headline"
      :description="block.subheadline"
      :links="links"
      :align="alignmentClass"
      :ui="backgroundImageUrl ? { title: 'text-white', description: 'text-white/80' } : {}"
      :class="backgroundImageUrl ? 'relative z-10' : ''"
    />
  </div>
</template>
`
  )

  // components/blocks/RichTextBlock.vue
  writeFileSync(
    join(blocksComponentsDir, 'RichTextBlock.vue'),
    `<script setup lang="ts">
import type { RichTextBlock as RichTextBlockType } from '~/types/blocks'

defineProps<{
  block: RichTextBlockType
}>()
</script>

<template>
  <div class="prose prose-lg max-w-none">
    <RichTextRenderer :content="block.content" />
  </div>
</template>
`
  )

  // components/blocks/SplitTextImage.vue
  writeFileSync(
    join(blocksComponentsDir, 'SplitTextImage.vue'),
    `<script setup lang="ts">
import type { SplitTextImageBlock } from '~/types/blocks'

const props = defineProps<{
  block: SplitTextImageBlock
}>()

const imageUrl = computed(() => {
  if (!props.block.image) return undefined
  if (typeof props.block.image === 'string') return undefined
  return useMediaUrl(props.block.image.url)
})

const imageAlt = computed(() => {
  if (!props.block.image || typeof props.block.image === 'string') return ''
  return props.block.image.alt || ''
})
</script>

<template>
  <section class="flex items-start">
    <!-- Left: Text content -->
    <div class="w-[55%] pr-8 pt-1">
      <!-- Rich text content with custom styling for this block -->
      <div class="split-text-image-content">
        <RichTextRenderer :content="block.text" />
      </div>

      <!-- CTA Buttons -->
      <div v-if="block.buttons?.length" class="flex flex-wrap gap-4 mt-10">
        <UiButtonOutline
          v-for="(button, index) in block.buttons"
          :key="button.id || index"
          :to="button.link"
        >
          {{ button.caption }}
        </UiButtonOutline>
      </div>
    </div>

    <!-- Right: Image (poster) -->
    <div class="w-[42%] pl-4">
      <div
        v-if="imageUrl"
        class="aspect-[5/6] overflow-hidden"
      >
        <img
          :src="imageUrl"
          :alt="imageAlt"
          class="w-full h-full object-cover"
        />
      </div>
      <div
        v-else
        class="bg-gray-200 aspect-[5/6] flex items-center justify-center text-gray-400"
      >
        Image
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Override default RichTextRenderer styles for this block */
.split-text-image-content :deep(h1),
.split-text-image-content :deep(h2) {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 40px;
  font-weight: 500;
  line-height: 1.15;
  margin-bottom: 2rem;
  color: var(--color-font);
}

.split-text-image-content :deep(p) {
  font-size: 15px;
  line-height: 1.8;
  color: color-mix(in srgb, var(--color-font) 70%, transparent);
  margin-bottom: 0;
}

.split-text-image-content :deep(.prose) {
  max-width: none;
}
</style>
`
  )

  // components/ui/ButtonOutline.vue
  writeFileSync(
    join(uiComponentsDir, 'ButtonOutline.vue'),
    `<script setup lang="ts">
interface Props {
  to?: string
  href?: string
}

const props = withDefaults(defineProps<Props>(), {
  to: undefined,
  href: undefined,
})

const isLink = computed(() => props.to || props.href)
</script>

<template>
  <NuxtLink
    v-if="isLink"
    :to="to"
    :href="href"
    class="inline-block border border-accent text-accent font-medium py-2.5 px-6 rounded-full hover:bg-accent hover:text-white transition-colors text-[15px]"
  >
    <slot />
  </NuxtLink>
  <button
    v-else
    type="button"
    class="inline-block border border-accent text-accent font-medium py-2.5 px-6 rounded-full hover:bg-accent hover:text-white transition-colors text-[15px]"
  >
    <slot />
  </button>
</template>
`
  )

  // components/blocks/HeroBlock.stories.ts
  writeFileSync(
    join(blocksComponentsDir, 'HeroBlock.stories.ts'),
    `import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import type { HeroBlock as HeroBlockType } from '~/types/blocks'

import HeroBlock from './HeroBlock.vue'

const meta = {
  title: 'Blocks/HeroBlock',
  component: HeroBlock,
  tags: ['autodocs'],
  argTypes: {
    block: {
      control: 'object',
      description: 'The hero block data object',
    },
  },
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof HeroBlock>

export default meta
type Story = StoryObj<typeof meta>

const baseBlock: HeroBlockType = {
  id: '1',
  blockType: 'hero',
  headline: 'Welcome to Our Platform',
  subheadline: 'Build amazing things with our powerful tools and intuitive interface.',
  alignment: 'center',
}

export const Default: Story = {
  args: {
    block: baseBlock,
  },
}

export const LeftAligned: Story = {
  args: {
    block: {
      ...baseBlock,
      id: '2',
      alignment: 'left',
    },
  },
}

export const RightAligned: Story = {
  args: {
    block: {
      ...baseBlock,
      id: '3',
      alignment: 'right',
    },
  },
}

export const WithLinks: Story = {
  args: {
    block: {
      ...baseBlock,
      id: '4',
      links: [
        { label: 'Get Started', url: '/get-started', variant: 'solid' },
        { label: 'Learn More', url: '/learn-more', variant: 'outline' },
      ],
    },
  },
}

export const WithBackgroundImage: Story = {
  args: {
    block: {
      ...baseBlock,
      id: '5',
      headline: 'Discover New Possibilities',
      subheadline: 'Transform your workflow with cutting-edge solutions.',
      backgroundImage: {
        id: 'img-1',
        url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=80',
        alt: 'Abstract background',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      links: [
        { label: 'Start Free Trial', url: '/trial', variant: 'solid' },
      ],
    },
  },
}

export const MinimalHeadlineOnly: Story = {
  args: {
    block: {
      id: '6',
      blockType: 'hero',
      headline: 'Simple and Clean',
    },
  },
}
`
  )

  // .storybook/main.ts
  writeFileSync(
    join(storybookDir, 'main.ts'),
    `import type { StorybookConfig } from '@storybook-vue/nuxt';

const config: StorybookConfig = {
  stories: ['../app/components/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-docs'],
  framework: '@storybook-vue/nuxt',
  core: {
    disableTelemetry: true,
  },
};

export default config;
`
  )

  // .storybook/preview.ts
  writeFileSync(
    join(storybookDir, 'preview.ts'),
    `import type { Preview } from '@storybook-vue/nuxt'
import { h } from 'vue'

const viewportDimensions: Record<string, { width: string; height: string }> = {
  iphone14: { width: '390px', height: '844px' },
  iphone14promax: { width: '430px', height: '932px' },
  ipad11p: { width: '834px', height: '1194px' },
  ipad12p: { width: '1024px', height: '1366px' },
  pixel5: { width: '393px', height: '851px' },
  galaxys9: { width: '360px', height: '740px' },
}

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      options: {
        light: { name: 'light', value: '#ffffff' },
        dark: { name: 'dark', value: '#1a1a1a' }
      }
    },
  },

  globalTypes: {
    viewport: {
      toolbar: {
        icon: 'mobile',
        title: 'Viewport',
        items: [
          { value: 'reset', title: 'Reset (Full width)' },
          { value: 'iphone14', title: 'iPhone 14 (390×844)' },
          { value: 'iphone14promax', title: 'iPhone 14 Pro Max (430×932)' },
          { value: 'ipad11p', title: 'iPad Pro 11 (834×1194)' },
          { value: 'ipad12p', title: 'iPad Pro 12.9 (1024×1366)' },
          { value: 'pixel5', title: 'Pixel 5 (393×851)' },
          { value: 'galaxys9', title: 'Galaxy S9 (360×740)' },
        ],
        dynamicTitle: true,
      },
    },
  },

  decorators: [
    (story, context) => {
      const viewport = context.globals.viewport
      const dimensions = viewportDimensions[viewport]

      if (!dimensions) {
        return { render: () => h(story()) }
      }

      return {
        render: () => h(
          'div',
          {
            style: {
              width: dimensions.width,
              height: dimensions.height,
              margin: '0 auto',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              overflow: 'auto',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            },
          },
          [h(story())]
        ),
      }
    },
  ],

  initialGlobals: {
    backgrounds: {
      value: 'light'
    }
  }
};

export default preview;
`
  )
}

async function generateRootFiles(
  targetDir: string,
  context: TemplateContext
): Promise<void> {
  // docker-compose.yml
  writeFileSync(
    join(targetDir, 'docker-compose.yml'),
    `services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: payload
      POSTGRES_PASSWORD: payload
      POSTGRES_DB: payload
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    networks:
      - ${context.projectSlug}

  payload:
    build:
      context: ./payload
      dockerfile: Dockerfile.dev
    ports:
      - "3202:3000"
    volumes:
      - ./payload/src:/app/src
      - ./payload/public:/app/public
      - ./payload/data:/app/data
      - payload_node_modules:/app/node_modules
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://payload:payload@postgres:5432/payload
      - PAYLOAD_SECRET=development-secret-key-change-in-production
    depends_on:
      - postgres
    networks:
      - ${context.projectSlug}

  web:
    build:
      context: ./web
      dockerfile: Dockerfile
    ports:
      - "3201:3000"
    volumes:
      - ./web/app/pages:/app/app/pages
      - ./web/app/components:/app/app/components
      - ./web/app/composables:/app/app/composables
      - ./web/app/layouts:/app/app/layouts
      - ./web/app/types:/app/app/types
      - ./web/app/assets:/app/app/assets
      - ./web/public:/app/public
      - ./web/nuxt.config.ts:/app/nuxt.config.ts
    environment:
      - PAYLOAD_API_URL=http://payload:3000/api
      - NUXT_PUBLIC_PAYLOAD_API_URL=http://localhost:3202/api
    depends_on:
      - payload
    networks:
      - ${context.projectSlug}

  storybook:
    build:
      context: ./web
      dockerfile: Dockerfile
    command: pnpm exec storybook dev -p 6006 --host 0.0.0.0 --no-open
    ports:
      - "6006:6006"
    environment:
      - STORYBOOK=true
      - NODE_ENV=development
    volumes:
      - ./web/app/pages:/app/app/pages
      - ./web/app/components:/app/app/components
      - ./web/app/composables:/app/app/composables
      - ./web/app/layouts:/app/app/layouts
      - ./web/app/types:/app/app/types
      - ./web/app/assets:/app/app/assets
      - ./web/public:/app/public
      - ./web/.storybook:/app/.storybook
      - ./web/nuxt.config.ts:/app/nuxt.config.ts
    networks:
      - ${context.projectSlug}

networks:
  ${context.projectSlug}:
    driver: bridge

volumes:
  payload_node_modules:
  postgres_data:
`
  )

  // .env.example
  writeFileSync(
    join(targetDir, '.env.example'),
    `# Payload CMS
DATABASE_URL=postgresql://payload:payload@localhost:5432/payload
PAYLOAD_SECRET=your-secret-key-here
PAYLOAD_PUBLIC_SERVER_URL=http://localhost:3202

# GitHub webhook (for auto-deploy on content changes)
GITHUB_TOKEN=your-github-token
GITHUB_REPO=owner/repo

# Frontend
NUXT_PUBLIC_PAYLOAD_API_URL=http://localhost:3202/api
`
  )

  // README.md
  writeFileSync(
    join(targetDir, 'README.md'),
    `# ${context.projectName}

A full-stack CMS project with Nuxt frontend and Payload CMS backend.

## Local Development

\`\`\`bash
# Start all services with Docker Compose
docker-compose up

# Access the services:
# - Frontend: http://localhost:3201
# - CMS Admin: http://localhost:3202/admin
# - Storybook: http://localhost:6006
\`\`\`

## Project Structure

\`\`\`
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
\`\`\`

## Deployment

- **CMS:** Deployed on Railway
- **Frontend:** Static site generated and deployed via FTP

Content changes in the CMS automatically trigger a rebuild of the static site.
`
  )

  // .gitignore (root)
  writeFileSync(
    join(targetDir, '.gitignore'),
    `# Dependencies
node_modules/

# Environment
.env
.env.local

# Build outputs
.next/
.nuxt/
.output/
dist/

# Logs
*.log

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db
`
  )

  // db-reset.sh
  writeFileSync(
    join(targetDir, 'db-reset.sh'),
    `#!/bin/bash
# Reset the Payload database (drops all data)
echo "Resetting database..."
docker compose exec postgres psql -U payload -d payload -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
echo "Database reset complete. Restart payload to recreate schema:"
echo "  docker compose restart payload"
`
  )
}

async function generateGithubWorkflow(targetDir: string): Promise<void> {
  const workflowDir = join(targetDir, '.github', 'workflows')
  mkdirSync(workflowDir, { recursive: true })

  writeFileSync(
    join(workflowDir, 'deploy.yml'),
    `name: Build and Deploy

on:
  # Trigger on content changes from Payload CMS webhook
  repository_dispatch:
    types: [content_update]

  # Trigger on code changes
  push:
    branches: [main]
    paths:
      - 'web/**'
      - '.github/workflows/deploy.yml'

  # Allow manual trigger
  workflow_dispatch:

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
          cache-dependency-path: web/pnpm-lock.yaml

      - name: Cache node_modules
        id: cache-node-modules
        uses: actions/cache@v4
        with:
          path: web/node_modules
          key: \${{ runner.os }}-node-modules-\${{ hashFiles('web/pnpm-lock.yaml') }}

      - name: Install dependencies
        if: steps.cache-node-modules.outputs.cache-hit != 'true'
        working-directory: web
        run: pnpm install --frozen-lockfile

      - name: Cache Nuxt build
        uses: actions/cache@v4
        with:
          path: web/.nuxt
          key: \${{ runner.os }}-nuxt-\${{ hashFiles('web/**/*.vue', 'web/**/*.ts', 'web/nuxt.config.ts', 'web/pnpm-lock.yaml') }}
          restore-keys: |
            \${{ runner.os }}-nuxt-

      - name: Generate static site
        working-directory: web
        env:
          # Both needed: PAYLOAD_API_URL for server-side rendering, NUXT_PUBLIC_PAYLOAD_API_URL for client
          PAYLOAD_API_URL: \${{ secrets.PAYLOAD_API_URL }}
          NUXT_PUBLIC_PAYLOAD_API_URL: \${{ secrets.PAYLOAD_API_URL }}
          NODE_OPTIONS: '--max-old-space-size=8192'
        run: pnpm run generate

      - name: Deploy to FTP
        uses: SamKirkland/FTP-Deploy-Action@v4.3.5
        with:
          server: \${{ secrets.FTP_HOST }}
          username: \${{ secrets.FTP_USERNAME }}
          password: \${{ secrets.FTP_PASSWORD }}
          local-dir: web/.output/public/
          server-dir: \${{ secrets.FTP_SERVER_DIR || './' }}
`
  )
}

function fieldToPayloadConfig(field: CollectionField): string {
  const parts: string[] = []
  parts.push(`      name: '${field.name}'`)
  parts.push(`      type: '${field.type}'`)

  if (field.required) {
    parts.push(`      required: true`)
  }
  if (field.unique) {
    parts.push(`      unique: true`)
  }
  if (field.relationTo) {
    parts.push(`      relationTo: '${field.relationTo}'`)
  }
  if (field.hasMany !== undefined) {
    parts.push(`      hasMany: ${field.hasMany}`)
  }
  if (field.options && field.options.length > 0) {
    const optionsStr = field.options
      .map((o) => `        { label: '${o.label}', value: '${o.value}' }`)
      .join(',\n')
    parts.push(`      options: [\n${optionsStr}\n      ]`)
  }
  if (field.admin?.description) {
    parts.push(`      admin: {\n        description: '${field.admin.description}'\n      }`)
  }

  return `    {\n${parts.join(',\n')}\n    }`
}

async function generateCollectionFile(
  targetDir: string,
  collection: GeneratedCollection
): Promise<void> {
  const collectionsDir = join(targetDir, 'payload', 'src', 'collections')

  const fieldsStr = collection.fields.map(fieldToPayloadConfig).join(',\n')

  const adminConfig = collection.admin?.useAsTitle
    ? `
  admin: {
    useAsTitle: '${collection.admin.useAsTitle}',
  },`
    : ''

  const content = `import type { CollectionConfig } from 'payload'
import { triggerDeploy } from '../hooks/triggerDeploy'

export const ${collection.name}: CollectionConfig = {
  slug: '${collection.slug}',${adminConfig}
  access: {
    read: () => true,
  },
  hooks: {
    afterChange: [
      async ({ collection }) => {
        await triggerDeploy(collection.slug)
      },
    ],
    afterDelete: [
      async ({ collection }) => {
        await triggerDeploy(collection.slug)
      },
    ],
  },
  fields: [
${fieldsStr}
  ],
}
`

  writeFileSync(join(collectionsDir, `${collection.name}.ts`), content)
}
