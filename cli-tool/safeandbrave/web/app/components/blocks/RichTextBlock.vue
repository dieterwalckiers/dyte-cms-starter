<script setup lang="ts">
import type { RichTextBlock as RichTextBlockType } from '~/types/blocks'

defineProps<{
  block: RichTextBlockType
}>()
</script>

<template>
  <div class="prose prose-lg max-w-none">
    <RichTextRenderer :content="block.content" />
  </div>
</template>
