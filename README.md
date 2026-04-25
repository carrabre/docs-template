# Next.js Docs Starter

A reusable documentation starter built with Next.js, MDX, local search, optional AI help, Markdown exports, `llms.txt`, and a minimal MCP endpoint.

The starter is designed for personal projects, open-source projects, and small teams that want to launch a free docs site on Vercel without using a docs-specific SaaS.

## Features

- Next.js App Router documentation site.
- Root-level MDX pages with YAML frontmatter.
- Typed `site.config.ts` for site metadata, navigation, theme, assistant, and MCP settings.
- Local search with `Command+K` or `Ctrl+K`.
- Optional AI assistant through your own OpenAI API key.
- External AI context actions for copying or opening page context.
- `/llms.txt`, `/llms-full.txt`, and Markdown routes for every page.
- Minimal `/mcp` endpoint for docs search and page reads.
- Vercel-ready defaults.

## Development

Install dependencies:

```bash
npm install
```

Run the local server:

```bash
npm run dev
```

Open `http://localhost:3000`.

Run checks before publishing:

```bash
npm run type-check
npm run build
```

## Configuration

Edit `site.config.ts` to change:

- Site name, short name, description, and URL.
- Navigation groups and header links.
- Theme storage keys and browser theme colors.
- Logo path.
- Assistant labels and defaults.
- MCP server name and route.
- Page context menu actions.

Set local environment variables in `.env.local`:

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.4-mini
```

`OPENAI_API_KEY` is optional. Search, Markdown exports, and the MCP endpoint work without it.

## Writing docs

Create or edit root-level `.mdx` files. Each page should include frontmatter:

```mdx
---
title: "Installation"
description: "Install the project and verify that it works."
---
```

Add new page slugs to `site.config.ts` so they appear in the sidebar, search index, and generated `llms.txt` files.

## Deploy to Vercel

1. Push this repo to GitHub, GitLab, or Bitbucket.
2. Import it in Vercel.
3. Keep the detected framework as **Next.js**.
4. Add `NEXT_PUBLIC_SITE_URL` with your deployed URL.
5. Add `OPENAI_API_KEY` only if you want AI chat.
6. Click **Deploy**.

The app is designed to run on Vercel's free Hobby plan for personal and open-source documentation sites. Check Vercel's current plan documentation before relying on specific limits.

## Key files

- `site.config.ts`: Main customization API.
- `index.mdx`: Home page.
- `app/globals.css`: Theme and component styles.
- `components/mdx-components.tsx`: MDX component registry.
- `lib/docs.ts`: Page loading and navigation helpers.
- `app/mcp/route.ts`: Minimal MCP endpoint.

## License

MIT
