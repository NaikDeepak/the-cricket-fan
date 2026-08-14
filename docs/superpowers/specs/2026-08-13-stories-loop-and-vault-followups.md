# Follow-ups: The Loop (stories/vault redesign)

Companion to `2026-08-13-stories-loop-and-vault-design.md` and the implementation
plan of the same date. Captures everything surfaced during execution and the
final whole-branch review that was correctly out of scope for the plan's 10
tasks, but needs an owner decision or a future round. The SDD ledger this was
extracted from has been deleted per the subagent-driven-development skill's
completion step (workspace is git-ignored, ephemeral) — this file is the
durable record.

---

## 1. Blocks a working deploy — owner decision required

The branch ships the **read path** (Vault, story detail, wire, on-this-day
rail, share cards) but **not the content writers**. On the branch tip, the
working tree still carries uncommitted, unrelated-to-this-plan WIP:

- `bot/scripts/seed_content_bank.py` (modified)
- `bot/scripts/harvest_wikipedia_stories.py` (untracked)
- `bot/scripts/harvest_cricsheet_thrillers.py` (untracked)
- `bot/run.py`, `bot/tests/test_run.py`, `bot/tests/test_seed_content_bank.py` (modified — recap wiring)
- `frontend/src/components/composer/cards/{Prediction,Record,Trivia}CardImg.tsx` (modified — `#TheCricketFan` branding)
- `frontend/next-env.d.ts` (modified, generated)

None of these are part of any of the plan's 10 task briefs — they're the
owner's separate, hand-authored content-pipeline work. Per `CLAUDE.md`,
content-bank seeding is explicitly **"hand-authored, owner-reviewed before
commit; not something to auto-run or stub with fake data"** — so the SDD run
correctly left them untouched and unstaged rather than sweeping them in.

**Consequence if merged as-is:** on a fresh DB built from committed code
alone, nothing populates `content_bank`'s story columns (`title`, `summary`,
`teams_json`, `year`, `tags_json`, etc.) or sets `is_published` explicitly on
insert. Every story falls back to `title = content_key` via `_row_to_story`.
The Vault, rail, and wire will all render, but empty/placeholder.

**Also:** the two untracked harvest scripts carry 31 pre-existing `ruff`
violations (3 `F401` unused-import, 28 `E501` line-length) that the owner
will need to clean up when reviewing and committing them.

**Decision needed:** review and commit these files (or an owner-authored
equivalent), or explicitly accept that this branch ships infrastructure only
and content is a separate follow-up.

---

## 2. Accepted debt (non-blocking, ship as-is)

- **`SourceBar.tsx`** — the "View in Vault ↗" `<a>` and the eye-toggle
  `<span role="button" tabIndex={0}>` are both nested inside an outer
  `<button className="ds-card">` — an HTML5 content-model violation
  (interactive content inside `<button>`). Pre-existing pattern, now extended
  across two tasks (Task 3, Task 10). `stopPropagation()` verified
  functionally correct regardless. Fix would mean swapping the outer
  `<button>` for `<div role="button">` and re-adding keyboard activation —
  real work in the most-patched file in the branch; deferred rather than
  risked in a one-shot fix round.
- **Duplicate `CATEGORY_LABEL` maps** — `frontend/src/app/stories/[contentKey]/page.tsx`
  (sentence-case: "Record") and `frontend/src/components/stories/StoryCardImg.tsx`
  (all-caps: "RECORD") each define their own. Both spec-mandated separately;
  different rendering contexts (UI chip vs. share-card typography). DRY-ing
  this would need a casing parameter — more machinery than the duplication
  costs.
- **`formatDateStamp` (storiesApi.ts) vs. `OnThisDayRail`'s zero-padded
  stamp** — unpadded day (`8 AUG 2026`) vs. zero-padded (`08 AUG`) diverge for
  single-digit days. Cosmetic; a shared formatter with `padStart(2, "0")`
  would unify them.
- **Missing `try/catch` on two async click handlers**:
  - `handleDownload` in the story detail page (Task 8) — `captureCard`
    failure is an unhandled rejection with no user feedback.
    `CardPreview.tsx` already has the pattern to copy.
  - The eye-toggle `onClick` in `SourceBar.tsx` (Task 3) — PATCH failure is
    an unhandled rejection; the icon silently doesn't flip, so the user
    believes nothing changed.
- **`GET /stories` defaults to `limit=50`, frontend never overrides it** —
  two knock-on effects: `allTags` (tag pills) is derived from ≤50 stories, so
  pills silently shrink as the bank grows past 50; and the detail page's
  prev/next nav (built from `listStories()` order) returns `idx === -1` for
  any story outside the first 50, killing prev/next entirely on that page. A
  ceiling at current data volume, not a bug yet.
- **`.ds-card:hover` only changes `border-color`.** The design spec asked for
  "CSS hover lift + border glow" on vault cards specifically; `.ds-card` is
  shared with the composer, which is presumably why the lift wasn't added.
  Worth an explicit accept or a vault-specific hover variant.
- **`WireStrip` never links wire items to their vault story**, even when
  `content_key` is present on the item. Not asked for in the spec; it's the
  one remaining un-drawn arrow in "the loop" (posted → wire → back to the
  story that generated it).
- **`bot/db.py`'s `ensure_schema` ALTER path adds `is_published` with
  `DEFAULT TRUE`**, which the fresh `create_all` path (new DBs) doesn't
  carry — this is required to add a `NOT NULL` column to a non-empty table
  in Postgres, so the technique is correct. A migrated production DB will
  carry a permanent column default; a follow-up
  `ALTER COLUMN is_published DROP DEFAULT` would close the gap between the
  two schema-creation paths.
- **No repo-wide `ruff` config enforces the stated 99-char line length.**
  There is no `pyproject.toml` / `ruff.toml` / `.ruff.toml` anywhere in the
  repo, so `CLAUDE.md`'s "Line length: 99 chars (ruff enforced)" is enforced
  by nothing (`E501` isn't in ruff's default `select`). The one line this
  plan's diff actually violated (`composer/tests/test_stories.py:163`) was
  fixed in the final review's fix round. 32 more pre-existing `E501`
  violations live in files entirely outside this plan's diff (mostly the two
  harvest scripts — see §1 — plus `bot/scripts/check_stale_content.py`).
  Adding the config now would immediately flag all 32 in unrelated files;
  this is an owner-level tooling decision, not something to silently fix or
  silently ignore.

---

## 3. Next-round spec gap (not a defect — correctly out of scope this round)

`frontend/src/app/stories/layout.tsx`'s static `metadata` export covers the
entire `/stories` route tree, including `/stories/[contentKey]`. Every
individual story's share link therefore gets the identical OG title "The
Vault — The Cricket Fan" and the same generic description — which undercuts
Task 8's whole point (a per-story 1080×1350 shareable card). Fixing this
needs a `generateMetadata` server function scoped per story (title = the
story's headline/keyLine, description = its summary, image = an OG-sized
render of the share card or a static fallback) — real, scoped work for a
future round, not a bug in what shipped.

---

## 4. Repo-level trap worth fixing separately (process, not product)

`composer/tests/conftest.py` builds its test app by importing `create_app`
from disk (`from composer.app import create_app`). This means **running
pytest against a dirty working tree proves nothing about what's actually
committed** — a change can exist only in the working tree, and the test
suite will still go fully green.

This is exactly how a 2-line omission (the `stories_router` mount in
`composer/app.py`) survived ten independent task-scoped code reviews on this
branch: every task's implementer and reviewer ran `pytest` in the same
working tree that already had the (uncommitted) mount, so the suite always
passed regardless of what any individual task actually committed. It was
only caught by the final whole-branch review's explicit instruction to
verify from a clean `git worktree` of the commit under review — a step nowhere
enforced by default.

**Recommendation:** either (a) add a CI job / pre-merge check that runs the
test suite from a clean checkout (worktree or fresh clone) rather than the
dirty tree, or (b) add a note to `CLAUDE.md`'s testing section flagging this
so future SDD/manual review rounds verify from a clean checkout before
signing off a task or branch as complete. Left as-is, the next feature branch
built the same way (uncommitted foundation WIP + task-scoped reviews in a
dirty tree) can hit the identical blind spot.
