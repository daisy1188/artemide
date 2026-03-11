# ARCHITECTURE
- Coordinate model: overlay in **page space** (PDF units), rendered directly su overlay canvas.
- Render pipeline: `pdf-canvas` (base) + `overlay-canvas` (annotations, text bboxes) compositati anche per snapshot.
- State model: store centralizzato con `layers`, `overlays`, `ui`, `textIndex`, `measurePrefs`.
- History: stack undo/redo snapshot-based per create/update/delete e layer ops.
- Tools: select, pan, box, note, measure, crop, exclude. Nessuna polyline.
