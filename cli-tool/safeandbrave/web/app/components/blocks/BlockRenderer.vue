<script setup lang="ts">
import type { ContentBlock } from '~/types/blocks'

defineProps<{
  blocks: ContentBlock[]
}>()
</script>

<template>
  <div class="blocks-container space-y-8">
    <template v-for="block in blocks" :key="block.id">
      <BlocksHeroBlock v-if="block.blockType === 'hero'" :block="block" />
      <BlocksRichTextBlock v-else-if="block.blockType === 'richText'" :block="block" />
    </template>
  </div>
</template>
