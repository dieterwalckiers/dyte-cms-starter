/**
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
    const response = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `Bearer ${token}`,
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
      console.log(`[Deploy Hook] Triggered deploy for ${collectionSlug} change`)
    } else {
      const text = await response.text()
      console.error(`[Deploy Hook] Failed to trigger deploy: ${response.status} ${text}`)
    }
  } catch (error) {
    console.error('[Deploy Hook] Error triggering deploy:', error)
  }
}
