/**
 * Company CMS Starter Seed Set
 * Professional company website with home, about, services, and contact pages
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

export const companyStarter: SeedSet = {
  id: 'company-starter',
  name: 'Company CMS Starter',
  description: 'Professional company website with home, about, services, and contact pages',
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
          headline: 'Welcome to Our Company',
          subheadline: 'We deliver exceptional solutions that drive your business forward. Partner with us to achieve your goals.',
          alignment: 'center',
          links: [
            { label: 'Our Services', url: '/services', variant: 'solid' },
            { label: 'Contact Us', url: '/contact', variant: 'outline' },
          ],
        },
        {
          blockType: 'richText',
          content: createLexicalContent([
            'At our company, we believe in delivering excellence. With years of experience and a dedicated team, we have helped countless businesses transform their operations and achieve sustainable growth.',
            'Our approach combines innovation with proven methodologies to ensure that every project we undertake delivers measurable results. We work closely with our clients to understand their unique challenges and develop tailored solutions.',
            'Ready to take your business to the next level? Explore our services or get in touch with our team today.',
          ]),
        },
      ],
    },
    {
      title: 'About',
      slug: 'about',
      showInMenu: true,
      menuOrder: 2,
      content: [
        {
          blockType: 'hero',
          headline: 'About Us',
          subheadline: 'Learn more about our company, our mission, and the team behind our success.',
          alignment: 'center',
        },
        {
          blockType: 'richText',
          content: createLexicalContent([
            'Founded with a vision to make a difference, our company has grown from a small startup to a trusted partner for businesses of all sizes. Our journey has been defined by our commitment to quality, innovation, and customer satisfaction.',
            'Our team consists of passionate professionals who bring diverse expertise to every project. We foster a culture of collaboration, continuous learning, and excellence that enables us to deliver outstanding results.',
            'We are proud of the relationships we have built with our clients over the years. Many of them have been with us since the beginning, a testament to the trust and value we provide.',
          ]),
        },
      ],
    },
    {
      title: 'Services',
      slug: 'services',
      showInMenu: true,
      menuOrder: 3,
      content: [
        {
          blockType: 'hero',
          headline: 'Our Services',
          subheadline: 'Discover how we can help transform your business with our comprehensive range of services.',
          alignment: 'center',
        },
        {
          blockType: 'richText',
          content: createLexicalContent([
            'We offer a wide range of services designed to meet the diverse needs of modern businesses. Each service is delivered with the same commitment to quality and excellence that defines our company.',
            'Consulting: Our expert consultants work with you to identify opportunities, overcome challenges, and develop strategies for success.',
            'Implementation: We turn plans into reality with our hands-on implementation services, ensuring smooth execution and adoption.',
            'Support: Our dedicated support team is always available to help you get the most out of our solutions.',
            'Contact us to learn more about how our services can benefit your organization.',
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
          headline: 'Get in Touch',
          subheadline: 'We would love to hear from you. Reach out to us with your questions, ideas, or to start a conversation.',
          alignment: 'center',
        },
        {
          blockType: 'richText',
          content: createLexicalContent([
            'Have a project in mind? Looking for a partner to help you achieve your goals? We are here to help.',
            'Email: contact@example.com',
            'Phone: (555) 123-4567',
            'Address: 123 Business Street, Suite 100, City, State 12345',
            'Our team is available Monday through Friday, 9 AM to 5 PM. We look forward to connecting with you!',
          ]),
        },
      ],
    },
  ],
}
