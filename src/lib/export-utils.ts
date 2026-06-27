import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { today } from "./format";

export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  // UTF-8 BOM so Excel opens Arabic correctly
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename);
}

export function downloadExcel(
  filename: string,
  title: string,
  headers: string[],
  rows: (string | number)[][],
) {
  const wb = XLSX.utils.book_new();
  const aoa = [
    [`مصرف الجمهورية — ${title}`],
    [`تاريخ الإصدار: ${today()}`],
    [],
    headers,
    ...rows,
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = headers.map(() => ({ wch: 20 }));
  XLSX.utils.book_append_sheet(wb, ws, "تقرير");
  XLSX.writeFile(wb, filename);
}

export function downloadPDF(
  filename: string,
  title: string,
  headers: string[],
  rows: (string | number)[][],
  opts?: { orientation?: "p" | "l"; watermark?: string },
) {
  const doc = new jsPDF({ orientation: opts?.orientation ?? "l", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFontSize(14);
  doc.text("Republic Bank of Libya — Credit Risk System", pageW / 2, 14, { align: "center" });
  doc.setFontSize(11);
  doc.text(title, pageW / 2, 21, { align: "center" });
  doc.setFontSize(9);
  doc.text(`Generated: ${today()}`, pageW - 14, 28, { align: "right" });
  doc.text(`Prepared by: Ahmed Al-Atibi`, 14, 28, { align: "left" });

  autoTable(doc, {
    head: [headers],
    body: rows.map((r) => r.map((c) => String(c ?? ""))),
    startY: 32,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 41, 59] },
    didDrawPage: () => {
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.text(
        `Confidential — Page ${doc.getNumberOfPages()}`,
        pageW / 2,
        pageH - 6,
        { align: "center" },
      );
      if (opts?.watermark) {
        doc.setTextColor(220);
        doc.setFontSize(48);
        doc.text(opts.watermark, pageW / 2, doc.internal.pageSize.getHeight() / 2, {
          align: "center",
          angle: 35,
        });
        doc.setTextColor(0);
        doc.setFontSize(9);
      }
    },
  });

  doc.save(filename);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}