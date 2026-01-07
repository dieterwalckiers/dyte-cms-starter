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
  }),
  editor: lexicalEditor({
    features: ({ defaultFeatures }) => [
      ...defaultFeatures,
      UploadFeature({
        collections: {
          media: {
            fields: [
              {
                name: 'caption',
                type: 'text',
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
    'http://localhost:3000',
    'http://localhost:4001',
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
      name: 'body',
      type: 'richText',
      required: true,
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
    staticDir: '../public/uploads',
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

COPY package*.json ./
RUN npm install

COPY . .

# Generate import map for Payload admin UI (lexical editor components)
RUN npx payload generate:importmap

EXPOSE 3000

CMD ["npm", "run", "dev"]
`
  )

  // Dockerfile (production)
  writeFileSync(
    join(payloadDir, 'Dockerfile'),
    `FROM node:22-alpine AS base

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
CMD ["sh", "-c", "npm run migrate && npm run start -- -p \${PORT:-3000}"]
`
  )

  // nixpacks.toml for Railway (fallback if Dockerfile is not used)
  writeFileSync(
    join(payloadDir, 'nixpacks.toml'),
    `[phases.setup]
nixPkgs = ["nodejs_22"]

[phases.install]
cmds = ["npm ci"]

[phases.build]
cmds = ["npm run build"]

[start]
cmd = "npm run migrate && npm start"
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
  const pagesDir = join(webDir, 'pages')
  const componentsDir = join(webDir, 'components')
  const composablesDir = join(webDir, 'composables')
  const layoutsDir = join(webDir, 'layouts')
  const typesDir = join(webDir, 'types')
  const assetsDir = join(webDir, 'assets', 'css')

  // Create directories
  mkdirSync(pagesDir, { recursive: true })
  mkdirSync(componentsDir, { recursive: true })
  mkdirSync(composablesDir, { recursive: true })
  mkdirSync(layoutsDir, { recursive: true })
  mkdirSync(typesDir, { recursive: true })
  mkdirSync(assetsDir, { recursive: true })

  // package.json
  const webPackageJson = {
    name: 'web',
    private: true,
    type: 'module',
    scripts: {
      build: 'nuxt build',
      dev: 'nuxt dev',
      generate: 'nuxt generate',
      preview: 'nuxt preview',
      postinstall: 'nuxt prepare',
    },
    dependencies: {
      nuxt: '^3.14.0',
      vue: '^3.5.0',
      'vue-router': '^4.5.0',
    },
    devDependencies: {
      '@nuxtjs/tailwindcss': '^6.14.0',
    },
  }
  writeFileSync(
    join(webDir, 'package.json'),
    JSON.stringify(webPackageJson, null, 2)
  )

  // nuxt.config.ts
  // Only add app.baseURL if there's a path (e.g., "/blog" for "https://example.com/blog")
  const baseURLConfig = context.websitePath
    ? `
  app: {
    baseURL: '${context.websitePath}/',
  },
`
    : ''

  writeFileSync(
    join(webDir, 'nuxt.config.ts'),
    `// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },

  modules: ['@nuxtjs/tailwindcss'],
${baseURLConfig}
  ssr: true,

  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ['/'],
      failOnError: false
    }
  },

  runtimeConfig: {
    public: {
      payloadApiUrl: process.env.NUXT_PUBLIC_PAYLOAD_API_URL || 'http://localhost:4001/api'
    }
  },

  devServer: {
    host: '0.0.0.0',
    port: 3000
  }
})
`
  )

  // Dockerfile
  writeFileSync(
    join(webDir, 'Dockerfile'),
    `FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
`
  )

  // types/page.ts
  writeFileSync(
    join(typesDir, 'page.ts'),
    `export interface Page {
  id: string
  title: string
  slug: string
  showInMenu: boolean
  menuOrder?: number
  body: unknown // Rich text content
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

  // composables/usePayload.ts
  writeFileSync(
    join(composablesDir, 'usePayload.ts'),
    `import type { Page, PagesResponse } from '~/types/page'

export function usePages() {
  const config = useRuntimeConfig()
  return useFetch<PagesResponse>(\`\${config.public.payloadApiUrl}/pages\`, {
    query: { limit: 100 },
    key: 'pages',
    timeout: 10000,
    retry: 1,
    transform: (data) => data.docs
  })
}

export function useMenuPages() {
  const config = useRuntimeConfig()
  return useFetch<PagesResponse>(\`\${config.public.payloadApiUrl}/pages\`, {
    query: {
      'where[showInMenu][equals]': 'true',
      sort: 'menuOrder',
      limit: 100
    },
    key: 'menuPages',
    timeout: 10000,
    retry: 1,
    transform: (data) => data.docs
  })
}

export function usePage(slug: MaybeRefOrGetter<string>) {
  const config = useRuntimeConfig()
  const slugValue = toValue(slug)

  return useFetch<PagesResponse>(\`\${config.public.payloadApiUrl}/pages\`, {
    query: {
      'where[slug][equals]': slugValue,
      limit: 1
    },
    key: \`page-\${slugValue}\`,
    timeout: 10000,
    retry: 1,
    transform: (data) => {
      if (data.docs.length === 0) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Page not found'
        })
      }
      return data.docs[0]
    }
  })
}
`
  )

  // app.vue
  writeFileSync(
    join(webDir, 'app.vue'),
    `<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
`
  )

  // layouts/default.vue
  writeFileSync(
    join(layoutsDir, 'default.vue'),
    `<template>
  <div class="min-h-screen flex flex-col">
    <TheHeader />
    <main class="flex-1 container mx-auto px-4 py-8">
      <slot />
    </main>
    <footer class="bg-gray-100 py-4 text-center text-gray-600">
      <p>&copy; {{ new Date().getFullYear() }} ${context.projectName}</p>
    </footer>
  </div>
</template>
`
  )

  // components/TheHeader.vue
  writeFileSync(
    join(componentsDir, 'TheHeader.vue'),
    `<script setup lang="ts">
const { data: menuPages } = await useMenuPages()
</script>

<template>
  <header class="bg-white shadow">
    <nav class="container mx-auto px-4 py-4">
      <div class="flex items-center justify-between">
        <NuxtLink to="/" class="text-xl font-bold text-gray-800">
          ${context.projectName}
        </NuxtLink>
        <ul class="flex space-x-6">
          <li v-for="page in menuPages" :key="page.id">
            <NuxtLink
              :to="\`/\${page.slug}\`"
              class="text-gray-600 hover:text-gray-800 transition-colors"
            >
              {{ page.title }}
            </NuxtLink>
          </li>
        </ul>
      </div>
    </nav>
  </header>
</template>
`
  )

  // components/RichTextRenderer.vue
  writeFileSync(
    join(componentsDir, 'RichTextRenderer.vue'),
    `<script setup lang="ts">
defineProps<{
  content: unknown
}>()

function renderNode(node: Record<string, unknown>): string {
  if (!node || typeof node !== 'object') return ''

  const type = node.type as string | undefined
  const children = node.children as Record<string, unknown>[] | undefined
  const text = node.text as string | undefined

  if (text !== undefined) {
    let result = text
    if (node.bold) result = \`<strong>\${result}</strong>\`
    if (node.italic) result = \`<em>\${result}</em>\`
    if (node.underline) result = \`<u>\${result}</u>\`
    return result
  }

  const childrenHtml = children?.map(renderNode).join('') || ''

  switch (type) {
    case 'paragraph':
      return \`<p class="mb-4">\${childrenHtml}</p>\`
    case 'heading':
      const tag = \`h\${(node.tag as string)?.replace('h', '') || '2'}\`
      return \`<\${tag} class="font-bold mb-4">\${childrenHtml}</\${tag}>\`
    case 'list':
      const listTag = node.listType === 'number' ? 'ol' : 'ul'
      return \`<\${listTag} class="list-disc list-inside mb-4">\${childrenHtml}</\${listTag}>\`
    case 'listitem':
      return \`<li>\${childrenHtml}</li>\`
    case 'link':
      return \`<a href="\${node.url || '#'}" class="text-blue-600 hover:underline">\${childrenHtml}</a>\`
    default:
      return childrenHtml
  }
}

function renderContent(content: unknown): string {
  if (!content || typeof content !== 'object') return ''
  const root = content as { root?: { children?: Record<string, unknown>[] } }
  if (!root.root?.children) return ''
  return root.root.children.map(renderNode).join('')
}
</script>

<template>
  <div class="prose max-w-none" v-html="renderContent(content)" />
</template>
`
  )

  // pages/index.vue
  writeFileSync(
    join(pagesDir, 'index.vue'),
    `<script setup lang="ts">
const config = useRuntimeConfig()

// Fetch data at build time for SSG with aggressive timeout and retry limits
const { data: response, error } = await useFetch(\`\${config.public.payloadApiUrl}/pages\`, {
  query: {
    'where[slug][equals]': 'home',
    limit: 1
  },
  timeout: 10000,
  retry: 1,
  onResponseError: () => {
    // Fail silently and show fallback
  }
})

const page = computed(() => response.value?.docs?.[0] || null)
</script>

<template>
  <div>
    <div v-if="!page" class="text-center py-12">
      <h1 class="text-4xl font-bold mb-4">Welcome to ${context.projectName}</h1>
      <p class="text-gray-600">Your CMS-powered website is ready.</p>
    </div>
    <article v-else>
      <h1 class="text-4xl font-bold mb-6">{{ page.title }}</h1>
      <RichTextRenderer :content="page.body" />
    </article>
  </div>
</template>
`
  )

  // pages/[...slug].vue
  writeFileSync(
    join(pagesDir, '[...slug].vue'),
    `<script setup lang="ts">
const route = useRoute()
const config = useRuntimeConfig()

// slug is an array for catch-all routes, join with '/' for nested slugs
const slugParam = route.params.slug
const slug = Array.isArray(slugParam) ? slugParam.join('/') : slugParam || 'home'

// Fetch data at build time for SSG with aggressive timeout and retry limits
const { data: response, error } = await useFetch(\`\${config.public.payloadApiUrl}/pages\`, {
  query: {
    'where[slug][equals]': slug,
    limit: 1
  },
  timeout: 10000,
  retry: 1,
  onResponseError: () => {
    // Fail silently - will show 404
  }
})

const page = computed(() => response.value?.docs?.[0] || null)

// Handle 404 if page not found
if (!page.value && !error.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Page Not Found'
  })
}
</script>

<template>
  <div>
    <article v-if="page">
      <h1 class="text-4xl font-bold mb-6">{{ page.title }}</h1>
      <RichTextRenderer :content="page.body" />
    </article>
  </div>
</template>
`
  )

  // tailwind.config.js
  writeFileSync(
    join(webDir, 'tailwind.config.js'),
    `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './app.vue',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
`
  )

  // assets/css/main.css
  writeFileSync(
    join(assetsDir, 'main.css'),
    `@tailwind base;
@tailwind components;
@tailwind utilities;
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
      - "4001:3000"
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
      - "3000:3000"
    volumes:
      - ./web/pages:/app/pages
      - ./web/components:/app/components
      - ./web/composables:/app/composables
      - ./web/layouts:/app/layouts
      - ./web/types:/app/types
      - ./web/assets:/app/assets
      - ./web/public:/app/public
      - ./web/nuxt.config.ts:/app/nuxt.config.ts
    environment:
      - NUXT_PUBLIC_PAYLOAD_API_URL=http://payload:3000/api
    depends_on:
      - payload
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
PAYLOAD_PUBLIC_SERVER_URL=http://localhost:4001

# GitHub webhook (for auto-deploy on content changes)
GITHUB_TOKEN=your-github-token
GITHUB_REPO=owner/repo

# Frontend
NUXT_PUBLIC_PAYLOAD_API_URL=http://localhost:4001/api
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
# - Frontend: http://localhost:3000
# - CMS Admin: http://localhost:4001/admin
\`\`\`

## Project Structure

\`\`\`
├── payload/          # Payload CMS (backend)
│   └── src/
│       ├── collections/
│       └── payload.config.ts
├── web/              # Nuxt frontend
│   ├── pages/
│   ├── components/
│   └── composables/
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

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: web/package-lock.json

      - name: Install dependencies
        working-directory: web
        run: npm install

      - name: Generate static site
        working-directory: web
        env:
          NUXT_PUBLIC_PAYLOAD_API_URL: \${{ secrets.PAYLOAD_API_URL }}
          NODE_OPTIONS: '--max-old-space-size=8192'
        run: npm run generate

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
