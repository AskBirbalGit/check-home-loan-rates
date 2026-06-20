# Decision records

Durable records of architecturally significant decisions in this repo (ADR-lite).

A decision belongs here when someone will plausibly ask "why is it like this?" later: a
framework or library choice, a data model, an API shape, a security tradeoff, a notable
deviation from the obvious approach. Small, reversible choices stay in the daily journal.

## Conventions

- One decision per file, named `NNNN-short-title.md` (e.g. `0007-use-sqlite-for-cache.md`).
- `NNNN` is a zero-padded sequential number. Never reuse a number.
- Decisions are immutable once `Accepted`. To change one, write a new record and mark the old
  one `Superseded by NNNN`.

## Status values

- `Proposed` — under discussion.
- `Accepted` — in effect.
- `Superseded by NNNN` — replaced by a later decision.
- `Deprecated` — no longer relevant, not replaced.

## Template

Copy the structure of an existing record. Each one has: Status, Date, Context, Decision,
**Rationale (the why)**, Consequences, and Alternatives considered.
