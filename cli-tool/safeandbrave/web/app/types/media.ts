export interface Media {
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
