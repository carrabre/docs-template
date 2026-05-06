# Next.js Docs Starter

A reusable documentation starter built with Next.js, MDX, local search, optional AI help, Markdown exports, `llms.txt`, API reference generation, and an MCP endpoint.

The starter is designed for personal projects, open-source projects, and small teams that want to launch a free docs site on Vercel without using a docs-specific SaaS.

## Features

- Next.js App Router documentation site.
- Root-level MDX pages with YAML frontmatter.
- Typed `site.config.ts` for site metadata, rich navigation, theme, API references, assistant, voice, feedback, analytics, and MCP settings.
- Rich MDX component set: cards, steps, tabs, code groups, file trees, type tables, API blocks, do/don't blocks, prompts, zoomable media, changelog updates, Mermaid, and more.
- Nested navigation groups, menus, external links, icons, tags, optional versions/languages, and generated API reference sections.
- Generated OpenAPI and AsyncAPI pages with params, bodies, responses, schemas, examples, and code samples.
- Optional Scalar OpenAPI playground at `/api-reference`.
- Local search with `Command+K` or `Ctrl+K`.
- Optional AI assistant through your own OpenAI API key.
- Optional OpenAI Realtime WebRTC voice assistant, disabled by default.
- External AI context actions for copying or opening page context.
- `/llms.txt`, `/llms-full.txt`, and Markdown routes for every page.
- `/mcp` endpoint with docs tools, resources, and prompts.
- Page feedback, optional analytics hooks, sitemap, robots, canonical metadata, and optional edit links.
- Docs validation for frontmatter, navigation, duplicate headings, internal links, and API spec paths.
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
npm run validate:docs
npm run check:links
npm run build
```

## Configuration

Edit `site.config.ts` to change:

- Site name, short name, description, and URL.
- Navigation groups and header links.
- Generated OpenAPI and AsyncAPI references.
- Theme storage keys and browser theme colors.
- Logo path.
- Assistant labels and defaults.
- Optional voice assistant, page feedback, analytics, and edit links.
- MCP server name and route.
- Page context menu actions.

Set local environment variables in `.env.local`. Use the first three variables for text chat:

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.4-mini
DOCS_ASSISTANT_MAX_CONTEXT_CHARS=80000
NEXT_PUBLIC_DOCS_VOICE_ASSISTANT=false
DOCS_VOICE_ASSISTANT_ENABLED=false
OPENAI_REALTIME_MODEL=gpt-realtime
OPENAI_REALTIME_VOICE=marin
OPENAI_REALTIME_VOICE_FEMALE=marin
OPENAI_REALTIME_VOICE_MALE=cedar
NEXT_PUBLIC_OPENAI_REALTIME_VOICE_FEMALE=marin
NEXT_PUBLIC_OPENAI_REALTIME_VOICE_MALE=cedar
OPENAI_REALTIME_TRANSCRIPTION_MODEL=gpt-4o-transcribe
NEXT_PUBLIC_DOCS_EDIT_URL=
NEXT_PUBLIC_DOCS_FEEDBACK_ENDPOINT=
NEXT_PUBLIC_DOCS_ANALYTICS=false
NEXT_PUBLIC_DOCS_ANALYTICS_SCRIPT_URL=
NEXT_PUBLIC_DOCS_ANALYTICS_WEBSITE_ID=
```

`OPENAI_API_KEY` is optional. Search, Markdown exports, generated API pages, and the MCP endpoint work without it. Add it when you want the top-bar **Chat** button to answer with AI. Set the voice variables only when you enable the top-bar **Audio** button. AI chat, voice, and transcription use paid provider API usage when enabled.

## Writing docs

Create or edit root-level `.mdx` files. Each page should include frontmatter:

```mdx
---
title: "Installation"
description: "Install the project and verify that it works."
---
```

Add new page slugs to `site.config.ts` so they appear in the sidebar, search index, and generated `llms.txt` files.

Use the templates in `templates/` when you want a starting point for a guide, API reference page, or changelog.

## Deploy to Vercel

1. Push this repo to GitHub, GitLab, or Bitbucket.
2. Import it in Vercel.
3. Keep the detected framework as **Next.js**.
4. Add `NEXT_PUBLIC_SITE_URL` with your deployed URL.
5. Add `OPENAI_API_KEY` only if you want AI chat or voice chat.
6. Click **Deploy**.

The app is designed to run on Vercel's free Hobby plan for personal and open-source documentation sites. Check Vercel's current plan documentation before relying on specific limits.

## Key files

- `site.config.ts`: Main customization API.
- `index.mdx`: Home page.
- `app/globals.css`: Theme and component styles.
- `components/mdx-components.tsx`: MDX component registry.
- `lib/docs.ts`: Page loading and navigation helpers.
- `lib/api-specs.ts`: OpenAPI and AsyncAPI page generation.
- `scripts/validate-docs.ts`: Frontmatter, navigation, link, heading, and spec validation.
- `app/mcp/route.ts`: MCP endpoint with docs tools, resources, and prompts.
- `app/api/voice/session/route.ts`: Optional OpenAI Realtime ephemeral session route.

## License

MIT
