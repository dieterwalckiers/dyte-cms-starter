import { z } from 'zod'

// Auth status for each provider
export interface AuthStatus {
  railway: { authenticated: boolean; user?: string }
  github: { authenticated: boolean; user?: string }
  claude: { authenticated: boolean }
}

// User input from questionnaire
export interface ProjectConfig {
  projectName: string
  projectSlug: string
  adminEmail: string
  adminPassword: string
  collectionDescription: string
  ftpHost: string
  ftpUsername: string
  ftpPassword: string
  ftpPath: string
  websiteUrl: string
  websitePath: string // Path portion of the URL (e.g., "/blog" from "https://example.com/blog")
}

// LLM-generated collection field
export const CollectionFieldSchema = z.object({
  name: z.string(),
  type: z.enum([
    'text',
    'textarea',
    'richText',
    'number',
    'date',
    'checkbox',
    'select',
    'upload',
    'relationship',
  ]),
  required: z.boolean().optional(),
  unique: z.boolean().optional(),
  relationTo: z.string().optional(),
  hasMany: z.boolean().optional(),
  options: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
      })
    )
    .optional(),
  admin: z
    .object({
      description: z.string().optional(),
    })
    .optional(),
})

export type CollectionField = z.infer<typeof CollectionFieldSchema>

// LLM-generated collection
export const GeneratedCollectionSchema = z.object({
  name: z.string(),
  slug: z.string(),
  fields: z.array(CollectionFieldSchema),
  admin: z
    .object({
      useAsTitle: z.string().optional(),
    })
    .optional(),
})

export type GeneratedCollection = z.infer<typeof GeneratedCollectionSchema>

// Full LLM response
export const LLMResponseSchema = z.object({
  collections: z.array(GeneratedCollectionSchema),
})

export type LLMResponse = z.infer<typeof LLMResponseSchema>

// Template context for rendering
export interface TemplateContext {
  projectName: string
  projectSlug: string
  adminEmail: string
  railwayUrl: string
  githubRepo: string
  collections: GeneratedCollection[]
  payloadSecret: string
  websitePath: string // Path portion of the website URL for base path configuration
}

// Railway provisioning result
export interface RailwayProject {
  id: string
  name: string
  url: string
  databaseUrl: string
}

// GitHub result
export interface GitHubRepo {
  owner: string
  repo: string
  url: string
  cloneUrl: string
}

// CLI state machine
export type CLIStep =
  | 'auth-check'
  | 'mode-selection'
  | 'delete-project'
  | 'data-management'
  | 'questionnaire'
  | 'collection-generation'
  | 'collection-preview'
  | 'ftp-config'
  | 'provisioning'
  | 'github-railway-setup'
  | 'complete'
  | 'error'

// Provisioning step status
export interface ProvisioningStep {
  label: string
  status: 'pending' | 'in_progress' | 'complete' | 'error'
  error?: string
  details?: string[] // Live output lines (e.g., last 5 lines of pnpm install)
}

// Credentials stored in config
export interface StoredCredentials {
  claudeApiKey?: string
  railwayToken?: string
  githubToken?: string
}

// Config file structure
export interface AppConfig {
  lastUsedEmail?: string
}

// Content blocks for seeding (matches Payload block types)
export interface HeroBlockData {
  blockType: 'hero'
  headline: string
  subheadline?: string
  backgroundImage?: string // Placeholder URL for seeding
  alignment?: 'left' | 'center' | 'right'
  links?: Array<{
    label: string
    url: string
    variant?: 'solid' | 'outline' | 'ghost'
  }>
}

export interface RichTextBlockData {
  blockType: 'richText'
  content: object // Lexical JSON structure
}

export type SeedContentBlock = HeroBlockData | RichTextBlockData

// Seed page structure
export interface SeedPage {
  title: string
  slug: string
  showInMenu: boolean
  menuOrder: number
  content: SeedContentBlock[]
}

// Complete seed set
export interface SeedSet {
  id: string
  name: string
  description: string
  requiredBlocks: string[] // e.g., ['hero', 'richText']
  pages: SeedPage[]
}

// Data management config
export interface DataManagementConfig {
  projectName: string
  environment: 'railway' | 'local'
  payloadUrl: string
  adminEmail: string
  adminPassword: string
}
