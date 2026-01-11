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
import { Hero, RichText } from '../blocks'

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
      blocks: [Hero, RichText],
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
  imageURL: '/assets/blocks/hero.png',
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
    join(blocksDir, 'index.ts'),
    `export { Hero } from './Hero'
export { RichText } from './RichText'
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
  const appDir = join(webDir, 'app')
  const pagesDir = join(appDir, 'pages')
  const componentsDir = join(appDir, 'components')
  const blocksComponentsDir = join(componentsDir, 'blocks')
  const composablesDir = join(appDir, 'composables')
  const layoutsDir = join(appDir, 'layouts')
  const typesDir = join(appDir, 'types')
  const assetsDir = join(appDir, 'assets', 'css')
  const storybookDir = join(webDir, '.storybook')

  // Create directories
  mkdirSync(pagesDir, { recursive: true })
  mkdirSync(componentsDir, { recursive: true })
  mkdirSync(blocksComponentsDir, { recursive: true })
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
      storybook: 'storybook dev -p 6006',
      'build-storybook': 'storybook build',
    },
    dependencies: {
      '@nuxt/ui-pro': '^1',
      nuxt: '^4.2.2',
      vue: '^3.5.0',
      'vue-router': '^4.5.0',
    },
    devDependencies: {
      '@chromatic-com/storybook': '^4.1.3',
      '@nuxt/fonts': '^0.11.0',
      '@nuxtjs/storybook': '^9.1.0-29411911.f34c865',
      '@storybook/addon-a11y': '^10.1.10',
      '@storybook/addon-docs': '^10.1.10',
      '@storybook/addon-vitest': '^10.1.10',
      '@types/node': '^22',
      '@vitejs/plugin-vue': '^6.0.3',
      '@vitest/browser-playwright': '^4.0.16',
      '@vitest/coverage-v8': '^4.0.16',
      autoprefixer: '^10.4.23',
      concurrently: '^9.2.1',
      playwright: '^1.57.0',
      storybook: '^10.1.10',
      tailwindcss: '^3.4.19',
      vitest: '^4.0.16',
    },
    overrides: {
      'storybook': '^10.1.10',
      '@storybook/builder-vite': '^10.1.10',
      '@storybook/vue3': '^10.1.10',
      '@storybook/vue3-vite': '^10.1.10',
      '@storybook/csf-plugin': '^10.1.10'
    }
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
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },

  extends: ['@nuxt/ui-pro'],
  modules: ['@nuxt/ui', '@nuxt/fonts'],

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

// Union type for all block types - add more as they are created
export type ContentBlock = HeroBlock | RichTextBlock
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
      'where[showInMenu][equals]': 'true',
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
      'where[slug][equals]': slugValue,
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
  <NuxtLayout>
    <NuxtPage :key="$route.fullPath" />
  </NuxtLayout>
</template>
`
  )

  // app.config.ts
  writeFileSync(
    join(appDir, 'app.config.ts'),
    `export default defineAppConfig({
  ui: {
    primary: 'primary',
    gray: 'gray',
  },
})
`
  )

  // layouts/default.vue
  writeFileSync(
    join(layoutsDir, 'default.vue'),
    `<template>
  <div class="min-h-screen flex flex-col font-sans">
    <TheHeader />
    <main class="flex-1">
      <slot />
    </main>
    <UContainer>
      <UDivider />
      <footer class="py-6 text-center text-neutral-500">
        <p>&copy; {{ new Date().getFullYear() }} ${context.projectName}</p>
      </footer>
    </UContainer>
  </div>
</template>
`
  )

  // components/TheHeader.vue
  writeFileSync(
    join(componentsDir, 'TheHeader.vue'),
    `<script setup lang="ts">
import type { PagesResponse } from '~/types/page'

const apiUrl = usePayloadApiUrl()

const { data: response } = await useFetch<PagesResponse>(\`\${apiUrl}/pages\`, {
  query: {
    'where[showInMenu][equals]': 'true',
    sort: 'menuOrder',
    limit: 100
  },
  key: 'menuPages',
  timeout: 10000,
  retry: 1,
})

const navLinks = computed(() => {
  const pages = response.value?.docs ?? []
  return pages.map((page) => ({
    label: page.title,
    to: \`/\${page.slug}\`,
  }))
})
</script>

<template>
  <UHeader>
    <template #left>
      <NuxtLink to="/" class="text-xl font-bold font-display">
        ${context.projectName}
      </NuxtLink>
    </template>

    <template #right>
      <UHorizontalNavigation :links="navLinks" />
    </template>
  </UHeader>
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

const { data: response } = await useFetch<PagesResponse>(\`\${apiUrl}/pages\`, {
  key: 'page-home',
  query: {
    'where[slug][equals]': 'home',
    limit: 1,
    depth: 2, // Populate relationships like backgroundImage
  },
})

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

// Get slug from route params
const slugParam = route.params.slug
const slug = Array.isArray(slugParam) ? slugParam.join('/') : slugParam || 'home'

const { data: response, error } = await useFetch<PagesResponse>(\`\${apiUrl}/pages\`, {
  key: \`page-\${slug}\`,
  query: {
    'where[slug][equals]': slug,
    limit: 1,
    depth: 2,
  },
})

const page = computed<Page | null>(() => response.value?.docs?.[0] || null)
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

  // tailwind.config.js
  writeFileSync(
    join(webDir, 'tailwind.config.js'),
    `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/components/**/*.{vue,js,ts}',
    './app/layouts/**/*.vue',
    './app/pages/**/*.vue',
    './app/app.vue',
  ],
  // Safelist classes used in dynamic rich text rendering
  safelist: [
    'max-w-[400px]',
    'max-w-[600px]',
    'max-w-[900px]',
    'max-w-full',
    'mr-auto',
    'ml-auto',
    'mx-auto',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Playfair Display', 'Georgia', 'serif'],
      },
      colors: {
        // Primary brand colors
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        // Neutral/gray scale
        gray: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        // Semantic colors
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
        info: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
      },
    },
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
  stories: [
    '../app/components/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],
  addons: [
    '@storybook/addon-a11y',
    '@storybook/addon-docs',
  ],
  framework: '@storybook-vue/nuxt',
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
      default: 'light',
      values: [
        { name: 'light', value: '#ffffff' },
        { name: 'dark', value: '#1a1a1a' },
      ],
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
    command: npm run storybook
    ports:
      - "6006:6006"
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
