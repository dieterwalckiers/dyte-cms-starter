/**
 * Artist CMS Starter Seed Set
 * Portfolio website for artists, photographers, and creatives
 */

import type { SeedSet } from '../types/index.js'

// Helper to create multi-paragraph Lexical content
function createLexicalContent(paragraphs: string[]): object {
  return {
    root: {
      children: paragraphs.map(text => ({
        children: [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text,
            type: 'text',
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'paragraph',
        version: 1,
      })),
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  }
}

export const artistStarter: SeedSet = {
  id: 'artist-starter',
  name: 'Artist Portfolio Starter',
  description: 'Portfolio website for artists, photographers, and creatives with work, about, and contact pages',
  requiredBlocks: ['hero', 'richText'],
  pages: [
    {
      title: 'Home',
      slug: 'home',
      showInMenu: true,
      menuOrder: 1,
      content: [
        {
          blockType: 'hero',
          headline: 'Creative Vision, Crafted with Care',
          subheadline: 'Welcome to my portfolio. Explore my work and discover the stories behind each piece.',
          alignment: 'center',
          links: [
            { label: 'View My Work', url: '/work', variant: 'solid' },
            { label: 'Get in Touch', url: '/contact', variant: 'outline' },
          ],
        },
        {
          blockType: 'richText',
          content: createLexicalContent([
            'Art is a journey, and every piece tells a story. Through my work, I explore themes of identity, nature, and the human experience.',
            'Whether you are looking for a commissioned piece, interested in purchasing existing work, or simply want to learn more about my creative process, I invite you to explore this space.',
          ]),
        },
      ],
    },
    {
      title: 'Work',
      slug: 'work',
      showInMenu: true,
      menuOrder: 2,
      content: [
        {
          blockType: 'hero',
          headline: 'My Work',
          subheadline: 'A collection of selected pieces from my portfolio.',
          alignment: 'center',
        },
        {
          blockType: 'richText',
          content: createLexicalContent([
            'Each piece in my collection represents a unique exploration of technique, concept, and emotion. I work across multiple mediums, always seeking new ways to express ideas and connect with viewers.',
            'Featured Collections:',
            'Nature Series - An exploration of organic forms and natural patterns that surround us.',
            'Urban Landscapes - Capturing the energy and architecture of city life.',
            'Abstract Expressions - Bold colors and forms that evoke emotion and invite interpretation.',
            'Contact me to inquire about available works or commission a custom piece.',
          ]),
        },
      ],
    },
    {
      title: 'About',
      slug: 'about',
      showInMenu: true,
      menuOrder: 3,
      content: [
        {
          blockType: 'hero',
          headline: 'About the Artist',
          subheadline: 'The story behind the art.',
          alignment: 'center',
        },
        {
          blockType: 'richText',
          content: createLexicalContent([
            'I am an artist based in the creative heart of the city, where inspiration flows from every corner. My work has been featured in galleries, publications, and private collections around the world.',
            'My journey began with a simple fascination for color and form. Over the years, this fascination has evolved into a lifelong pursuit of artistic expression and mastery.',
            'Education and training have shaped my technical skills, but it is life experiences that truly inform my work. Travel, nature, music, and human connection all find their way into my pieces.',
            'When not in the studio, I can be found teaching workshops, mentoring emerging artists, or exploring new places for inspiration.',
          ]),
        },
      ],
    },
    {
      title: 'Contact',
      slug: 'contact',
      showInMenu: true,
      menuOrder: 4,
      content: [
        {
          blockType: 'hero',
          headline: 'Let\'s Connect',
          subheadline: 'Interested in my work? Have a project in mind? I would love to hear from you.',
          alignment: 'center',
        },
        {
          blockType: 'richText',
          content: createLexicalContent([
            'I welcome inquiries about commissions, exhibitions, collaborations, and purchases. Whether you have a specific vision in mind or want to explore possibilities together, let\'s start a conversation.',
            'Email: artist@example.com',
            'Studio: By appointment only',
            'Social: @artisthandle',
            'For commission requests, please include details about your vision, timeline, and budget. I respond to all inquiries within 48 hours.',
          ]),
        },
      ],
    },
  ],
}
