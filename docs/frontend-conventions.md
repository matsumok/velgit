# Frontend Conventions

Conventions for Tailwind CSS and shadcn/ui usage in this project.

## Formatting

Run the appropriate formatter before every commit.

| Target | Tool | Command |
|--------|------|---------|
| `.ts` / `.tsx` | Biome | `pnpm biome format --write .` |

Do not commit unformatted files.

## shadcn/ui components

- Components installed under `src/components/ui/` are **not to be edited**.
- Use them as-is. If customization is needed, wrap them in a new component outside `src/components/ui/`.
- `src/components/ui/` is excluded from Biome formatting and linting.

## Tailwind CSS

### No arbitrary values

Do not use arbitrary value notation. Use design tokens and the Tailwind scale instead.

```tsx
// Bad
<div className="w-[240px] h-[calc(100%-1rem)] text-[#3b82f6]" />

// Good
<div className="w-60 h-full text-blue-500" />
```

### No fractional scale values

Do not use fractional steps in the Tailwind spacing/sizing scale (e.g. `1.5`, `2.5`, `3.5`). Use whole-number steps only.

```tsx
// Bad
<div className="top-3.5 gap-2.5 size-1.5" />

// Good
<div className="top-3 gap-2 size-2" />
```

### Colors via CSS variables only

Use semantic color tokens defined as CSS variables. Do not hardcode color values.

```tsx
// Bad
<p className="text-[#ff0000]" />

// Good
<p className="text-destructive" />
```

### No `!` prefix

Do not use the `!important` modifier prefix.

```tsx
// Bad
<p className="!text-red-500 !mt-0" />

// Good — restructure styles to avoid the need for overrides
<p className="text-red-500 mt-0" />
```

### Responsive design with breakpoint prefixes

Use Tailwind's responsive prefixes for layout changes. Do not check screen width in JavaScript.

```tsx
// Bad
const isMobile = window.innerWidth < 768
<div style={{ flexDirection: isMobile ? "column" : "row" }} />

// Good
<div className="flex flex-col md:flex-row" />
```

### Always use `cn()` for conditional classes

Use the `cn()` utility from `@/lib/utils` for all conditional or merged class names.

```tsx
// Bad
<div className={`base-class ${isActive ? "active" : ""}`} />
<div className={clsx("base-class", isActive && "active")} />

// Good
import { cn } from "@/lib/utils"
<div className={cn("base-class", isActive && "active")} />
```
