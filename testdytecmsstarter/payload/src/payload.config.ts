import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor, UploadFeature } from '@payloadcms/richtext-lexical'
import sharp from 'sharp'

import { Pages } from './collections/Pages'
import { Media } from './collections/Media'
import { Users } from './collections/Users'

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
  collections: [Pages, Media, Users],
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
        console.log(`✅ Admin user created: ${adminEmail}`)
      } else {
        console.log('ℹ️  Admin user already exists. Skipping creation.')
      }
    } catch (error) {
      console.error('❌ Error creating admin user:', error)
    }
  },
})
