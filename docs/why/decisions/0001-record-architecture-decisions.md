# 0001 — Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-06-20
- **Tags:** meta
- **Touches:** docs/why

## Context

This repo uses why-journal to capture the reasoning behind changes. We need a durable place for
architecturally significant decisions, separate from the daily journal.

## Decision

We will keep ADR-lite decision records in `docs/why/decisions/`, numbered sequentially, one
decision per file.

## Rationale (the why)

Plain-markdown records travel with the code, diff in PRs, and stay readable by any human or
agent. Numbering gives a stable reference the journal can link to.

## Consequences

Every architecturally significant choice gets a record. The daily journal links to these for the
durable why.

## Alternatives considered

- **A single decisions file** — rejected: grows unwieldy, hard to link to.
- **Only the daily journal** — rejected: big decisions get buried in chronological noise.
