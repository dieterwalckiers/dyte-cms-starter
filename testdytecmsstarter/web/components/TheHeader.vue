<script setup lang="ts">
const { data: menuPages } = await useMenuPages()
</script>

<template>
  <header class="bg-white shadow">
    <nav class="container mx-auto px-4 py-4">
      <div class="flex items-center justify-between">
        <NuxtLink to="/" class="text-xl font-bold text-gray-800">
          testdytecmsstarter
        </NuxtLink>
        <ul class="flex space-x-6">
          <li v-for="page in menuPages" :key="page.id">
            <NuxtLink
              :to="`/${page.slug}`"
              class="text-gray-600 hover:text-gray-800 transition-colors"
            >
              {{ page.title }}
            </NuxtLink>
          </li>
        </ul>
      </div>
    </nav>
  </header>
</template>
