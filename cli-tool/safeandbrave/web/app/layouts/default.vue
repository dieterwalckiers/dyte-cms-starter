<template>
  <div class="min-h-screen flex flex-col font-sans">
    <TheHeader />
    <main class="flex-1">
      <slot />
    </main>
    <UContainer>
      <UDivider />
      <footer class="py-6 text-center text-neutral-500">
        <p>&copy; {{ new Date().getFullYear() }} safeandbrave</p>
      </footer>
    </UContainer>
  </div>
</template>
