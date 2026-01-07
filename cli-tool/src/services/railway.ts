import { randomBytes } from 'crypto'
import type { RailwayProject } from '../types/index.js'

const RAILWAY_API = 'https://backboard.railway.app/graphql/v2'

interface GraphQLResponse<T> {
  data?: T
  errors?: Array<{ message: string }>
}

async function railwayRequest<T>(
  token: string,
  query: string,
  variables?: Record<string, unknown>,
  operation?: string
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
    const context = operation ? ` (${operation})` : ''
    throw new Error(`Railway API error${context}: ${response.status} - ${text}`)
  }

  const result = (await response.json()) as GraphQLResponse<T>

  if (result.errors && result.errors.length > 0) {
    const context = operation ? ` (${operation})` : ''
    throw new Error(`Railway GraphQL error${context}: ${result.errors[0].message}`)
  }

  if (!result.data) {
    const context = operation ? ` (${operation})` : ''
    throw new Error(`No data in Railway response${context}`)
  }

  return result.data
}

/**
 * Check if the user has GitHub connected to Railway
 * We do this by checking if we can query GitHub repos from Railway
 */
export async function checkGitHubIntegration(token: string): Promise<boolean> {
  const query = `
    query {
      me {
        isVerified
      }
      gitHubRepos {
        fullName
      }
    }
  `

  try {
    const data = await railwayRequest<{
      me: { isVerified: boolean }
      gitHubRepos: Array<{ fullName: string }>
    }>(token, query, undefined, 'check GitHub integration')

    // If we can query GitHub repos, GitHub is connected
    // The query will fail or return empty if not connected
    return Array.isArray(data.gitHubRepos)
  } catch {
    return false
  }
}

/**
 * Get the user's default workspace ID from the API token
 * Note: This only works with Railway API tokens, not user session tokens
 */
async function getDefaultWorkspaceId(token: string): Promise<string> {
  const query = `
    query {
      apiToken {
        workspaces {
          id
          name
        }
      }
    }
  `

  try {
    const data = await railwayRequest<{
      apiToken: {
        workspaces: Array<{ id: string; name: string }>
      }
    }>(token, query, undefined, 'get workspace ID')

    const workspaces = data.apiToken.workspaces

    if (workspaces.length > 0) {
      return workspaces[0].id
    }

    throw new Error('No Railway workspace found. Please create a workspace at railway.app first.')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    // If "Not Authorized", it means this is a user session token, not an API token
    if (message.includes('Not Authorized')) {
      throw new Error(
        'Your Railway account requires a workspace ID, but you are using a user session token. ' +
        'Please create an API token at https://railway.app/account/tokens and set it as ' +
        'RAILWAY_TOKEN environment variable, then try again.'
      )
    }

    throw error
  }
}

export async function createRailwayProject(
  token: string,
  projectName: string
): Promise<{ projectId: string; environmentId: string }> {
  // Try creating project without workspaceId first (for personal workspaces)
  const queryWithoutWorkspace = `
    mutation CreateProject($name: String!) {
      projectCreate(input: { name: $name }) {
        id
        environments {
          edges {
            node {
              id
              name
            }
          }
        }
      }
    }
  `

  try {
    const data = await railwayRequest<{
      projectCreate: {
        id: string
        environments: {
          edges: Array<{ node: { id: string; name: string } }>
        }
      }
    }>(token, queryWithoutWorkspace, { name: projectName }, 'create project (no workspace)')

    const project = data.projectCreate
    const prodEnv = project.environments.edges.find(
      (e) => e.node.name === 'production'
    )

    return {
      projectId: project.id,
      environmentId: prodEnv?.node.id || project.environments.edges[0].node.id,
    }
  } catch (error) {
    // If it fails with "must specify workspaceId", try again with workspaceId
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (!errorMessage.includes('must specify a workspaceId')) {
      throw error
    }

    // Get workspace ID and retry
    const workspaceId = await getDefaultWorkspaceId(token)

    const queryWithWorkspace = `
      mutation CreateProject($name: String!, $workspaceId: String!) {
        projectCreate(input: { name: $name, workspaceId: $workspaceId }) {
          id
          environments {
            edges {
              node {
                id
                name
              }
            }
          }
        }
      }
    `

    const data = await railwayRequest<{
      projectCreate: {
        id: string
        environments: {
          edges: Array<{ node: { id: string; name: string } }>
        }
      }
    }>(token, queryWithWorkspace, { name: projectName, workspaceId }, 'create project (with workspace)')

    const project = data.projectCreate
    const prodEnv = project.environments.edges.find(
      (e) => e.node.name === 'production'
    )

    return {
      projectId: project.id,
      environmentId: prodEnv?.node.id || project.environments.edges[0].node.id,
    }
  }
}

export async function provisionPostgres(
  token: string,
  projectId: string,
  environmentId: string
): Promise<string> {
  // Create a PostgreSQL service using the database template
  const createQuery = `
    mutation CreatePostgres($projectId: String!) {
      serviceCreate(input: {
        projectId: $projectId
        name: "Postgres"
        source: {
          image: "postgres:16-alpine"
        }
      }) {
        id
      }
    }
  `

  const createResult = await railwayRequest<{
    serviceCreate: { id: string }
  }>(token, createQuery, { projectId }, 'create Postgres service')

  const serviceId = createResult.serviceCreate.id

  // Add a volume for persistent storage
  const volumeQuery = `
    mutation AddVolume($projectId: String!, $serviceId: String!, $environmentId: String!) {
      volumeCreate(input: {
        projectId: $projectId
        serviceId: $serviceId
        environmentId: $environmentId
        mountPath: "/var/lib/postgresql/data"
      }) {
        id
      }
    }
  `

  await railwayRequest(token, volumeQuery, { projectId, serviceId, environmentId }, 'add Postgres volume')

  // Set PostgreSQL environment variables
  const varsQuery = `
    mutation SetPostgresVars($projectId: String!, $environmentId: String!, $serviceId: String!, $variables: EnvironmentVariables!) {
      variableCollectionUpsert(input: {
        projectId: $projectId
        environmentId: $environmentId
        serviceId: $serviceId
        variables: $variables
      })
    }
  `

  const pgPassword = randomBytes(16).toString('hex')
  await railwayRequest(token, varsQuery, {
    projectId,
    environmentId,
    serviceId,
    variables: {
      POSTGRES_USER: 'payload',
      POSTGRES_PASSWORD: pgPassword,
      POSTGRES_DB: 'payload',
      PGDATA: '/var/lib/postgresql/data/pgdata',
    },
  }, 'set Postgres variables')

  // Deploy the postgres service
  await deployService(token, environmentId, serviceId)

  // Wait for the service to be ready and construct the database URL
  // The internal hostname in Railway is the service name
  let attempts = 0
  const maxAttempts = 60

  while (attempts < maxAttempts) {
    try {
      // Check if the service is deployed by querying its status
      const statusQuery = `
        query ServiceStatus($serviceId: String!) {
          service(id: $serviceId) {
            deployments(first: 1) {
              edges {
                node {
                  status
                }
              }
            }
          }
        }
      `

      const statusData = await railwayRequest<{
        service: {
          deployments: {
            edges: Array<{ node: { status: string } }>
          }
        }
      }>(token, statusQuery, { serviceId }, 'check Postgres deployment status')

      const deployment = statusData.service.deployments.edges[0]
      if (deployment && deployment.node.status === 'SUCCESS') {
        // Construct the internal database URL
        // Railway internal DNS: servicename.railway.internal
        return `postgresql://payload:${pgPassword}@Postgres.railway.internal:5432/payload`
      }
    } catch {
      // Ignore errors during polling
    }

    await new Promise((resolve) => setTimeout(resolve, 3000))
    attempts++
  }

  // Return the URL even if we couldn't confirm deployment
  // The service might still be starting up
  return `postgresql://payload:${pgPassword}@Postgres.railway.internal:5432/payload`
}

/**
 * Create an empty Railway service (without connecting GitHub yet)
 */
export async function createService(
  token: string,
  projectId: string,
  serviceName: string
): Promise<string> {
  const createQuery = `
    mutation CreateService($projectId: String!, $name: String!) {
      serviceCreate(input: {
        projectId: $projectId
        name: $name
      }) {
        id
      }
    }
  `

  const createResult = await railwayRequest<{
    serviceCreate: { id: string }
  }>(token, createQuery, {
    projectId,
    name: serviceName,
  }, 'create main service')

  return createResult.serviceCreate.id
}

/**
 * Connect a GitHub repository to an existing Railway service
 * Note: This will trigger an automatic build, so ensure root directory
 * is set BEFORE calling this function
 */
export async function connectServiceToGitHub(
  token: string,
  serviceId: string,
  githubRepoFullName: string, // format: "owner/repo"
  branch: string = 'main'
): Promise<void> {
  const connectQuery = `
    mutation ConnectRepo($serviceId: String!, $repo: String!, $branch: String!) {
      serviceConnect(
        id: $serviceId
        input: {
          repo: $repo
          branch: $branch
        }
      ) {
        id
      }
    }
  `

  try {
    await railwayRequest(token, connectQuery, {
      serviceId,
      repo: githubRepoFullName,
      branch,
    }, 'connect GitHub repo')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    // Re-throw with full context for debugging
    throw new Error(
      `Failed to connect GitHub repo "${githubRepoFullName}" to Railway: ${message}`
    )
  }
}

export async function setServiceRootDirectory(
  token: string,
  environmentId: string,
  serviceId: string,
  rootDirectory: string
): Promise<void> {
  const query = `
    mutation SetRootDirectory($environmentId: String, $serviceId: String!, $rootDirectory: String!) {
      serviceInstanceUpdate(
        environmentId: $environmentId
        serviceId: $serviceId
        input: {
          rootDirectory: $rootDirectory
        }
      )
    }
  `

  await railwayRequest(token, query, {
    environmentId,
    serviceId,
    rootDirectory,
  }, 'set service root directory')
}

export async function setServiceVariables(
  token: string,
  projectId: string,
  environmentId: string,
  serviceId: string,
  variables: Record<string, string>
): Promise<void> {
  const query = `
    mutation SetVariables($projectId: String!, $environmentId: String!, $serviceId: String!, $variables: EnvironmentVariables!) {
      variableCollectionUpsert(input: {
        projectId: $projectId
        environmentId: $environmentId
        serviceId: $serviceId
        variables: $variables
      })
    }
  `

  await railwayRequest(token, query, {
    projectId,
    environmentId,
    serviceId,
    variables,
  }, 'set service variables')
}

export async function getServiceDomain(
  token: string,
  environmentId: string,
  serviceId: string
): Promise<string> {
  // Generate a Railway domain for the service
  const query = `
    mutation CreateDomain($environmentId: String!, $serviceId: String!) {
      serviceDomainCreate(input: {
        serviceId: $serviceId
        environmentId: $environmentId
      }) {
        domain
      }
    }
  `

  const data = await railwayRequest<{
    serviceDomainCreate: { domain: string }
  }>(token, query, { environmentId, serviceId }, 'create service domain')

  return `https://${data.serviceDomainCreate.domain}`
}

export async function deployService(
  token: string,
  environmentId: string,
  serviceId: string
): Promise<void> {
  const query = `
    mutation Deploy($environmentId: String!, $serviceId: String!) {
      serviceInstanceDeploy(
        environmentId: $environmentId
        serviceId: $serviceId
      )
    }
  `

  await railwayRequest(token, query, { environmentId, serviceId }, 'deploy service')
}

export function generatePayloadSecret(): string {
  return randomBytes(32).toString('hex')
}

export async function provisionRailwayInfrastructure(
  token: string,
  projectName: string,
  adminEmail: string,
  adminPassword: string,
  githubRepo: string
): Promise<RailwayProject> {
  // 1. Create project
  const { projectId, environmentId } = await createRailwayProject(
    token,
    projectName
  )

  // 2. Provision PostgreSQL
  const databaseUrl = await provisionPostgres(token, projectId, environmentId)

  // 3. Create Payload service (empty, no GitHub connection yet)
  const serviceId = await createService(token, projectId, 'payload')

  // 4. Set root directory BEFORE connecting GitHub (prevents build failure)
  await setServiceRootDirectory(token, environmentId, serviceId, 'payload')

  // 5. Connect GitHub repo (this will trigger a build, but root dir is now set)
  await connectServiceToGitHub(token, serviceId, githubRepo)

  // 6. Generate secrets
  const payloadSecret = generatePayloadSecret()

  // 7. Get service domain
  const serviceUrl = await getServiceDomain(token, environmentId, serviceId)

  // 8. Set environment variables
  await setServiceVariables(token, projectId, environmentId, serviceId, {
    DATABASE_URL: databaseUrl,
    PAYLOAD_SECRET: payloadSecret,
    PAYLOAD_PUBLIC_SERVER_URL: serviceUrl,
    PAYLOAD_ADMIN_EMAIL: adminEmail,
    PAYLOAD_ADMIN_PASSWORD: adminPassword,
    GITHUB_REPO: githubRepo,
  })

  // 9. Trigger deployment
  await deployService(token, environmentId, serviceId)

  return {
    id: projectId,
    name: projectName,
    url: serviceUrl,
    databaseUrl,
  }
}

export async function deleteRailwayProject(
  token: string,
  projectId: string
): Promise<void> {
  const query = `
    mutation DeleteProject($projectId: String!) {
      projectDelete(id: $projectId)
    }
  `

  await railwayRequest(token, query, { projectId }, 'delete project')
}
