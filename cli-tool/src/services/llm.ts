import Anthropic from '@anthropic-ai/sdk'
import { LLMResponseSchema, type GeneratedCollection } from '../types/index.js'

const COLLECTION_PROMPT = `You are a Payload CMS expert. Given a natural language description of a data model, generate Payload collection configurations.

User description:
"{description}"

Respond with a JSON object containing an array of collections. Each collection should have:
- name (PascalCase, e.g., "BlogPosts")
- slug (kebab-case, e.g., "blog-posts")
- fields (array of Payload field configurations)
- admin (optional object with useAsTitle pointing to the title field)

For each field, include:
- name (camelCase)
- type (one of: text, textarea, richText, number, date, checkbox, select, upload, relationship)
- required (boolean, optional)
- unique (boolean, optional)
- relationTo (string, for relationship fields - use the slug of the related collection)
- hasMany (boolean, for relationship fields)
- options (array of {label, value} for select fields)
- admin (optional object with description)

Field type guidelines:
- Use "text" for short strings (titles, names, slugs)
- Use "textarea" for longer text without formatting
- Use "richText" for formatted content (body text, descriptions)
- Use "number" for numeric values
- Use "date" for dates and timestamps
- Use "checkbox" for boolean flags
- Use "select" for enumerated values
- Use "upload" for images/files (relationTo should be "media")
- Use "relationship" for references to other collections

For slugs, include both the slug field definition AND set unique: true.
For title fields, set admin.useAsTitle to that field name.

Respond ONLY with valid JSON, no markdown formatting or explanation.

Example response format:
{
  "collections": [
    {
      "name": "Posts",
      "slug": "posts",
      "admin": { "useAsTitle": "title" },
      "fields": [
        { "name": "title", "type": "text", "required": true },
        { "name": "slug", "type": "text", "required": true, "unique": true },
        { "name": "body", "type": "richText" },
        { "name": "author", "type": "relationship", "relationTo": "authors" }
      ]
    }
  ]
}`

const REFINEMENT_PROMPT = `You are a Payload CMS expert. The user provided a data model description, and you previously generated collection configurations. The user has requested changes.

Original description:
"{description}"

Previous generation:
{previousCollections}

User feedback:
"{feedback}"

Please regenerate the collections incorporating the user's feedback. Keep everything that was correct and only modify what the user requested.

Respond ONLY with valid JSON, no markdown formatting or explanation.

The response format should be:
{
  "collections": [...]
}`

interface GenerateOptions {
  description: string
  apiKey: string
  feedback?: string
  previousCollections?: GeneratedCollection[]
}

export async function generateCollections(
  options: GenerateOptions
): Promise<GeneratedCollection[]> {
  const { description, apiKey, feedback, previousCollections } = options

  const client = new Anthropic({
    apiKey,
  })

  let prompt: string

  if (feedback && previousCollections && previousCollections.length > 0) {
    // Refinement mode - use feedback to improve previous generation
    prompt = REFINEMENT_PROMPT
      .replace('{description}', description)
      .replace('{previousCollections}', JSON.stringify({ collections: previousCollections }, null, 2))
      .replace('{feedback}', feedback)
  } else {
    // Initial generation
    prompt = COLLECTION_PROMPT.replace('{description}', description)
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  // Extract text content
  const textContent = response.content.find((block) => block.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  // Parse JSON response
  let jsonStr = textContent.text.trim()

  // Remove markdown code blocks if present
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    throw new Error(`Failed to parse LLM response as JSON: ${jsonStr}`)
  }

  // Validate against schema
  const result = LLMResponseSchema.safeParse(parsed)
  if (!result.success) {
    throw new Error(
      `Invalid collection schema: ${result.error.issues.map((i) => i.message).join(', ')}`
    )
  }

  return result.data.collections
}
