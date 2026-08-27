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
  const name = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;
  const data = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  const blob = new Blob([data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, name);
}

/** Надёжное скачивание файла (работает и внутри iframe-превью) */
function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 2000);
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
        canvas.toBlob((blob) => {
          if (blob) downloadBlob(blob, fileName.endsWith(".png") ? fileName : `${fileName}.png`);
          resolve();
        }, "image/png");
        return;
      }
      resolve();
    };
    img.onerror = () => resolve();
    img.src = url;
  });
}
