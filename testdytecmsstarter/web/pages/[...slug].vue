<script setup lang="ts">
const route = useRoute()
const config = useRuntimeConfig()

// slug is an array for catch-all routes, join with '/' for nested slugs
const slugParam = route.params.slug
const slug = Array.isArray(slugParam) ? slugParam.join('/') : slugParam || 'home'

// Fetch data at build time for SSG with aggressive timeout and retry limits
const { data: response, error } = await useFetch(`${config.public.payloadApiUrl}/pages`, {
  query: {
    'where[slug][equals]': slug,
    limit: 1
  },
  timeout: 10000,
  retry: 1,
  onResponseError: () => {
    // Fail silently - will show 404
  }
})

const page = computed(() => response.value?.docs?.[0] || null)

// Handle 404 if page not found
if (!page.value && !error.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Page Not Found'
  })
}
</script>

<template>
  <div>
    <article v-if="page">
      <h1 class="text-4xl font-bold mb-6">{{ page.title }}</h1>
      <RichTextRenderer :content="page.body" />
    </article>
  </div>
</template>
