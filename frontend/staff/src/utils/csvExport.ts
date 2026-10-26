/**
 * CSV Export Utility for Staff Portal
 * Formats objects as downloadable CSV files with escaped cells and automated browser download trigger.
 */

export function exportToCsv(filename: string, rows: Record<string, any>[]): void {
  if (!rows || rows.length === 0) {
    console.warn('[CSV Export] No data rows provided for export.');
    return;
  }

  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map(row =>
      headers
        .map(header => {
          let cell = row[header] ?? '';
          if (typeof cell === 'object') {
            cell = JSON.stringify(cell);
          }
          const escaped = String(cell).replace(/"/g, '""');
          return `"${escaped}"`;
        })
        .join(',')
    )
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
