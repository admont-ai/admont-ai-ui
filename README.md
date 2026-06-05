# admont-ai-ui

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6.svg)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-7-646cff.svg)](https://vite.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8.svg)](https://tailwindcss.com)

The frontend for [Admont-AI](https://github.com/christianfischer/admont-ai) — a collaborative document platform with Git-backed storage, hybrid search, and AI-powered content tools.

Built with React 19, TypeScript, Vite, Tailwind CSS v4, and shadcn/ui.

## Features

- **WYSIWYG Markdown Editor** — Rich editing with MDXEditor (Lexical-based): tables, code blocks, math (KaTeX), embedded media, and live preview
- **Multi-Format Support** — Markdown, Mermaid diagrams, Draw.io diagrams, LaTeX, images, video, and plain text
- **File Tree Sidebar** — Drag-and-drop file and folder management with multi-select and custom ordering
- **Draft Workflow** — Auto-saving drafts with three-way merge on publish
- **Hybrid Search** — Full-text, semantic, and combined search across all repositories
- **AI Assistant** — Ask questions (RAG), generate content, and polish text with multi-turn conversations and model selection
- **Version History** — View commit history, compare diffs, and restore previous versions
- **Permission Management** — Granular file and folder access control with group support
- **Admin Panel** — Manage users, groups, repositories, auth providers, LLM providers, and search engines

## Prerequisites

- **Node.js 22+**
- **admont-ai-api** running on `localhost:8080` (or configure the proxy target)

## Getting Started

```sh
npm install
npm run dev
```

The dev server starts on `http://localhost:5174` and proxies API requests to the backend.

## Development

```sh
npm run dev       # Start dev server with HMR
npm run build     # Type-check and build for production
npm run lint      # Run ESLint
npm run preview   # Preview production build
```

### API Proxy

The Vite dev server proxies these paths to `http://localhost:8080`:

| Path | Description |
|------|-------------|
| `/auth/*` | OAuth login flow |
| `/login`, `/consent` | Internal auth |
| `/me` | User info and permissions |
| `/admin` | Admin endpoints |
| `/llm` | LLM model listing and actions |
| `/checker` | Grammar and spelling checker |
| `/conversations` | AI conversation persistence |
| `/repos` | Repository, file, search, and RAG endpoints |

### Authentication

The app supports multiple OAuth providers (Google, GitHub, Okta, Azure AD, and more) configured on the backend. After authenticating, a JWT is stored in `localStorage` and attached as a `Bearer` token to all API requests. Sessions persist across page reloads until the token expires (24 hours), at which point the user is automatically logged out.

## Production Build

```sh
npm run build
```

Output is written to `dist/`. The production web server must serve `index.html` for all paths that don't match a static file (SPA routing).

**Nginx example:**

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

## Tech Stack

| Technology | Purpose |
|-----------|---------|
| [React 19](https://react.dev) | UI framework |
| [TypeScript 5.9](https://www.typescriptlang.org) | Type safety |
| [Vite 7](https://vite.dev) | Build tool and dev server |
| [Tailwind CSS v4](https://tailwindcss.com) | Styling |
| [shadcn/ui](https://ui.shadcn.com) | Component library (Radix UI primitives) |
| [MDXEditor](https://mdxeditor.dev) | WYSIWYG markdown editor (Lexical-based) |
| [Monaco Editor](https://microsoft.github.io/monaco-editor) | Code and plain text editing |
| [React Flow](https://reactflow.dev) | Mermaid diagram visual editor |

## Project Structure

```
src/
├── components/
│   ├── layout/       # Page-level components (editors, sidebar, dialogs, panels)
│   └── ui/           # shadcn/ui base components
├── contexts/         # React context providers (auth)
├── hooks/            # Custom hooks (API calls, document state, AI)
├── lib/              # Utilities (auth-fetch, PDF export, Monaco config)
└── plugins/          # MDXEditor plugins (math, video)
```

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
