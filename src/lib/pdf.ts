/**
 * A very small PDF writer - no dependencies, nothing to install.
 *
 * It does exactly what the reports need: headings, paragraphs, a strip of
 * headline figures, and tables with automatic page breaks and page numbers.
 * Text uses the two standard fonts every PDF reader already has (Helvetica and
 * Helvetica-Bold) with WinAnsi encoding, so accents (é, ñ, à) come out right.
 */

const PAGE_W = 595.28; // A4 portrait, in points
const PAGE_H = 841.89;
const MARGIN = 42;
const BOTTOM = MARGIN + 24; // leave room for the footer

/** Width of each character of Helvetica at size 1 (AFM table, ASCII range). */
const WIDTHS: Record<string, number> = {};
const WIDTH_LIST = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, // 32-47
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, // 48-63
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, // 64-79
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, // 80-95
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, // 96-111
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, // 112-126
];
WIDTH_LIST.forEach((w, index) => {
  WIDTHS[String.fromCharCode(32 + index)] = w / 1000;
});

/** Width of `text` at `size`, in points. Accented letters fall back to a sane average. */
export function textWidth(text: string, size: number, bold = false): number {
  let total = 0;
  for (const char of text) total += WIDTHS[char] ?? 0.55;
  // Helvetica-Bold is a little wider than Helvetica.
  return total * size * (bold ? 1.06 : 1);
}

/** Shorten text with an ellipsis so it fits in `maxWidth`. */
export function fitText(text: string, maxWidth: number, size: number, bold = false): string {
  if (textWidth(text, size, bold) <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && textWidth(`${out}...`, size, bold) > maxWidth) out = out.slice(0, -1);
  return `${out}...`;
}

/**
 * Typographic characters that WinAnsi has at a different code point, plus the
 * thin spaces Intl uses inside French numbers ("1 250,00").
 */
const WINANSI_EXTRA: Record<string, string> = {
  "\u2013": "\u0096", // en dash
  "\u2014": "\u0097", // em dash
  "\u2018": "\u0091",
  "\u2019": "\u0092", // curly apostrophe
  "\u201c": "\u0093",
  "\u201d": "\u0094",
  "\u2026": "\u0085", // ellipsis
  "\u20ac": "\u0080", // euro
  "\u2022": "\u0095", // bullet
  "\u2009": " ",
  "\u202f": "\u00a0", // narrow no-break space -> no-break space
  "\u2192": "-",
};

/** PDF string escaping, and anything outside WinAnsi becomes "?". */
function pdfText(text: string): string {
  let out = "";
  for (const raw of text) {
    const char = WINANSI_EXTRA[raw] ?? raw;
    const code = char.codePointAt(0) ?? 63;
    const ch = code <= 255 ? char : "?";
    if (ch === "\\" || ch === "(" || ch === ")") out += `\\${ch}`;
    else out += ch;
  }
  return out;
}

export interface Column {
  header: string;
  /** Share of the available width (the shares are normalised). */
  width: number;
  align?: "left" | "right";
}

export class PdfDocument {
  private pages: string[][] = [];
  private ops: string[] = [];
  private y = PAGE_H - MARGIN;
  private readonly contentWidth = PAGE_W - MARGIN * 2;

  private readonly footerText: (page: number, total: number) => string;

  constructor(footerText: (page: number, total: number) => string) {
    this.footerText = footerText;
    this.pages.push(this.ops);
  }

  /* ----------------------------------------------------------- primitives */

  private newPage() {
    this.ops = [];
    this.pages.push(this.ops);
    this.y = PAGE_H - MARGIN;
  }

  /** Start a new page when `height` would not fit on this one. */
  private ensure(height: number) {
    if (this.y - height < BOTTOM) this.newPage();
  }

  private draw(text: string, x: number, size: number, bold: boolean, gray = 0) {
    this.ops.push(
      `BT ${gray === 0 ? "0 g" : `${gray} g`} /${bold ? "F2" : "F1"} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${this.y.toFixed(2)} Tm (${pdfText(text)}) Tj ET`
    );
  }

  private line(x1: number, y: number, x2: number, gray = 0.85) {
    this.ops.push(`${gray} G 0.7 w ${x1.toFixed(2)} ${y.toFixed(2)} m ${x2.toFixed(2)} ${y.toFixed(2)} l S`);
  }

  /* --------------------------------------------------------------- blocks */

  title(text: string, subtitle?: string) {
    this.ensure(48);
    this.y -= 6;
    this.draw(text, MARGIN, 20, true);
    this.y -= 16;
    if (subtitle) {
      this.draw(subtitle, MARGIN, 10, false, 0.35);
      this.y -= 14;
    }
    this.line(MARGIN, this.y, PAGE_W - MARGIN, 0.75);
    this.y -= 18;
  }

  heading(text: string) {
    this.ensure(34);
    this.y -= 6;
    this.draw(text, MARGIN, 13, true);
    this.y -= 16;
  }

  paragraph(text: string, size = 9.5) {
    this.ensure(size + 8);
    this.draw(fitText(text, this.contentWidth, size), MARGIN, size, false, 0.25);
    this.y -= size + 6;
  }

  spacer(height = 10) {
    this.y -= height;
  }

  /** A row of headline figures: label on top, value underneath. */
  metrics(items: { label: string; value: string; note?: string }[]) {
    if (items.length === 0) return;
    this.ensure(58);
    const width = this.contentWidth / items.length;
    const top = this.y;

    items.forEach((item, index) => {
      const x = MARGIN + index * width;
      this.y = top;
      this.draw(fitText(item.label, width - 8, 8.5), x, 8.5, false, 0.4);
      this.y = top - 16;
      this.draw(fitText(item.value, width - 8, 14, true), x, 14, true);
      if (item.note) {
        this.y = top - 29;
        this.draw(fitText(item.note, width - 8, 8), x, 8, false, 0.45);
      }
    });

    this.y = top - 40;
    this.line(MARGIN, this.y, PAGE_W - MARGIN);
    this.y -= 16;
  }

  /** A table with a header row that repeats on every new page. */
  table(columns: Column[], rows: string[][]) {
    const total = columns.reduce((sum, column) => sum + column.width, 0) || 1;
    const widths = columns.map((column) => (column.width / total) * this.contentWidth);
    const xs: number[] = [];
    widths.reduce((x, width, index) => {
      xs[index] = x;
      return x + width;
    }, MARGIN);

    const cell = (text: string, index: number, size: number, bold: boolean, gray = 0) => {
      const width = widths[index] - 6;
      const value = fitText(text, width, size, bold);
      const x =
        columns[index].align === "right" ? xs[index] + widths[index] - 6 - textWidth(value, size, bold) : xs[index];
      this.draw(value, x, size, bold, gray);
    };

    const header = () => {
      this.ensure(30);
      columns.forEach((column, index) => cell(column.header, index, 8.5, true, 0.3));
      this.y -= 6;
      this.line(MARGIN, this.y, PAGE_W - MARGIN, 0.6);
      this.y -= 13;
    };

    header();

    for (const row of rows) {
      if (this.y - 16 < BOTTOM) {
        this.newPage();
        header();
      }
      row.forEach((value, index) => cell(value, index, 9, false));
      this.y -= 6;
      this.line(MARGIN, this.y, PAGE_W - MARGIN, 0.92);
      this.y -= 11;
    }

    this.y -= 6;
  }

  /* ---------------------------------------------------------------- build */

  /** Assembles the file. Returns the bytes of a complete PDF. */
  build(): Uint8Array {
    const total = this.pages.length;

    // Footer on every page (added now that the page count is known).
    const streams = this.pages.map((ops, index) => {
      const footer = this.footerText(index + 1, total);
      const width = textWidth(footer, 8);
      const withFooter = [
        ...ops,
        `BT 0.45 g /F1 8 Tf 1 0 0 1 ${(PAGE_W - MARGIN - width).toFixed(2)} ${(MARGIN - 8).toFixed(2)} Tm (${pdfText(footer)}) Tj ET`,
      ];
      return withFooter.join("\n");
    });

    const objects: string[] = [];
    const pageIds = streams.map((_, index) => 5 + index * 2);

    objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${total} >>`;
    objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
    objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

    streams.forEach((stream, index) => {
      const pageId = pageIds[index];
      objects[pageId] =
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W.toFixed(2)} ${PAGE_H.toFixed(2)}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageId + 1} 0 R >>`;
      objects[pageId + 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    });

    let file = "%PDF-1.4\n";
    const offsets: number[] = [];
    for (let id = 1; id < objects.length; id += 1) {
      offsets[id] = file.length;
      file += `${id} 0 obj\n${objects[id]}\nendobj\n`;
    }

    const xrefStart = file.length;
    const count = objects.length; // ids 1..count-1, plus the free entry
    file += `xref\n0 ${count}\n0000000000 65535 f \n`;
    for (let id = 1; id < count; id += 1) {
      file += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
    }
    file += `trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

    // Every character is a single byte in latin1, which is what the offsets above assume.
    const bytes = new Uint8Array(file.length);
    for (let i = 0; i < file.length; i += 1) bytes[i] = file.charCodeAt(i) & 0xff;
    return bytes;
  }
}
