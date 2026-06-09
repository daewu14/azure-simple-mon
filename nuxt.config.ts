// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: false },
  ssr: true,

  modules: ['@nuxt/ui'],

  css: ['~/assets/css/main.css'],

  colorMode: {
    preference: 'dark',
    fallback: 'dark',
    classSuffix: '',
  },

  runtimeConfig: {
    azureDevOpsPat: process.env.AZURE_DEVOPS_PAT || '',
    azureDevOpsOrg: process.env.AZURE_DEVOPS_ORG || 'KiriminAja2026',
    azureDevOpsProject: process.env.AZURE_DEVOPS_PROJECT || 'Product Delivery',
    azureDevOpsTeam: process.env.AZURE_DEVOPS_TEAM || 'Platform Squad',
    azureDevOpsTeams: process.env.AZURE_DEVOPS_TEAMS || '',
    dashboardAuthUsername: process.env.DASHBOARD_AUTH_USERNAME || 'daewubintara@kiriminaja.com',
    dashboardAuthSalt: process.env.DASHBOARD_AUTH_SALT || '',
    dashboardAuthPasswordSha256: process.env.DASHBOARD_AUTH_PASSWORD_SHA256 || '',
    dashboardSessionSecret: process.env.DASHBOARD_SESSION_SECRET || '',
    public: {
      defaultTeam: process.env.AZURE_DEVOPS_TEAM || 'Platform Squad',
    },
  },

  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      htmlAttrs: { lang: 'id' },
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap',
        },
      ],
    },
  },

  nitro: {
    experimental: {
      openAPI: false,
    },
  },

  compatibilityDate: '2025-05-01',
})
