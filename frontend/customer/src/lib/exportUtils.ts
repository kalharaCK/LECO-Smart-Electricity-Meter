/**
 * Utility functions for exporting consumption and telemetry data in Customer Dashboard
 */

export interface ExportDataPoint {
  date: string
  import: number
  export: number
}

export interface MeterExportMeta {
  meterNumber: string
  accountNumber: string
  tariffType?: string
}

/**
 * Downloads records as formatted CSV file
 */
export function exportTelemetryToCsv(
  filename: string,
  meta: MeterExportMeta,
  records: ExportDataPoint[]
): void {
  if (!records || records.length === 0) {
    return
  }

  const rows = records.map((record) => {
    const importKwh = Number(record.import) || 0
    const exportKwh = Number(record.export) || 0
    const netKwh = Math.max(0, importKwh - exportKwh)
    const estCostLkr = Math.round(netKwh * 25.0 * 100) / 100

    return {
      "Account Number": meta.accountNumber,
      "Meter Number": meta.meterNumber,
      "Date": record.date,
      "Import (kWh)": importKwh.toFixed(2),
      "Solar Export (kWh)": exportKwh.toFixed(2),
      "Net Consumption (kWh)": netKwh.toFixed(2),
      "Est. Cost (LKR)": estCostLkr.toFixed(2),
      "Tariff Type": meta.tariffType || "Domestic D-1",
    }
  })

  const headers = Object.keys(rows[0])
  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const cell = row[header as keyof typeof row] ?? ""
          const escaped = String(cell).replace(/"/g, '""')
          return `"${escaped}"`
        })
        .join(",")
    ),
  ].join("\r\n")

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.setAttribute("href", url)
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Downloads data as formatted JSON file
 */
export function exportTelemetryToJson(filename: string, data: Record<string, unknown>): void {
  const jsonContent = JSON.stringify(data, null, 2)
  const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.setAttribute("href", url)
  link.setAttribute("download", filename.endsWith(".json") ? filename : `${filename}.json`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
