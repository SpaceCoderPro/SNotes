# SNotes

SNotes is a Supernotes-inspired single-page notes app with local-first storage and a fast card UI.

## Features

- Card-based notes with title, body, tags, pin/archive/trash states.
- Markdown-ish rich text preview (`#`, `##`, `**bold**`, `*italic*`, links).
- `[[Backlink]]` syntax with backlink counts on each card.
- Global search across title/body/tags.
- Filter views: all, pinned, archived, trash.
- Tag filtering with dynamic tag cloud.
- Keyboard shortcuts:
  - `N`: new card
  - `/`: focus search
  - `Ctrl/Cmd + S`: save card in editor
  - `Ctrl/Cmd + K`: command palette
- Command palette for fast navigation/actions.
- Light/dark theme toggle.
- Local storage persistence (works immediately, no backend required).

## Run now

No build tools required.

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Notes

- Data is stored in browser `localStorage` (`snotes.cards.v1`).
- This is intentionally offline-first and single-user.
