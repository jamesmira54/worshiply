import type { SongInput } from "@/types/song";
import { createPdf } from "./fonts";
import { exportModel } from "./model";
import { PAGE_MARGIN as margin, songMetadata } from "./metadata";
import { downloadBlob, filename, wrapSegments } from "./layout";
import { svgToPng } from "./diagrams";

/** Export vector text, with raster images used only for the instrument diagrams. */
export async function buildPdf(song: SongInput) {
  const pdf = await createPdf(song.orientation);
  const model = exportModel(song);
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const bottom = height - margin;
  const sidebar = model.diagrams.length ? 100 : 0;
  const musicX = margin + sidebar;
  const musicWidth = width - margin - musicX;
  const size = model.fontSize;
  pdf.setProperties({
    title: song.title || "Untitled song",
    subject: "Worship chord sheet",
    creator: "Worshiply",
  });
  const select = (fontSize: number, bold = false, color = "#172B37") => {
    pdf.setFont("Noto Sans", bold ? "bold" : "normal");
    pdf.setFontSize(fontSize);
    pdf.setTextColor(color);
  };
  let y = margin;
  const write = (text: string, fontSize: number, bold = false) => {
    select(fontSize, bold);
    const rows = pdf.splitTextToSize(text, width - margin * 2) as string[];
    for (const row of rows) {
      if (y + fontSize * 1.4 > bottom) {
        pdf.addPage();
        y = margin;
      }
      pdf.text(row, margin, y + fontSize);
      y += fontSize * 1.4;
    }
  };
  write(song.title || "Untitled song", 23, true);
  if (song.artist) write(song.artist, 11);
  const metadata = songMetadata(song);
  if (metadata) {
    y += 6;
    write(metadata, 9);
  }
  if (song.notes) {
    y += 6;
    write(song.notes, 9);
  }
  y += 20;
  if (y + size * 3 > bottom) {
    pdf.addPage();
    y = margin;
  }
  const contentStartPage = pdf.getNumberOfPages();
  const contentStartY = y;
  let musicPage = contentStartPage;
  function ensurePage(page: number) {
    while (pdf.getNumberOfPages() < page) pdf.addPage();
    pdf.setPage(page);
  }
  const need = (space: number) => {
    if (y + space > bottom) {
      musicPage++;
      ensurePage(musicPage);
      y = margin;
    }
  };
  const measure = (text: string, bold = false) => {
    select(size, bold);
    return pdf.getTextWidth(text);
  };
  for (const line of model.lines) {
    if (line.type === "blank") {
      need(size);
      y += size;
      continue;
    }
    if (line.type === "section") {
      select(size, true);
      const labels = pdf.splitTextToSize(line.label, musicWidth) as string[];
      need((labels.length + 3) * size * 1.3);
      y += size * 0.4;
      for (const label of labels) {
        select(size, true, "#22577A");
        pdf.text(label, musicX, y + size);
        y += size * 1.3;
      }
      y += size * 0.5;
      continue;
    }
    const rows = wrapSegments(
      line.segments,
      musicWidth,
      measure,
      song.showChords,
    );
    for (const row of rows) {
      const hasChords = row.some((segment) => segment.chord);
      const rowHeight = size * (hasChords ? 2.75 : 1.5);
      need(rowHeight);
      for (const segment of row) {
        if (segment.chord) {
          select(size, true, "#22577A");
          pdf.text(segment.chord, musicX + segment.x, y + size);
        }
        select(size);
        pdf.text(
          segment.lyric,
          musicX + segment.x,
          y + size * (hasChords ? 2.2 : 1),
        );
      }
      y += rowHeight;
    }
  }
  let diagramPage = contentStartPage,
    diagramY = contentStartY;
  let previousType = "";
  for (const diagram of model.diagrams) {
    const heading = diagram.type !== previousType;
    const diagramHeight = diagram.svg ? 69 : 43;
    if (diagramY + diagramHeight + (heading ? 20 : 0) > bottom) {
      diagramPage++;
      diagramY = margin;
    }
    ensurePage(diagramPage);
    if (heading || diagramY === margin) {
      select(8, true, "#22577A");
      pdf.text(
        `${diagram.type === "guitar" ? "GUITAR" : "PIANO"} CHORDS`,
        margin,
        diagramY + 8,
      );
      diagramY += 19;
    }
    if (diagram.svg)
      pdf.addImage(
        await svgToPng(diagram.svg),
        "PNG",
        margin - 3,
        diagramY,
        88,
        63.8,
      );
    else {
      select(9, true);
      pdf.text(diagram.name, margin, diagramY + 10);
      select(7);
      pdf.text(["Diagram not", "available"], margin, diagramY + 22);
    }
    diagramY += diagramHeight;
    previousType = diagram.type;
  }
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page);
    select(8, false, "#64748B");
    pdf.text(`${page} / ${pages}`, width - margin, height - 22, {
      align: "right",
    });
  }
  return pdf;
}

export async function exportPdf(song: SongInput): Promise<void> {
  const pdf = await buildPdf(song);
  downloadBlob(pdf.output("blob"), filename(song.title, "pdf"));
}
