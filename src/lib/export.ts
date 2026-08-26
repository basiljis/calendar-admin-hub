import * as XLSX from "xlsx";

/** Экспорт произвольных данных в файл Excel (.xlsx) */
export function exportToExcel(
  sheets: { name: string; rows: Record<string, string | number>[] }[],
  fileName: string,
) {
  const wb = XLSX.utils.book_new();
  sheets.forEach((s) => {
    const ws = XLSX.utils.json_to_sheet(s.rows.length ? s.rows : [{ "": "Нет данных" }]);
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  });
  XLSX.writeFile(wb, fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`);
}

/** Скачивание графика (SVG внутри контейнера) как PNG-картинки */
export async function downloadChartPng(container: HTMLElement | null, fileName: string) {
  if (!container) return;
  const svg = container.querySelector("svg");
  if (!svg) return;

  const clone = svg.cloneNode(true) as SVGSVGElement;
  const rect = svg.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  // Подставляем вычисленные цвета вместо CSS-переменных
  const source = svg.querySelectorAll<SVGElement>("*");
  clone.querySelectorAll<SVGElement>("*").forEach((el, i) => {
    const origin = source[i];
    if (!origin) return;
    const cs = window.getComputedStyle(origin);
    if (cs.fill && cs.fill !== "none") el.setAttribute("fill", cs.fill);
    if (cs.stroke && cs.stroke !== "none") el.setAttribute("stroke", cs.stroke);
    if (cs.fontSize) el.setAttribute("font-size", cs.fontSize);
    if (cs.fontFamily) el.setAttribute("font-family", cs.fontFamily);
  });

  const svgText = new XMLSerializer().serializeToString(clone);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
  const scale = 2;

  await new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const a = document.createElement("a");
        a.href = canvas.toDataURL("image/png");
        a.download = fileName.endsWith(".png") ? fileName : `${fileName}.png`;
        a.click();
      }
      resolve();
    };
    img.onerror = () => resolve();
    img.src = url;
  });
}
