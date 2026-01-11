<script setup lang="ts">
import type { HeroBlock as HeroBlockType } from '~/types/blocks'

const props = defineProps<{
  block: HeroBlockType
}>()

const alignmentClass = computed(() => {
  switch (props.block.alignment) {
    case 'left':
      return 'left'
    case 'right':
      return 'right'
    default:
      return 'center'
  }
})

const links = computed(() => {
  if (!props.block.links) return []
  return props.block.links.map((link) => ({
    label: link.label,
    to: link.url,
    variant: link.variant || 'solid',
    size: 'lg' as const,
  }))
})

const backgroundImageUrl = computed(() => {
  if (!props.block.backgroundImage) return undefined
  if (typeof props.block.backgroundImage === 'string') return undefined
  return useMediaUrl(props.block.backgroundImage.url)
})
</script>

<template>
  <div class="relative">
    <div
      v-if="backgroundImageUrl"
      class="absolute inset-0 z-0"
    >
      <img
        :src="backgroundImageUrl"
        :alt="block.headline"
        class="w-full h-full object-cover"
      />
      <div class="absolute inset-0 bg-black/50" />
    </div>
    <UPageHero
      :title="block.headline"
      :description="block.subheadline"
      :links="links"
      :align="alignmentClass"
      :ui="backgroundImageUrl ? { title: 'text-white', description: 'text-white/80' } : {}"
      :class="backgroundImageUrl ? 'relative z-10' : ''"
    />
  </div>
</template>
