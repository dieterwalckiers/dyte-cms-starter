<script setup lang="ts">
import type { Media } from '~/types/media'

defineProps<{
  content: unknown
}>()

// Get the base URL for media - needs to be called at setup time
const payloadBaseUrl = usePayloadBaseUrl()

// Escape HTML entities to prevent XSS
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function getMediaUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `${payloadBaseUrl}${url}`
}

// Lexical format bitmask values
const IS_BOLD = 1
const IS_ITALIC = 2
const IS_STRIKETHROUGH = 4
const IS_UNDERLINE = 8
const IS_CODE = 16
const IS_SUBSCRIPT = 32
const IS_SUPERSCRIPT = 64

interface LexicalNode {
  type?: string
  tag?: string
  format?: number | string
  indent?: number
  direction?: string
  version?: number
  text?: string
  children?: LexicalNode[]
  listType?: 'bullet' | 'number' | 'check'
  checked?: boolean
  url?: string
  newTab?: boolean
  rel?: string
  fields?: Record<string, unknown>
  // For upload nodes - value can be list value (number) or media object
  value?: number | Media | string | null
  relationTo?: string
}

function renderNode(node: LexicalNode): string {
  if (!node || typeof node !== 'object') return ''

  const type = node.type
  const children = node.children
  const text = node.text

  // Handle text nodes
  if (text !== undefined) {
    let result = escapeHtml(text)
    const format = typeof node.format === 'number' ? node.format : 0

    if (format & IS_BOLD) result = `<strong>${result}</strong>`
    if (format & IS_ITALIC) result = `<em>${result}</em>`
    if (format & IS_UNDERLINE) result = `<u>${result}</u>`
    if (format & IS_STRIKETHROUGH) result = `<s>${result}</s>`
    if (format & IS_CODE) result = `<code class="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono">${result}</code>`
    if (format & IS_SUBSCRIPT) result = `<sub>${result}</sub>`
    if (format & IS_SUPERSCRIPT) result = `<sup>${result}</sup>`
    return result
  }

  // Recursively render children
  const childrenHtml = children?.map(renderNode).join('') || ''

  switch (type) {
    case 'root':
      return childrenHtml

    case 'paragraph': {
      if (!childrenHtml.trim()) return '<p class="mb-4">&nbsp;</p>' // Empty paragraph
      const align = getTextAlign(node.format)
      return `<p class="mb-4${align}">${childrenHtml}</p>`
    }

    case 'heading': {
      const level = node.tag?.replace('h', '') || '2'
      const align = getTextAlign(node.format)
      const sizeClass = getHeadingSize(level)
      return `<h${level} class="${sizeClass} font-bold mb-4${align}">${childrenHtml}</h${level}>`
    }

    case 'list': {
      const listTag = node.listType === 'number' ? 'ol' : 'ul'
      const listClass = node.listType === 'number'
        ? 'list-decimal list-inside mb-4 space-y-1'
        : 'list-disc list-inside mb-4 space-y-1'
      return `<${listTag} class="${listClass}">${childrenHtml}</${listTag}>`
    }

    case 'listitem': {
      const indent = node.indent ? ` style="margin-left: ${node.indent * 1.5}rem"` : ''
      if (node.checked !== undefined) {
        // Checkbox list item
        const checked = node.checked ? 'checked' : ''
        return `<li${indent} class="flex items-start gap-2"><input type="checkbox" ${checked} disabled class="mt-1" /><span>${childrenHtml}</span></li>`
      }
      return `<li${indent}>${childrenHtml}</li>`
    }

    case 'link': {
      const url = node.url || '#'
      const target = node.newTab ? ' target="_blank"' : ''
      const rel = node.newTab ? ' rel="noopener noreferrer"' : ''
      return `<a href="${escapeHtml(url)}" class="text-primary-600 hover:text-primary-700 underline"${target}${rel}>${childrenHtml}</a>`
    }

    case 'autolink': {
      const url = node.url || '#'
      return `<a href="${escapeHtml(url)}" class="text-primary-600 hover:text-primary-700 underline">${childrenHtml}</a>`
    }

    case 'quote': {
      return `<blockquote class="border-l-4 border-gray-300 dark:border-gray-600 pl-4 my-4 italic text-gray-600 dark:text-gray-400">${childrenHtml}</blockquote>`
    }

    case 'horizontalrule': {
      return '<hr class="my-8 border-gray-200 dark:border-gray-700" />'
    }

    case 'linebreak': {
      return '<br />'
    }

    case 'tab': {
      return '&nbsp;&nbsp;&nbsp;&nbsp;'
    }

    case 'code': {
      // Code block (multi-line code)
      const language = (node as LexicalNode & { language?: string }).language || ''
      return `<pre class="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto my-4"><code class="text-sm font-mono"${language ? ` data-language="${escapeHtml(language)}"` : ''}>${childrenHtml}</code></pre>`
    }

    case 'upload': {
      // Handle uploaded media (images)
      const mediaValue = node.value as Media | string | null | undefined
      if (!mediaValue || typeof mediaValue === 'string') return ''
      const url = getMediaUrl(mediaValue.url)
      if (!url) return ''
      const alt = escapeHtml(mediaValue.alt || '')
      const fields = node.fields || {}
      const size = (fields.size as string) || 'medium'
      const alignment = (fields.alignment as string) || 'center'
      const caption = fields.caption as string | undefined

      // Size classes
      const sizeStyles: Record<string, string> = {
        small: 'max-w-[400px]',
        medium: 'max-w-[600px]',
        large: 'max-w-[900px]',
        full: 'max-w-full',
      }
      const sizeClass = sizeStyles[size] || sizeStyles.medium

      // Alignment classes for figure container
      const alignmentStyles: Record<string, string> = {
        left: 'mr-auto',
        center: 'mx-auto',
        right: 'ml-auto',
      }
      const alignClass = alignmentStyles[alignment] || alignmentStyles.center

      let html = `<figure class="my-6 ${sizeClass} ${alignClass}">`
      html += `<img src="${url}" alt="${alt}" class="rounded-lg w-full h-auto" loading="lazy" />`
      if (caption) {
        html += `<figcaption class="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">${escapeHtml(caption)}</figcaption>`
      }
      html += '</figure>'
      return html
    }

    default:
      // For unknown node types, just render children
      return childrenHtml
  }
}

function getTextAlign(format: number | string | undefined): string {
  if (typeof format === 'string') {
    switch (format) {
      case 'left': return ' text-left'
      case 'center': return ' text-center'
      case 'right': return ' text-right'
      case 'justify': return ' text-justify'
      default: return ''
    }
  }
  // Lexical also uses numeric format for alignment on block nodes
  // These are different from text formatting bitmasks
  return ''
}

function getHeadingSize(level: string): string {
  switch (level) {
    case '1': return 'text-4xl'
    case '2': return 'text-3xl'
    case '3': return 'text-2xl'
    case '4': return 'text-xl'
    case '5': return 'text-lg'
    case '6': return 'text-base'
    default: return 'text-2xl'
  }
}

function renderContent(content: unknown): string {
  if (!content || typeof content !== 'object') return ''
  const root = content as { root?: LexicalNode }
  if (!root.root?.children) return ''
  return root.root.children.map(renderNode).join('')
}
</script>

<template>
  <div class="prose prose-gray dark:prose-invert max-w-none" v-html="renderContent(content)" />
</template>
