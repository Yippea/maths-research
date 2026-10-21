import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import fs from 'node:fs';
import { SITE, BASE, TITLE } from './site.config.mjs';

// Written by scripts/generate.mjs before every dev/build run.
const categories = fs.existsSync('./src/categories.json')
  ? JSON.parse(fs.readFileSync('./src/categories.json', 'utf8'))
  : [];

export default defineConfig({
  site: SITE,
  base: BASE,
  integrations: [
    starlight({
      title: TITLE,
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/Yippea/maths-research' }],
      tableOfContents: false,
      sidebar: categories.map((c) => ({
        label: c.catTitle,
        collapsed: true,
        items: [{ autogenerate: { directory: c.catSlug, collapsed: true } }],
      })),
    }),
  ],
});
