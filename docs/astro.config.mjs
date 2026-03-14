import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'

export default defineConfig({
  site: 'https://aryabyte21.github.io',
  base: '/koto',
  integrations: [
    starlight({
      title: 'koto',
      social: {
        github: 'https://github.com/aryabyte21/koto',
      },
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Introduction', link: '/' },
            { label: 'Getting Started', link: '/getting-started/' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Configuration', link: '/configuration/' },
            { label: 'Context Profiles', link: '/contexts/' },
            { label: 'Type Safety', link: '/type-safety/' },
            { label: 'Providers', link: '/providers/' },
          ],
        },
        {
          label: 'CI/CD',
          items: [{ label: 'CI/CD Integration', link: '/ci-cd/' }],
        },
        {
          label: 'Reference',
          items: [
            { label: 'CLI Reference', link: '/cli-reference/' },
            { label: 'Comparison', link: '/comparison/' },
          ],
        },
      ],
    }),
  ],
})
