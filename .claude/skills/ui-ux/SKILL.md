---
name: ui-ux
description: UI/UX design and review guidance for the UCL Fantasy app (Next.js 16 App Router, React 19, Tailwind v4). Covers this project's dark-theme design tokens, component conventions, server/client boundaries for interactive UI, accessibility, and responsive layout. Triggers on "UI", "UX", "design", "styling", "Tailwind", "layout", "component", "accessibility", "a11y", "responsive", "make it look", "page", "form", "button".
---

# UI/UX guide — UCL Fantasy

Use this when building or reviewing any user-facing screen in `src/app/**` or `src/components/**`.
The goal is a consistent, accessible, dark-mode-first fantasy-football UI that matches the
existing pages (`ChipShop`, `DraftBoard`, `AdminPanel`, `standings`).

## Stack constraints (read before writing UI)

- **Next.js 16 App Router + React 19.** APIs differ from older Next — consult
  `node_modules/next/dist/docs/` before using framework features (per `AGENTS.md`).
- **Tailwind v4** via `@import "tailwindcss"` in `src/app/globals.css`. Theme tokens are
  declared with `@theme inline` — no `tailwind.config.js`. Add design tokens as CSS variables
  there, not in a JS config.
- **Fonts:** Geist Sans / Geist Mono, wired in `src/app/layout.tsx` as `--font-geist-sans` /
  `--font-geist-mono`. Use `font-mono` for numbers (points, prices, countdowns).
- Pages are `export const dynamic = 'force-dynamic'` (live fantasy data) — don't rely on static
  rendering or `generateStaticParams`.

## Server vs client components

- **Default to Server Components.** Fetch data (Prisma) on the server, pass plain props down.
- Add `"use client"` only to leaves that need state/interaction (forms, pickers, buttons that
  mutate). Mirror `ChipShop.tsx`: server page loads data → client component handles UI state.
- **Mutations go through Server Actions** (`src/app/*/actions.ts`) invoked from client components
  via `useTransition`. Show pending state (`disabled` + reduced opacity) and a result message.
  Never fetch in a client `useEffect` when a server action or server-rendered prop will do.

## Design tokens & palette

UEFA Champions League look: deep navy aurora background with electric cyan/blue
as the primary accent and magenta/violet highlights. Tokens are defined in
`globals.css` via `@theme inline` — use the semantic class names, never raw hex
or `slate-*`/`indigo-*` (those were the old theme and are gone).

| Role | Token classes |
|------|---------------|
| Page background | body sets the navy aurora gradient — pages just `flex min-h-screen flex-col` |
| Card / panel | `card-surface rounded-2xl p-4` (frosted navy, custom utility) |
| Primary action | `bg-gradient-to-r from-ucl-cyan to-ucl-blue text-[#04122e]` |
| Secondary button | `bg-ucl-blue text-white hover:bg-ucl-cyan hover:text-[#04122e]` |
| Surfaces | `bg-surface`, `bg-surface-2`; borders `border-border` |
| Text | body `text-foreground`; muted `text-muted` |
| Brand text | `text-brand` utility (cyan→blue gradient clip) |
| Success | `text-ok` / `bg-ok/15` |
| Warning | `text-warn` (deadlines, cautions) |
| Error | `text-bad` |
| Accents | `ucl-cyan`, `ucl-blue`, `ucl-magenta`, `ucl-violet` |

Custom utilities in `globals.css`: `card-surface`, `text-brand`, `skeleton`,
`pitch-turf`. Named keyframe animations: `animate-[pop_…]`, `rise`, `fade`,
`shimmer`, `pulse-ring`, `count-glow`.

Disabled controls: `disabled:opacity-40` (+ `disabled:grayscale` on gradient
buttons) plus a truthy `disabled` prop, never just visual.

## Animation (Framer Motion — `motion` dep)

- Shared primitives live in `src/components/ui/motion.tsx`: `Reveal`,
  `Stagger`/`StaggerItem`, `Pressable`, `AnimatedNumber` (count-up). Reuse these
  instead of re-declaring variants.
- Entrance: fade+rise with ease `[0.16, 1, 0.3, 1]`, ~0.4–0.45s; stagger lists at
  ~0.05–0.07s children delay.
- Interaction: `whileHover={{ y: -3, scale ~1.05 }}`, `whileTap={{ scale ~0.95 }}`,
  spring `stiffness ~400, damping ~24`.
- Overlays use `AnimatePresence`; the shared `Modal` in `DraftBoard.tsx` is the
  bottom-sheet-on-mobile pattern (spring slide-up + backdrop fade + Escape/close).
- Respect reduced motion — `globals.css` already neutralizes CSS animations under
  `prefers-reduced-motion`; keep motion subtle and non-blocking.

## Pitch / Team-Selection View

`src/components/ui/Pitch.tsx` renders the FPL-style formation: starting rows
(attackers top → keeper bottom) + a bench strip, using `PitchSlot`s (filled shirt
or empty "+"). `DraftBoard.tsx` owns selection state and builds slots via
`buildSlots`; empty slots open the player picker `Modal`, filled shirts open the
captain/bench/remove action sheet. Kits are colour-coded per position. Prefer
extending these over building a new pitch.

## Layout conventions

- Center content: `mx-auto max-w-4xl px-6 py-8` (narrower forms `max-w-md`/`max-w-2xl`).
- Card grids: `grid gap-4 sm:grid-cols-2 lg:grid-cols-3` — mobile-first, one column by default.
- Header metadata rows: `flex flex-wrap items-center gap-4 text-sm`.
- Root shell is `min-h-full flex flex-col` (`layout.tsx`) — new full-height sections build on that.
- Always design the small-screen layout first, then add `sm:`/`lg:` breakpoints.

## Accessibility (required, not optional)

- Every interactive element must be a real `<button>`, `<a>`, `<input>`, or `<select>` — no
  click handlers on `<div>`. (Existing code follows this; keep it.)
- Inputs need an associated `<label>` (or `aria-label` when a visible label is impossible).
- Icons/emoji that convey meaning need text too (e.g. "First chip free 🎁" — the words carry it).
- Visible focus states: prefer `focus:border-indigo-500` / `focus:ring` over removing outlines.
  If you set `outline-none`, you MUST add a visible focus replacement.
- Color is never the only signal — pair it with text/icon (e.g. success ✓, deadline text).
- Result/status messages should be perceivable to screen readers (`role="status"` /
  `aria-live="polite"` for the `msg` pattern in `ChipShop`).

## Interaction patterns to reuse

- **Async action feedback:** optimistic-free pattern from `ChipShop` — `useTransition`, disable
  the trigger while `pending`, then set a `{ ok, text }` message (green/red).
- **Searchable picker:** filter + `.slice(0, 20)` cap, `max-h-56 overflow-y-auto`, highlight the
  selected row with `bg-indigo-600` and others with `hover:bg-slate-800`.
- **Deadline awareness:** compute `deadlinePassed` from the deadline and disable actions + show an
  amber notice, rather than letting the server action be the only guard.
- **Confirm / Cancel pairs:** primary `bg-indigo-600` button + a plain `text-slate-400` cancel.

## Review checklist (when asked to review UI)

1. Server/client boundary correct? Interactivity isolated to `"use client"` leaves?
2. Uses the palette/token classes above — no stray colors or inline hex?
3. Mobile-first responsive; grid collapses to one column on small screens?
4. All interactive elements are semantic + keyboard reachable with visible focus?
5. Pending/disabled/error/success states all handled for any mutation?
6. Numbers use `font-mono`; deadlines/points formatted consistently?
7. No layout shift from `force-dynamic` data — skeleton/empty states considered?

When adding a genuinely new pattern, prefer extracting a shared component in `src/components/`
over copy-pasting Tailwind strings across pages.
