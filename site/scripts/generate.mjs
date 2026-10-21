// Scans the repo root for category folders and builds one page per PDF.
// Output goes to src/content/docs and public/files (both gitignored).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE, TITLE, IGNORE } from '../site.config.mjs';

const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(siteDir, '..');
const docsDir = path.join(siteDir, 'src/content/docs');
const filesDir = path.join(siteDir, 'public/files');

fs.rmSync(docsDir, { recursive: true, force: true });
fs.rmSync(filesDir, { recursive: true, force: true });
fs.mkdirSync(docsDir, { recursive: true });

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const slugify = (s) =>
  s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'file';
const humanize = (s) => s.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
const yaml = (s) => JSON.stringify(s);
const size = (b) => (b >= 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB');

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.pdf$/i.test(e.name)) out.push(p);
  }
  return out;
}

const categories = fs.readdirSync(repoRoot, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !IGNORE.has(e.name))
  .map((e) => e.name)
  .sort(collator.compare);

const summary = [];

for (const cat of categories) {
  const catDir = path.join(repoRoot, cat);
  const pdfs = walk(catDir).sort((a, b) => collator.compare(a, b));
  if (!pdfs.length) continue;

  const catSlug = slugify(cat);
  const catTitle = humanize(cat.replace(/[_-]?pdfs?$/i, '')).replace(/^./, (c) => c.toUpperCase());
  const used = new Set();
  const entries = [];

  for (const pdf of pdfs) {
    const rel = path.relative(catDir, pdf);
    const parts = rel.split(path.sep);
    const base = parts.pop().replace(/\.pdf$/i, '');
    const subSlugs = parts.map(slugify);
    let slug = slugify(base);
    let key = [...subSlugs, slug].join('/');
    for (let n = 2; used.has(key); n++) key = [...subSlugs, `${slug}-${n}`].join('/');
    used.add(key);

    const publicRel = path.posix.join(cat, ...parts, base + '.pdf');
    const dest = path.join(filesDir, publicRel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(pdf, dest);

    const url = `${BASE}/files/${publicRel.split('/').map(encodeURIComponent).join('/')}`;
    const title = humanize(base);
    const pagePath = path.join(docsDir, catSlug, key + '.md');
    fs.mkdirSync(path.dirname(pagePath), { recursive: true });
    fs.writeFileSync(pagePath, `---
title: ${yaml(title)}
tableOfContents: false
---

<a href="${url}" download>Download PDF</a> (${size(fs.statSync(pdf).size)})

<iframe src="${url}" title=${yaml(title)} style="width:100%;height:80vh;border:1px solid var(--sl-color-hairline);"></iframe>
`);
    entries.push({ title, href: `${BASE}/${catSlug}/${key}/` });
  }

  fs.writeFileSync(path.join(docsDir, catSlug, 'index.md'), `---
title: ${yaml(catTitle)}
description: ${yaml(entries.length + ' files')}
sidebar:
  label: All files
  order: 0
pagefind: false
---

${entries.map((e) => `- [${e.title}](${e.href})`).join('\n')}
`);
  summary.push({ cat, catSlug, catTitle, count: entries.length });
}

fs.writeFileSync(path.join(docsDir, 'index.md'), `---
title: ${yaml(TITLE)}
template: splash
pagefind: false
---

${summary.map((s) => `- [${s.catTitle}](${BASE}/${s.catSlug}/) (${s.count})`).join('\n')}
`);

fs.writeFileSync(path.join(siteDir, 'src/categories.json'), JSON.stringify(summary, null, 2));
console.log(`Generated ${summary.reduce((n, s) => n + s.count, 0)} pages in ${summary.length} categories.`);
