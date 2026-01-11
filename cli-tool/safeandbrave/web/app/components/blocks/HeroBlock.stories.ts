import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import type { HeroBlock as HeroBlockType } from '~/types/blocks'

import HeroBlock from './HeroBlock.vue'

const meta = {
  title: 'Blocks/HeroBlock',
  component: HeroBlock,
  tags: ['autodocs'],
  argTypes: {
    block: {
      control: 'object',
      description: 'The hero block data object',
    },
  },
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof HeroBlock>

export default meta
type Story = StoryObj<typeof meta>

const baseBlock: HeroBlockType = {
  id: '1',
  blockType: 'hero',
  headline: 'Welcome to Our Platform',
  subheadline: 'Build amazing things with our powerful tools and intuitive interface.',
  alignment: 'center',
}

export const Default: Story = {
  args: {
    block: baseBlock,
  },
}

export const LeftAligned: Story = {
  args: {
    block: {
      ...baseBlock,
      id: '2',
      alignment: 'left',
    },
  },
}

export const RightAligned: Story = {
  args: {
    block: {
      ...baseBlock,
      id: '3',
      alignment: 'right',
    },
  },
}

export const WithLinks: Story = {
  args: {
    block: {
      ...baseBlock,
      id: '4',
      links: [
        { label: 'Get Started', url: '/get-started', variant: 'solid' },
        { label: 'Learn More', url: '/learn-more', variant: 'outline' },
      ],
    },
  },
}

export const WithBackgroundImage: Story = {
  args: {
    block: {
      ...baseBlock,
      id: '5',
      headline: 'Discover New Possibilities',
      subheadline: 'Transform your workflow with cutting-edge solutions.',
      backgroundImage: {
        id: 'img-1',
        url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=80',
        alt: 'Abstract background',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      links: [
        { label: 'Start Free Trial', url: '/trial', variant: 'solid' },
      ],
    },
  },
}

export const MinimalHeadlineOnly: Story = {
  args: {
    block: {
      id: '6',
      blockType: 'hero',
      headline: 'Simple and Clean',
    },
  },
}
