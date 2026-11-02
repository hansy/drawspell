import { deLocalizeUrl, localizeUrl } from "./paraglide/runtime.js"
import { isLocalizablePath } from "./i18n/urls"
import { createRouter } from '@tanstack/react-router'

// Import the generated route tree
import { routeTree } from './routeTree.gen'

// Create a new router instance
export const getRouter = () => {
  const router = createRouter({
    routeTree,
    rewrite: {
      input: ({ url }) => isLocalizablePath(url.pathname) ? deLocalizeUrl(url) : url,
      output: ({ url }) => isLocalizablePath(url.pathname) ? localizeUrl(url) : url,
    },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  })

  return router
}
