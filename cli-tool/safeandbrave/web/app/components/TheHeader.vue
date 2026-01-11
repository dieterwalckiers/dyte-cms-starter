<script setup lang="ts">
import type { PagesResponse } from '~/types/page'

const apiUrl = usePayloadApiUrl()

const { data: response } = await useFetch<PagesResponse>(`${apiUrl}/pages`, {
  query: {
    'where[showInMenu][equals]': 'true',
    sort: 'menuOrder',
    limit: 100
  },
  key: 'menuPages',
  timeout: 10000,
  retry: 1,
})

const navLinks = computed(() => {
  const pages = response.value?.docs ?? []
  return pages.map((page) => ({
    label: page.title,
    to: `/${page.slug}`,
  }))
})
</script>

<template>
  <UHeader>
    <template #left>
      <NuxtLink to="/" class="text-xl font-bold font-display">
        safeandbrave
      </NuxtLink>
    </template>

    <template #right>
      <UHorizontalNavigation :links="navLinks" />
    </template>
  </UHeader>
</template>
