# Action Tracker — Design Library Builder
Last updated: 2026-07-22

## Open

### ACT-3: Manual Mode A UAT — verify merged PR #1 UI changes in browser
**Requested:** 2026-07-22
**Asked for:** "i will log in as von.ellis@enterpriseds.io to see if it actually happened successfully end to end"
**Expected outcome:** User confirms in their browser that (1) Showcase renders typed components not generic blue buttons, (2) Libraries tab shows a saved library, (3) Export → Figma Plugin Bundle downloads a real zip with plugin.js + ui.html + manifest.json
**Acceptance criteria:**
- AC-1: Showcase screen shows component cards where checkboxes look like checkboxes, cards show data field rows, badges show pill shapes — none render as identical blue rectangles
- AC-2: Libraries tab lists at least one saved library (the one saved via uat-extract.yml UAT run)
- AC-3: Export → "Figma Plugin Bundle" download produces a zip containing manifest.json, plugin.js, ui.html, design-system.json, README.md
**Status:** open — waiting on user browser verification
**Blocker:** Mode A Playwright blocked by CCR egress proxy; user must verify manually

---

### ACT-4: Wire mandatory eds-claude-skills into Stop hook + settings.json
**Requested:** 2026-07-22
**Asked for:** "all the skills in the eds Claude skills repo used unless it absolutely makes no sense... the ones about memory, tracking, acceptance and review should be required"
**Expected outcome:** `.claude/settings.json` Stop hook injects a system reminder at every turn end listing all mandatory skills and what evidence is required before marking done. memory.md and actions.md bootstrapped and committed.
**Acceptance criteria:**
- AC-1: `.claude/settings.json` exists with a Stop hook whose additionalContext lists all 6 mandatory skills
- AC-2: `.claude/memory.md` exists, is populated with current architecture/feature/decision state, committed to main
- AC-3: `.claude/actions.md` exists, is populated with open/closed actions, committed to main
- AC-4: On next session start, reading memory.md surfaces what was last in progress without needing to re-read the full conversation
**Status:** in-progress

---

## Closed

### ACT-1: Fix component rendering — all components showing as identical blue buttons
**Requested:** 2026-07 (prior session)  **Closed:** 2026-07-21
**Asked for:** Every component in Showcase renders as a generic blue button regardless of type
**Expected outcome:** Each component type renders with its correct visual affordance
**Evidence:** Commit 3ec0361 — `detectComponentType` + `ComponentPreview` in Showcase.jsx; `detectType` + `buildRender` in storiesHandler
**Verification:** PARTIAL — Mode B (code review) confirmed correct implementation; Mode A Playwright UNVERIFIED (CCR proxy blocks Chromium)

### ACT-2: Build real Figma plugin + update Export page
**Requested:** 2026-07 (prior session)  **Closed:** 2026-07-21
**Asked for:** "Figma Plugin Bundle" download should produce a real runnable plugin, not just a README
**Expected outcome:** Download zip contains manifest.json + plugin.js + ui.html that can be imported into Figma and run to create variables/styles/components
**Evidence:** Commits 3ec0361 + 0b93da7 — figma-plugin/ directory, v2/public/figma-plugin/ static assets, downloadPluginBundle() in Export.jsx
**Verification:** PARTIAL — Mode B confirmed files present and zipped correctly; Mode A UNVERIFIED

---

## Decisions & scope changes
- [2026-07-22] Established mandatory skill order: remember (session start/end) → track-actions (on task assign/close) → define-acceptance-criteria (before coding) → verify-work + verifier agent (after implementation) → design-library-uat (after API/pipeline changes)
- [2026-07-22] Mode A Playwright UAT acknowledged as blocked in CCR environment — must be done by user in browser or in CCR env with browser-capable egress policy; this is a known infrastructure gap not a task failure
- [2026-07-22] eds-claude-skills repo updated with: remember.md, track-actions.md, verifier agent — pulled and in use
