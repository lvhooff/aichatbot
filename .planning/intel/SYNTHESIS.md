# Synthesis Summary

Mode: new
Classifications consumed: 2 (from `.planning/intel/classifications/`)

## Doc counts by type
- ADR: 0
- SPEC: 0
- PRD: 0
- DOC: 2
  - `docs/superpowers/plans/2026-05-16-ai-voice-chatbot.md` (medium confidence) — AI Voice Chatbot Implementation Plan
  - `docs/vad-mic-error-debug-handoff.md` (high confidence) — VAD "Mic error" Debug Handoff

## Cycle detection
No cross-doc reference cycles found. The debug handoff's `cross_refs` point to source code files (not other planning docs); the plan has no `cross_refs`.

## Decisions locked
0 — no ADR-classified documents in this ingest set. `decisions.md` is a placeholder.

## Requirements extracted
0 — no PRD-classified documents in this ingest set. `requirements.md` is a placeholder.

## Constraints
0 — no SPEC-classified documents in this ingest set. `constraints.md` is a placeholder.

## Context topics
2 — both DOC-classified sources extracted verbatim (with source attribution) into `context.md`:
1. AI Voice Chatbot Implementation Plan — goal, architecture, tech stack, 14-task build sequence, file map, settings model, barge-in behavior.
2. VAD "Mic error" Debug Handoff — resolved root causes (CSP `worker-src` via meta tag vs. HTTP header; ONNX Runtime WASM/`.mjs` path resolution under Vite), fixes applied, known production-build follow-up, approaches that did not work.

## Conflicts
- Blockers: 0
- Competing variants: 0
- Auto-resolved (precedence): 0
- Info: 1 — same-scope supersession note (debug handoff documents fixes to code the plan's Task 9/11 snippets show without those fixes; both docs are DOC-type so no precedence conflict, but downstream should treat the debug handoff as authoritative for `src/main/index.ts` CSP headers, `electron.vite.config.ts` dev middleware, and `src/renderer/hooks/useVAD.ts` asset-path config).

See `.planning/INGEST-CONFLICTS.md` for full detail.

## Per-type intel files
- `.planning/intel/decisions.md`
- `.planning/intel/requirements.md`
- `.planning/intel/constraints.md`
- `.planning/intel/context.md`
