// Builds the site into dist/: copies the home page and assets, and turns
// every Markdown file in posts/ into a page of the tinker log.
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, existsSync } from 'node:fs';
import { marked } from 'marked';

const LOG = 'tinker-log';
const OUT = 'dist';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const niceDate = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

// Posts: posts/2026-11-26-my-title.md, with title/date/summary at the top.
const posts = readdirSync('posts')
  .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
  .map((file) => {
    const raw = readFileSync(`posts/${file}`, 'utf8');
    const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    const meta = {};
    if (m) for (const line of m[1].split(/\r?\n/)) {
      const i = line.indexOf(':');
      if (i > 0) meta[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
    }
    const base = file.replace(/\.md$/, '');
    const dated = base.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
    const date = meta.date || (dated && dated[1]);
    if (!meta.title || !/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw new Error(`posts/${file} needs a title and a date like 2026-11-26`);
    const slug = (dated ? dated[2] : base).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    let html = marked.parse(m ? m[2] : raw);
    html = html
      .replace(/(src|href)="images\//g, `$1="/${LOG}/images/`)
      .replace(/<a href="(https?:\/\/[^"]+)"/g, '<a href="$1" target="_blank" rel="noopener"')
      .replace(/<table>/g, '<div class="table-scroll"><table>').replace(/<\/table>/g, '</table></div>');
    return { slug, date, title: meta.title, summary: meta.summary || '', html };
  })
  .sort((a, b) => (a.date < b.date ? 1 : -1));

// The header, footer and font links come from the home page, so they stay in step with it.
const home = readFileSync('index.html', 'utf8');
const grab = (re) => home.match(re)[0];
const toRoot = (s) => s.replace(/href="#/g, 'href="/#');
const header = toRoot(grab(/<header[\s\S]*?<\/header>/));
const footer = toRoot(grab(/<footer[\s\S]*?<\/footer>/));
const fonts = home.match(/<link rel="(?:preconnect|stylesheet)" href="https:\/\/fonts[^>]*>/g).join('\n');
const icon = grab(/<link rel="icon"[^>]*>/);

const page = ({ title, description, body }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#dce6f0">
${icon}
${fonts}
<link rel="stylesheet" href="/styles.css">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>

${header}

<main id="main">
${body}
</main>

${footer}
</body>
</html>
`;

const list = (items) => `<ol class="log-list">
${items.map((p) => `  <li><time datetime="${p.date}">${niceDate(p.date)}</time><a href="/${LOG}/${p.slug}/">${esc(p.title)}</a>${p.summary ? `<p>${esc(p.summary)}</p>` : ''}</li>`).join('\n')}
</ol>`;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/${LOG}`, { recursive: true });
cpSync('styles.css', `${OUT}/styles.css`);
cpSync('assets', `${OUT}/assets`, { recursive: true });
if (existsSync('posts/images')) cpSync('posts/images', `${OUT}/${LOG}/images`, { recursive: true });

// Home page: the latest three entries appear above "Who is behind this".
const homeSection = posts.length ? `<section class="tinker wrap" id="tinker">
  <div class="note">tinker log</div>
  <h2 class="section-title">Fresh from the tinkering bench</h2>
  ${list(posts.slice(0, 3))}
  <a class="more-link" href="/${LOG}/">All entries</a>
</section>` : '';
writeFileSync(`${OUT}/index.html`, home.replace('<!-- TINKER-LOG -->', homeSection));

const intro = 'Personal experiments, side quests and half-finished results from Babita\'s bench. Rough on purpose.';
writeFileSync(`${OUT}/${LOG}/index.html`, page({
  title: 'Tinker log · Genethropic',
  description: intro,
  body: `<section class="wrap log-page">
  <div class="note">tinker log</div>
  <h1>Notes from the tinkering bench</h1>
  <p class="intro">${esc(intro)}</p>
  ${posts.length ? list(posts) : '<p class="empty">The first entries are on their way.</p>'}
</section>`,
}));

for (const p of posts) {
  mkdirSync(`${OUT}/${LOG}/${p.slug}`, { recursive: true });
  writeFileSync(`${OUT}/${LOG}/${p.slug}/index.html`, page({
    title: `${p.title} · Tinker log · Genethropic`,
    description: p.summary || p.title,
    body: `<article class="wrap log-page">
  <a class="note" href="/${LOG}/" style="text-decoration:none">tinker log</a>
  <h1>${esc(p.title)}</h1>
  <div class="post-meta"><time datetime="${p.date}">${niceDate(p.date)}</time></div>
  <div class="post-body">
${p.html}
  </div>
  <a class="back-link" href="/${LOG}/">All entries</a>
</article>`,
  }));
}

console.log(`Built ${posts.length} tinker-log entr${posts.length === 1 ? 'y' : 'ies'} into ${OUT}/`);
