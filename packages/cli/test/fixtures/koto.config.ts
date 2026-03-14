import { defineConfig } from '../../src/index.js';

export default defineConfig({
  sourceLocale: 'en',
  targetLocales: ['es', 'fr', 'ja'],
  provider: {
    name: 'openai',
    model: 'gpt-4o-mini',
  },
  files: ['test/fixtures/[locale].json'],
  contexts: {
    default: {
      tone: 'professional',
      instructions: 'Consumer web application UI strings.',
    },
  },
});
