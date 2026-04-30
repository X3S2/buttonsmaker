/* ============================================================
   ButtonsMaker – app.js  v0.3.0
   Pure HTML/CSS/JS – keine Abhängigkeiten
   ============================================================ */

'use strict';

// ============================================================
// CONSTANTS
// ============================================================

const A4_MM_W = 210;
const A4_MM_H = 297;
const A4_PX_W = 794;   // 210mm @ 96dpi
const A4_PX_H = 1123;  // 297mm @ 96dpi
const MM_TO_PX = A4_PX_W / A4_MM_W; // ≈ 3.78

const PRESETS = [
  { label: '25mm', inner: 25, outer: 39 },
  { label: '31mm', inner: 31, outer: 45 },
  { label: '37mm', inner: 37, outer: 51 },
  { label: '50mm', inner: 50, outer: 64 },
  { label: '56mm', inner: 56, outer: 70 },
  { label: '58mm', inner: 58, outer: 70 },
  { label: '75mm', inner: 75, outer: 89 },
];

const LS_PROJECT_KEY = 'buttonsmaker_project';
const LS_TEMPLATES_KEY = 'buttonsmaker_templates';
const GAP_MM = 2; // Mindestabstand zwischen den Außenkreisen benachbarter Buttons (mm)

// ============================================================
// STATE
// ============================================================

/** @type {Project} */
let project = null;
/** @type {string|null} selectedSlotId – "pageId:slotIndex" */
let selectedSlotId = null;
/** @type {ButtonConfig|null} editing config in modal */
let editingConfig = null;
/** @type {string|null} slot being edited */
let editingSlotId = null;
/** @type {number} current visible page index (0-based) */
let currentPageIndex = 0;
/** @type {Array<NamedTemplate>} */
let templates = [];

// ============================================================
// DATA MODELS
// ============================================================

function makeId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** @returns {ButtonConfig} */
function makeEmptyButtonConfig() {
  return {
    id: makeId(),
    bgColor: '#ffffff',
    bgImage: null,
    imgNaturalW: null,
    imgNaturalH: null,
    imgX: 0,
    imgY: 0,
    imgScale: 1,
    shapes: [],
    texts: [],
  };
}

/** @returns {Shape} */
function makeShape() {
  return {
    id: makeId(),
    type: 'circle',   // circle | ellipse | rect | roundrect | triangle | star | line
    x: 50, y: 50,     // % of inner diameter (center point)
    w: 40, h: 40,     // % of inner diameter
    rotation: 0,
    fillColor: '#e94560',
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWidth: 0,
  };
}

/**
 * Build SVG polygon points for a star shape.
 * @param {number} cx @param {number} cy @param {number} r outer radius
 * @param {number} numPoints
 * @returns {string}
 */
function starPoints(cx, cy, r, numPoints) {
  const innerR = r * 0.42;
  const pts = [];
  for (let i = 0; i < numPoints * 2; i++) {
    const radius = i % 2 === 0 ? r : innerR;
    const angle = (i * Math.PI / numPoints) - Math.PI / 2;
    pts.push(`${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`);
  }
  return pts.join(' ');
}

/** @returns {TextLayer} */
function makeTextLayer() {
  return {
    id: makeId(),
    content: 'Text',
    font: 'sans-serif',
    size: 14,
    color: '#000000',
    x: 50,   // % of inner diameter
    y: 50,
    align: 'center',
    bold: false,
    italic: false,
    rotation: 0,
    shadowEnabled: false,
    shadowColor: '#000000',
    shadowBlur: 3,
    shadowOffsetX: 2,
    shadowOffsetY: 2,
    strokeEnabled: false,
    strokeColor: '#000000',
    strokeWidth: 1,
    arcRadius: 0,   // mm: 0=gerade, +N=Bogen oben, -N=Bogen unten
  };
}

/**
 * Calculate the layout for a page given button outer diameter in mm.
 * @param {number} outerMm
 * @returns {{cols:number, rows:number, marginHmm:number, marginVmm:number, spacingHmm:number, spacingVmm:number}}
 */
function calcLayout(outerMm) {
  // Maximale Spalten/Zeilen bei 2mm Pflichtabstand zwischen Buttons:
  // N*(outer + GAP) - GAP <= A4  →  N <= (A4 + GAP) / (outer + GAP)
  const cols = Math.max(1, Math.floor((A4_MM_W + GAP_MM) / (outerMm + GAP_MM)));
  const rows = Math.max(1, Math.floor((A4_MM_H + GAP_MM) / (outerMm + GAP_MM)));
  // Verbleibenden Rand links/rechts bzw. oben/unten gleichmäßig verteilen
  const marginHmm = Math.max(0, (A4_MM_W - cols * outerMm - (cols - 1) * GAP_MM) / 2);
  const marginVmm = Math.max(0, (A4_MM_H - rows * outerMm - (rows - 1) * GAP_MM) / 2);
  return { cols, rows, marginHmm, marginVmm, spacingHmm: GAP_MM, spacingVmm: GAP_MM };
}

/**
 * @param {number} outerMm
 * @returns {Page}
 */
function makePage(outerMm) {
  const layout = calcLayout(outerMm);
  const slotCount = layout.cols * layout.rows;
  return {
    id: makeId(),
    layout,
    slots: Array.from({ length: slotCount }, () => makeEmptyButtonConfig()),
  };
}

/** @returns {Project} */
function makeProject() {
  const size = { inner: 37, outer: 51 };
  return {
    version: '0.1.0',
    buttonSize: size,
    guideLineWidth: 0.4,   // mm – Dicke der roten Innenkreis-Führungslinie
    pages: [makePage(size.outer)],
  };
}

// ============================================================
// RENDERING
// ============================================================

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Create an SVG element for a button.
 * @param {ButtonConfig} config
 * @param {number} outerMm
 * @param {number} innerMm
 * @param {number} sizePx – rendered size in pixels
 * @param {boolean} isPreview
 * @returns {SVGSVGElement}
 */
function renderButtonSVG(config, outerMm, innerMm, sizePx, isPreview) {
  const outerR = outerMm / 2;
  const innerR = innerMm / 2;
  const cx = outerR;
  const cy = outerR;
  const viewSize = outerMm;

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('viewBox', `0 0 ${viewSize} ${viewSize}`);
  svg.setAttribute('width', String(sizePx));
  svg.setAttribute('height', String(sizePx));

  // ---- defs: inner clip (text/shapes) + outer clip (image) ----
  const defs = document.createElementNS(SVG_NS, 'defs');

  const clipId = 'clip-' + config.id + (isPreview ? '-prev' : '');
  const clipPath = document.createElementNS(SVG_NS, 'clipPath');
  clipPath.setAttribute('id', clipId);
  const clipCircle = document.createElementNS(SVG_NS, 'circle');
  clipCircle.setAttribute('cx', String(cx)); clipCircle.setAttribute('cy', String(cy));
  clipCircle.setAttribute('r', String(innerR));
  clipPath.appendChild(clipCircle);
  defs.appendChild(clipPath);

  // Outer clip for the image — fills entire button including fold-over area
  const outerClipId = 'clipO-' + config.id + (isPreview ? '-prev' : '');
  const outerClipPath = document.createElementNS(SVG_NS, 'clipPath');
  outerClipPath.setAttribute('id', outerClipId);
  const outerClipCircle = document.createElementNS(SVG_NS, 'circle');
  outerClipCircle.setAttribute('cx', String(cx)); outerClipCircle.setAttribute('cy', String(cy));
  outerClipCircle.setAttribute('r', String(outerR));
  outerClipPath.appendChild(outerClipCircle);
  defs.appendChild(outerClipPath);

  // ---- background fill (outer circle) + optional image ----
  svg.appendChild(defs);

  // Outer circle background (bgColor always fills the fold-over area)
  const bgOuter = document.createElementNS(SVG_NS, 'circle');
  bgOuter.setAttribute('cx', String(cx)); bgOuter.setAttribute('cy', String(cy));
  bgOuter.setAttribute('r', String(outerR));
  bgOuter.setAttribute('fill', config.bgColor || '#ffffff');
  svg.appendChild(bgOuter);

  if (config.bgImage) {
    const imgEl = document.createElementNS(SVG_NS, 'image');
    imgEl.setAttribute('href', config.bgImage);
    imgEl.setAttribute('clip-path', `url(#${outerClipId})`);

    const { imgNaturalW, imgNaturalH, imgX = 0, imgY = 0, imgScale = 1 } = config;
    if (imgNaturalW && imgNaturalH) {
      // Cover the full outer circle, user offset applied from center
      const outerD = outerR * 2;
      const coverScale = Math.max(outerD / imgNaturalW, outerD / imgNaturalH) * imgScale;
      const scaledW = imgNaturalW * coverScale;
      const scaledH = imgNaturalH * coverScale;
      imgEl.setAttribute('x', String(cx - scaledW / 2 + imgX));
      imgEl.setAttribute('y', String(cy - scaledH / 2 + imgY));
      imgEl.setAttribute('width', String(scaledW));
      imgEl.setAttribute('height', String(scaledH));
      imgEl.setAttribute('preserveAspectRatio', 'none');
    } else {
      // Fallback for configs saved before v0.1.2
      imgEl.setAttribute('x', String(cx - innerR));
      imgEl.setAttribute('y', String(cy - innerR));
      imgEl.setAttribute('width', String(innerR * 2));
      imgEl.setAttribute('height', String(innerR * 2));
      imgEl.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    }
    svg.appendChild(imgEl);
  }

  // ---- Shape layers (clipped to inner circle) ----
  if (config.shapes && config.shapes.length > 0) {
    const shapeGroup = document.createElementNS(SVG_NS, 'g');
    shapeGroup.setAttribute('clip-path', `url(#${clipId})`);
    config.shapes.forEach(s => {
      const el = buildShapeSVGEl(s, innerR, cx, cy);
      if (el) shapeGroup.appendChild(el);
    });
    svg.appendChild(shapeGroup);
  }

  // ---- Text layers (clipped to inner circle) ----
  if (config.texts && config.texts.length > 0) {
    const textGroup = document.createElementNS(SVG_NS, 'g');
    textGroup.setAttribute('clip-path', `url(#${clipId})`);

    config.texts.forEach(t => {
      const tx = (cx - innerR) + (t.x / 100) * (innerR * 2);
      const ty = (cy - innerR) + (t.y / 100) * (innerR * 2);
      const fs = (t.size || 14) / MM_TO_PX;

      // Shadow filter
      if (t.shadowEnabled) {
        const fId = `fshadow-${t.id}${isPreview ? '-p' : ''}`;
        const filter = document.createElementNS(SVG_NS, 'filter');
        filter.setAttribute('id', fId);
        filter.setAttribute('x', '-50%'); filter.setAttribute('y', '-50%');
        filter.setAttribute('width', '200%'); filter.setAttribute('height', '200%');
        const fds = document.createElementNS(SVG_NS, 'feDropShadow');
        fds.setAttribute('dx', String((t.shadowOffsetX || 2) / MM_TO_PX));
        fds.setAttribute('dy', String((t.shadowOffsetY || 2) / MM_TO_PX));
        fds.setAttribute('stdDeviation', String((t.shadowBlur || 3) / MM_TO_PX));
        fds.setAttribute('flood-color', t.shadowColor || '#000000');
        fds.setAttribute('flood-opacity', '1');
        filter.appendChild(fds);
        defs.appendChild(filter);
      }

      const textEl = document.createElementNS(SVG_NS, 'text');
      textEl.setAttribute('text-anchor', t.align || 'middle');
      textEl.setAttribute('dominant-baseline', 'middle');
      textEl.setAttribute('fill', t.color || '#000000');
      textEl.setAttribute('font-size', String(fs));
      textEl.setAttribute('font-family', t.font || 'sans-serif');
      textEl.setAttribute('font-weight', t.bold ? 'bold' : 'normal');
      textEl.setAttribute('font-style', t.italic ? 'italic' : 'normal');

      if (t.shadowEnabled) {
        textEl.setAttribute('filter', `url(#fshadow-${t.id}${isPreview ? '-p' : ''})`);
      }
      if (t.strokeEnabled) {
        textEl.setAttribute('stroke', t.strokeColor || '#000000');
        textEl.setAttribute('stroke-width', String((t.strokeWidth || 1) / MM_TO_PX));
        textEl.setAttribute('paint-order', 'stroke fill');
      }

      if (t.arcRadius && t.arcRadius !== 0) {
        // Arc text via textPath
        const r = Math.abs(t.arcRadius);
        const arcId = `arcpath-${t.id}${isPreview ? '-p' : ''}`;
        const arcPath = document.createElementNS(SVG_NS, 'path');
        // Positive: text bows upward → arc circle center is below the text position
        // Negative: text bows downward → arc circle center is above the text position
        const sign = t.arcRadius > 0 ? 1 : -1;
        const arcCy = ty + sign * r;
        // Build semicircle path: for upward bow (positive), arc goes counterclockwise on top
        // SVG arc: M startX,startY A rx,ry x-rot large-arc-flag sweep-flag endX,endY
        const sweep = t.arcRadius > 0 ? 0 : 1;
        const d = `M ${tx - r},${arcCy} A ${r},${r} 0 0,${sweep} ${tx + r},${arcCy}`;
        arcPath.setAttribute('id', arcId);
        arcPath.setAttribute('d', d);
        arcPath.setAttribute('fill', 'none');
        defs.appendChild(arcPath);

        const tpEl = document.createElementNS(SVG_NS, 'textPath');
        tpEl.setAttribute('href', `#${arcId}`);
        tpEl.setAttribute('startOffset', '50%');
        tpEl.setAttribute('text-anchor', 'middle');
        tpEl.textContent = t.content || '';
        textEl.appendChild(tpEl);
      } else {
        textEl.setAttribute('x', String(tx));
        textEl.setAttribute('y', String(ty));
        textEl.textContent = t.content || '';
      }

      if (t.rotation) {
        const existing = textEl.getAttribute('transform') || '';
        textEl.setAttribute('transform', `${existing} rotate(${t.rotation},${tx},${ty})`);
      }

      textGroup.appendChild(textEl);
    });
    svg.appendChild(textGroup);
  }

  // ---- Guide circles (printed) ----
  const strokeW = 0.4; // mm – blauer Außenkreis bleibt dünn
  const redStrokeW = (project && project.guideLineWidth) ? project.guideLineWidth : 0.4;

  // Blue outer circle
  const blueCircle = document.createElementNS(SVG_NS, 'circle');
  blueCircle.setAttribute('cx', String(cx)); blueCircle.setAttribute('cy', String(cy));
  blueCircle.setAttribute('r', String(outerR - strokeW / 2));
  blueCircle.setAttribute('fill', 'none');
  blueCircle.setAttribute('stroke', '#2196f3');
  blueCircle.setAttribute('stroke-width', String(strokeW));
  svg.appendChild(blueCircle);

  // Red inner circle – NOT printed (no-print class)
  const redCircle = document.createElementNS(SVG_NS, 'circle');
  redCircle.setAttribute('cx', String(cx)); redCircle.setAttribute('cy', String(cy));
  redCircle.setAttribute('r', String(innerR));
  redCircle.setAttribute('fill', 'none');
  redCircle.setAttribute('stroke', '#e53935');
  redCircle.setAttribute('stroke-width', String(redStrokeW));
  redCircle.classList.add('no-print');
  svg.appendChild(redCircle);

  // ---- Selection ring (not printed) ----
  const selRing = document.createElementNS(SVG_NS, 'circle');
  selRing.setAttribute('cx', String(cx)); selRing.setAttribute('cy', String(cy));
  selRing.setAttribute('r', String(outerR + 1));
  selRing.setAttribute('fill', 'none');
  selRing.setAttribute('stroke', '#facc15');
  selRing.setAttribute('stroke-width', '1.5');
  selRing.setAttribute('stroke-dasharray', '3 2');
  selRing.classList.add('select-ring');
  svg.appendChild(selRing);

  return svg;
}

/**
 * Build a single SVG element for a shape.
 * All coordinates/sizes are in mm (same units as the SVG viewBox).
 * @param {Shape} s @param {number} innerR @param {number} cx @param {number} cy
 * @returns {SVGElement|null}
 */
function buildShapeSVGEl(s, innerR, cx, cy) {
  const px = (cx - innerR) + (s.x / 100) * (innerR * 2);
  const py = (cy - innerR) + (s.y / 100) * (innerR * 2);
  const w  = (s.w / 100) * (innerR * 2);
  const h  = (s.h / 100) * (innerR * 2);
  const fill  = s.type === 'line' ? 'none' : (s.fillColor || '#e94560');
  const fOpac = s.fillOpacity != null ? s.fillOpacity : 1;
  const stroke = s.strokeColor || 'none';
  const sw     = s.strokeWidth || 0;

  let el = null;
  switch (s.type) {
    case 'circle':
      el = document.createElementNS(SVG_NS, 'circle');
      el.setAttribute('cx', String(px)); el.setAttribute('cy', String(py));
      el.setAttribute('r', String(Math.min(w, h) / 2));
      break;
    case 'ellipse':
      el = document.createElementNS(SVG_NS, 'ellipse');
      el.setAttribute('cx', String(px)); el.setAttribute('cy', String(py));
      el.setAttribute('rx', String(w / 2)); el.setAttribute('ry', String(h / 2));
      break;
    case 'rect':
      el = document.createElementNS(SVG_NS, 'rect');
      el.setAttribute('x', String(px - w / 2)); el.setAttribute('y', String(py - h / 2));
      el.setAttribute('width', String(w)); el.setAttribute('height', String(h));
      break;
    case 'roundrect':
      el = document.createElementNS(SVG_NS, 'rect');
      el.setAttribute('x', String(px - w / 2)); el.setAttribute('y', String(py - h / 2));
      el.setAttribute('width', String(w)); el.setAttribute('height', String(h));
      el.setAttribute('rx', String(Math.min(w, h) * 0.18));
      break;
    case 'triangle': {
      const pts = `${px},${py - h/2} ${px - w/2},${py + h/2} ${px + w/2},${py + h/2}`;
      el = document.createElementNS(SVG_NS, 'polygon');
      el.setAttribute('points', pts);
      break;
    }
    case 'star':
      el = document.createElementNS(SVG_NS, 'polygon');
      el.setAttribute('points', starPoints(px, py, Math.min(w, h) / 2, 5));
      break;
    case 'line':
      el = document.createElementNS(SVG_NS, 'line');
      el.setAttribute('x1', String(px - w / 2)); el.setAttribute('y1', String(py));
      el.setAttribute('x2', String(px + w / 2)); el.setAttribute('y2', String(py));
      break;
    default:
      return null;
  }

  el.setAttribute('fill', fill);
  el.setAttribute('fill-opacity', String(fOpac));
  el.setAttribute('stroke', sw > 0 ? stroke : 'none');
  el.setAttribute('stroke-width', String(sw));
  if (s.rotation) el.setAttribute('transform', `rotate(${s.rotation},${px},${py})`);
  return el;
}

/**
 * Draw a shape onto a 2D canvas context.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Shape} s @param {number} innerRpx @param {number} cx @param {number} cy
 */
function drawShapeCanvas(ctx, s, innerRpx, cx, cy) {
  const px = (cx - innerRpx) + (s.x / 100) * (innerRpx * 2);
  const py = (cy - innerRpx) + (s.y / 100) * (innerRpx * 2);
  const w  = (s.w / 100) * (innerRpx * 2);
  const h  = (s.h / 100) * (innerRpx * 2);

  ctx.save();
  ctx.globalAlpha = s.fillOpacity != null ? s.fillOpacity : 1;
  ctx.fillStyle   = s.fillColor || '#e94560';
  ctx.strokeStyle = s.strokeColor || '#ffffff';
  ctx.lineWidth   = s.strokeWidth || 0;

  if (s.rotation) {
    ctx.translate(px, py);
    ctx.rotate(s.rotation * Math.PI / 180);
    ctx.translate(-px, -py);
  }

  ctx.beginPath();
  switch (s.type) {
    case 'circle':
      ctx.arc(px, py, Math.min(w, h) / 2, 0, Math.PI * 2);
      break;
    case 'ellipse':
      ctx.ellipse(px, py, w / 2, h / 2, 0, 0, Math.PI * 2);
      break;
    case 'rect':
      ctx.rect(px - w/2, py - h/2, w, h);
      break;
    case 'roundrect': {
      const r = Math.min(w, h) * 0.18;
      if (ctx.roundRect) ctx.roundRect(px - w/2, py - h/2, w, h, r);
      else ctx.rect(px - w/2, py - h/2, w, h);
      break;
    }
    case 'triangle':
      ctx.moveTo(px, py - h/2);
      ctx.lineTo(px - w/2, py + h/2);
      ctx.lineTo(px + w/2, py + h/2);
      ctx.closePath();
      break;
    case 'star': {
      const or = Math.min(w, h) / 2;
      const ir = or * 0.42;
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 === 0 ? or : ir;
        const a   = (i * Math.PI / 5) - Math.PI / 2;
        if (i === 0) ctx.moveTo(px + rad * Math.cos(a), py + rad * Math.sin(a));
        else         ctx.lineTo(px + rad * Math.cos(a), py + rad * Math.sin(a));
      }
      ctx.closePath();
      break;
    }
    case 'line':
      ctx.moveTo(px - w/2, py);
      ctx.lineTo(px + w/2, py);
      break;
  }

  if (s.type !== 'line') ctx.fill();
  if ((s.strokeWidth || 0) > 0) ctx.stroke();
  ctx.restore();
}

/**
 * Draw a text layer on canvas.
 */
function drawTextCanvas(ctx, t, innerRpx, cx, cy, pxPerMm) {
  const tx = (cx - innerRpx) + (t.x / 100) * (innerRpx * 2);
  const ty = (cy - innerRpx) + (t.y / 100) * (innerRpx * 2);
  // Canvas font size scales with canvas size; size is stored in "screen px at 96dpi"
  // We convert to mm then back at canvas pxPerMm
  const fsMm = (t.size || 14) / MM_TO_PX;
  const fsPx = fsMm * pxPerMm;

  ctx.save();
  ctx.translate(tx, ty);
  if (t.rotation) ctx.rotate(t.rotation * Math.PI / 180);

  const fontStr = `${t.italic ? 'italic ' : ''}${t.bold ? 'bold ' : ''}${fsPx}px ${t.font || 'sans-serif'}`;
  ctx.font = fontStr;
  ctx.textAlign = t.align === 'start' ? 'left' : t.align === 'end' ? 'right' : 'center';
  ctx.textBaseline = 'middle';

  if (t.shadowEnabled) {
    ctx.shadowColor = t.shadowColor || '#000000';
    ctx.shadowBlur = (t.shadowBlur || 3) * pxPerMm;
    ctx.shadowOffsetX = (t.shadowOffsetX || 2) * pxPerMm;
    ctx.shadowOffsetY = (t.shadowOffsetY || 2) * pxPerMm;
  }

  const text = t.content || '';
  if (t.arcRadius && t.arcRadius !== 0) {
    const rPx = Math.abs(t.arcRadius) * pxPerMm;
    if (t.strokeEnabled) {
      ctx.strokeStyle = t.strokeColor || '#000000';
      ctx.lineWidth = (t.strokeWidth || 1) * pxPerMm;
      drawArcTextCanvas(ctx, text, t.arcRadius > 0 ? rPx : -rPx, fsPx, false);
    }
    ctx.fillStyle = t.color || '#000000';
    drawArcTextCanvas(ctx, text, t.arcRadius > 0 ? rPx : -rPx, fsPx, true);
  } else {
    if (t.strokeEnabled) {
      ctx.strokeStyle = t.strokeColor || '#000000';
      ctx.lineWidth = (t.strokeWidth || 1) * pxPerMm;
      ctx.strokeText(text, 0, 0);
    }
    ctx.fillStyle = t.color || '#000000';
    ctx.fillText(text, 0, 0);
  }
  ctx.restore();
}

/**
 * Draw arc text centered at origin.
 * radiusPx > 0 = bow upward (∩, center highest), < 0 = bow downward (∪, center lowest).
 * ctx must already be translated to the reference text position.
 */
function drawArcTextCanvas(ctx, text, radiusPx, fsPx, fill) {
  // Minimum radius to prevent degenerate geometry at tiny values
  const r = Math.max(Math.abs(radiusPx), 60);
  const isUpward = radiusPx > 0;

  const charWidths = Array.from(text).map(ch => ctx.measureText(ch).width);
  const totalW = charWidths.reduce((a, b) => a + b, 0);
  // Clamp angle span so text never wraps more than 270°
  const angleSpan = Math.min(totalW / r, Math.PI * 1.5);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (isUpward) {
    // ∩ bow: center char is highest, edges curve downward
    // Circle center at (0, +r) below reference in canvas coords (Y goes down)
    // Position at θ: x=r*sin(θ), y=r*(1−cos(θ))  →  at θ≠0, y>0 = edges go lower ✓
    let θ = -angleSpan / 2;
    for (let i = 0; i < text.length; i++) {
      const cw = charWidths[i];
      const midθ = θ + cw / (2 * r);
      ctx.save();
      ctx.translate(r * Math.sin(midθ), r * (1 - Math.cos(midθ)));
      ctx.rotate(midθ);
      if (fill) ctx.fillText(text[i], 0, 0);
      else ctx.strokeText(text[i], 0, 0);
      ctx.restore();
      θ += cw / r;
    }
  } else {
    // ∪ bow: center char is lowest, edges curve upward
    // Circle center at (0, −r) above reference
    // Position at θ: x=r*sin(θ), y=r*(cos(θ)−1)  →  at θ≠0, y<0 = edges go higher ✓
    let θ = -angleSpan / 2;
    for (let i = 0; i < text.length; i++) {
      const cw = charWidths[i];
      const midθ = θ + cw / (2 * r);
      ctx.save();
      ctx.translate(r * Math.sin(midθ), r * (Math.cos(midθ) - 1));
      ctx.rotate(-midθ);
      if (fill) ctx.fillText(text[i], 0, 0);
      else ctx.strokeText(text[i], 0, 0);
      ctx.restore();
      θ += cw / r;
    }
  }
}

/**
 * Render one Page DOM element.
 * @param {Page} page
 * @param {number} pageIndex
 * @returns {HTMLElement}
 */
function renderPage(page, pageIndex) {
  const { inner, outer } = project.buttonSize;
  const { cols, rows, marginHmm, marginVmm, spacingHmm, spacingVmm } = page.layout;
  const outerPx = outer * MM_TO_PX;
  const innerPx = inner * MM_TO_PX;

  const pageEl = document.createElement('div');
  pageEl.className = 'a4-page';
  pageEl.dataset.pageId = page.id;

  const label = document.createElement('div');
  label.className = 'page-label no-print';
  label.textContent = `Seite ${pageIndex + 1}`;
  pageEl.appendChild(label);

  const grid = document.createElement('div');
  grid.className = 'buttons-grid';
  pageEl.appendChild(grid);

  page.slots.forEach((config, slotIndex) => {
    const col = slotIndex % cols;
    const row = Math.floor(slotIndex / cols);
    const leftMm = marginHmm + col * (outer + spacingHmm);
    const topMm = marginVmm + row * (outer + spacingVmm);
    const leftPx = leftMm * MM_TO_PX;
    const topPx = topMm * MM_TO_PX;

    const slotEl = document.createElement('div');
    slotEl.className = 'btn-slot';
    slotEl.style.left = `${leftPx}px`;
    slotEl.style.top = `${topPx}px`;
    slotEl.style.width = `${outerPx}px`;
    slotEl.style.height = `${outerPx}px`;
    slotEl.dataset.slotId = `${page.id}:${slotIndex}`;

    const sid = `${page.id}:${slotIndex}`;
    if (selectedSlotId === sid) slotEl.classList.add('selected');

    const svgEl = renderButtonSVG(config, outer, inner, outerPx, false);
    slotEl.appendChild(svgEl);

    slotEl.addEventListener('click', () => onSlotClick(page.id, slotIndex));
    slotEl.addEventListener('dblclick', () => onSlotDblClick(page.id, slotIndex));

    grid.appendChild(slotEl);
  });

  return pageEl;
}

/** Full re-render of pages container (only visible page for performance). */
function renderPages() {
  const container = document.getElementById('pages-container');
  container.innerHTML = '';

  project.pages.forEach((page, i) => {
    if (i !== currentPageIndex) return; // Only show current page on screen
    const el = renderPage(page, i);
    container.appendChild(el);
  });

  updatePageNav();
  scaleA4Pages();
}

/** Scale A4 pages to fit the canvas-area width. */
function scaleA4Pages() {
  const canvasArea = document.querySelector('.canvas-area');
  const availW = canvasArea.clientWidth - 48; // 24px padding each side
  if (availW < A4_PX_W) {
    const scale = availW / A4_PX_W;
    document.querySelectorAll('.a4-page').forEach(el => {
      el.style.transform = `scale(${scale})`;
      el.style.transformOrigin = 'top center';
      el.style.marginBottom = `${-(A4_PX_H * (1 - scale))}px`;
    });
  } else {
    document.querySelectorAll('.a4-page').forEach(el => {
      el.style.transform = '';
      el.style.marginBottom = '';
    });
  }
}

function updatePageNav() {
  document.getElementById('page-indicator').textContent =
    `Seite ${currentPageIndex + 1} / ${project.pages.length}`;
  document.getElementById('btn-prev-page').disabled = currentPageIndex === 0;
  document.getElementById('btn-next-page').disabled = currentPageIndex >= project.pages.length - 1;
}

// ============================================================
// SLOT INTERACTIONS
// ============================================================

/**
 * @param {string} pageId
 * @param {number} slotIndex
 */
function onSlotClick(pageId, slotIndex) {
  const sid = `${pageId}:${slotIndex}`;
  if (selectedSlotId === sid) {
    // Deselect
    selectedSlotId = null;
  } else {
    selectedSlotId = sid;
  }
  updateSelectedPanel();
  // Re-render to update selection visuals
  renderPages();
}

function onSlotDblClick(pageId, slotIndex) {
  selectedSlotId = `${pageId}:${slotIndex}`;
  openEditor(pageId, slotIndex);
}

function updateSelectedPanel() {
  const hint = document.getElementById('selected-hint');
  const actions = document.getElementById('selected-actions');
  if (selectedSlotId) {
    hint.classList.add('hidden');
    actions.classList.remove('hidden');
  } else {
    hint.classList.remove('hidden');
    actions.classList.add('hidden');
  }
}

/** Find slot config by slotId string "pageId:slotIndex". */
function getSlotConfig(slotId) {
  if (!slotId) return null;
  const [pageId, idxStr] = slotId.split(':');
  const page = project.pages.find(p => p.id === pageId);
  if (!page) return null;
  return page.slots[parseInt(idxStr, 10)] || null;
}

function getPage(pageId) {
  return project.pages.find(p => p.id === pageId) || null;
}

// ============================================================
// EDITOR MODAL
// ============================================================

/** Deep-clone a ButtonConfig */
function cloneConfig(config) {
  return JSON.parse(JSON.stringify(config));
}

/**
 * Open the editor modal for a specific slot.
 */
function openEditor(pageId, slotIndex) {
  const page = getPage(pageId);
  if (!page) return;
  const config = page.slots[slotIndex];
  editingConfig = cloneConfig(config);
  editingSlotId = `${pageId}:${slotIndex}`;

  // Populate modal fields
  document.getElementById('ed-bg-color').value = editingConfig.bgColor || '#ffffff';

  // Sync guide line slider to current project value
  const glw = project.guideLineWidth || 0.4;
  document.getElementById('guide-line-width').value = glw;
  document.getElementById('guide-line-val').textContent = `${glw.toFixed(1)} mm`;

  // Reset image input
  document.getElementById('ed-bg-image').value = '';

  // Init widget (lazy)
  if (!imgWidget) imgWidget = new ImagePositionWidget();

  // Show/hide image controls
  const imgControls = document.getElementById('img-pos-section');
  if (editingConfig.bgImage) {
    imgControls.classList.remove('hidden');
    const zoomVal = editingConfig.imgScale || 1;
    document.getElementById('img-zoom').value = String(zoomVal);
    document.getElementById('img-zoom-val').textContent = `${zoomVal.toFixed(1)}×`;
    imgWidget.load(editingConfig.bgImage);
  } else {
    imgControls.classList.add('hidden');
    imgWidget.clear();
  }

  // Render text layers + shapes
  renderShapesList();
  renderTextsList();

  document.getElementById('modal-overlay').classList.remove('hidden');

  // After layout, resize canvas to fill right panel
  requestAnimationFrame(() => {
    const panel = document.querySelector('.modal-preview');
    if (!panel) return;
    // Available height: panel height minus header, slider, button rows (~150px)
    const size = Math.min(panel.clientWidth - 40, panel.clientHeight - 150, 520);
    imgWidget.resize(Math.max(size, 280));
    imgWidget.render();
  });
}

function closeEditor() {
  document.getElementById('modal-overlay').classList.add('hidden');
  editingConfig = null;
  editingSlotId = null;
}

function saveEditor() {
  if (!editingSlotId || !editingConfig) return;
  const [pageId, idxStr] = editingSlotId.split(':');
  const page = getPage(pageId);
  if (!page) return;
  page.slots[parseInt(idxStr, 10)] = cloneConfig(editingConfig);
  closeEditor();
  renderPages();
  autosave();
}

/** Rebuild the texts list UI inside the editor. */
function renderTextsList() {
  const container = document.getElementById('texts-list');
  container.innerHTML = '';
  (editingConfig.texts || []).forEach((t, i) => {
    container.appendChild(buildTextEntry(t, i));
  });
}

/**
 * Build one text layer UI row.
 * @param {TextLayer} t
 * @param {number} i
 * @returns {HTMLElement}
 */
function buildTextEntry(t, i) {
  const entry = document.createElement('div');
  entry.className = 'text-entry';

  // Content
  const row1 = document.createElement('div');
  row1.className = 'text-entry-row';
  const contentLbl = document.createElement('label');
  contentLbl.style.width = '100%';
  contentLbl.textContent = 'Text';
  const contentInput = document.createElement('textarea');
  contentInput.value = t.content;
  contentInput.addEventListener('input', () => { t.content = contentInput.value; updateEditorPreview(); });
  contentLbl.appendChild(contentInput);
  row1.appendChild(contentLbl);
  entry.appendChild(row1);

  // Font, size, color, align
  const row2 = document.createElement('div');
  row2.className = 'text-entry-row';

  // Font family
  const fontLbl = document.createElement('label');
  fontLbl.textContent = 'Schrift';
  const fontSel = document.createElement('select');
  ['sans-serif', 'serif', 'monospace', 'Arial', 'Georgia', 'Verdana', 'Impact', 'Comic Sans MS'].forEach(f => {
    const opt = document.createElement('option');
    opt.value = f; opt.textContent = f;
    if (t.font === f) opt.selected = true;
    fontSel.appendChild(opt);
  });
  fontSel.addEventListener('change', () => { t.font = fontSel.value; updateEditorPreview(); });
  fontLbl.appendChild(fontSel);
  row2.appendChild(fontLbl);

  // Size
  const sizeLbl = document.createElement('label');
  sizeLbl.textContent = 'Größe (px)';
  const sizeInput = document.createElement('input');
  sizeInput.type = 'number'; sizeInput.min = '6'; sizeInput.max = '120'; sizeInput.value = t.size;
  sizeInput.addEventListener('change', () => { t.size = parseInt(sizeInput.value, 10) || 14; updateEditorPreview(); });
  sizeLbl.appendChild(sizeInput);
  row2.appendChild(sizeLbl);

  // Color
  const colorLbl = document.createElement('label');
  colorLbl.textContent = 'Farbe';
  const colorInput = document.createElement('input');
  colorInput.type = 'color'; colorInput.value = t.color || '#000000';
  colorInput.addEventListener('input', () => { t.color = colorInput.value; updateEditorPreview(); });
  colorLbl.appendChild(colorInput);
  row2.appendChild(colorLbl);

  // Align
  const alignLbl = document.createElement('label');
  alignLbl.textContent = 'Ausrichtung';
  const alignSel = document.createElement('select');
  ['center', 'start', 'end'].forEach(a => {
    const opt = document.createElement('option');
    opt.value = a; opt.textContent = a === 'start' ? 'Links' : a === 'end' ? 'Rechts' : 'Mitte';
    if (t.align === a) opt.selected = true;
    alignSel.appendChild(opt);
  });
  alignSel.addEventListener('change', () => { t.align = alignSel.value; updateEditorPreview(); });
  alignLbl.appendChild(alignSel);
  row2.appendChild(alignLbl);

  entry.appendChild(row2);

  // Bold, Italic, X, Y, remove
  const row3 = document.createElement('div');
  row3.className = 'text-entry-row';

  const boldLbl = document.createElement('label');
  boldLbl.textContent = 'Fett';
  const boldCb = document.createElement('input');
  boldCb.type = 'checkbox'; boldCb.checked = !!t.bold;
  boldCb.addEventListener('change', () => { t.bold = boldCb.checked; updateEditorPreview(); });
  boldLbl.appendChild(boldCb);
  row3.appendChild(boldLbl);

  const italicLbl = document.createElement('label');
  italicLbl.textContent = 'Kursiv';
  const italicCb = document.createElement('input');
  italicCb.type = 'checkbox'; italicCb.checked = !!t.italic;
  italicCb.addEventListener('change', () => { t.italic = italicCb.checked; updateEditorPreview(); });
  italicLbl.appendChild(italicCb);
  row3.appendChild(italicLbl);

  const xLbl = document.createElement('label');
  xLbl.textContent = 'X %';
  const xInput = document.createElement('input');
  xInput.type = 'number'; xInput.min = '0'; xInput.max = '100'; xInput.value = t.x;
  xInput.addEventListener('change', () => { t.x = parseInt(xInput.value, 10) || 50; updateEditorPreview(); });
  xLbl.appendChild(xInput);
  row3.appendChild(xLbl);

  const yLbl = document.createElement('label');
  yLbl.textContent = 'Y %';
  const yInput = document.createElement('input');
  yInput.type = 'number'; yInput.min = '0'; yInput.max = '100'; yInput.value = t.y;
  yInput.addEventListener('change', () => { t.y = parseInt(yInput.value, 10) || 50; updateEditorPreview(); });
  yLbl.appendChild(yInput);
  row3.appendChild(yLbl);

  // Remove text button
  const removeBtn = document.createElement('button');
  removeBtn.className = 'btn-small text-remove';
  removeBtn.textContent = '✕ Entfernen';
  removeBtn.addEventListener('click', () => {
    editingConfig.texts.splice(i, 1);
    renderTextsList();
    updateEditorPreview();
  });
  row3.appendChild(removeBtn);
  entry.appendChild(row3);

  // Row 4 – Rotation + Arc
  const row4 = document.createElement('div');
  row4.className = 'text-entry-row';

  const rotLbl = document.createElement('label');
  rotLbl.textContent = 'Rotation (°)';
  const rotInput = document.createElement('input');
  rotInput.type = 'number'; rotInput.min = '-180'; rotInput.max = '180'; rotInput.value = t.rotation || 0;
  rotInput.style.width = '62px';
  rotInput.addEventListener('change', () => { t.rotation = parseFloat(rotInput.value) || 0; updateEditorPreview(); });
  rotLbl.appendChild(rotInput);
  row4.appendChild(rotLbl);

  const arcLbl = document.createElement('label');
  arcLbl.style.flex = '1';
  const arcVal = t.arcRadius || 0;
  arcLbl.textContent = `Bogen: ${arcVal > 0 ? '+' : ''}${arcVal} mm`;
  const arcInput = document.createElement('input');
  arcInput.type = 'range'; arcInput.min = '-100'; arcInput.max = '100'; arcInput.step = '1';
  arcInput.value = arcVal;
  arcInput.style.cssText = 'width:100%;accent-color:var(--accent)';
  arcInput.addEventListener('input', () => {
    t.arcRadius = parseInt(arcInput.value, 10);
    arcLbl.textContent = `Bogen: ${t.arcRadius > 0 ? '+' : ''}${t.arcRadius} mm`;
    updateEditorPreview();
  });
  arcLbl.appendChild(arcInput);
  row4.appendChild(arcLbl);
  entry.appendChild(row4);

  // Row 5 – Shadow
  const row5 = document.createElement('div');
  row5.className = 'text-entry-row';

  const shadowToggle = document.createElement('label');
  shadowToggle.textContent = 'Schatten';
  const shadowCb = document.createElement('input');
  shadowCb.type = 'checkbox'; shadowCb.checked = !!t.shadowEnabled;
  shadowCb.addEventListener('change', () => { t.shadowEnabled = shadowCb.checked; updateEditorPreview(); });
  shadowToggle.appendChild(shadowCb);
  row5.appendChild(shadowToggle);

  const shColorLbl = document.createElement('label');
  shColorLbl.textContent = 'Farbe';
  const shColorInput = document.createElement('input');
  shColorInput.type = 'color'; shColorInput.value = t.shadowColor || '#000000';
  shColorInput.addEventListener('input', () => { t.shadowColor = shColorInput.value; updateEditorPreview(); });
  shColorLbl.appendChild(shColorInput);
  row5.appendChild(shColorLbl);

  [
    ['Unschärfe', 'shadowBlur', 0, 20, t.shadowBlur != null ? t.shadowBlur : 3],
    ['OffsetX', 'shadowOffsetX', -20, 20, t.shadowOffsetX != null ? t.shadowOffsetX : 2],
    ['OffsetY', 'shadowOffsetY', -20, 20, t.shadowOffsetY != null ? t.shadowOffsetY : 2],
  ].forEach(([label, key, min, max, val]) => {
    const lbl = document.createElement('label');
    lbl.textContent = label;
    const inp = document.createElement('input');
    inp.type = 'number'; inp.min = String(min); inp.max = String(max); inp.value = val;
    inp.style.width = '50px';
    inp.addEventListener('change', () => { t[key] = parseFloat(inp.value) || 0; updateEditorPreview(); });
    lbl.appendChild(inp);
    row5.appendChild(lbl);
  });
  entry.appendChild(row5);

  // Row 6 – Stroke/Outline
  const row6 = document.createElement('div');
  row6.className = 'text-entry-row';

  const strokeToggle = document.createElement('label');
  strokeToggle.textContent = 'Kontur';
  const strokeCb = document.createElement('input');
  strokeCb.type = 'checkbox'; strokeCb.checked = !!t.strokeEnabled;
  strokeCb.addEventListener('change', () => { t.strokeEnabled = strokeCb.checked; updateEditorPreview(); });
  strokeToggle.appendChild(strokeCb);
  row6.appendChild(strokeToggle);

  const stColorLbl = document.createElement('label');
  stColorLbl.textContent = 'Farbe';
  const stColorInput = document.createElement('input');
  stColorInput.type = 'color'; stColorInput.value = t.strokeColor || '#000000';
  stColorInput.addEventListener('input', () => { t.strokeColor = stColorInput.value; updateEditorPreview(); });
  stColorLbl.appendChild(stColorInput);
  row6.appendChild(stColorLbl);

  const stWidthLbl = document.createElement('label');
  stWidthLbl.textContent = 'Breite (mm)';
  const stWidthInput = document.createElement('input');
  stWidthInput.type = 'number'; stWidthInput.min = '0.1'; stWidthInput.max = '5'; stWidthInput.step = '0.1';
  stWidthInput.value = t.strokeWidth != null ? t.strokeWidth : 1;
  stWidthInput.style.width = '55px';
  stWidthInput.addEventListener('change', () => { t.strokeWidth = parseFloat(stWidthInput.value) || 1; updateEditorPreview(); });
  stWidthLbl.appendChild(stWidthInput);
  row6.appendChild(stWidthLbl);
  entry.appendChild(row6);

  return entry;
}

/** Rebuild the shapes list UI inside the editor. */
function renderShapesList() {
  const container = document.getElementById('shapes-list');
  container.innerHTML = '';
  (editingConfig.shapes || []).forEach((s, i) => {
    container.appendChild(buildShapeEntry(s, i));
  });
}

/**
 * Build one shape-layer UI row.
 * @param {Shape} s @param {number} i
 * @returns {HTMLElement}
 */
function buildShapeEntry(s, i) {
  const entry = document.createElement('div');
  entry.className = 'shape-entry';

  // Row 1: type + fill color + eyedropper + remove
  const row1 = document.createElement('div');
  row1.className = 'shape-entry-row';

  const typeLbl = document.createElement('label');
  typeLbl.textContent = 'Form';
  const typeSel = document.createElement('select');
  [
    ['circle',    'Kreis'],
    ['ellipse',   'Ellipse'],
    ['rect',      'Rechteck'],
    ['roundrect', 'Abger. Rechteck'],
    ['triangle',  'Dreieck'],
    ['star',      'Stern'],
    ['line',      'Linie'],
  ].forEach(([val, label]) => {
    const opt = document.createElement('option');
    opt.value = val; opt.textContent = label;
    if (s.type === val) opt.selected = true;
    typeSel.appendChild(opt);
  });
  typeSel.addEventListener('change', () => { s.type = typeSel.value; renderShapesList(); updateEditorPreview(); });
  typeLbl.appendChild(typeSel);
  row1.appendChild(typeLbl);

  // Fill color
  const fillLbl = document.createElement('label');
  fillLbl.textContent = 'Füllfarbe';
  const fillInput = document.createElement('input');
  fillInput.type = 'color'; fillInput.value = s.fillColor || '#e94560';
  fillInput.addEventListener('input', () => { s.fillColor = fillInput.value; if (imgWidget) imgWidget.render(); updateEditorPreview(); });
  fillLbl.appendChild(fillInput);
  row1.appendChild(fillLbl);

  // Eyedropper for fill
  const eyeBtn = document.createElement('button');
  eyeBtn.className = 'btn-small';
  eyeBtn.textContent = '🔬';
  eyeBtn.title = 'Farbe aus Bild aufnehmen';
  eyeBtn.addEventListener('click', () => {
    if (!imgWidget) return;
    imgWidget.setEyedropper(true, (hex) => {
      s.fillColor = hex;
      fillInput.value = hex;
      if (imgWidget) imgWidget.render();
      updateEditorPreview();
    });
  });
  row1.appendChild(eyeBtn);

  // Remove
  const removeBtn = document.createElement('button');
  removeBtn.className = 'btn-small shape-remove';
  removeBtn.textContent = '✕';
  removeBtn.addEventListener('click', () => {
    editingConfig.shapes.splice(i, 1);
    renderShapesList();
    updateEditorPreview();
  });
  row1.appendChild(removeBtn);
  entry.appendChild(row1);

  // Row 2: fill opacity + stroke color + stroke width
  const row2 = document.createElement('div');
  row2.className = 'shape-entry-row';

  const opacLbl = document.createElement('label');
  opacLbl.style.flex = '1';
  opacLbl.textContent = `Deckkraft (${Math.round((s.fillOpacity || 1) * 100)}%)`;
  const opacSlider = document.createElement('input');
  opacSlider.type = 'range'; opacSlider.min = '0'; opacSlider.max = '1'; opacSlider.step = '0.05';
  opacSlider.value = String(s.fillOpacity != null ? s.fillOpacity : 1);
  opacSlider.style.cssText = 'width:100%;accent-color:var(--accent)';
  opacSlider.addEventListener('input', () => {
    s.fillOpacity = parseFloat(opacSlider.value);
    opacLbl.textContent = `Deckkraft (${Math.round(s.fillOpacity * 100)}%)`;
    if (imgWidget) imgWidget.render(); updateEditorPreview();
  });
  opacLbl.appendChild(opacSlider);
  row2.appendChild(opacLbl);

  if (s.type !== 'line') {
    const strLbl = document.createElement('label');
    strLbl.textContent = 'Kontur';
    const strInput = document.createElement('input');
    strInput.type = 'color'; strInput.value = s.strokeColor || '#ffffff';
    strInput.addEventListener('input', () => { s.strokeColor = strInput.value; if (imgWidget) imgWidget.render(); updateEditorPreview(); });
    strLbl.appendChild(strInput);
    row2.appendChild(strLbl);

    const swLbl = document.createElement('label');
    swLbl.textContent = 'Breite (mm)';
    const swInput = document.createElement('input');
    swInput.type = 'number'; swInput.min = '0'; swInput.max = '5'; swInput.step = '0.1'; swInput.value = s.strokeWidth || 0;
    swInput.addEventListener('change', () => { s.strokeWidth = parseFloat(swInput.value) || 0; if (imgWidget) imgWidget.render(); updateEditorPreview(); });
    swLbl.appendChild(swInput);
    row2.appendChild(swLbl);
  }
  entry.appendChild(row2);

  // Row 3: position X/Y + size W/H + rotation
  const row3 = document.createElement('div');
  row3.className = 'shape-entry-row';

  [
    ['X %', 'x', 0, 100], ['Y %', 'y', 0, 100],
    ['B %', 'w', 1, 200], ['H %', 'h', 1, 200],
    ['Rot °', 'rotation', -180, 180],
  ].forEach(([label, key, min, max]) => {
    const lbl = document.createElement('label');
    lbl.textContent = label;
    const inp = document.createElement('input');
    inp.type = 'number'; inp.min = String(min); inp.max = String(max); inp.value = s[key];
    inp.addEventListener('change', () => {
      s[key] = parseFloat(inp.value) || 0;
      if (imgWidget) imgWidget.render(); updateEditorPreview();
    });
    lbl.appendChild(inp);
    row3.appendChild(lbl);
  });
  entry.appendChild(row3);

  return entry;
}

function updateEditorPreview() {
  if (!editingConfig || !imgWidget) return;
  imgWidget.render();
}

function openPreviewZoom() {
  if (!editingConfig) return;
  const { inner, outer } = project.buttonSize;
  const size = Math.min(window.innerWidth, window.innerHeight) * 0.78;
  const svg = renderButtonSVG(editingConfig, outer, inner, size, true);
  const inner2 = document.getElementById('preview-zoom-inner');
  inner2.innerHTML = '';
  inner2.appendChild(svg);
  document.getElementById('preview-zoom-overlay').classList.remove('hidden');
}

function closePreviewZoom() {
  document.getElementById('preview-zoom-overlay').classList.add('hidden');
}

// ============================================================
// TEMPLATES
// ============================================================

function loadTemplates() {
  try {
    const raw = localStorage.getItem(LS_TEMPLATES_KEY);
    templates = raw ? JSON.parse(raw) : [];
  } catch (e) {
    templates = [];
  }
  renderTemplatesList();
}

function saveTemplates() {
  localStorage.setItem(LS_TEMPLATES_KEY, JSON.stringify(templates));
}

function renderTemplatesList() {
  const container = document.getElementById('templates-list');
  container.innerHTML = '';
  if (templates.length === 0) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'Noch keine Vorlagen gespeichert.';
    container.appendChild(p);
    return;
  }
  templates.forEach((tpl, i) => {
    const item = document.createElement('div');
    item.className = 'template-item';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'tpl-name';
    nameSpan.textContent = tpl.name;
    item.appendChild(nameSpan);

    const useBtn = document.createElement('button');
    useBtn.className = 'btn-small';
    useBtn.textContent = 'Einfügen';
    useBtn.title = 'Als nächsten Button auf aktueller Seite einfügen';
    useBtn.addEventListener('click', () => insertTemplateIntoNextFreeSlot(tpl.config));
    item.appendChild(useBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-small';
    delBtn.textContent = '✕';
    delBtn.title = 'Vorlage löschen';
    delBtn.addEventListener('click', () => {
      templates.splice(i, 1);
      saveTemplates();
      renderTemplatesList();
    });
    item.appendChild(delBtn);

    container.appendChild(item);
  });
}

/** Find the next empty slot (null bgImage + no texts + white bg) or simply first slot. */
function insertTemplateIntoNextFreeSlot(config) {
  const page = project.pages[currentPageIndex];
  if (!page) return;
  const freeIdx = page.slots.findIndex(s => !s.bgImage && (!s.texts || s.texts.length === 0) && s.bgColor === '#ffffff');
  const targetIdx = freeIdx >= 0 ? freeIdx : 0;
  page.slots[targetIdx] = cloneConfig({ ...config, id: makeId() });
  renderPages();
  autosave();
}

// ============================================================
// SIZE PRESET HANDLING
// ============================================================

function applySizeFromSelect() {
  const sel = document.getElementById('size-preset');
  const val = sel.value;
  if (val === 'custom|custom') {
    document.getElementById('custom-size-row').classList.remove('hidden');
    return;
  }
  document.getElementById('custom-size-row').classList.add('hidden');
  const [inner, outer] = val.split('|').map(Number);
  applyNewSize(inner, outer);
}

function applyNewSize(inner, outer) {
  project.buttonSize = { inner, outer };
  // Recalculate layouts for all pages
  project.pages.forEach(page => {
    const newLayout = calcLayout(outer);
    const newSlotCount = newLayout.cols * newLayout.rows;
    const oldSlots = page.slots;
    page.layout = newLayout;
    // Preserve existing configs up to new slot count
    page.slots = Array.from({ length: newSlotCount }, (_, i) =>
      oldSlots[i] ? oldSlots[i] : makeEmptyButtonConfig()
    );
  });
  renderPages();
  autosave();
}

// ============================================================
// PROJECT SAVE / LOAD
// ============================================================

function autosave() {
  try {
    localStorage.setItem(LS_PROJECT_KEY, JSON.stringify(project));
  } catch (e) {
    console.warn('Autosave failed:', e);
  }
}

function loadProjectFromStorage() {
  try {
    const raw = localStorage.getItem(LS_PROJECT_KEY);
    if (raw) {
      const loaded = JSON.parse(raw);
      if (loaded && loaded.pages && loaded.buttonSize) {
        project = loaded;
        return true;
      }
    }
  } catch (e) {
    console.warn('Could not load project from storage:', e);
  }
  return false;
}

function saveProjectToFile() {
  const json = JSON.stringify(project, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `buttonsmaker_projekt_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function loadProjectFromFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const loaded = JSON.parse(e.target.result);
      if (loaded && loaded.pages && loaded.buttonSize) {
        project = loaded;
        currentPageIndex = 0;
        selectedSlotId = null;
        syncSizeSelectToProject();
        renderPages();
        autosave();
      } else {
        alert('Ungültige Projektdatei.');
      }
    } catch (err) {
      alert('Fehler beim Laden der Datei: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function syncSizeSelectToProject() {
  const sel = document.getElementById('size-preset');
  const { inner, outer } = project.buttonSize;
  const matchVal = `${inner}|${outer}`;
  let found = false;
  for (const opt of sel.options) {
    if (opt.value === matchVal) { opt.selected = true; found = true; break; }
  }
  if (!found) {
    sel.value = 'custom|custom';
    document.getElementById('custom-inner').value = inner;
    document.getElementById('custom-outer').value = outer;
    document.getElementById('custom-size-row').classList.remove('hidden');
  } else {
    document.getElementById('custom-size-row').classList.add('hidden');
  }
}

// ============================================================
// COPY & CLEAR SLOT
// ============================================================

function copySelectedSlot() {
  if (!selectedSlotId) return;
  const config = getSlotConfig(selectedSlotId);
  if (!config) return;
  const copy = cloneConfig({ ...config, id: makeId() });
  // Find next free slot after the selected one
  const [pageId, idxStr] = selectedSlotId.split(':');
  const page = getPage(pageId);
  if (!page) return;
  const startIdx = parseInt(idxStr, 10) + 1;
  let placed = false;
  for (let i = startIdx; i < page.slots.length; i++) {
    const s = page.slots[i];
    if (!s.bgImage && (!s.texts || s.texts.length === 0) && s.bgColor === '#ffffff') {
      page.slots[i] = copy;
      placed = true;
      break;
    }
  }
  if (!placed) {
    // Put into first free slot overall
    const freeIdx = page.slots.findIndex(s =>
      !s.bgImage && (!s.texts || s.texts.length === 0) && s.bgColor === '#ffffff'
    );
    if (freeIdx >= 0) {
      page.slots[freeIdx] = copy;
    } else {
      // All full: add a new page
      const newPage = makePage(project.buttonSize.outer);
      newPage.slots[0] = copy;
      project.pages.push(newPage);
      currentPageIndex = project.pages.length - 1;
    }
  }
  renderPages();
  autosave();
}

function clearSelectedSlot() {
  if (!selectedSlotId) return;
  const [pageId, idxStr] = selectedSlotId.split(':');
  const page = getPage(pageId);
  if (!page) return;
  page.slots[parseInt(idxStr, 10)] = makeEmptyButtonConfig();
  selectedSlotId = null;
  updateSelectedPanel();
  renderPages();
  autosave();
}

// ============================================================
// IMAGE POSITION WIDGET
// ============================================================

class ImagePositionWidget {
  constructor() {
    this.canvas = document.getElementById('img-pos-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.eyedropperMode = false;
    this.eyedropperCallback = null;
    this.imgEl = new Image();
    this.imgLoaded = false;

    // Interaction state
    this.sel = null;         // { type: 'shape'|'text', index } or null
    this.iMode = null;       // 'move' | 'resize' | 'rotate' | 'imgdrag'
    this.resizeDir = null;   // 'nw'|'ne'|'se'|'sw'
    this.dragStart = null;   // { mx, my, origX, origY, origW, origH, origRot, origImgX, origImgY }

    this._bindEvents();
  }

  load(src) {
    this.imgLoaded = false;
    this.imgEl.onload = () => { this.imgLoaded = true; this.render(); };
    this.imgEl.src = src;
  }

  clear() {
    this.imgLoaded = false;
    this.imgEl.src = '';
    this.render();
  }

  resize(size) {
    this.canvas.width = size;
    this.canvas.height = size;
    this.render();
  }

  setEyedropper(on, callback) {
    this.eyedropperMode = on;
    this.eyedropperCallback = callback || null;
    this.canvas.classList.toggle('eyedropper-mode', on);
    document.getElementById('eyedropper-hint').classList.toggle('hidden', !on);
    const btnEye = document.getElementById('btn-eyedropper');
    if (btnEye) btnEye.classList.toggle('active', on && !callback);
  }

  // ---- coordinate helpers ----
  _metrics() {
    const { inner, outer } = project.buttonSize;
    const cpx = this.canvas.width;
    const pxPerMm = cpx / outer;
    const cx = cpx / 2;
    const cy = cpx / 2;
    const outerRpx = (outer / 2) * pxPerMm;
    const innerRpx = (inner / 2) * pxPerMm;
    return { cpx, pxPerMm, cx, cy, outerRpx, innerRpx };
  }

  _elBBox(el, innerRpx, cx, cy) {
    const px = (cx - innerRpx) + (el.x / 100) * (innerRpx * 2);
    const py = (cy - innerRpx) + (el.y / 100) * (innerRpx * 2);
    const w  = (el.w / 100) * (innerRpx * 2);
    const h  = (el.h / 100) * (innerRpx * 2);
    return { px, py, w, h };
  }

  _textBBox(t, innerRpx, cx, cy, pxPerMm) {
    const px = (cx - innerRpx) + (t.x / 100) * (innerRpx * 2);
    const py = (cy - innerRpx) + (t.y / 100) * (innerRpx * 2);
    const fsMm = (t.size || 14) / MM_TO_PX;
    const fsPx = fsMm * pxPerMm;
    const estW = fsPx * (t.content || '').length * 0.65;
    const estH = fsPx * 1.3;
    return { px, py, w: estW, h: estH };
  }

  // ---- hit test ----
  _hitHandle(mx, my, hx, hy) {
    return Math.abs(mx - hx) < 9 && Math.abs(my - hy) < 9;
  }

  _handlesFor(el, innerRpx, cx, cy, isText, pxPerMm) {
    let px, py, w, h;
    if (isText) {
      ({ px, py, w, h } = this._textBBox(el, innerRpx, cx, cy, pxPerMm));
    } else {
      ({ px, py, w, h } = this._elBBox(el, innerRpx, cx, cy));
    }
    const hw = w / 2; const hh = h / 2;
    return {
      nw: { x: px - hw, y: py - hh },
      ne: { x: px + hw, y: py - hh },
      se: { x: px + hw, y: py + hh },
      sw: { x: px - hw, y: py + hh },
      n:  { x: px,      y: py - hh },
      s:  { x: px,      y: py + hh },
      e:  { x: px + hw, y: py      },
      w:  { x: px - hw, y: py      },
      rot:{ x: px,      y: py - hh - 22 },
    };
  }

  _hitTestHandles(mx, my, el, innerRpx, cx, cy, isText, pxPerMm) {
    const handles = this._handlesFor(el, innerRpx, cx, cy, isText, pxPerMm);
    if (this._hitHandle(mx, my, handles.rot.x, handles.rot.y)) return 'rotate';
    for (const dir of ['nw', 'ne', 'se', 'sw']) {
      if (this._hitHandle(mx, my, handles[dir].x, handles[dir].y)) return 'resize-' + dir;
    }
    return null;
  }

  _pointInBBox(mx, my, el, innerRpx, cx, cy, isText, pxPerMm) {
    let px, py, w, h;
    if (isText) {
      ({ px, py, w, h } = this._textBBox(el, innerRpx, cx, cy, pxPerMm));
    } else {
      ({ px, py, w, h } = this._elBBox(el, innerRpx, cx, cy));
    }
    return mx >= px - w/2 && mx <= px + w/2 && my >= py - h/2 && my <= py + h/2;
  }

  // ---- drawing ----
  render() {
    if (!editingConfig) return;
    const { cpx, pxPerMm, cx, cy, outerRpx, innerRpx } = this._metrics();
    const ctx = this.ctx;

    ctx.clearRect(0, 0, cpx, cpx);

    // Background fill
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, outerRpx, 0, Math.PI * 2);
    ctx.fillStyle = editingConfig.bgColor || '#ffffff';
    ctx.fill();
    ctx.restore();

    // Image clipped to outer circle
    if (this.imgLoaded) {
      const { imgX = 0, imgY = 0, imgScale = 1 } = editingConfig;
      const outerD = outerRpx * 2;
      const natW = this.imgEl.naturalWidth;
      const natH = this.imgEl.naturalHeight;
      const coverScale = Math.max(outerD / natW, outerD / natH) * imgScale;
      const scaledW = natW * coverScale;
      const scaledH = natH * coverScale;
      const ix = cx - scaledW / 2 + imgX * pxPerMm;
      const iy = cy - scaledH / 2 + imgY * pxPerMm;

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, outerRpx, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(this.imgEl, ix, iy, scaledW, scaledH);
      ctx.restore();
    }

    // Shapes (clipped to inner circle)
    if (editingConfig.shapes && editingConfig.shapes.length > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, innerRpx, 0, Math.PI * 2);
      ctx.clip();
      editingConfig.shapes.forEach(s => drawShapeCanvas(ctx, s, innerRpx, cx, cy));
      ctx.restore();
    }

    // Texts (clipped to inner circle)
    if (editingConfig.texts && editingConfig.texts.length > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, innerRpx, 0, Math.PI * 2);
      ctx.clip();
      editingConfig.texts.forEach(t => drawTextCanvas(ctx, t, innerRpx, cx, cy, pxPerMm));
      ctx.restore();
    }

    // Guide circles
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, outerRpx - 1, 0, Math.PI * 2);
    ctx.strokeStyle = '#2196f3';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const redW = (project && project.guideLineWidth) ? project.guideLineWidth * pxPerMm : 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, innerRpx, 0, Math.PI * 2);
    ctx.strokeStyle = '#e53935';
    ctx.lineWidth = redW;
    ctx.stroke();
    ctx.restore();

    // Selection handles
    if (this.sel) {
      const el = this.sel.type === 'shape'
        ? editingConfig.shapes[this.sel.index]
        : editingConfig.texts[this.sel.index];
      if (el) this._drawHandles(ctx, el, innerRpx, cx, cy, this.sel.type === 'text', pxPerMm);
    }
  }

  _drawHandles(ctx, el, innerRpx, cx, cy, isText, pxPerMm) {
    const handles = this._handlesFor(el, innerRpx, cx, cy, isText, pxPerMm);
    let px, py, w, h;
    if (isText) {
      ({ px, py, w, h } = this._textBBox(el, innerRpx, cx, cy, pxPerMm));
    } else {
      ({ px, py, w, h } = this._elBBox(el, innerRpx, cx, cy));
    }

    ctx.save();
    // Dashed selection box
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(px - w/2, py - h/2, w, h);
    ctx.setLineDash([]);

    // Rotation handle line + circle
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, py - h/2);
    ctx.lineTo(handles.rot.x, handles.rot.y);
    ctx.stroke();
    ctx.fillStyle = '#a855f7';
    ctx.beginPath();
    ctx.arc(handles.rot.x, handles.rot.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Corner resize handles
    for (const dir of ['nw', 'ne', 'se', 'sw']) {
      const h2 = handles[dir];
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#7c3aed';
      ctx.lineWidth = 1.5;
      ctx.fillRect(h2.x - 5, h2.y - 5, 10, 10);
      ctx.strokeRect(h2.x - 5, h2.y - 5, 10, 10);
    }
    ctx.restore();
  }

  _bindEvents() {
    const c = this.canvas;

    c.addEventListener('mousedown', e => {
      if (this.eyedropperMode) return;
      e.preventDefault();
      const mx = e.offsetX, my = e.offsetY;
      const { pxPerMm, cx, cy, outerRpx, innerRpx } = this._metrics();

      // 1. Check handles of currently selected element
      if (this.sel) {
        const el = this.sel.type === 'shape'
          ? editingConfig.shapes[this.sel.index]
          : editingConfig.texts[this.sel.index];
        if (el) {
          const hit = this._hitTestHandles(mx, my, el, innerRpx, cx, cy, this.sel.type === 'text', pxPerMm);
          if (hit) {
            this.iMode = hit === 'rotate' ? 'rotate' : 'resize';
            this.resizeDir = hit === 'rotate' ? null : hit.replace('resize-', '');
            const bbox = this.sel.type === 'text'
              ? this._textBBox(el, innerRpx, cx, cy, pxPerMm)
              : this._elBBox(el, innerRpx, cx, cy);
            this.dragStart = {
              mx, my,
              origX: el.x, origY: el.y,
              origW: el.w || 40, origH: el.h || 40,
              origRot: el.rotation || 0,
              bboxPx: bbox.px, bboxPy: bbox.py,
            };
            return;
          }
        }
      }

      // 2. Hit-test shapes (reverse = topmost first)
      const shapes = editingConfig.shapes || [];
      for (let i = shapes.length - 1; i >= 0; i--) {
        if (this._pointInBBox(mx, my, shapes[i], innerRpx, cx, cy, false, pxPerMm)) {
          this.sel = { type: 'shape', index: i };
          this.iMode = 'move';
          this.dragStart = { mx, my, origX: shapes[i].x, origY: shapes[i].y };
          this.render();
          return;
        }
      }

      // 3. Hit-test texts (reverse = topmost first)
      const texts = editingConfig.texts || [];
      for (let i = texts.length - 1; i >= 0; i--) {
        if (this._pointInBBox(mx, my, texts[i], innerRpx, cx, cy, true, pxPerMm)) {
          this.sel = { type: 'text', index: i };
          this.iMode = 'move';
          this.dragStart = { mx, my, origX: texts[i].x, origY: texts[i].y };
          this.render();
          return;
        }
      }

      // 4. Deselect + image drag
      this.sel = null;
      if (this.imgLoaded) {
        this.iMode = 'imgdrag';
        this.dragStart = {
          mx, my,
          origImgX: editingConfig.imgX || 0,
          origImgY: editingConfig.imgY || 0,
        };
        c.style.cursor = 'grabbing';
      }
      this.render();
    });

    c.addEventListener('mousemove', e => {
      if (!this.iMode || !editingConfig) return;
      const mx = e.offsetX, my = e.offsetY;
      const { pxPerMm, cx, cy, innerRpx } = this._metrics();
      const dx = mx - this.dragStart.mx;
      const dy = my - this.dragStart.my;
      const innerD = innerRpx * 2;

      const el = this.sel ? (
        this.sel.type === 'shape'
          ? editingConfig.shapes[this.sel.index]
          : editingConfig.texts[this.sel.index]
      ) : null;

      if (this.iMode === 'imgdrag') {
        editingConfig.imgX = this.dragStart.origImgX + dx / pxPerMm;
        editingConfig.imgY = this.dragStart.origImgY + dy / pxPerMm;

      } else if (this.iMode === 'move' && el) {
        el.x = Math.max(0, Math.min(100, this.dragStart.origX + (dx / innerD) * 100));
        el.y = Math.max(0, Math.min(100, this.dragStart.origY + (dy / innerD) * 100));

      } else if (this.iMode === 'resize' && el && this.sel.type === 'shape') {
        const dPct = (Math.abs(dx) + Math.abs(dy)) / (innerD) * 100;
        const grow = (dx + dy) > 0 ? 1 : -1;
        const dir = this.resizeDir;
        const wDelta = (dir === 'ne' || dir === 'se') ? (dx / innerD) * 100 : (-dx / innerD) * 100;
        const hDelta = (dir === 'se' || dir === 'sw') ? (dy / innerD) * 100 : (-dy / innerD) * 100;
        el.w = Math.max(2, this.dragStart.origW + wDelta * 2);
        el.h = Math.max(2, this.dragStart.origH + hDelta * 2);

      } else if (this.iMode === 'rotate' && el) {
        const elPx = this.dragStart.bboxPx;
        const elPy = this.dragStart.bboxPy;
        const angle = Math.atan2(my - elPy, mx - elPx) * (180 / Math.PI) + 90;
        el.rotation = Math.round(angle);
      }

      this.render();
    });

    c.addEventListener('mouseup', () => {
      const wasInteracting = this.iMode && this.iMode !== null;
      this.iMode = null;
      this.dragStart = null;
      this.resizeDir = null;
      c.style.cursor = 'default';
      if (wasInteracting && this.sel) {
        syncFormAfterCanvasEdit();
      }
    });

    c.addEventListener('mouseleave', () => {
      if (this.iMode === 'imgdrag') {
        this.iMode = null;
        this.dragStart = null;
      }
    });

    c.addEventListener('click', e => {
      if (!this.eyedropperMode) return;
      const pixel = this.ctx.getImageData(e.offsetX, e.offsetY, 1, 1).data;
      const hex = '#' + [pixel[0], pixel[1], pixel[2]]
        .map(v => v.toString(16).padStart(2, '0')).join('');
      if (this.eyedropperCallback) {
        this.eyedropperCallback(hex);
      } else {
        if (editingConfig) editingConfig.bgColor = hex;
        document.getElementById('ed-bg-color').value = hex;
        this.render();
      }
      this.setEyedropper(false);
    });

    c.addEventListener('dblclick', () => {
      // Double-click canvas: open SVG zoom overlay
      openPreviewZoom();
    });
  }
}

/** @type {ImagePositionWidget|null} */
let imgWidget = null;

/** After canvas drag/resize/rotate, rebuild form UI to reflect new values. */
function syncFormAfterCanvasEdit() {
  if (!editingConfig) return;
  renderShapesList();
  renderTextsList();
}

// ============================================================
// EVENT WIRING
// ============================================================

function initEvents() {
  // Guide line width
  document.getElementById('guide-line-width').addEventListener('input', e => {
    project.guideLineWidth = parseFloat(e.target.value);
    document.getElementById('guide-line-val').textContent = `${project.guideLineWidth.toFixed(1)} mm`;
    renderPages();
    updateEditorPreview();
    autosave();
  });

  // Size preset
  document.getElementById('size-preset').addEventListener('change', applySizeFromSelect);
  document.getElementById('btn-apply-custom').addEventListener('click', () => {
    const inner = parseInt(document.getElementById('custom-inner').value, 10) || 37;
    const outer = parseInt(document.getElementById('custom-outer').value, 10) || 51;
    if (outer <= inner) { alert('Außendurchmesser muss größer als Innendurchmesser sein.'); return; }
    applyNewSize(inner, outer);
  });

  // Selected slot actions
  document.getElementById('btn-edit-selected').addEventListener('click', () => {
    if (!selectedSlotId) return;
    const [pageId, idxStr] = selectedSlotId.split(':');
    openEditor(pageId, parseInt(idxStr, 10));
  });
  document.getElementById('btn-copy-selected').addEventListener('click', copySelectedSlot);
  document.getElementById('btn-clear-selected').addEventListener('click', clearSelectedSlot);

  // Page navigation
  document.getElementById('btn-prev-page').addEventListener('click', () => {
    if (currentPageIndex > 0) { currentPageIndex--; renderPages(); }
  });
  document.getElementById('btn-next-page').addEventListener('click', () => {
    if (currentPageIndex < project.pages.length - 1) { currentPageIndex++; renderPages(); }
  });
  document.getElementById('btn-add-page').addEventListener('click', () => {
    const newPage = makePage(project.buttonSize.outer);
    project.pages.push(newPage);
    currentPageIndex = project.pages.length - 1;
    renderPages();
    autosave();
  });
  document.getElementById('btn-remove-page').addEventListener('click', () => {
    if (project.pages.length <= 1) { alert('Mindestens eine Seite muss vorhanden sein.'); return; }
    if (!confirm(`Seite ${currentPageIndex + 1} wirklich löschen?`)) return;
    project.pages.splice(currentPageIndex, 1);
    currentPageIndex = Math.min(currentPageIndex, project.pages.length - 1);
    renderPages();
    autosave();
  });

  // Print
  document.getElementById('btn-print').addEventListener('click', () => {
    // Show all pages temporarily for printing
    const container = document.getElementById('pages-container');
    container.innerHTML = '';
    project.pages.forEach((page, i) => {
      const el = renderPage(page, i);
      el.style.transform = '';
      el.style.marginBottom = '';
      container.appendChild(el);
    });
    window.print();
    // Restore single-page view
    renderPages();
  });

  // Save / Load project
  document.getElementById('btn-save-project').addEventListener('click', () => {
    autosave();
    saveProjectToFile();
  });
  document.getElementById('btn-load-project').addEventListener('click', () => {
    document.getElementById('file-load-input').click();
  });
  document.getElementById('file-load-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) loadProjectFromFile(file);
    e.target.value = '';
  });

  // Modal – bg color
  document.getElementById('ed-bg-color').addEventListener('input', e => {
    if (editingConfig) {
      editingConfig.bgColor = e.target.value;
      updateEditorPreview();
      if (imgWidget) imgWidget.render();
    }
  });

  // Modal – bg image upload
  document.getElementById('ed-bg-image').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file || !editingConfig) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target.result;
      // Resolve natural dimensions before storing
      const tmpImg = new Image();
      tmpImg.onload = () => {
        editingConfig.bgImage = dataUrl;
        editingConfig.imgNaturalW = tmpImg.naturalWidth;
        editingConfig.imgNaturalH = tmpImg.naturalHeight;
        editingConfig.imgX = 0;
        editingConfig.imgY = 0;
        editingConfig.imgScale = 1;
        document.getElementById('img-zoom').value = '1';
        document.getElementById('img-zoom-val').textContent = '1.0×';
        document.getElementById('img-pos-section').classList.remove('hidden');
        if (!imgWidget) imgWidget = new ImagePositionWidget();
        imgWidget.load(dataUrl);
        updateEditorPreview();
      };
      tmpImg.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('ed-bg-image-clear').addEventListener('click', () => {
    if (editingConfig) {
      editingConfig.bgImage = null;
      editingConfig.imgNaturalW = null;
      editingConfig.imgNaturalH = null;
      editingConfig.imgX = 0;
      editingConfig.imgY = 0;
      editingConfig.imgScale = 1;
      updateEditorPreview();
    }
    document.getElementById('ed-bg-image').value = '';
    document.getElementById('img-pos-section').classList.add('hidden');
    if (imgWidget) imgWidget.clear();
  });

  // Image position widget controls
  document.getElementById('btn-eyedropper').addEventListener('click', () => {
    if (!imgWidget) return;
    const isOn = !imgWidget.eyedropperMode;
    imgWidget.setEyedropper(isOn, isOn ? (hex) => {
      if (editingConfig) editingConfig.bgColor = hex;
      document.getElementById('ed-bg-color').value = hex;
      if (imgWidget) imgWidget.render();
      updateEditorPreview();
    } : null);
  });

  document.getElementById('btn-img-reset').addEventListener('click', () => {
    if (!editingConfig) return;
    editingConfig.imgX = 0;
    editingConfig.imgY = 0;
    editingConfig.imgScale = 1;
    document.getElementById('img-zoom').value = '1';
    document.getElementById('img-zoom-val').textContent = '1.0×';
    if (imgWidget) imgWidget.render();
    updateEditorPreview();
  });

  document.getElementById('img-zoom').addEventListener('input', e => {
    if (!editingConfig) return;
    editingConfig.imgScale = parseFloat(e.target.value);
    document.getElementById('img-zoom-val').textContent = `${editingConfig.imgScale.toFixed(1)}×`;
    if (imgWidget) imgWidget.render();
    updateEditorPreview();
  });

  // Modal – add shape
  document.getElementById('btn-add-shape').addEventListener('click', () => {
    if (!editingConfig) return;
    if (!editingConfig.shapes) editingConfig.shapes = [];
    editingConfig.shapes.push(makeShape());
    renderShapesList();
    updateEditorPreview();
  });

  // Modal – add text
  document.getElementById('btn-add-text').addEventListener('click', () => {
    if (!editingConfig) return;
    editingConfig.texts.push(makeTextLayer());
    renderTextsList();
    updateEditorPreview();
  });

  // Preview zoom
  document.getElementById('btn-preview-zoom').addEventListener('click', openPreviewZoom);
  document.getElementById('preview-zoom-overlay').addEventListener('click', closePreviewZoom);

  // Modal – save/cancel/save-as-template
  document.getElementById('btn-modal-save').addEventListener('click', saveEditor);
  document.getElementById('btn-modal-cancel').addEventListener('click', closeEditor);
  document.getElementById('btn-modal-close').addEventListener('click', closeEditor);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeEditor();
  });

  document.getElementById('btn-save-as-template').addEventListener('click', () => {
    document.getElementById('template-name-overlay').classList.remove('hidden');
    document.getElementById('template-name-input').value = '';
    document.getElementById('template-name-input').focus();
  });

  // Template name dialog
  document.getElementById('btn-template-name-save').addEventListener('click', () => {
    const name = document.getElementById('template-name-input').value.trim();
    if (!name) { alert('Bitte einen Namen eingeben.'); return; }
    if (editingConfig) {
      templates.push({ name, config: cloneConfig(editingConfig) });
      saveTemplates();
      renderTemplatesList();
    }
    document.getElementById('template-name-overlay').classList.add('hidden');
  });
  document.getElementById('btn-template-name-cancel').addEventListener('click', () => {
    document.getElementById('template-name-overlay').classList.add('hidden');
  });
  document.getElementById('template-name-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-template-name-save').click();
    if (e.key === 'Escape') document.getElementById('template-name-overlay').classList.add('hidden');
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !document.getElementById('preview-zoom-overlay').classList.contains('hidden')) {
      closePreviewZoom(); return;
    }
    if (document.getElementById('modal-overlay').classList.contains('hidden') === false) return;
    if (e.key === 'Escape') { selectedSlotId = null; updateSelectedPanel(); renderPages(); }
    if (e.key === 'Delete' && selectedSlotId) clearSelectedSlot();
    if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedSlotId) { e.preventDefault(); copySelectedSlot(); }
  });

  // Resize handler
  window.addEventListener('resize', scaleA4Pages);
}

// ============================================================
// INIT
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  // Load or create project
  if (!loadProjectFromStorage()) {
    project = makeProject();
  }

  loadTemplates();
  syncSizeSelectToProject();
  renderPages();
  updateSelectedPanel();
  initEvents();
});
