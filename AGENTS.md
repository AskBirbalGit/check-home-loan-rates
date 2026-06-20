# 0618 cibil-based-ir

## Why-Journal Protocol

This repo records the **why** behind every change in `docs/why/`, and that history is meant to
be **consulted, not just written**. Follow this loop on every task.

### 1. Read first — search the why before you act

Before changing any code or config, search `docs/why/` for prior context, and read what you find:

```sh
rg -il "<keyword|filename|entity>" docs/why/      # files that mention the topic
rg -i  "Touches:.*<entity>" docs/why/             # blame a specific entity
```

Also skim `docs/why/INDEX.md` for the topic/entity map. If a prior **decision** covers what
you're about to do, honor it. If you must deviate, say so explicitly and supersede it with a new
decision record — don't silently contradict it.

This read-first step is required for tasks that **change code or config**. Skip it only for
pure read-only questions and trivial edits (e.g. fixing a typo).

### 2. Act

Make the change, informed by what the history told you.

### 3. Write — capture the why

**Always**, after changing code or config, add an entry to today's journal file
`docs/why/journal/YYYY-MM-DD.md` (create it from an existing day's file if missing). Record:
- **Ask** — what the user asked for (intent, not implementation).
- **Changed** — files/areas touched.
- **Why** — the rationale: why this approach, what problem it solves, what constraint shaped it.
- **Tags** — comma-separated topics (e.g. `auth, billing`). Reuse existing tags where possible.
- **Touches** — comma-separated entities (e.g. `users.email, env/STRIPE_KEY, deps/stripe`) so
  the change is greppable at the entity level.
- **Decision** — link to a decision record if significant; else "—".
- **Agent** — your agent/model name, if known.

Then **update `docs/why/INDEX.md`**: add/refresh the topic and entity rows for what you touched.

**When you make an architecturally significant choice** (framework/library pick, data model,
API shape, security tradeoff, notable deviation from the obvious approach), also write a decision
record in `docs/why/decisions/NNNN-short-title.md` (next sequential number), following
`docs/why/decisions/README.md`, and link to it from the journal entry.

### Principles
- Capture the why **as you work**, from the context that produced the change — don't reconstruct
  it later from the diff.
- Keep entries short and honest. Reasoning over changelog.
- Keep `Tags`/`Touches` concrete and consistent so search stays useful.
- Never delete or rewrite past entries or decision records; supersede instead.

See `docs/why/README.md` for the full explanation and `docs/why/SEARCH.md` for search recipes.
