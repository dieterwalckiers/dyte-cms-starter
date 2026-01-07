<script setup lang="ts">
const config = useRuntimeConfig()

// Fetch data at build time for SSG with aggressive timeout and retry limits
const { data: response, error } = await useFetch(`${config.public.payloadApiUrl}/pages`, {
  query: {
    'where[slug][equals]': 'home',
    limit: 1
  },
  timeout: 10000,
  retry: 1,
  onResponseError: () => {
    // Fail silently and show fallback
  }
})

const page = computed(() => response.value?.docs?.[0] || null)
</script>

<template>
  <div>
    <div v-if="!page" class="text-center py-12">
      <h1 class="text-4xl font-bold mb-4">Welcome to testdytecmsstarter</h1>
      <p class="text-gray-600">Your CMS-powered website is ready.</p>
    </div>
    <article v-else>
      <h1 class="text-4xl font-bold mb-6">{{ page.title }}</h1>
      <RichTextRenderer :content="page.body" />
    </article>
  </div>
</template>
