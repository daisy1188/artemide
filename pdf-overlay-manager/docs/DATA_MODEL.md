# DATA MODEL
## Project JSON
- `version`
- `ui`: collapsed, showTextBoxes, snap, grid
- `measurePrefs`: unit, ratio
- `layers[]`: id, name, visible, locked
- `activeLayerId`
- `overlays[]`
- `cropByPage`, `excludeVisible`, `textIndex`

## Overlay schema
- `id`, `type`, `page`, `layerId`
- `geometry` (`rect`, `anchor`, `line`)
- `style` (stroke/fill/font)
- `content` (note text)
- `meta` (name, tags, notes, hidden, locked)
- `createdAt`, `updatedAt`
