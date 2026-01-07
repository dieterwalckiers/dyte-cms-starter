import { exec } from 'child_process'
import { platform } from 'os'

/**
 * Opens a URL in the user's default browser
 */
export function openBrowser(url: string): Promise<void> {
  return new Promise((resolve) => {
    const os = platform()
    let command: string

    switch (os) {
      case 'darwin':
        command = `open "${url}"`
        break
      case 'win32':
        command = `start "" "${url}"`
        break
      default:
        // Linux and others
        command = `xdg-open "${url}"`
        break
    }

    exec(command, (error) => {
      if (error) {
        // Don't fail if browser can't be opened - user can manually navigate
        console.error(`Could not open browser: ${error.message}`)
        resolve()
      } else {
        resolve()
      }
    })
  })
}
