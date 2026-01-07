<script setup lang="ts">
defineProps<{
  content: unknown
}>()

function renderNode(node: Record<string, unknown>): string {
  if (!node || typeof node !== 'object') return ''

  const type = node.type as string | undefined
  const children = node.children as Record<string, unknown>[] | undefined
  const text = node.text as string | undefined

  if (text !== undefined) {
    let result = text
    if (node.bold) result = `<strong>${result}</strong>`
    if (node.italic) result = `<em>${result}</em>`
    if (node.underline) result = `<u>${result}</u>`
    return result
  }

  const childrenHtml = children?.map(renderNode).join('') || ''

  switch (type) {
    case 'paragraph':
      return `<p class="mb-4">${childrenHtml}</p>`
    case 'heading':
      const tag = `h${(node.tag as string)?.replace('h', '') || '2'}`
      return `<${tag} class="font-bold mb-4">${childrenHtml}</${tag}>`
    case 'list':
      const listTag = node.listType === 'number' ? 'ol' : 'ul'
      return `<${listTag} class="list-disc list-inside mb-4">${childrenHtml}</${listTag}>`
    case 'listitem':
      return `<li>${childrenHtml}</li>`
    case 'link':
      return `<a href="${node.url || '#'}" class="text-blue-600 hover:underline">${childrenHtml}</a>`
    default:
      return childrenHtml
  }
}

function renderContent(content: unknown): string {
  if (!content || typeof content !== 'object') return ''
  const root = content as { root?: { children?: Record<string, unknown>[] } }
  if (!root.root?.children) return ''
  return root.root.children.map(renderNode).join('')
}
</script>

<template>
  <div class="prose max-w-none" v-html="renderContent(content)" />
</template>
