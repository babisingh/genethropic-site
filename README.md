# genethropic.com

The website for Genethropic. Anything saved to the `main` branch of this
repository goes live on https://genethropic.com about a minute later.

## Change text on the home page

Open `index.html` on github.com, click the pencil icon, edit the words, and
click "Commit changes". Colours, sizes and spacing live in `styles.css`.

## Add a b.logs entry

Entries are files in the `posts` folder. The file name starts with the date:
`2026-12-01-my-title.md`. Use "Add file" on github.com to create or upload one.

- **A written entry** is a `.md` file. Copy `posts/_template.md` to see the
  format. Pictures go in `posts/images`.
- **A Claude artifact** is an `.html` file. Save the artifact as HTML, name it
  with a date (`2026-12-01-codon-usage-explorer.html`) and upload it. The
  artifact's page title becomes the headline.

The newest entry opens first, and the menu on the left lists every entry.
A file whose name starts with `_` is never published. To remove an entry,
delete its file.

## How it is built

`build.mjs` copies the home page into `dist/`, fills the archive ticker with
the newest records from artgene-archive.org, and turns each file in `posts/`
into a page. Cloudflare Pages runs it on every change. To try it on your own computer:

    npm install
    node build.mjs
