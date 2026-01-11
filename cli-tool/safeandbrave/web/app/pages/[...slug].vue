<script setup lang="ts">
import type { Page, PagesResponse } from '~/types/page'

const route = useRoute()
const apiUrl = usePayloadApiUrl()

// Get slug from route params
const slugParam = route.params.slug
const slug = Array.isArray(slugParam) ? slugParam.join('/') : slugParam || 'home'

const { data: response, error } = await useFetch<PagesResponse>(`${apiUrl}/pages`, {
  key: `page-${slug}`,
  query: {
    'where[slug][equals]': slug,
    limit: 1,
    depth: 2,
  },
})

const page = computed<Page | null>(() => response.value?.docs?.[0] || null)
</script>

<template>
  <UContainer>
    <article v-if="page">
      <BlocksBlockRenderer v-if="page.content?.length" :blocks="page.content" />

      <!-- Empty state -->
      <div v-else class="py-12 text-center text-neutral-500">
        <h1 class="text-4xl font-bold mb-6">{{ page.title }}</h1>
        <p>No content yet. Add blocks in the CMS.</p>
      </div>
    </article>
  </UContainer>
</template>
