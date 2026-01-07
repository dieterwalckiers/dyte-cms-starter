import type { Page, PagesResponse } from '~/types/page'

export function usePages() {
  const config = useRuntimeConfig()
  return useFetch<PagesResponse>(`${config.public.payloadApiUrl}/pages`, {
    query: { limit: 100 },
    key: 'pages',
    timeout: 10000,
    retry: 1,
    transform: (data) => data.docs
  })
}

export function useMenuPages() {
  const config = useRuntimeConfig()
  return useFetch<PagesResponse>(`${config.public.payloadApiUrl}/pages`, {
    query: {
      'where[showInMenu][equals]': 'true',
      sort: 'menuOrder',
      limit: 100
    },
    key: 'menuPages',
    timeout: 10000,
    retry: 1,
    transform: (data) => data.docs
  })
}

export function usePage(slug: MaybeRefOrGetter<string>) {
  const config = useRuntimeConfig()
  const slugValue = toValue(slug)

  return useFetch<PagesResponse>(`${config.public.payloadApiUrl}/pages`, {
    query: {
      'where[slug][equals]': slugValue,
      limit: 1
    },
    key: `page-${slugValue}`,
    timeout: 10000,
    retry: 1,
    transform: (data) => {
      if (data.docs.length === 0) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Page not found'
        })
      }
      return data.docs[0]
    }
  })
}
