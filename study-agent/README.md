# Study Flow Agent (Gemini + Next.js + PostgreSQL)

A web app that plans a student's study routine, generates daily tasks, and offers a sidebar chat agent using Google's Gemini LLM. Includes an internal calendar/scheduler and PostgreSQL via Prisma.

## Prerequisites

- Node.js 18+
- PostgreSQL database (local or cloud)
- Gemini API key ([Google AI Studio](https://aistudio.google.com/))

## Setup

1. Copy `.env.example` to BOTH `.env` (used by Prisma CLI) and `.env.local` (used by Next.js), then set values.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Generate Prisma client and run migrations (requires DATABASE_URL):

   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   ```

4. Start the dev server:

   ```bash

   npm run dev
   ```

## Scripts

- `npm run dev` – Start Next.js dev server
- `npm run build` – Build for production
- `npm run start` – Start production server
- `npm run prisma:migrate` – Create dev migration

## Notes

- Chat is powered by Gemini; set `GEMINI_API_KEY` in `.env.local`.
- Internal calendar is basic and can be improved with drag-drop and weekly view.
- No external calendar is used; all data stays in this app.
