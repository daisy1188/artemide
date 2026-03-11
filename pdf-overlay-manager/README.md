# PDF Overlay Manager – IS Workbench
App web statica (HTML/CSS/JS ESM) per aprire PDF tecnici e gestire overlay non distruttivi.

## Avvio
```bash
cd pdf-overlay-manager/app
py -m http.server 8000
# http://localhost:8000
```

## Quick start
1. Apri un PDF con **Apri PDF**.
2. Crea Box/Note/Measure/Crop/Exclude da toolbar.
3. Modifica proprietà nel pannello **Properties**.
4. Salva progetto con **Save JSON**.

## Troubleshooting
- Porta occupata: usare `py -m http.server 8010`.
- PDF.js è già incluso localmente in `app/vendor/pdfjs/`; se il browser blocca il worker verificare che l'app sia servita via HTTP (non file://).
- JSON invalido: toast errore durante import.

## Smoke test checklist
- [ ] Avvio server → UI carica
- [ ] Apri PDF multipagina → render OK
- [ ] Zoom/pan/fit/rotate OK
- [ ] Toggle text layer OK
- [ ] Search testo → highlight + jump OK
- [ ] Crea Box: P0/P1 coerenti col mouse
- [ ] Box: fill/stroke funzionano
- [ ] Box: move + resize da 8 handles
- [ ] Crea Note: centrata + edit + rotate/resize
- [ ] Crop: attiva/disattiva e ritaglia vista
- [ ] Exclude: patch visibile e toggle
- [ ] Layers: active/lock/visible + add/rename/delete
- [ ] Objects: selezione lista + delete/hide + batch
- [ ] Save/Load JSON ripristina stato
- [ ] Snapshot PNG genera file
- [ ] CSV export ok
- [ ] Undo/Redo ok

## Docs
- `docs/ARCHITECTURE.md`
- `docs/USER_GUIDE.md`
- `docs/DATA_MODEL.md`


## Entity Inspector / PDF Entity Debugger
- Toolbar sinistra: pulsante 🐞 apre l'inspector.
- Scope: pagina corrente o documento intero.
- Tabella con ricerca, filtri, ordinamento, selezione multipla, paginazione e export CSV/JSON.
- Azioni bidirezionali con tavola: highlight, zoom-to, hide/show (mask bbox), pin/unpin.
