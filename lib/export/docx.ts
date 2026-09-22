import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
  Packer,
  PageNumber,
  PageOrientation,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { SongInput } from "@/types/song";
import { exportModel } from "./model";
import { createPdf } from "./fonts";
import { downloadBlob, filename, wrapSegments } from "./layout";
import { PAGE_MARGIN, pageSize, songMetadata } from "./metadata";
import { svgToPng } from "./diagrams";

const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const borders = {
  top: noBorder,
  bottom: noBorder,
  left: noBorder,
  right: noBorder,
  insideHorizontal: noBorder,
  insideVertical: noBorder,
};
const twips = (points: number) => Math.round(points * 20);
const empty = () =>
  new Paragraph({ spacing: { before: 0, after: 0, line: 20 }, children: [] });

/** Chords and lyrics remain editable Word text in paired, precisely sized cells. */
export async function buildDocx(song: SongInput): Promise<Blob> {
  const model = exportModel(song);
  const page = pageSize(song);
  const contentWidth = page.width - PAGE_MARGIN * 2;
  const sidebar = model.diagrams.length ? 100 : 0;
  const musicWidth = contentWidth - sidebar;
  const size = model.fontSize;
  const metricPdf = await createPdf(song.orientation);
  metricPdf.setFontSize(size);
  const measure = (text: string, bold = false) => {
    metricPdf.setFont("Noto Sans", bold ? "bold" : "normal");
    return metricPdf.getTextWidth(text);
  };
  const text = (
    value: string,
    options: { bold?: boolean; color?: string; size?: number } = {},
  ) =>
    new TextRun({
      text: value,
      font: "Noto Sans",
      size: (options.size ?? size) * 2,
      ...options,
      ...(options.size === undefined ? {} : { size: options.size * 2 }),
    });
  const body: (Paragraph | Table)[] = [];
  for (const line of model.lines) {
    if (line.type === "blank") {
      body.push(
        new Paragraph({
          spacing: { before: 0, after: twips(size * 0.6) },
          children: [],
        }),
      );
      continue;
    }
    if (line.type === "section") {
      body.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          keepNext: true,
          spacing: { before: twips(size), after: twips(size * 0.5) },
          children: [text(line.label, { bold: true, color: "22577A" })],
        }),
      );
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
      const widths = row.map((segment) => twips(segment.width));
      const used = widths.reduce((sum, value) => sum + value, 0);
      const remainder = Math.max(0, twips(musicWidth) - used);
      const cells = row.map(
        (segment, index) =>
          new TableCell({
            width: { size: widths[index], type: WidthType.DXA },
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            borders,
            children: [
              ...(hasChords
                ? [
                    new Paragraph({
                      keepNext: true,
                      spacing: { before: 0, after: 0, line: twips(size * 1.2) },
                      children: [
                        text(segment.chord || " ", {
                          bold: true,
                          color: "22577A",
                        }),
                      ],
                    }),
                  ]
                : []),
              new Paragraph({
                spacing: {
                  before: 0,
                  after: twips(size * 0.45),
                  line: twips(size * 1.2),
                },
                children: [text(segment.lyric || " ")],
              }),
            ],
          }),
      );
      if (remainder > 0) {
        widths.push(remainder);
        cells.push(
          new TableCell({
            width: { size: remainder, type: WidthType.DXA },
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            borders,
            children: [empty()],
          }),
        );
      }
      body.push(
        new Table({
          width: { size: twips(musicWidth), type: WidthType.DXA },
          layout: TableLayoutType.FIXED,
          columnWidths: widths,
          borders,
          rows: [new TableRow({ cantSplit: true, children: cells })],
        }),
      );
      body.push(empty());
    }
  }
  const header: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      spacing: { after: 90 },
      children: [text(song.title || "Untitled song", { size: 23, bold: true })],
    }),
  ];
  if (song.artist)
    header.push(
      new Paragraph({
        spacing: { after: 100 },
        children: [text(song.artist, { size: 11 })],
      }),
    );
  if (songMetadata(song))
    header.push(
      new Paragraph({
        spacing: { after: 130 },
        children: [text(songMetadata(song), { size: 9 })],
      }),
    );
  if (song.notes)
    header.push(
      new Paragraph({
        spacing: { after: 180 },
        children: [text(song.notes, { size: 9 })],
      }),
    );
  let content: (Paragraph | Table)[] = body;
  if (model.diagrams.length) {
    const diagrams: Paragraph[] = [];
    let previousType = "";
    for (const diagram of model.diagrams) {
      if (previousType !== diagram.type)
        diagrams.push(
          new Paragraph({
            keepNext: true,
            spacing: { before: 80, after: 100 },
            children: [
              text(`${diagram.type === "guitar" ? "GUITAR" : "PIANO"} CHORDS`, {
                size: 8,
                bold: true,
                color: "22577A",
              }),
            ],
          }),
        );
      if (diagram.svg)
        diagrams.push(
          new Paragraph({
            spacing: { before: 0, after: 40 },
            children: [
              new ImageRun({
                type: "png",
                data: await svgToPng(diagram.svg),
                transformation: { width: 112, height: 81.2 },
                altText: {
                  name: `${diagram.type}-${diagram.name}`,
                  title: `${diagram.name} ${diagram.type} chord`,
                  description: `${diagram.name} ${diagram.type} fingering`,
                },
              }),
            ],
          }),
        );
      else
        diagrams.push(
          new Paragraph({
            spacing: { after: 140 },
            children: [
              text(`${diagram.name}\nDiagram not available`, { size: 8 }),
            ],
          }),
        );
      previousType = diagram.type;
    }
    content = [
      new Table({
        width: { size: twips(contentWidth), type: WidthType.DXA },
        columnWidths: [twips(sidebar), twips(musicWidth)],
        layout: TableLayoutType.FIXED,
        borders,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: twips(sidebar), type: WidthType.DXA },
                margins: { top: 0, left: 0, right: 100, bottom: 0 },
                borders,
                children: diagrams,
              }),
              new TableCell({
                width: { size: twips(musicWidth), type: WidthType.DXA },
                margins: { top: 0, left: 0, right: 0, bottom: 0 },
                borders,
                children: [...body, empty()],
              }),
            ],
          }),
        ],
      }),
    ];
  }
  const document = new Document({
    title: song.title || "Untitled song",
    creator: "Worshiply",
    description: "Editable song lyrics and chord sheet",
    styles: {
      default: {
        document: {
          run: { font: "Noto Sans", size: size * 2, color: "172B37" },
          paragraph: { spacing: { after: 0 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: twips(page.width),
              height: twips(page.height),
              orientation:
                song.orientation === "landscape"
                  ? PageOrientation.LANDSCAPE
                  : PageOrientation.PORTRAIT,
            },
            margin: {
              top: twips(PAGE_MARGIN),
              bottom: twips(PAGE_MARGIN),
              left: twips(PAGE_MARGIN),
              right: twips(PAGE_MARGIN),
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    children: [
                      PageNumber.CURRENT,
                      " / ",
                      PageNumber.TOTAL_PAGES,
                    ],
                    size: 16,
                    color: "64748B",
                  }),
                ],
              }),
            ],
          }),
        },
        children: [...header, ...content],
      },
    ],
  });
  return Packer.toBlob(document);
}

export async function exportDocx(song: SongInput): Promise<void> {
  downloadBlob(await buildDocx(song), filename(song.title, "docx"));
}
