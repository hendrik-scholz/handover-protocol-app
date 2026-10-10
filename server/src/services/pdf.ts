import PDFDocument from 'pdfkit';
import { SLOTS, type Damage, type Severity, type Slot } from '../schemas.js';
import { pdfCopy as t } from './pdfCopy.js';

export interface PdfData {
  protocolId: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  plate: string;
  makeModel: string;
  mileageKm: number | null;
  remarks: string;
  /** Prepared JPEGs by slot; a slot without an entry is reported as not captured. */
  photos: Partial<Record<Slot, Buffer>>;
  damages: Damage[];
  /** Dark ink on white (see signatureToInk). */
  signatures: { handed?: Buffer; received?: Buffer };
}

// A4 in points; layout follows mockups/Handover_Protocol_PDF.pdf.
const PAGE_W = 595.28;
const MARGIN = 42;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = 791;
const BOTTOM = 776;
const RUNNING_TOP = 84;

const C = {
  text: '#1b2230',
  muted: '#5b6678',
  border: '#c4ccd8',
  hairline: '#d9dee7',
  placeholder: '#cbd5e1',
  badge: '#c2410c',
  warn: { bg: '#fdeee6', border: '#f0c4a3', text: '#8a2f0b' },
  ok: { bg: '#e8f5ee', border: '#a6d6bb', text: '#14663a' },
  sev: {
    minor: { bg: '#e6eaf8', text: '#1e2f7a' },
    moderate: { bg: '#fbdcc0', text: '#8a2f0b' },
    severe: { bg: '#f8d0d0', text: '#8b1a1a' },
  } satisfies Record<Severity, { bg: string; text: string }>,
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  const month = MONTHS[Number(m) - 1];
  return month ? `${d} ${month} ${y}` : iso;
}

type Doc = InstanceType<typeof PDFDocument>;

const BOLD = 'Helvetica-Bold';
const REGULAR = 'Helvetica';

function badge(doc: Doc, cx: number, cy: number, n: number) {
  doc.circle(cx, cy, 7.5).lineWidth(1.4).fillAndStroke(C.badge, '#ffffff');
  doc.fillColor('#ffffff').font(BOLD).fontSize(8).text(String(n), cx - 8, cy - 3.2, { width: 16, align: 'center', lineBreak: false });
}

function pill(doc: Doc, rightX: number, y: number, severity: Severity) {
  const label = t.severityLabel[severity];
  doc.font(BOLD).fontSize(9);
  const w = doc.widthOfString(label) + 18;
  doc.roundedRect(rightX - w, y, w, 17, 8.5).fill(C.sev[severity].bg);
  doc.fillColor(C.sev[severity].text).text(label, rightX - w, y + 4.3, { width: w, align: 'center', lineBreak: false });
}

function photoCover(doc: Doc, img: Buffer, x: number, y: number, w: number, h: number, radius: number) {
  doc.save();
  doc.roundedRect(x, y, w, h, radius).clip();
  doc.image(img, x, y, { cover: [w, h], align: 'center', valign: 'center' });
  doc.restore();
}

export function renderProtocolPdf(data: PdfData, opts: { compress?: boolean } = {}): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 0,
    bufferPages: true,
    compress: opts.compress ?? true,
    info: { Title: t.title, Subject: data.protocolId },
  });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const captured = SLOTS.filter((s) => data.photos[s]);
  const missing = SLOTS.filter((s) => !data.photos[s]);
  const dateLabel = formatDate(data.date);
  const damages = data.damages;
  const counts: Record<Severity, number> = { minor: 0, moderate: 0, severe: 0 };
  for (const d of damages) counts[d.severity] += 1;

  let y = 0;

  const heading = (text: string) => {
    doc.fillColor(C.text).font(BOLD).fontSize(17).text(text, MARGIN, y, { lineBreak: false });
    y += 28;
  };

  const runningHeader = () => {
    doc.fillColor(C.text).font(BOLD).fontSize(15).text(t.title, MARGIN, 36, { lineBreak: false });
    const right = `${data.plate ? `${data.plate} · ` : ''}${dateLabel}`;
    doc.fillColor(C.muted).font(REGULAR).fontSize(10.5).text(right, MARGIN, 40, { width: CONTENT_W, align: 'right', lineBreak: false });
    doc.moveTo(MARGIN, 62).lineTo(MARGIN + CONTENT_W, 62).lineWidth(1.6).stroke(C.text);
    y = RUNNING_TOP;
  };

  const newPage = () => {
    doc.addPage();
    runningHeader();
  };

  const ensureSpace = (h: number) => {
    if (y + h > BOTTOM) newPage();
  };

  // ---- Page 1: header ----
  doc.fillColor(C.text).font(BOLD).fontSize(28).text(t.title, MARGIN, 34, { lineBreak: false });
  doc.fillColor(C.muted).font(REGULAR).fontSize(11)
    .text(`${t.draftFrom(captured.length)} · ${t.created(dateLabel)}`, MARGIN, 68, { lineBreak: false });
  doc.fillColor(C.muted).fontSize(8.5).text(t.protocolId, MARGIN, 44, { width: CONTENT_W, align: 'right', lineBreak: false });
  doc.fillColor(C.text).fontSize(12).text(data.protocolId, MARGIN, 56, { width: CONTENT_W, align: 'right', lineBreak: false });
  doc.moveTo(MARGIN, 90).lineTo(MARGIN + CONTENT_W, 90).lineWidth(1.6).stroke(C.text);

  // ---- Vehicle box ----
  y = 108;
  const fields: Array<[string, string]> = [
    [t.plate, data.plate || '—'],
    ...(data.makeModel ? ([[t.vehicle, data.makeModel]] as Array<[string, string]>) : []),
    [t.date, dateLabel],
    [t.mileage, data.mileageKm === null ? '—' : `${data.mileageKm.toLocaleString('en-US')} km`],
  ];
  doc.roundedRect(MARGIN, y, CONTENT_W, 56, 7).lineWidth(0.8).stroke(C.border);
  const colW = (CONTENT_W - 32) / fields.length;
  fields.forEach(([label, value], i) => {
    const x = MARGIN + 16 + i * colW;
    doc.fillColor(C.muted).font(REGULAR).fontSize(8.5).text(label, x, y + 13, { width: colW - 8, lineBreak: false });
    doc.fillColor(C.text).font(BOLD).fontSize(13).text(value, x, y + 27, { width: colW - 8, lineBreak: false, ellipsis: true });
  });
  y += 56 + 18;

  // ---- Severity banner ----
  const none = damages.length === 0;
  const tone = none ? C.ok : C.warn;
  const detail = [
    [counts.minor && `${counts.minor} minor`, counts.moderate && `${counts.moderate} moderate`, counts.severe && `${counts.severe} severe`]
      .filter(Boolean)
      .join(' · '),
    missing.length && t.notChecked(missing.map((s) => t.slotLabels[s]).join(', ')),
  ].filter(Boolean).join(' · ');
  doc.roundedRect(MARGIN, y, CONTENT_W, detail ? 56 : 44, 7).lineWidth(0.8).fillAndStroke(tone.bg, tone.border);
  const iconX = MARGIN + 26;
  const iconY = y + (detail ? 28 : 22);
  doc.lineWidth(1.4).strokeColor(tone.text);
  if (none) {
    doc.circle(iconX, iconY, 9).stroke();
    doc.moveTo(iconX - 4, iconY).lineTo(iconX - 1, iconY + 3.5).lineTo(iconX + 5, iconY - 3.5).stroke();
  } else {
    doc.polygon([iconX, iconY - 9], [iconX + 10, iconY + 8], [iconX - 10, iconY + 8]).lineJoin('round').stroke();
    doc.moveTo(iconX, iconY - 3).lineTo(iconX, iconY + 2).stroke();
    doc.circle(iconX, iconY + 5, 0.6).fill(tone.text);
  }
  doc.fillColor(tone.text).font(BOLD).fontSize(14)
    .text(none ? t.noDamages : t.damagesDetected(damages.length), MARGIN + 50, y + (detail ? 12 : 14), { lineBreak: false });
  if (detail) {
    doc.font(REGULAR).fontSize(10.5).text(detail, MARGIN + 50, y + 33, { width: CONTENT_W - 64, lineBreak: false });
  }
  y += (detail ? 56 : 44) + 24;

  // ---- Damages table ----
  if (!none) {
    ensureSpace(28 + 24 + 90);
    heading(t.damages);
    const THUMB_W = 99;
    const THUMB_H = 70;
    const TEXT_X = MARGIN + 126;
    const TEXT_W = CONTENT_W - 126 - 86;

    const tableHeader = () => {
      doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_W, y).lineWidth(1).stroke(C.text);
      doc.fillColor(C.muted).font(REGULAR).fontSize(9).text(t.evidence, MARGIN, y + 7, { lineBreak: false });
      doc.text(t.damage, TEXT_X, y + 7, { lineBreak: false });
      doc.text(t.severity, MARGIN, y + 7, { width: CONTENT_W, align: 'right', lineBreak: false });
      doc.moveTo(MARGIN, y + 24).lineTo(MARGIN + CONTENT_W, y + 24).lineWidth(1).stroke(C.text);
      y += 24;
    };
    tableHeader();

    damages.forEach((d, i) => {
      doc.font(REGULAR).fontSize(10.5);
      const descH = doc.heightOfString(d.description, { width: TEXT_W });
      const textH = 20 + 15 + descH;
      const rowH = Math.max(THUMB_H, textH) + 18;
      if (y + rowH > BOTTOM) {
        newPage();
        tableHeader();
      }
      const top = y + 9;
      const img = data.photos[d.slot];
      if (img) photoCover(doc, img, MARGIN, top, THUMB_W, THUMB_H, 6);
      else doc.roundedRect(MARGIN, top, THUMB_W, THUMB_H, 6).fill(C.placeholder);
      badge(doc, MARGIN + 16, top + THUMB_H - 16, d.id);

      doc.fillColor(C.text).font(BOLD).fontSize(13).text(d.type, TEXT_X, top, { width: TEXT_W, lineBreak: false, ellipsis: true });
      doc.fillColor(C.muted).font(REGULAR).fontSize(9.5)
        .text(`${d.location} · ${t.photoOf(t.slotLabels[d.slot])}`, TEXT_X, top + 19, { width: TEXT_W, lineBreak: false, ellipsis: true });
      doc.fillColor(C.text).font(REGULAR).fontSize(10.5).text(d.description, TEXT_X, top + 36, { width: TEXT_W });
      pill(doc, MARGIN + CONTENT_W, top, d.severity);

      y += rowH;
      const last = i === damages.length - 1;
      doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_W, y).lineWidth(last ? 1 : 0.6).stroke(last ? C.text : C.hairline);
    });
    y += 22;
  }

  // ---- Coverage notice ----
  if (missing.length) {
    const text = t.coverage(missing.map((s) => t.slotLabels[s].toLowerCase()).join(', '));
    doc.font(REGULAR).fontSize(11);
    const h = doc.heightOfString(text, { width: CONTENT_W - 62 }) + 28;
    ensureSpace(h);
    doc.roundedRect(MARGIN, y, CONTENT_W, h, 7).lineWidth(0.9).dash(3, { space: 2.5 }).stroke(C.muted).undash();
    const cy = y + h / 2;
    doc.circle(MARGIN + 24, cy, 8).lineWidth(1.2).stroke(C.muted);
    doc.moveTo(MARGIN + 24, cy - 1).lineTo(MARGIN + 24, cy + 4).stroke(C.muted);
    doc.circle(MARGIN + 24, cy - 4, 0.6).fill(C.muted);
    doc.fillColor(C.text).text(text, MARGIN + 46, y + 14, { width: CONTENT_W - 62 });
    y += h;
  }

  // ---- Photos (always starts on a fresh page, as in the mockup) ----
  newPage();
  heading(t.photos);
  const GAP = 15;
  const TILE_W = (CONTENT_W - GAP) / 2;
  const TILE_H = 130;
  for (let i = 0; i < SLOTS.length; i += 2) {
    ensureSpace(TILE_H + 22);
    SLOTS.slice(i, i + 2).forEach((slot, col) => {
      const x = MARGIN + col * (TILE_W + GAP);
      const img = data.photos[slot];
      const ids = damages.filter((d) => d.slot === slot).map((d) => d.id);
      if (img) {
        photoCover(doc, img, x, y, TILE_W, TILE_H, 8);
        ids.forEach((id, k) => badge(doc, x + 8 + 7.5 + k * 19, y + TILE_H - 8 - 7.5, id));
      } else {
        doc.roundedRect(x, y, TILE_W, TILE_H, 8).lineWidth(0.9).dash(3, { space: 2.5 }).stroke(C.muted).undash();
        const cx = x + TILE_W / 2;
        const cy = y + TILE_H / 2 - 10;
        doc.moveTo(cx - 8, cy).lineTo(cx + 8, cy).moveTo(cx, cy - 8).lineTo(cx, cy + 8).lineWidth(1.4).stroke(C.muted);
        doc.fillColor(C.text).font(BOLD).fontSize(11).text(t.slotLabels[slot], x, cy + 16, { width: TILE_W, align: 'center', lineBreak: false });
      }
      doc.fillColor(C.text).font(BOLD).fontSize(10.5).text(t.slotLabels[slot], x, y + TILE_H + 6, { lineBreak: false });
      doc.fillColor(C.muted).font(REGULAR).fontSize(9.5)
        .text(img ? (ids.length ? t.damageMarked(ids) : '') : t.notCaptured, x, y + TILE_H + 7, { width: TILE_W, align: 'right', lineBreak: false });
    });
    y += TILE_H + 20;
  }

  // ---- Remarks ----
  y += 4;
  ensureSpace(28 + 64);
  heading(t.remarks);
  doc.font(REGULAR).fontSize(10.5);
  const remarksH = data.remarks ? doc.heightOfString(data.remarks, { width: CONTENT_W - 24 }) + 24 : 0;
  const boxH = Math.max(64, remarksH);
  ensureSpace(boxH);
  doc.roundedRect(MARGIN, y, CONTENT_W, boxH, 7).lineWidth(0.8).stroke(C.border);
  if (!data.remarks) {
    doc.moveTo(MARGIN, y + boxH / 3).lineTo(MARGIN + CONTENT_W, y + boxH / 3).lineWidth(0.5).stroke(C.hairline);
    doc.moveTo(MARGIN, y + (boxH * 2) / 3).lineTo(MARGIN + CONTENT_W, y + (boxH * 2) / 3).stroke(C.hairline);
  } else {
    doc.fillColor(C.text).text(data.remarks, MARGIN + 12, y + 12, { width: CONTENT_W - 24 });
  }
  y += boxH + 22;

  // ---- Signatures ----
  const SIG_H = 66;
  ensureSpace(SIG_H + 24);
  ([
    [t.handedOverBy, data.signatures.handed],
    [t.receivedBy, data.signatures.received],
  ] as const).forEach(([label, img], col) => {
    const x = MARGIN + col * (TILE_W + GAP);
    doc.roundedRect(x, y, TILE_W, SIG_H, 7).lineWidth(0.8).stroke(C.border);
    if (img) doc.image(img, x + 8, y + 6, { fit: [TILE_W - 16, SIG_H - 12], align: 'center', valign: 'center' });
    doc.fillColor(C.muted).font(REGULAR).fontSize(10).text(label, x, y + SIG_H + 9, { lineBreak: false });
  });

  // ---- Footer on every page ----
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.moveTo(MARGIN, FOOTER_Y).lineTo(MARGIN + CONTENT_W, FOOTER_Y).lineWidth(0.7).stroke(C.hairline);
    doc.fillColor(C.muted).font(REGULAR).fontSize(9).text(t.disclaimer, MARGIN, FOOTER_Y + 10, { lineBreak: false });
    doc.text(t.page(i + 1, range.count), MARGIN, FOOTER_Y + 10, { width: CONTENT_W, align: 'right', lineBreak: false });
  }

  doc.end();
  return done;
}
