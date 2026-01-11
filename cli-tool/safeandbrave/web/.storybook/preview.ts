import type { Preview } from '@storybook-vue/nuxt'
import { h } from 'vue'

const viewportDimensions: Record<string, { width: string; height: string }> = {
  iphone14: { width: '390px', height: '844px' },
  iphone14promax: { width: '430px', height: '932px' },
  ipad11p: { width: '834px', height: '1194px' },
  ipad12p: { width: '1024px', height: '1366px' },
  pixel5: { width: '393px', height: '851px' },
  galaxys9: { width: '360px', height: '740px' },
}

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#ffffff' },
        { name: 'dark', value: '#1a1a1a' },
      ],
    },
  },
  globalTypes: {
    viewport: {
      toolbar: {
        icon: 'mobile',
        title: 'Viewport',
        items: [
          { value: 'reset', title: 'Reset (Full width)' },
          { value: 'iphone14', title: 'iPhone 14 (390×844)' },
          { value: 'iphone14promax', title: 'iPhone 14 Pro Max (430×932)' },
          { value: 'ipad11p', title: 'iPad Pro 11 (834×1194)' },
          { value: 'ipad12p', title: 'iPad Pro 12.9 (1024×1366)' },
          { value: 'pixel5', title: 'Pixel 5 (393×851)' },
          { value: 'galaxys9', title: 'Galaxy S9 (360×740)' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (story, context) => {
      const viewport = context.globals.viewport
      const dimensions = viewportDimensions[viewport]

      if (!dimensions) {
        return { render: () => h(story()) }
      }

      return {
        render: () => h(
          'div',
          {
            style: {
              width: dimensions.width,
              height: dimensions.height,
              margin: '0 auto',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              overflow: 'auto',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            },
          },
          [h(story())]
        ),
      }
    },
  ],
};

export default preview;
