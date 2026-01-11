import type { Media } from './media'

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
