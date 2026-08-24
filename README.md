# App2Class

A school management platform for the Israeli education system (Hebrew UI, RTL). Covers students, parents, teachers, subject/grade coordinators, counselors, management, and system admins in a single app.

## Features

- **Academics** — grades, attendance & roll call, subject hubs, syllabus planning, exam archive, grade progress reports
- **Scheduling** — bell schedule setup, track/הקבצה blocks, subject requirements, automatic timetable generation with feasibility checks, master scheduler
- **Task Studio** — quizzes, games, and a sandboxed Monaco-based mini-app IDE (HTML/CSS/JS or Python via Pyodide) for teacher-built interactive tasks, with an AI assistant and community gallery
- **AI Tutor** — a Gemini-backed tutoring assistant scoped to the student's own data
- **Documents** — a Word/Google-Docs-style rich text editor (ribbon toolbar, comments, track-changes, version history, Hebrew spell/grammar check) with real-time multi-user sharing
- **Student life** — seating maps, badges/streaks, school newspaper, bell-song voting, student council (elections, appointed roles, permissions)
- **Operations** — approvals workflows, meetings & meeting slots, finance hub, school org tree, chat, notifications
- **Admin** — system admin console, team/role management, school-scoped RLS across all tables

## Tech stack

- [Vite](https://vitejs.dev/) + [React 18](https://react.dev/) + TypeScript
- [shadcn-ui](https://ui.shadcn.com/) + [Tailwind CSS](https://tailwindcss.com/)
- [Supabase](https://supabase.com/) (Postgres, Auth, Storage, Edge Functions, Row-Level Security)
- [Google Gemini](https://ai.google.dev/) for AI features (tutor, task-studio assistant, grade-coordinator assistant, OCR)
- [Vitest](https://vitest.dev/) + Testing Library

## Getting started

**Prerequisites:** Node.js 20+ and npm.

```sh
# Install dependencies
npm install

# Create .env.local with your own Supabase/Gemini keys (see below)

# Start the dev server
npm run dev
```

### Environment variables

Create a `.env.local` file in the project root:

```
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_PROJECT_ID=your-supabase-project-id
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key
VITE_GEMINI_API_KEY=your-gemini-api-key
```

Server-side secrets (service role key, etc.) used by Supabase Edge Functions are configured separately in the Supabase project, not in this file.

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build |
| `npm run build:dev` | Development-mode build |
| `npm run preview` | Preview a production build locally |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run `tsc --noEmit` |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |

CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs `typecheck` and `test` on every push/PR to `main`.

## Project structure

```
src/
  pages/            top-level routes (landing, auth, registration) and pages/dashboard/* (role-based dashboard pages)
  components/       shared UI, layout, and feature-specific components (task-studio, timetable-builder, etc.)
  hooks/            data-fetching and auth hooks
  integrations/      Supabase client and generated types
supabase/
  migrations/       SQL migrations (schema + RLS policies)
  functions/        Edge Functions (ai-tutor, task-studio-ai, chat-moderate, ocr-extract, verify-student, admin-manage-user, grade-coordinator-ai)
infra/              supporting infrastructure (e.g. dictalm-space)
server/             local DB migration/check tooling
```

## Database

Schema and Row-Level Security policies live entirely in [supabase/migrations](supabase/migrations). All tables are school-scoped via RLS — access control is enforced at the database layer, not just in the UI. Apply migrations to a linked Supabase project with:

```sh
npx supabase db push
```

## Deployment

The app is a static SPA (Vite build) with client-side routing. [vercel.json](vercel.json) provides the rewrite rule needed for `BrowserRouter` on Vercel. Any static host that supports SPA fallback routing will work.
