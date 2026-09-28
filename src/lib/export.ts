import * as XLSX from "xlsx";

/** Writes a real .xlsx workbook (not a renamed CSV). */
export function exportToExcel(
  rows: Record<string, string | number>[],
  sheetName: string,
  fileName: string,
) {
  const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Notice: "No records" }]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));

  const headers = Object.keys(rows[0] ?? { Notice: "" });
  worksheet["!cols"] = headers.map((h) => ({
    wch: Math.min(
      40,
      Math.max(h.length + 2, ...rows.map((r) => String(r[h] ?? "").length + 2), 10),
    ),
  }));

  XLSX.writeFile(workbook, `${fileName}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function downloadJson(data: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
