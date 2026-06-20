# Why

This directory captures the **why** behind changes in this repo, in plain markdown — and is meant
to be **searched and consulted**, not just written.

Code and `git blame` tell you *what* changed and *when*. They rarely tell you *why* — and once
an AI agent's session ends, the intent behind a change is gone. This directory keeps that intent
alive so future readers (you, teammates, or the next agent) don't have to reverse-engineer it.

## Layout

- `journal/YYYY-MM-DD.md` — the daily running log. One entry per task.
- `decisions/NNNN-title.md` — durable, numbered decision records (ADR-lite).
- `INDEX.md` — an agent-maintained map of topics and entities.
- `SEARCH.md` — how to search the why (ripgrep recipes).

### Daily journal
A running log. One file per day, one entry per task. Each entry records the **ask** (what was
requested), what **changed**, the **why** (the rationale), plus **Tags** and **Touches** that
make it searchable. Fast to write; gives a chronological story of how the repo evolved.

### Decision records
Durable, numbered records for architecturally significant choices. When a decision is big enough
that someone will question it later, it gets its own permanent file with context, the decision,
the rationale, consequences, and rejected alternatives. See [`decisions/README.md`](./decisions/README.md).
Journal entries link up to a decision record when one exists.

## The read-first loop

Agents working here follow a read → act → write loop (see the "Why-Journal Protocol" in the
repo's `AGENTS.md`):

1. **Read first.** Before changing code or config, search `docs/why/` for prior context and
   honor existing decisions. See [`SEARCH.md`](./SEARCH.md).
2. **Act.** Make the change, informed by that history.
3. **Write.** Add a journal entry, update [`INDEX.md`](./INDEX.md), and write a decision record
   if the choice was significant.

## Searchable conventions

Every entry and decision carries two structured fields so the history is greppable:

- **`Tags:`** — topics, e.g. `auth, billing, perf`.
- **`Touches:`** — concrete entities, e.g. `users.email`, `env/STRIPE_KEY`, `deps/stripe`.
  This is what lets you "blame" a specific thing: `rg -i "Touches:.*users\.email" docs/why/`.

Keep these concrete and consistent so search stays useful.

## How to use it (humans)

- Browse [`INDEX.md`](./INDEX.md) for a birds-eye view, then use [`SEARCH.md`](./SEARCH.md)
  recipes to drill in.
- When you change code, add a journal entry to today's file in `journal/` (create it from an
  existing day's file if missing) and update the index.
- When you make a significant choice, write a decision record in `decisions/` and link to it.
- Keep entries short and honest. The goal is the reasoning, not a changelog.
