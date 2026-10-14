# Stored layouts tab

## Goal
A second tab, "Stored layouts", beside "Layout". It lists example layouts read from a JSON file so
visitors can see how others set up a bank tag, preview one, and copy it into the editor.

## Decisions
- Layouts are stored as raw RuneLite bank tag export strings (`banktags,1,<name>,<icon id>,layout,<cell>,<item id>,...`)
  plus `author` and `description`. The title and icon come from the string. Authors paste exports from RuneLite directly.
- Clicking a layout opens a read-only preview in the same area (list -> preview, "Back" returns).
  "Load into editor" replaces the current layout, after a confirm if it has items, then switches to the Layout tab.
- The file is `data/stored-layouts.json`, hand-edited. It is not one of the generated files.

## Data
```json
[{ "author": "zom", "description": "potion making", "layout": "banktags,1,Potions,249,layout,0,199,1,249,..." }]
```
Cell index maps to x = index % 8, y = floor(index / 8), as the importer does today.

## Units
| File | Responsibility |
| --- | --- |
| `assets/js/helpers/banktag-parse.js` (new) | Pure `parseBanktag(text, resolveId)` -> `{ layoutName, layoutIcon, items: [{x, y, id}] }`. Moved out of `editor.js`; the import modal and the new tab share it. |
| `assets/js/stored-layouts.js` (new) | Tab switching, lazy fetch of the JSON, list, preview, load button. |
| `assets/js/editor.js` | Import calls the shared parser and a shared `applyImportedLayout(parsed)`. No behavior change. |
| `assets/js/script.js` | Exposes an id -> image lookup for the preview. A few lines only (837 of 1,000 cap). |
| `index.html`, `assets/css/styles.css` | Second tab button, list and preview containers. |
| `data/stored-layouts.json` (new) | The examples. First entry: the Potions layout. |

## Behaviour
- List row: icon, title, author, description, item count. Opening the tab fetches the file once.
- Preview: 8-wide grid, rows = max y + 1, item names on hover, "Back" and "Load into editor".
- Fetch failure: message in the tab. Entry that does not parse: skipped, console warning. Unknown item id: placeholder cell, as import does.

## Tests
- Node: parser behaviour pinned before the move (existing import output), plus the Potions string.
- Node: every entry in `data/stored-layouts.json` has `author`, `description`, `layout` and parses to a non-empty layout.
- The tab UI has no automated test (no DOM library, no new dependencies). It is checked by hand and the PR says so.

## Order of work (one branch, one commit per step)
1. Extract the parser with tests first; import behaves the same.
2. Add the data file, the shared apply function and the data checks.
3. Add the tab, list, preview and load button.

## Risks
- Moving the parser and the apply logic touches the import path, which works today. Step 1 is test-pinned for that reason.
- Preview needs the item list loaded; the tab waits on the same item load the editor uses.
