const normColor = (v) => Array.isArray(v) ? `rgb(${v.map(n=>Math.round((n<=1?n*255:n))).join(',')})` : null;

export async function extractPageEntities(pdfDoc, pageNo, pdfjs){
  const page = await pdfDoc.getPage(pageNo);
  const entities = [];

  // Text entities (high confidence)
  try {
    const txt = await page.getTextContent();
    txt.items.forEach((it, i) => {
      const x = it.transform?.[4] ?? 0;
      const y = (it.transform?.[5] ?? 0) - (it.height ?? 0);
      const w = it.width ?? 0;
      const h = it.height ?? 0;
      entities.push({
        entityId: `p${pageNo}-text-${i}`,
        page: pageNo,
        type: 'text',
        subtype: 'textSpan',
        label: it.str || '',
        text: it.str || '',
        x, y, width: w, height: h,
        centerX: x + w / 2,
        centerY: y + h / 2,
        rotation: null,
        strokeColor: null,
        fillColor: null,
        strokeWidth: null,
        opacity: null,
        visible: true,
        pinned: false,
        extractionLevel: 'high',
        confidence: 0.95,
        source: 'pdfjs.getTextContent',
        fontName: it.fontName || null,
        fontSize: it.height || null,
        transform: it.transform || null,
        rawType: 'textItem',
        groupId: null,
        symbolHint: null,
        zIndex: i,
        raw: { hasEOL: !!it.hasEOL, dir: it.dir || null }
      });
    });
  } catch {
    // ignore
  }

  // Operator-level entities (medium confidence)
  try {
    const opList = await page.getOperatorList();
    const OPS = pdfjs.OPS || {};
    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i];
      const args = opList.argsArray[i] || [];
      const eid = `p${pageNo}-op-${i}`;
      const rec = {
        entityId: eid,
        page: pageNo,
        type: 'unknown',
        subtype: 'operator',
        label: '',
        text: null,
        x: null, y: null, width: null, height: null,
        centerX: null, centerY: null,
        rotation: null,
        strokeColor: null,
        fillColor: null,
        strokeWidth: null,
        opacity: null,
        visible: true,
        pinned: false,
        extractionLevel: 'medium',
        confidence: 0.55,
        source: 'pdfjs.getOperatorList',
        dashStyle: null,
        pathClosed: null,
        pointCount: null,
        length: null,
        area: null,
        fontName: null,
        fontSize: null,
        imageWidth: null,
        imageHeight: null,
        transform: null,
        rawType: String(fn),
        groupId: null,
        symbolHint: null,
        zIndex: i,
        raw: { fn, args }
      };

      if (fn === OPS.paintImageXObject || fn === OPS.paintImageMaskXObject || fn === OPS.paintInlineImageXObject) {
        rec.type = 'image';
        rec.subtype = 'imageXObject';
        rec.label = 'image';
        rec.confidence = 0.7;
        if (args?.[0]?.width) rec.imageWidth = args[0].width;
        if (args?.[0]?.height) rec.imageHeight = args[0].height;
      } else if (fn === OPS.showText || fn === OPS.showSpacedText || fn === OPS.nextLineShowText || fn === OPS.nextLineSetSpacingShowText) {
        rec.type = 'text';
        rec.subtype = 'glyphRun';
        rec.label = 'glyph run';
        rec.confidence = 0.7;
      } else if (fn === OPS.constructPath) {
        rec.type = 'path';
        rec.subtype = 'openPath';
        rec.label = 'path';
        rec.confidence = 0.7;
        const [ops = [], coords = []] = args;
        rec.pointCount = Math.floor((coords?.length || 0) / 2);
        rec.raw.pathOps = ops;
      } else if (fn === OPS.rectangle) {
        rec.type = 'rect';
        rec.subtype = 'strokedShape';
        rec.label = 'rectangle';
        rec.confidence = 0.75;
        const [x,y,w,h] = args;
        rec.x = x ?? null; rec.y = y ?? null; rec.width = w ?? null; rec.height = h ?? null;
        if (w != null && h != null && x != null && y != null) {
          rec.centerX = x + w/2; rec.centerY = y + h/2;
        }
      } else if (fn === OPS.setStrokeRGBColor || fn === OPS.setFillRGBColor) {
        rec.type = 'style';
        rec.subtype = fn === OPS.setStrokeRGBColor ? 'strokeStyle' : 'fillStyle';
        rec.label = rec.subtype;
        if (fn === OPS.setStrokeRGBColor) rec.strokeColor = normColor(args);
        if (fn === OPS.setFillRGBColor) rec.fillColor = normColor(args);
      } else if (fn === OPS.setLineWidth) {
        rec.type = 'style';
        rec.subtype = 'lineWidth';
        rec.strokeWidth = args?.[0] ?? null;
      } else {
        continue;
      }

      entities.push(rec);
    }
  } catch {
    // ignore operator list failures
  }

  return entities;
}
