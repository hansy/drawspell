// Render public content at build time so Markdown and HTML share their source.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { writeFile } from 'node:fs/promises';
import { ApiDocs } from '../src/routes/docs.tsx';
import { Route as privacy } from '../src/routes/privacy.tsx';
import { Route as terms } from '../src/routes/tos.tsx';
import { LandingHero } from '../src/components/landing/LandingHero.tsx';
import { landingContent, publicPages } from '../src/content/publicPages.ts';
import examples from '../src/generated/doc-examples.json';

const origin = 'https://drawspell.space';
const output = new URL('../public/', import.meta.url);
const markdown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
markdown.use(gfm);
markdown.addRule('fields', {
  filter: ['dt', 'dd'],
  replacement: (content, node) => node.nodeName === 'DT' ? `\n\n**${content.trim()}**\n\n` : `\n\n${content.trim()}\n\n`,
});
const components = new Map([
  ['/', createElement(LandingHero, landingContent)],
  ['/docs', createElement(ApiDocs)],
  ['/privacy', createElement(privacy.options.component)],
  ['/tos', createElement(terms.options.component)],
]);
const documents = [];
for (const page of publicPages) {
  const element = components.get(page.path);
  if (!element) throw new Error(`No public content renderer for ${page.path}`);
  const document = new JSDOM(renderToStaticMarkup(element)).window.document;
  const main = document.querySelector('main');
  if (!main) throw new Error(`No main content for ${page.path}`);
  // Exclude controls, and include all code examples below rather than only the selected tab.
  main.querySelectorAll('button, svg, .api-code').forEach(node => node.remove());
  main.querySelectorAll('a[href]').forEach(link => {
    link.setAttribute('href', new URL(link.getAttribute('href'), origin + page.path).href);
  });
  // CSS supplies these gaps in HTML; Markdown needs literal separators.
  main.querySelectorAll('.api-base-url > span, .api-endpoint > span, dt > code').forEach(node => {
    node.after(document.createTextNode(' '));
  });
  // Spell out nested field paths so the flat text preserves ownership.
  const fields = Array.from(main.querySelectorAll('.api-field'));
  const names = new Map(fields.map(field => [field, field.querySelector(':scope > dt > code')?.textContent]));
  for (const field of fields) {
    const code = field.querySelector(':scope > dt > code');
    const path = [names.get(field)];
    let parent = field.parentElement?.closest('.api-field');
    while (parent) {
      const type = parent.querySelector(':scope > dt > span')?.textContent ?? '';
      path.unshift(names.get(parent) + (type.includes('object[]') ? '[]' : ''));
      parent = parent.parentElement?.closest('.api-field');
    }
    if (code) code.textContent = path.join('.');
  }
  main.querySelectorAll('td p').forEach(node => {
    node.replaceWith(document.createTextNode(' ' + node.textContent));
  });
  let content = markdown.turndown(main.innerHTML);
  if (page.path === '/docs') {
    content += '\n\n## Code examples\n\n' + examples.map(example =>
      `### ${example.label}\n\n\`\`\`${example.lang}\n${example.code}\n\`\`\``,
    ).join('\n\n');
  }
  content = `Source: ${origin}${page.path}\n\n${content}\n`;
  await writeFile(new URL(page.markdown.slice(1), output), content);
  documents.push(content);
}
const index = `# Drawspell

> A browser-based virtual tabletop for playing Magic: The Gathering with friends.

Public information is available as Markdown. Creating rooms through the API requires an API key from the authenticated developer dashboard at ${origin}/developers. Live game state and private dashboard data require browser interaction and are not included here.

## Pages

${publicPages.map(page => `- [${page.title}](${origin}${page.markdown}): ${page.description}`).join('\n')}

## Combined content

- [Full public content](${origin}/llms-full.txt): All the Markdown pages above in one response.
`;
await writeFile(new URL('llms.txt', output), index);
await writeFile(new URL('llms-full.txt', output), `${index}\n---\n\n${documents.join('\n---\n\n')}`);
await writeFile(new URL('sitemap.xml', output), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${publicPages.map(page => `  <url><loc>${origin}${page.path}</loc></url>`).join('\n')}
</urlset>
`);
await writeFile(new URL('_headers', output), `/*.md
  Content-Type: text/markdown; charset=utf-8
  Link: </llms.txt>; rel="describedby"
/llms.txt
  Content-Type: text/plain; charset=utf-8
/llms-full.txt
  Content-Type: text/plain; charset=utf-8
`);
