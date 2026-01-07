export interface Page {
  id: string
  title: string
  slug: string
  showInMenu: boolean
  menuOrder?: number
  body: unknown // Rich text content
  createdAt: string
  updatedAt: string
}

export interface PagesResponse {
  docs: Page[]
  totalDocs: number
  limit: number
  totalPages: number
  page: number
  pagingCounter: number
  hasPrevPage: boolean
  hasNextPage: boolean
  prevPage: number | null
  nextPage: number | null
}
