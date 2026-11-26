// Builds the site into dist/: copies the home page and assets, fills the
// archive ticker with real records, and turns every file in posts/ into a
// b.logs entry (.md is written text, .html is a saved Claude artifact).
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, existsSync } from 'node:fs';
import { marked } from 'marked';

const BLOG = 'b.logs';
const POSTS = process.env.POSTS_DIR || 'posts';
const OUT = process.env.OUT_DIR || 'dist';
const ARCHIVE = 'https://artgene-archive.org';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const niceDate = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

// ---- Archive ticker: the newest published records, with a saved copy as fallback.
async function archiveRecords() {
  const saved = 'data/archive.json';
  try {
    const res = await fetch(`${ARCHIVE}/api/proxy/catalogue?limit=20`, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data.items) || !data.items.length) throw new Error('no records');
    const slim = { count: data.count, items: data.items.map((r) => ({ id: r.registry_id, title: r.title, venue: r.container, published_on: r.published_on, kind: r.function_class })) };
    writeFileSync(saved, JSON.stringify(slim, null, 1) + '\n');
    return slim;
  } catch (err) {
    console.warn(`Archive not reachable (${err.message}); using the saved copy.`);
    return existsSync(saved) ? JSON.parse(readFileSync(saved, 'utf8')) : null;
  }
}

function ticker(archive) {
  if (!archive) return '';
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
  const set = (hidden) => `<ul class="ticker-set"${hidden ? ' aria-hidden="true"' : ''}>
${archive.items.map((r) => `          <li><a class="tick" href="${ARCHIVE}/sequences/${esc(r.id)}" target="_blank" rel="noopener"${hidden ? ' tabindex="-1"' : ''}><span class="id">${esc(r.id)}</span><span class="t">${esc(r.title)}</span><span class="m">${esc([r.venue, r.published_on && r.published_on.slice(0, 4), cap(r.kind)].filter(Boolean).join(' · '))}</span></a></li>`).join('\n')}
        </ul>`;
  return `<div class="archive-ticker">
      <div class="ticker-head">
        <strong>Now in the archive</strong>
        <a href="${ARCHIVE}/sequences" target="_blank" rel="noopener">See all ${archive.count} records</a>
      </div>
      <div class="ticker-view">
        <div class="ticker-track" style="--ticker-time:${archive.items.length * 7}s">
        ${set(false)}
        ${set(true)}
        </div>
      </div>
    </div>`;
}

// ---- b.logs entries. File names look like 2026-11-26-my-title.md or .html.
function readPost(file) {
  const raw = readFileSync(`${POSTS}/${file}`, 'utf8');
  const base = file.replace(/\.(md|html)$/, '');
  const dated = base.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
  const slug = (dated ? dated[2] : base).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (file.endsWith('.html')) {
    if (!dated) throw new Error(`${POSTS}/${file}: start the file name with a date, like 2026-11-26-my-title.html`);
    const t = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = (t && t[1].trim()) || dated[2].replace(/-/g, ' ');
    return { slug, date: dated[1], title, summary: '', artifact: raw };
  }
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const meta = {};
  if (m) for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  }
  const date = meta.date || (dated && dated[1]);
  if (!meta.title || !/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw new Error(`${POSTS}/${file} needs a title and a date like 2026-11-26`);
  const html = marked.parse(m ? m[2] : raw)
    .replace(/(src|href)="images\//g, `$1="/${BLOG}/images/`)
    .replace(/<a href="(https?:\/\/[^"]+)"/g, '<a href="$1" target="_blank" rel="noopener"')
    .replace(/<table>/g, '<div class="table-scroll"><table>').replace(/<\/table>/g, '</table></div>');
  return { slug, date, title: meta.title, summary: meta.summary || '', html };
}

const posts = (existsSync(POSTS) ? readdirSync(POSTS) : [])
  .filter((f) => /\.(md|html)$/.test(f) && !f.startsWith('_'))
  .map(readPost)
  .sort((a, b) => (a.date < b.date ? 1 : -1));

// The header, footer and font links come from the home page, so they stay in step with it.
const home = readFileSync('index.html', 'utf8');
const grab = (re) => home.match(re)[0];
const toRoot = (s) => s.replace(/href="#/g, 'href="/#');
const header = toRoot(grab(/<header[\s\S]*?<\/header>/));
const footer = toRoot(grab(/<footer[\s\S]*?<\/footer>/));
const fonts = home.match(/<link rel="(?:preconnect|stylesheet)" href="https:\/\/fonts[^>]*>/g).join('\n');
const icon = grab(/<link rel="icon"[^>]*>/);
const intro = "B.'s lab notebook: experiments, side quests and half-finished results. Rough on purpose.";

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

const menu = (current) => `<aside class="blog-menu">
    <a class="note" href="/${BLOG}/">b.logs</a>
    <p>${esc(intro)}</p>
    ${posts.length ? `<details open>
      <summary>All entries (${posts.length})</summary>
      <ol>
${posts.map((p) => `        <li><a href="/${BLOG}/${p.slug}/"${p === current ? ' aria-current="page"' : ''}><time datetime="${p.date}">${niceDate(p.date)}</time>${esc(p.title)}</a></li>`).join('\n')}
      </ol>
    </details>` : ''}
  </aside>`;

const entry = (p) => `<article class="blog-main">
    <h1>${esc(p.title)}</h1>
    <div class="post-meta"><time datetime="${p.date}">${niceDate(p.date)}</time>${p.artifact ? `<a href="/${BLOG}/${p.slug}/artifact.html" target="_blank" rel="noopener">Open full screen</a>` : ''}</div>
    ${p.artifact
      ? `<iframe class="post-frame" src="/${BLOG}/${p.slug}/artifact.html" title="${esc(p.title)}" sandbox="allow-scripts allow-popups allow-forms allow-downloads"></iframe>`
      : `<div class="post-body">\n${p.html}\n    </div>`}
  </article>`;

const blogPage = (p) => page({
  title: p ? `${p.title} · b.logs · Genethropic` : 'b.logs · Genethropic',
  description: (p && (p.summary || p.title)) || intro,
  body: `<section class="wrap blog">
  ${menu(p)}
  ${p ? entry(p) : '<div class="blog-main"><h1>Nothing logged yet</h1><p class="empty" style="margin-top:28px">The first entries are on their way.</p></div>'}
</section>`,
});

rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/${BLOG}`, { recursive: true });
cpSync('styles.css', `${OUT}/styles.css`);
cpSync('assets', `${OUT}/assets`, { recursive: true });
if (existsSync(`${POSTS}/images`)) cpSync(`${POSTS}/images`, `${OUT}/${BLOG}/images`, { recursive: true, filter: (f) => !f.endsWith('.gitkeep') });

// Home page: ticker inside the archive card, latest three entries above "Who is behind this".
const homeBlogs = posts.length ? `<section class="blogs-home wrap" id="blogs">
  <div class="note">b.logs</div>
  <h2 class="section-title">Fresh from the tinkering bench</h2>
  <ol class="log-list">
${posts.slice(0, 3).map((p) => `    <li><time datetime="${p.date}">${niceDate(p.date)}</time><a href="/${BLOG}/${p.slug}/">${esc(p.title)}</a>${p.summary ? `<p>${esc(p.summary)}</p>` : ''}</li>`).join('\n')}
  </ol>
  <a class="more-link" href="/${BLOG}/">All entries</a>
</section>` : '';
const archive = await archiveRecords();
writeFileSync(`${OUT}/index.html`, home.replace('<!-- ARCHIVE-TICKER -->', ticker(archive)).replace('<!-- BLOGS -->', homeBlogs));

// b.logs opens on the newest entry; every entry also has its own address.
writeFileSync(`${OUT}/${BLOG}/index.html`, blogPage(posts[0]));
for (const p of posts) {
  mkdirSync(`${OUT}/${BLOG}/${p.slug}`, { recursive: true });
  writeFileSync(`${OUT}/${BLOG}/${p.slug}/index.html`, blogPage(p));
  if (p.artifact) writeFileSync(`${OUT}/${BLOG}/${p.slug}/artifact.html`, p.artifact);
}

console.log(`Built ${posts.length} b.logs entr${posts.length === 1 ? 'y' : 'ies'} and ${archive ? archive.items.length : 0} archive records into ${OUT}/`);
