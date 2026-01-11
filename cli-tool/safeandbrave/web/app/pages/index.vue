<script setup lang="ts">
import type { Page, PagesResponse } from '~/types/page'

const apiUrl = usePayloadApiUrl()

const { data: response } = await useFetch<PagesResponse>(`${apiUrl}/pages`, {
  key: 'page-home',
  query: {
    'where[slug][equals]': 'home',
    limit: 1,
    depth: 2, // Populate relationships like backgroundImage
  },
})

const page = computed<Page | null>(() => response.value?.docs?.[0] || null)
</script>

<template>
  <UContainer>
    <!-- Default welcome when no home page exists -->
    <UPageHero
      v-if="!page"
      title="Welcome to safeandbrave"
      description="Your CMS-powered website is ready. Create a page with slug 'home' to customize this."
      align="center"
      :links="[{ label: 'Open CMS', to: 'http://localhost:3202/admin', variant: 'solid', size: 'lg' }]"
    />

    <!-- Render page content -->
    <article v-else>
      <BlocksBlockRenderer v-if="page.content?.length" :blocks="page.content" />

      <!-- Empty state -->
      <div v-else class="py-12 text-center text-neutral-500">
        <h1 class="text-4xl font-bold mb-6">{{ page.title }}</h1>
        <p>No content yet. Add blocks in the CMS.</p>
      </div>
    </article>
  </UContainer>
</template>
