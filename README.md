# SNotes

SNotes is a Supernotes-inspired single-page notes app with an instant local-first workflow.

## What's now included

- Wide-card feed by default, plus grid mode in settings.
- Infinite feed loading (cards stream in as you scroll).
- Card CRUD with title/body/tags + pin/archive/trash states.
- Live markdown preview with headings, lists, links, blockquotes, inline code, fenced code blocks, and backlinks (`[[...]]`).
- Search across title/body/tags.
- Tag filtering with dynamic tag cloud.
- Keyboard shortcuts:
  - `N`: new card
  - `/`: focus search
  - `Ctrl/Cmd + S`: save card in editor
  - `Ctrl/Cmd + K`: command palette
- Command palette for quick actions.
- Settings panel:
  - theme (system/light/dark)
  - feed layout (wide/grid)
  - density (comfortable/compact)
  - live preview toggle
- LocalStorage persistence for cards and settings.

## Run now

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`.

## Data keys

- Cards: `snotes.cards.v2`
- Settings: `snotes.settings.v1`
