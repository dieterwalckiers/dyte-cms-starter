<template>
  <div class="min-h-screen flex flex-col">
    <TheHeader />
    <main class="flex-1 container mx-auto px-4 py-8">
      <slot />
    </main>
    <footer class="bg-gray-100 py-4 text-center text-gray-600">
      <p>&copy; {{ new Date().getFullYear() }} testdytecmsstarter</p>
    </footer>
  </div>
</template>
