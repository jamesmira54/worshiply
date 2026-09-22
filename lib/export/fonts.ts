import { jsPDF } from "jspdf";

const fontRequests = new Map<string, Promise<string>>();
function loadFont(name: string): Promise<string> {
  const cached = fontRequests.get(name);
  if (cached) return cached;
  const request = fetch(`/fonts/${name}.ttf`)
    .then(async (response) => {
      if (!response.ok)
        throw new Error(
          "The export font could not be loaded. Please refresh and try again.",
        );
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 8192)
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
      return btoa(binary);
    })
    .catch((error: unknown) => {
      fontRequests.delete(name);
      throw error;
    });
  fontRequests.set(name, request);
  return request;
}

export async function createPdf(
  orientation: "portrait" | "landscape",
): Promise<jsPDF> {
  const pdf = new jsPDF({
    orientation,
    unit: "pt",
    format: "a4",
    compress: true,
  });
  const [font, bold] = await Promise.all([
    loadFont("NotoSans-Regular"),
    loadFont("NotoSans-Bold"),
  ]);
  pdf.addFileToVFS("NotoSans-Regular.ttf", font);
  pdf.addFont("NotoSans-Regular.ttf", "Noto Sans", "normal");
  pdf.addFileToVFS("NotoSans-Bold.ttf", bold);
  pdf.addFont("NotoSans-Bold.ttf", "Noto Sans", "bold");
  pdf.setFont("Noto Sans", "normal");
  return pdf;
}
