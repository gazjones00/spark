# Frontend conventions

One rule per file kind, so new code doesn't copy whichever neighbour it lands
next to.

## File and folder naming

| What                                             | Convention                                                | Example                                                                 |
| ------------------------------------------------ | --------------------------------------------------------- | ----------------------------------------------------------------------- |
| Feature components (`src/features/*/components`) | PascalCase folder + same-named `.tsx` + `index.ts` barrel | `features/finance/components/QuickStats/QuickStats.tsx`                 |
| Shared UI primitives (`src/components/ui`)       | kebab-case flat files (shadcn style — leave as generated) | `components/ui/card.tsx`                                                |
| App shell & shared components (`src/components`) | kebab-case flat files                                     | `components/page-header.tsx`, `components/layouts/dashboard-layout.tsx` |
| Hooks (`hooks/`)                                 | camelCase, `use` prefix                                   | `features/finance/hooks/useDashboardData.ts`                            |
| Non-component modules (`lib/`, utils)            | kebab-case                                                | `features/finance/lib/dashboard-derivations.ts`                         |
| Routes (`src/routes`)                            | TanStack Router file conventions (kebab, `_` prefixes)    | `routes/_authenticated/dashboard.tsx`                                   |

Feature component folders may co-locate private pieces: helper components
(`AccountCard/SyncStatusBadge.tsx`), step/sub-component folders and hooks
(`ConnectAccountModal/steps/`, `ConnectAccountModal/hooks/`), and a `utils.ts`.
Only the barrel (`index.ts`) is imported from outside the folder.

Tests sit next to the unit they test: `Component/Component.test.tsx`,
`lib/module.test.ts`, `routes/route.test.tsx`.

## Route data loading and error handling

- Routes with data prefetch it in a `loader` via the router context's
  QueryClient (`context.queryClient.prefetchQuery(...)`) using the same query
  keys the component hooks use. Loaders stay thin — warm the cache, never
  block rendering on it; components own their loading/error/empty states via
  TanStack Query.
- Route-level failures render the nearest `errorComponent`; the
  `_authenticated` layout route provides one for every signed-in page, and the
  router's `defaultErrorComponent` is the global fallback.
