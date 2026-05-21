## Frontend conventions

See `docs/frontend-conventions.md` for Tailwind CSS and shadcn/ui coding conventions.

Key rules: no arbitrary values (`w-[...]`), CSS variables for colors, no `!` prefix, responsive via breakpoint prefixes, always use `cn()`. `src/components/ui/` is read-only — wrap, don't edit.

## Agent skills

### Issue tracker

Issues live in GitHub Issues (`matsumok/velgit`). See `docs/agents/issue-tracker.md`.

### Triage labels

Uses default triage label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
