/**
 * Cleanup script to delete GitHub repo and Railway project
 * Usage: npx tsx cleanup.ts <project-name>
 */

import { deleteGitHubRepo, getGitHubUsername } from './src/services/github.js'
import { deleteRailwayProject } from './src/services/railway.js'
import { getRailwayToken, getGitHubToken } from './src/services/auth.js'

const RAILWAY_API = 'https://backboard.railway.app/graphql/v2'

interface GraphQLResponse<T> {
  data?: T
  errors?: Array<{ message: string }>
}

async function railwayRequest<T>(
  token: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(RAILWAY_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Railway API error: ${response.status} - ${text}`)
  }

  const result = (await response.json()) as GraphQLResponse<T>

  if (result.errors && result.errors.length > 0) {
    throw new Error(`Railway GraphQL error: ${result.errors[0].message}`)
  }

  if (!result.data) {
    throw new Error('No data in Railway response')
  }

  return result.data
}

async function findRailwayProjectByName(
  token: string,
  projectName: string
): Promise<string | null> {
  const query = `
    query {
      projects {
        edges {
          node {
            id
            name
          }
        }
      }
    }
  `

  const data = await railwayRequest<{
    projects: {
      edges: Array<{ node: { id: string; name: string } }>
    }
  }>(token, query)

  const project = data.projects.edges.find(
    (edge) => edge.node.name === projectName
  )

  return project?.node.id ?? null
}

async function main() {
  const projectName = process.argv[2]

  if (!projectName) {
    console.error('Usage: npx tsx cleanup.ts <project-name>')
    process.exit(1)
  }

  console.log(`\n🧹 Cleaning up project: ${projectName}\n`)

  // Get tokens
  const railwayToken = getRailwayToken()
  const githubToken = getGitHubToken()

  if (!railwayToken) {
    console.error('❌ Railway token not found')
    console.error('   Set RAILWAY_TOKEN env var or run `railway login` first')
    process.exit(1)
  }

  if (!githubToken) {
    console.error('❌ GitHub token not found')
    console.error('   Set GITHUB_TOKEN env var or run `gh auth login` first')
    process.exit(1)
  }

  let railwaySuccess = false
  let githubSuccess = false

  // Delete Railway project
  try {
    console.log('🔍 Finding Railway project...')
    const projectId = await findRailwayProjectByName(railwayToken, projectName)

    if (!projectId) {
      console.log(`⚠️  Railway project "${projectName}" not found (may already be deleted)`)
    } else {
      console.log(`🗑️  Deleting Railway project (ID: ${projectId})...`)
      await deleteRailwayProject(railwayToken, projectId)
      console.log('✅ Railway project deleted')
      railwaySuccess = true
    }
  } catch (error) {
    console.error('❌ Failed to delete Railway project:', error instanceof Error ? error.message : String(error))
  }

  // Delete GitHub repo
  try {
    console.log('🔍 Getting GitHub username...')
    const githubUsername = await getGitHubUsername(githubToken)
    console.log(`🗑️  Deleting GitHub repo ${githubUsername}/${projectName}...`)
    await deleteGitHubRepo(githubToken, githubUsername, projectName)
    console.log('✅ GitHub repo deleted')
    githubSuccess = true
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (errorMessage.includes('Not Found')) {
      console.log(`⚠️  GitHub repo "${projectName}" not found (may already be deleted)`)
    } else {
      console.error('❌ Failed to delete GitHub repo:', errorMessage)
    }
  }

  // Summary
  console.log('\n📊 Cleanup Summary:')
  console.log(`   Railway: ${railwaySuccess ? '✅ Deleted' : '❌ Failed or not found'}`)
  console.log(`   GitHub:  ${githubSuccess ? '✅ Deleted' : '❌ Failed or not found'}`)
  console.log()
}

main().catch((error) => {
  console.error('❌ Cleanup failed:', error)
  process.exit(1)
})
