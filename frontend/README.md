# StyleMe — Frontend

Main application frontend built with Next.js 16, React 19, TypeScript, and Tailwind CSS 4. Provides the user-facing wardrobe management, outfit recommendation, and virtual try-on experience.

## Setup

```bash
cd frontend
npm install
```

A `.env.local` file is auto-created on first `npm run dev` via the predev script. Override if needed:

```env
BETTER_AUTH_SECRET=<random-secret>
BETTER_AUTH_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://127.0.0.1:8001
```

## Run

```bash
npm run dev       # development server (usually http://localhost:3000)
npm run build     # production build
npm run start     # serve production build
npm run lint      # run ESLint
```

## Project structure

```
frontend/src/
├── app/
│   ├── layout.tsx              Root layout (nav, fonts, auth provider)
│   ├── page.tsx                Home / landing
│   ├── globals.css             Tailwind base + custom theme
│   ├── upload/page.tsx         Upload clothing photos
│   ├── wardrobe/page.tsx       Browse & manage wardrobe
│   └── api/auth/[...all]/      Better Auth API route
├── components/
│   ├── AppNav.tsx              Top navigation bar
│   ├── UploadPlayground.tsx    Upload + AI scraping UI
│   ├── TryOnPlayground.tsx     Virtual try-on UI
│   ├── auth/                   Auth components (sign-in, sign-up)
│   ├── onboarding/             Onboarding flow (name, photos)
│   ├── outfit/                 Outfit recommendation cards
│   ├── wardrobe/               Wardrobe grid, garment cards
│   └── ui/                     Reusable primitives (button, card, input, etc.)
└── lib/
    ├── api.ts                  API client (fetch wrapper + auth headers)
    ├── auth-client.ts          Better Auth client config
    ├── auth.ts                 Better Auth server config
    ├── types.ts                Shared TypeScript interfaces
    └── utils.ts                Helpers (cn, formatters)
```

## Key pages

| Route | Description |
|-------|-------------|
| `/` | Home page with navigation to features |
| `/upload` | Drag-and-drop clothing upload with AI metadata extraction |
| `/wardrobe` | Searchable wardrobe grid with filters |

## Tech

- **Next.js 16** with App Router
- **React 19** with server components
- **Tailwind CSS 4** via PostCSS
- **Better Auth** for authentication (SQLite-backed)
- **Radix UI** primitives for accessible components
- **shadcn/ui** pattern for component library
