// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },

  extends: ['@nuxt/ui-pro'],
  modules: ['@nuxt/ui', '@nuxt/fonts'],

  fonts: {
    families: [
      { name: 'Inter', provider: 'google', weights: [400, 500, 600, 700] },
      { name: 'Playfair Display', provider: 'google', weights: [400, 500, 600, 700] },
    ],
  },

  app: {
    baseURL: '/safeandbrave/',
  },

  ssr: true,

  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ['/'],
      failOnError: false
    },
    routeRules: {
      '/api/**': {
        proxy: (process.env.NUXT_PUBLIC_PAYLOAD_API_URL || 'http://localhost:3202/api') + '/**'
      }
    }
  },

  runtimeConfig: {
    // Server-side only (can use Docker internal hostname)
    payloadApiUrl: process.env.PAYLOAD_API_URL || 'http://localhost:3202/api',
    public: {
      // Client-side (must be browser-accessible)
      payloadApiUrl: process.env.NUXT_PUBLIC_PAYLOAD_API_URL || 'http://localhost:3202/api'
    }
  },

  devServer: {
    host: '0.0.0.0',
    port: 3000
  }
})
