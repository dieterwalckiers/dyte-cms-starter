import type { CollectionConfig } from 'payload'
import { triggerDeploy } from '../hooks/triggerDeploy'

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'showInMenu', 'menuOrder', 'updatedAt'],
  },
  access: {
    read: () => true,
  },
  hooks: {
    afterChange: [
      async ({ collection }) => {
        await triggerDeploy(collection.slug)
      },
    ],
    afterDelete: [
      async ({ collection }) => {
        await triggerDeploy(collection.slug)
      },
    ],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'URL slug for the page (e.g., "about-us")',
      },
    },
    {
      name: 'showInMenu',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Show this page in the main navigation menu',
      },
    },
    {
      name: 'menuOrder',
      type: 'number',
      admin: {
        description: 'Order in the menu (lower numbers appear first)',
        condition: (data) => data?.showInMenu,
      },
    },
    {
      name: 'body',
      type: 'richText',
      required: true,
    },
  ],
}
