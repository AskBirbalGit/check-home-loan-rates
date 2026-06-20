# Searching the why

This repo records the reasoning behind changes in `docs/why/`. This is how to search it. All
recipes use [ripgrep](https://github.com/BurntSushi/ripgrep) (`rg`); plain `grep -r` works too.

## The conventions that make search work

Every journal entry and decision record carries two structured fields:

- **`Tags:`** — free-text topics, e.g. `auth, billing, perf`.
- **`Touches:`** — concrete entities, e.g. `users.email`, `env/STRIPE_KEY`, `deps/stripe`,
  `api/v1/checkout`. This is what lets you "blame" a specific thing.

Keep these consistent and search stays sharp.

## Recipes

```sh
# Blame an entity — every change/decision that touched it, with the why
rg -i "Touches:.*users\.email" docs/why/

# Everything tagged with a topic
rg -i "Tags:.*billing" docs/why/

# Free-text search across all reasoning
rg -i "stripe" docs/why/

# Find decisions about a topic (decisions live in decisions/)
rg -il "rate.?limit" docs/why/decisions/

# What changed on a given day
cat docs/why/journal/2025-10-14.md

# All changes mentioning a file or symbol
rg -il "checkout" docs/why/journal/

# List entries newest-first by filename
ls -r docs/why/journal/
```

## The index

`docs/why/INDEX.md` is an agent-maintained map: a Topics table (tag → entries/decisions) and an
Entities table (entity → where it's touched and why). Start there for a birds-eye view, then drop
to `rg` for detail. If the index looks stale, trust `rg` over the raw files — the structured
`Tags`/`Touches` fields are the source of truth.
