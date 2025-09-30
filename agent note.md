# Agent Collaboration Notes

Author: Human project owner (FM Tool)
Scope: PDF watermarking + digital signature SaaS (frontend: React/Vite, backend: Node/Express)

## Execution Mode
- While database is not yet provisioned, ALWAYS run backend with `USE_INMEMORY_STORAGE=true` and `ALLOW_START_WITHOUT_DB=true`.
- During this phase: persistence durability is NOT required; functional completeness and API stability ARE required.
- Do NOT introduce DB-only features that break in-memory mode unless explicitly approved.

## Auth Mode
- Temporary setting: `DISABLE_AUTH=true` for rapid UI iteration.
- When re‑enabling auth later: keep routes backward compatible (avoid breaking the frontend silently). Provide graceful 401 handling.

## File & PDF Processing
- All transformations (watermark/signature) must produce a NEW derivative file; never overwrite the original.
- Provide URLs relative to `/static/`.
- Plan to track derivative lineage later (do not hardcode assumptions that would block this).

## Coding Standards
- Keep changes **minimal and surgical**; avoid broad refactors unless requested.
- Prefer pure functions in services; controllers should stay thin.
- Add validation before expanding logic (e.g., zod/joi) but only when a feature touches that surface.
- Log actionable errors (context + id) but avoid leaking internals to clients.

## Performance & Safety Interim Rules
- PDF ops may be synchronous for now; defer worker queue integration until requested.
- Enforce max file size 25MB (already in place). Do not raise without approval.
- Avoid adding new large dependencies without justification.

## Naming & API Stability
- Avoid renaming existing response properties unless a compatibility shim is added.
- If adding fields, append rather than replace.

## Frontend Conventions
- Use existing Axios instance in `frontend/src/api/http.js` for new calls.
- Keep state local unless cross-page usage is clear.
- Reuse MUI components + existing styling tone.

## Logging & Debug
- Use existing `logger` utility on backend; never use `console.log` for new permanent logs (except very early scaffolding which should later be converted).

## Git / Change Discipline
- Group related edits logically.
- Do not introduce dead code or commented blocks unless marked `// TODO(owner): ...`.

## Security Placeholders (to implement later)
- Input validation layer
- Signature audit trail
- File derivative provenance tracking
- Role-based review dashboard

## When Unsure
- Make at most **one** reasonable assumption; document it in PR / response.
- If ambiguity is high, ask a focused clarifying question (avoid broad questionnaires).

## Output / Responses Expectations
- Be concise; avoid restating unchanged earlier analysis.
- Provide delta-focused summaries after multi-file edits.
- Offer next-step suggestions only if they are immediately actionable.
 - Skip routine frontend build invocations after minor UI-only JSX/style edits unless: (a) build errors are suspected, (b) new dependencies were added, or (c) structural refactors occurred. User explicitly requested no automatic build spam.

## Non-Goals For Now
- No deployment / containerization work yet.
- No CI/CD pipeline wiring yet.
- No frontend global state library introduction.

## Success Criteria (Current Phase)
1. Backend & frontend run fully in memory mode without DB.
2. Watermark + signature flows work end-to-end with auth disabled.
3. Clear path to later enable DB & auth with minimal rewrite.

---
Last updated: 2025-09-26 – Added rule to skip automatic frontend builds for minor UI edits per owner request.
