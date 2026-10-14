# BankLayoutViewer

Tier: small. Static GitHub Pages site for viewing and editing OSRS bank layouts, plus a Python script that fetches item data.

- Check: `make check` (needs `.venv`: `pip install -r requirements-dev.txt`). Run it before saying anything is done; paste its last line.
- Never edit lint, type-check or CI config unless asked. Never weaken or skip a test to pass.
- Files stay under 1,000 lines. Split by responsibility, in the plan.
- Generated files (`cdn/items`, `cdn/json`, `data/layouts.json`) are never hand-edited; regenerate them.
- Work on a branch. Never merge, push to a protected branch or deploy; the human does.
- Plan before building anything non-trivial. In plans, lead with the risky items.
- Be concise. No filler or summaries.
- Don't fake confidence. Hedge or say "I don't know".
- Push back on wrong requests.
- Verify current facts (APIs, versions, prices) against docs before relying on them.
