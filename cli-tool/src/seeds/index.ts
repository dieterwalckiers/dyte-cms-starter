/**
 * Seed Sets Registry
 * Exports all available content seed sets for data management
 */

import type { SeedSet } from '../types/index.js'
import { companyStarter } from './company-starter.js'
import { artistStarter } from './artist-starter.js'

// Registry of all available seed sets
export const seedSets: SeedSet[] = [
  companyStarter,
  artistStarter,
]

// Get a seed set by ID
export function getSeedSetById(id: string): SeedSet | undefined {
  return seedSets.find(set => set.id === id)
}

// Export individual seed sets
export { companyStarter, artistStarter }
