import type { jsPDF } from "jspdf";
import type { SongInput } from "@/types/song";
import { createPdf } from "./fonts";
import { exportModel } from "./model";
import { PAGE_MARGIN as margin, songMetadata } from "./metadata";
import { downloadBlob, filename, wrapSegments } from "./layout";
import { svgToPng } from "./diagrams";

const INK = "#172B37";
const ACCENT = "#22577A";
const MUTED = "#64748B";
/** Songs are compacted (columns, then smaller text and diagrams) to fit this many pages. */
export const MAX_PDF_PAGES = 2;
const MIN_FONT_SIZE = 9;
const MIN_COLUMN_WIDTH = 150;
const COLUMN_GAP = 20;
/** Sidebar arrangements, largest first; two narrower columns can save a page of diagrams. */
const DIAGRAM_LAYOUTS = [
  { diagramScale: 1, diagramColumns: 1 },
  { diagramScale: 0.8, diagramColumns: 1 },
  { diagramScale: 0.8, diagramColumns: 2 },
  { diagramScale: 0.65, diagramColumns: 2 },
];

type Model = ReturnType<typeof exportModel>;
interface LayoutOptions {
  size: number;
  columns: number;
  diagramScale: number;
  diagramColumns: number;
}
type Draw =
  | {
      kind: "text";
      page: number;
      text: string | string[];
      x: number;
      y: number;
      size: number;
      bold: boolean;
      color: string;
    }
  | {
      kind: "image";
      page: number;
      svg: string;
      x: number;
      y: number;
      width: number;
      height: number;
    };
interface Layout {
  pages: number;
  draws: Draw[];
}
interface Item {
  kind: "blank" | "section" | "row";
  height: number;
  draw: (page: number, x: number, y: number) => void;
}

const setFont = (pdf: jsPDF, size: number, bold = false) => {
  pdf.setFont("Noto Sans", bold ? "bold" : "normal");
  pdf.setFontSize(size);
};

/** Measure and position everything without drawing, so several layouts can be compared cheaply. */
function layout(
  pdf: jsPDF,
  song: SongInput,
  model: Model,
  { size, columns, diagramScale, diagramColumns }: LayoutOptions,
): Layout {
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const bottom = height - margin;
  const draws: Draw[] = [];
  const text = (
    page: number,
    value: string | string[],
    x: number,
    y: number,
    fontSize: number,
    bold = false,
    color = INK,
  ) =>
    draws.push({
      kind: "text",
      page,
      text: value,
      x,
      y,
      size: fontSize,
      bold,
      color,
    });
  const measure = (value: string, bold = false) => {
    setFont(pdf, size, bold);
    return pdf.getTextWidth(value);
  };

  // The header spans the full width of page one, above the diagrams and music.
  let headerBottom = margin;
  const header = (value: string, fontSize: number, bold = false) => {
    setFont(pdf, fontSize, bold);
    for (const row of pdf.splitTextToSize(
      value,
      width - margin * 2,
    ) as string[]) {
      text(1, row, margin, headerBottom + fontSize, fontSize, bold);
      headerBottom += fontSize * 1.3;
    }
  };
  header(song.title || "Untitled song", 20, true);
  if (song.artist) header(song.artist, 10.5);
  const metadata = songMetadata(song);
  if (metadata) {
    headerBottom += 3;
    header(metadata, 9);
  }
  if (song.notes) {
    headerBottom += 3;
    header(song.notes, 9);
  }
  headerBottom += 14;
  const startPage = headerBottom + size * 3 > bottom ? 2 : 1;
  const pageTop = (page: number) => (page === 1 ? headerBottom : margin);

  let diagramPages = 0;
  const cellWidth = 100 * diagramScale;
  const sidebar = model.diagrams.length ? cellWidth * diagramColumns : 0;
  if (sidebar) {
    const headingSize = Math.max(7, 8 * diagramScale);
    const headingHeight = 19 * diagramScale;
    let page = startPage,
      y = pageTop(page);
    for (const type of ["guitar", "piano"] as const) {
      const group = model.diagrams.filter((diagram) => diagram.type === type);
      for (let index = 0; index < group.length; index += diagramColumns) {
        const row = group.slice(index, index + diagramColumns);
        const rowHeight =
          Math.max(...row.map((diagram) => (diagram.svg ? 69 : 43))) *
          diagramScale;
        const heading = index === 0;
        if (y + rowHeight + (heading ? headingHeight : 0) > bottom) {
          page++;
          y = margin;
        }
        if (heading || y === pageTop(page)) {
          text(
            page,
            `${type === "guitar" ? "GUITAR" : "PIANO"} CHORDS`,
            margin,
            y + headingSize,
            headingSize,
            true,
            ACCENT,
          );
          y += headingHeight;
        }
        row.forEach((diagram, column) => {
          const x = margin + column * cellWidth;
          if (diagram.svg)
            draws.push({
              kind: "image",
              page,
              svg: diagram.svg,
              x: x - 3 * diagramScale,
              y,
              width: 88 * diagramScale,
              height: 63.8 * diagramScale,
            });
          else {
            text(
              page,
              diagram.name,
              x,
              y + 10 * diagramScale,
              9 * diagramScale,
              true,
            );
            text(
              page,
              ["Diagram not", "available"],
              x,
              y + 22 * diagramScale,
              7 * diagramScale,
            );
          }
        });
        y += rowHeight;
      }
    }
    diagramPages = page;
  }

  const musicX = margin + sidebar;
  const columnWidth =
    (width - margin - musicX - COLUMN_GAP * (columns - 1)) / columns;
  if (columnWidth < MIN_COLUMN_WIDTH)
    throw new Error("The page is too narrow for this chord sheet.");

  // Group lines into sections so a section can move whole to the next column.
  const blocks: Item[][] = [[]];
  for (const line of model.lines) {
    if (line.type === "blank") {
      blocks
        .at(-1)!
        .push({ kind: "blank", height: size * 0.5, draw: () => {} });
      continue;
    }
    if (line.type === "section") {
      setFont(pdf, size, true);
      const labels = pdf.splitTextToSize(line.label, columnWidth) as string[];
      blocks.push([
        {
          kind: "section",
          height: labels.length * size * 1.3 + size * 0.15,
          draw: (page, x, y) =>
            labels.forEach((label, index) =>
              text(
                page,
                label,
                x,
                y + size + index * size * 1.3,
                size,
                true,
                ACCENT,
              ),
            ),
        },
      ]);
      continue;
    }
    for (const row of wrapSegments(
      line.segments,
      columnWidth,
      measure,
      song.showChords,
    )) {
      const hasChords = row.some((segment) => segment.chord);
      const hasLyrics = row.some((segment) => segment.lyric.trim());
      const lyricY = hasChords ? size * 2 : size;
      blocks.at(-1)!.push({
        kind: "row",
        height: size * (hasChords && hasLyrics ? 2.5 : 1.35),
        draw: (page, x, y) => {
          for (const segment of row) {
            if (segment.chord)
              text(
                page,
                segment.chord,
                x + segment.x,
                y + size * 0.95,
                size,
                true,
                ACCENT,
              );
            if (hasLyrics && segment.lyric)
              text(page, segment.lyric, x + segment.x, y + lyricY, size);
          }
        },
      });
    }
  }

  let page = startPage,
    column = 0,
    y = pageTop(page);
  const atTop = () => y === pageTop(page);
  const nextColumn = () => {
    if (++column === columns) {
      column = 0;
      page++;
    }
    y = pageTop(page);
  };
  const sectionGap = size * 0.35;
  for (const block of blocks) {
    let end = block.length;
    while (end && block[end - 1].kind === "blank") end--;
    const blockHeight =
      sectionGap +
      block.slice(0, end).reduce((sum, item) => sum + item.height, 0);
    const freshTop = column + 1 < columns ? pageTop(page) : margin;
    if (
      !atTop() &&
      y + blockHeight > bottom &&
      freshTop + blockHeight <= bottom
    )
      nextColumn();
    block.forEach((item, index) => {
      if (item.kind === "blank") {
        // Spacing never carries over to the top of a column.
        if (!atTop()) y = Math.min(y + item.height, bottom);
        return;
      }
      let needed = item.height;
      if (item.kind === "section") {
        const gap = atTop() ? 0 : sectionGap;
        needed +=
          gap +
          (block[index + 1]?.kind === "row" ? block[index + 1].height : 0);
        if (y + needed > bottom && !atTop()) nextColumn();
        else y += gap;
      } else if (y + needed > bottom && !atTop()) nextColumn();
      item.draw(page, musicX + column * (columnWidth + COLUMN_GAP), y);
      y += item.height;
    });
  }
  return { pages: Math.max(page, diagramPages), draws };
}

/** Music arrangements from most to least preferred: the chosen font size first, then denser. */
function arrangements(song: SongInput): [columns: number, size: number][] {
  const sizes = (from: number, to: number) =>
    Array.from(
      { length: Math.max(1, from - to + 1) },
      (_, index) => from - index,
    );
  const base = song.fontSize;
  if (song.orientation === "landscape")
    return [2, 3].flatMap((columns) =>
      sizes(base, MIN_FONT_SIZE).map((size): [number, number] => [
        columns,
        size,
      ]),
    );
  return [
    ...sizes(base, Math.max(MIN_FONT_SIZE, base - 3)).map(
      (size): [number, number] => [1, size],
    ),
    ...sizes(base, MIN_FONT_SIZE).map((size): [number, number] => [2, size]),
  ];
}

function chooseLayout(pdf: jsPDF, song: SongInput, model: Model): Layout {
  const diagramLayouts = model.diagrams.length
    ? DIAGRAM_LAYOUTS
    : DIAGRAM_LAYOUTS.slice(0, 1);
  let best: Layout | undefined;
  let failure: unknown;
  for (const [columns, size] of arrangements(song)) {
    // For each arrangement, use the largest diagrams that still give the fewest pages.
    let fewest: Layout | undefined;
    for (const diagrams of diagramLayouts) {
      try {
        const result = layout(pdf, song, model, { columns, size, ...diagrams });
        if (!fewest || result.pages < fewest.pages) fewest = result;
      } catch (error) {
        failure = error;
      }
    }
    if (!fewest) continue;
    if (fewest.pages <= MAX_PDF_PAGES) return fewest;
    if (!best || fewest.pages < best.pages) best = fewest;
  }
  // Extremely long songs can't reach the page limit at a readable size; use the densest layout.
  if (best) return best;
  throw failure;
}

/** Export vector text, with raster images used only for the instrument diagrams. */
export async function buildPdf(song: SongInput) {
  const pdf = await createPdf(song.orientation);
  const model = exportModel(song);
  const result = chooseLayout(pdf, song, model);
  pdf.setProperties({
    title: song.title || "Untitled song",
    subject: "Worship chord sheet",
    creator: "Worshiply",
  });
  for (let page = 2; page <= result.pages; page++) pdf.addPage();
  for (const draw of result.draws) {
    pdf.setPage(draw.page);
    if (draw.kind === "image") {
      pdf.addImage(
        await svgToPng(draw.svg),
        "PNG",
        draw.x,
        draw.y,
        draw.width,
        draw.height,
      );
      continue;
    }
    setFont(pdf, draw.size, draw.bold);
    pdf.setTextColor(draw.color);
    pdf.text(draw.text, draw.x, draw.y);
  }
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  for (let page = 1; page <= result.pages; page++) {
    pdf.setPage(page);
    setFont(pdf, 8);
    pdf.setTextColor(MUTED);
    pdf.text(`${page} / ${result.pages}`, width - margin, height - 22, {
      align: "right",
    });
  }
  return pdf;
}

export async function exportPdf(song: SongInput): Promise<void> {
  const pdf = await buildPdf(song);
  downloadBlob(pdf.output("blob"), filename(song.title, "pdf"));
}
