import { getGuitarDiagram, getPianoDiagram } from "@/lib/chord-diagrams";

export interface ExportDiagram {
  name: string;
  type: "guitar" | "piano";
  svg: string | null;
}
const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[character]!,
  );

export function diagramSvg(
  chord: string,
  type: "guitar" | "piano",
): string | null {
  let drawing = `<text x="80" y="17" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" font-weight="bold" fill="#22577A">${escape(chord)}</text>`;
  if (type === "guitar") {
    const shape = getGuitarDiagram(chord);
    if (!shape) return null;
    for (let string = 0; string < 6; string++)
      drawing += `<path d="M${45 + string * 14} 38V108" stroke="#64748b"/>`;
    for (let fret = 0; fret <= 5; fret++)
      drawing += `<path d="M45 ${38 + fret * 14}H115" stroke="#64748b" stroke-width="${fret === 0 && shape.baseFret === 1 ? 3 : 1}"/>`;
    if (shape.baseFret > 1)
      drawing += `<text x="28" y="49" font-family="Arial" font-size="10">${shape.baseFret}</text>`;
    shape.frets.forEach((fret, string) => {
      const x = 45 + string * 14;
      if (fret < 0)
        drawing += `<path d="M${x - 3} 27l6 6m0-6l-6 6" stroke="#22577A"/>`;
      else if (!fret)
        drawing += `<circle cx="${x}" cy="30" r="3" fill="none" stroke="#22577A"/>`;
      else
        drawing += `<circle cx="${x}" cy="${45 + (fret - shape.baseFret) * 14}" r="5" fill="#22577A"/>`;
    });
  } else {
    const shape = getPianoDiagram(chord);
    if (!shape) return null;
    const whites = [0, 2, 4, 5, 7, 9, 11];
    whites.forEach((note, index) => {
      drawing += `<rect x="${17 + index * 18}" y="35" width="18" height="66" fill="${shape.notes.includes(note) ? "#C7F9CC" : "white"}" stroke="#64748b"/>`;
      if (shape.notes.includes(note))
        drawing += `<circle cx="${26 + index * 18}" cy="88" r="4" fill="#22577A"/>`;
    });
    [
      [1, 1],
      [3, 2],
      [6, 4],
      [8, 5],
      [10, 6],
    ].forEach(([note, boundary]) => {
      const x = 17 + boundary * 18 - 5.5;
      drawing += `<rect x="${x}" y="35" width="11" height="42" fill="${shape.notes.includes(note) ? "#38A3A5" : "#1f2937"}"/>`;
      if (shape.notes.includes(note))
        drawing += `<circle cx="${x + 5.5}" cy="65" r="2.5" fill="white"/>`;
    });
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="116" viewBox="0 0 160 116"><rect width="160" height="116" fill="white"/>${drawing}</svg>`;
}

export async function svgToPng(svg: string): Promise<Uint8Array> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 348;
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("Your browser could not prepare the chord diagrams.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error("Could not draw a chord diagram.")),
        "image/png",
      ),
    );
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
}
