# StyleMe — Website

Marketing / landing page for StyleMe, built with Next.js 16 and Tailwind CSS 4. This is a standalone app separate from the main frontend.

## Setup

```bash
cd website
npm install
```

## Run

```bash
npm run dev       # development server
npm run build     # production build
npm run start     # serve production build
npm run lint      # run ESLint
```

## Structure

```
website/src/
└── app/
    ├── layout.tsx      Root layout with metadata and fonts
    ├── page.tsx        Landing page (hero, features, CTA)
    ├── globals.css     Tailwind base + custom styles
    └── favicon.ico
```

## Tech

- **Next.js 16** with App Router
- **React 19**
- **Tailwind CSS 4** via PostCSS
