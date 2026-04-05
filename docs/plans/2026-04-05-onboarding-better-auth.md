# Onboarding Flow with Better Auth & Neobrutalism

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the existing single-screen onboarding with a multi-step neobrutalism-styled flow using Better Auth for email/password authentication, followed by display name, full-body photo, and selfie collection.

**Architecture:** Better Auth runs as a Next.js API route (`/api/auth/[...all]`) with SQLite storage. After Better Auth sign-up/sign-in, the frontend checks if the user has completed onboarding (name + photos). If not, it walks them through a step-by-step wizard. Photo/selfie data is sent to the existing FastAPI backend which handles face enrollment and stores the reference photo. The FastAPI JWT is stored alongside the Better Auth session for API calls.

**Tech Stack:** Better Auth, better-sqlite3, class-variance-authority, @radix-ui/react-slot, @radix-ui/react-label, clsx, tailwind-merge, tw-animate-css

---

### Task 1: Install Dependencies

**Files:**
- Modify: `frontend/package.json`

**Step 1: Install Better Auth + UI dependencies**

Run from `frontend/`:

```bash
npm install better-auth better-sqlite3 class-variance-authority @radix-ui/react-slot @radix-ui/react-label clsx tailwind-merge tw-animate-css
npm install -D @types/better-sqlite3
```

**Step 2: Verify installation**

Run: `cd frontend && node -e "require('better-auth'); require('better-sqlite3'); console.log('OK')"`
Expected: `OK`

**Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: add better-auth, neobrutalism UI deps"
```

---

### Task 2: Create Utility Functions (`cn` helper)

**Files:**
- Create: `frontend/src/lib/utils.ts`

**Step 1: Create the cn utility**

```typescript
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Step 2: Commit**

```bash
git add frontend/src/lib/utils.ts
git commit -m "feat: add cn() utility for class merging"
```

---

### Task 3: Update globals.css with Neobrutalism.dev Theme

**Files:**
- Modify: `frontend/src/app/globals.css`

Replace the entire file with a merged theme that combines the existing custom neo-* tokens (used by SegmentPlayground and TryOnPlayground) with the neobrutalism.dev design system tokens (needed by shadcn/neobrutalism UI components). Keep ALL existing `.neo-*` CSS classes intact since they're used throughout the app. Add the neobrutalism.dev `@theme inline` tokens (`--color-main`, `--color-background`, `--color-secondary-background`, etc.) alongside the existing ones.

Key additions to `@theme inline`:
```css
--color-main: var(--main);
--color-secondary-background: var(--secondary-background);
--color-main-foreground: var(--main-foreground);
--color-overlay: var(--overlay);
--color-ring: var(--ring);
--spacing-boxShadowX: var(--box-shadow-x);
--spacing-boxShadowY: var(--box-shadow-y);
--spacing-reverseBoxShadowX: var(--reverse-box-shadow-x);
--spacing-reverseBoxShadowY: var(--reverse-box-shadow-y);
--radius-base: var(--border-radius);
--shadow-shadow: var(--shadow);
--font-weight-base: var(--base-font-weight);
--font-weight-heading: var(--heading-font-weight);
```

Key additions to `:root`:
```css
--border-radius: 5px;
--box-shadow-x: 4px;
--box-shadow-y: 4px;
--reverse-box-shadow-x: -4px;
--reverse-box-shadow-y: -4px;
--heading-font-weight: 700;
--base-font-weight: 500;
--main: var(--neo-accent);
--main-foreground: #000000;
--secondary-background: var(--neo-surface);
--overlay: rgba(0,0,0,0.8);
--ring: var(--neo-ink);
--shadow: var(--box-shadow-x) var(--box-shadow-y) 0px 0px var(--border);
```

**CRITICAL:** Do NOT remove any existing `.neo-card`, `.neo-btn`, `.neo-input`, `.neo-press`, `.neo-tab-wrap`, `.neo-tab`, `.neo-tab-active`, `.neo-tag`, `.neo-code`, `.skeleton`, `.animate-fade-in-up`, `.animate-fill` classes. They are used by existing components.

**Step 1: Update globals.css**
**Step 2: Verify the dev server still compiles**: `cd frontend && npm run build` (or just start dev)
**Step 3: Commit**

```bash
git add frontend/src/app/globals.css
git commit -m "feat: merge neobrutalism.dev design tokens into globals.css"
```

---

### Task 4: Create Neobrutalism UI Primitives

**Files:**
- Create: `frontend/src/components/ui/button.tsx`
- Create: `frontend/src/components/ui/input.tsx`
- Create: `frontend/src/components/ui/card.tsx`
- Create: `frontend/src/components/ui/label.tsx`

These are the shadcn/neobrutalism components fetched from the neobrutalism-components GitHub repo. They use the `cn()` utility and the theme tokens from Task 3.

**Step 1: Create Button component**

Use the exact code from `ekmas/neobrutalism-components` button.tsx (with `cva` variants: default, noShadow, neutral, reverse; sizes: default, sm, lg, icon). The button has `border-2 border-border shadow-shadow` with hover translate animation.

**Step 2: Create Input component**

Use the exact code from the repo. `border-2 border-border bg-secondary-background` with focus ring.

**Step 3: Create Card component**

Use the exact code from the repo. Includes Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter.

**Step 4: Create Label component**

Use the exact code from the repo. Uses `@radix-ui/react-label`.

**Step 5: Commit**

```bash
git add frontend/src/components/ui/
git commit -m "feat: add neobrutalism UI primitives (button, input, card, label)"
```

---

### Task 5: Set Up Better Auth Server

**Files:**
- Create: `frontend/src/lib/auth-server.ts`
- Create: `frontend/src/app/api/auth/[...all]/route.ts`
- Modify: `frontend/.env.local` (create if doesn't exist)

**Step 1: Create .env.local**

```env
BETTER_AUTH_SECRET=styleme-dev-secret-change-in-prod
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

**Step 2: Create auth server instance**

`frontend/src/lib/auth-server.ts`:

```typescript
import { betterAuth } from "better-auth";
import Database from "better-sqlite3";

export const auth = betterAuth({
  database: new Database("./sqlite.db"),
  emailAndPassword: {
    enabled: true,
  },
});
```

**Step 3: Create API route handler**

`frontend/src/app/api/auth/[...all]/route.ts`:

```typescript
import { auth } from "@/lib/auth-server";
import { toNextJsHandler } from "better-auth/next-js";

export const { POST, GET } = toNextJsHandler(auth);
```

**Step 4: Run database migration**

```bash
cd frontend && npx @better-auth/cli migrate
```

This creates the `user`, `session`, `account`, and `verification` tables in `sqlite.db`.

**Step 5: Add sqlite.db to .gitignore**

Append `sqlite.db` to `frontend/.gitignore`.

**Step 6: Verify by starting dev server**

```bash
cd frontend && npm run dev
```

Visit `http://localhost:3000/api/auth/ok` — should return a response (Better Auth health check).

**Step 7: Commit**

```bash
git add frontend/src/lib/auth-server.ts frontend/src/app/api/auth/ frontend/.env.local frontend/.gitignore
git commit -m "feat: set up Better Auth server with SQLite"
```

---

### Task 6: Create Better Auth Client

**Files:**
- Create: `frontend/src/lib/auth-client.ts`

**Step 1: Create client**

```typescript
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "http://localhost:3000",
});
```

**Step 2: Commit**

```bash
git add frontend/src/lib/auth-client.ts
git commit -m "feat: add Better Auth React client"
```

---

### Task 7: Build the Multi-Step Onboarding Flow

**Files:**
- Create: `frontend/src/components/onboarding/OnboardingFlow.tsx`
- Create: `frontend/src/components/onboarding/StepAuth.tsx`
- Create: `frontend/src/components/onboarding/StepName.tsx`
- Create: `frontend/src/components/onboarding/StepPhoto.tsx`
- Create: `frontend/src/components/onboarding/StepSelfie.tsx`
- Create: `frontend/src/components/onboarding/StepComplete.tsx`
- Create: `frontend/src/components/onboarding/ProgressBar.tsx`
- Create: `frontend/src/components/onboarding/PhotoDropzone.tsx`

This is the core UI. All components use the neobrutalism UI primitives from Task 4.

#### OnboardingFlow.tsx — The Orchestrator

State machine with steps: `"auth" | "name" | "photo" | "selfie" | "complete"`. Renders a centered card with a progress bar at top and the active step component. Manages all onboarding state (Better Auth session, display name, photo files, FastAPI user).

Props: `onComplete: (user: User) => void` — called when onboarding finishes to hand off to AuthProvider.

State:
```typescript
type OnboardingState = {
  step: "auth" | "name" | "photo" | "selfie" | "complete";
  displayName: string;
  fullBodyFile: File | null;
  selfieFile: File | null;
};
```

Flow logic:
1. On mount, check Better Auth session via `authClient.useSession()`.
2. If session exists AND localStorage has `styleme_onboarded` flag, call `onComplete` immediately (returning user).
3. If session exists but no `styleme_onboarded`, start at step `"name"` (they authenticated but didn't finish onboarding).
4. If no session, start at step `"auth"`.

#### ProgressBar.tsx

A horizontal progress bar showing the current step. 4 segments with labels: Auth, Name, Photo, Selfie. Active step is highlighted with `bg-main` (accent color). Completed steps have a checkmark. Uses neobrutalism border styling.

#### StepAuth.tsx

Two-tab view: "Sign Up" and "Sign In".

**Sign Up tab:**
- Email input
- Password input (min 8 chars)
- Confirm password input
- "Create Account" button
- Calls `authClient.signUp.email({ email, password, name: "" })`
- On success, advances to "name" step

**Sign In tab:**
- Email input
- Password input
- "Sign In" button
- Calls `authClient.signIn.email({ email, password })`
- On success, check if `styleme_onboarded` exists in localStorage:
  - If yes: call `onComplete` directly (returning user, skip onboarding)
  - If no: advance to "name" step

Error display: neobrutalism-styled error card with bold border.

#### StepName.tsx

- "What should we call you?" heading
- Display name input
- "Continue" button (disabled if empty)
- On submit, saves displayName to parent state and advances to "photo"

#### PhotoDropzone.tsx (shared component)

A reusable drag-and-drop photo upload zone with image preview.

Props:
```typescript
{
  onFileSelect: (file: File) => void;
  file: File | null;
  label: string;
  description: string;
  accept?: string; // default "image/*"
}
```

Features:
- Dashed border neobrutalism zone
- Click to select or drag-and-drop
- Shows image preview after selection (URL.createObjectURL)
- "Change photo" button to re-select
- File type validation (images only)

#### StepPhoto.tsx

- "Strike a pose" heading
- Subtext: "Upload a full-length photo of yourself. We'll use this for virtual try-on."
- PhotoDropzone component
- "Continue" button (disabled if no file)
- "Skip for now" link (advances without photo — optional, discuss if we want this)

Actually, NO skip — both photos are required by the backend for face enrollment and try-on. Remove skip option.

#### StepSelfie.tsx

- "Show us your face" heading
- Subtext: "A clear selfie helps us find you in group photos."
- PhotoDropzone component
- "Finish setup" button (disabled if no file)
- On submit: calls `onboard(displayName, fullBodyFile, selfieFile)` from `@/lib/api`
- Shows loading state during upload
- On success: sets `styleme_onboarded` in localStorage, advances to "complete"
- On error: shows error message, stays on step

#### StepComplete.tsx

- Big checkmark or party emoji
- "You're all set!" heading
- "Welcome, {displayName}" subtext
- Auto-redirects to app after 2 seconds (or "Enter StyleMe" button)
- Calls `onComplete(user)` to hand off to AuthProvider

**Step 1: Create all onboarding components** (implement each file)
**Step 2: Verify no TypeScript errors**: `cd frontend && npx tsc --noEmit`
**Step 3: Commit**

```bash
git add frontend/src/components/onboarding/
git commit -m "feat: multi-step neobrutalism onboarding flow"
```

---

### Task 8: Update AuthProvider to Use Better Auth

**Files:**
- Modify: `frontend/src/components/auth/AuthProvider.tsx`
- Modify: `frontend/src/lib/auth.ts`

**Step 1: Update AuthProvider**

Rewrite `AuthProvider` to:
1. Use `authClient.useSession()` to check Better Auth session
2. If no session + no localStorage user → show `<OnboardingFlow />`
3. If session exists + `styleme_onboarded` in localStorage → load user from localStorage, render children
4. If session exists + no `styleme_onboarded` → show `<OnboardingFlow />` starting at "name" step
5. `signOut` now calls both `authClient.signOut()` and clears localStorage

Keep the existing `AuthContext` shape (`user`, `ready`, `signIn`, `signOut`) so existing components don't break. The `User` type stays the same (user_id, display_name, token from FastAPI).

**Step 2: Update auth.ts localStorage helpers**

Add helpers:
- `setOnboarded()` — sets `styleme_onboarded` flag
- `isOnboarded()` — checks flag
- `clearOnboarded()` — removes flag (used in signOut)

Update `clearToken()` to also remove `styleme_onboarded`.

**Step 3: Verify the full flow works**:
1. Start both servers: FastAPI on 8000, Next.js on 3000
2. Visit localhost:3000 — should see onboarding auth step
3. Sign up with email/password
4. Complete name, photo, selfie steps
5. Should land in main app
6. Refresh — should stay authenticated
7. Sign out — should return to auth step

**Step 4: Commit**

```bash
git add frontend/src/components/auth/AuthProvider.tsx frontend/src/lib/auth.ts
git commit -m "feat: integrate Better Auth into AuthProvider with onboarding flow"
```

---

### Task 9: Polish & Animations

**Files:**
- Modify: Various onboarding components

**Step 1: Add step transition animations**

Add CSS keyframe animations for step transitions:
- Fade-in-up for entering steps (reuse existing `.animate-fade-in-up`)
- Subtle scale-in for the completion checkmark

**Step 2: Add loading states**

- Skeleton/shimmer on the auth check (before showing onboarding)
- Spinner on the "Finish setup" button during photo upload
- Disabled state styling on all buttons during async operations

**Step 3: Verify all animations work**
**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add animations and loading states to onboarding"
```

---

### Task 10: Clean Up & Final Verification

**Step 1: Remove old OnboardingScreen**

The old `OnboardingScreen` function in `AuthProvider.tsx` should be fully replaced by this point. Verify no dead code remains.

**Step 2: Type check**

```bash
cd frontend && npx tsc --noEmit
```

**Step 3: Build check**

```bash
cd frontend && npm run build
```

**Step 4: Manual E2E test**

1. Delete `sqlite.db` and localStorage to start fresh
2. Start both servers
3. Full sign-up flow: email → password → name → photo → selfie → app
4. Refresh: stays authenticated
5. Sign out: returns to auth
6. Sign in: email → password → straight to app (onboarded flag exists)
7. New incognito window: fresh sign-up works

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete neobrutalism onboarding with Better Auth"
```
