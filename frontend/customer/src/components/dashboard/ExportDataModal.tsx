import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Download, 
  FileSpreadsheet, 
  FileCode, 
  CheckCircle2, 
  X 
} from "lucide-react"
import { 
  exportTelemetryToCsv, 
  exportTelemetryToJson, 
  type ExportDataPoint, 
  type MeterExportMeta 
} from "@/lib/exportUtils"

interface ExportDataModalProps {
  isOpen: boolean
  onClose: () => void
  records: ExportDataPoint[]
  meta: MeterExportMeta
}

export default function ExportDataModal({
  isOpen,
  onClose,
  records,
  meta,
}: ExportDataModalProps) {
  const [format, setFormat] = useState<"csv" | "json">("csv")
  const [downloaded, setDownloaded] = useState(false)

  if (!isOpen) return null

  const handleExport = () => {
    const timestamp = new Date().toISOString().slice(0, 10)
    const baseFilename = `LECO_Consumption_${meta.meterNumber || "Meter"}_${timestamp}`

    if (format === "csv") {
      exportTelemetryToCsv(baseFilename, meta, records)
    } else {
      exportTelemetryToJson(baseFilename, {
        exportedAt: new Date().toISOString(),
        meter: meta,
        totalRecords: records.length,
        consumptionHistory: records,
      })
    }

    setDownloaded(true)
    setTimeout(() => {
      setDownloaded(false)
      onClose()
    }, 1500)
  }

  const totalImport = records.reduce((sum, r) => sum + (Number(r.import) || 0), 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#121214] border border-white/20 rounded-3xl w-full max-w-md p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-yellow-400/10 text-yellow-400 border border-yellow-400/20">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">Export Consumption Data</h3>
              <p className="text-xs text-white/50">Download smart electricity meter interval records</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Data Scope Summary */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 mb-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/50">Target Meter:</span>
            <span className="font-mono font-bold text-white">{meta.meterNumber}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/50">Total Logged Energy:</span>
            <span className="font-mono font-bold text-yellow-400">{totalImport.toFixed(1)} kWh</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/50">Available Records:</span>
            <Badge className="bg-white/10 text-white border-white/15 text-[10px]">
              {records.length} Daily Readings
            </Badge>
          </div>
        </div>

        {/* Format Selector */}
        <div className="space-y-2 mb-5">
          <span className="text-xs font-semibold text-white/70 block">Select Export Format</span>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFormat("csv")}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                format === "csv"
                  ? "bg-yellow-400/15 border-yellow-400 text-white shadow-sm"
                  : "bg-white/[0.02] border-white/10 text-white/60 hover:text-white hover:border-white/20"
              }`}
            >
              <FileSpreadsheet className={`h-5 w-5 mb-2 ${format === "csv" ? "text-yellow-400" : "text-white/40"}`} />
              <div className="font-bold text-xs">CSV / Excel</div>
              <div className="text-[10px] text-white/40 mt-0.5">Spreadsheet readable</div>
            </button>

            <button
              type="button"
              onClick={() => setFormat("json")}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                format === "json"
                  ? "bg-yellow-400/15 border-yellow-400 text-white shadow-sm"
                  : "bg-white/[0.02] border-white/10 text-white/60 hover:text-white hover:border-white/20"
              }`}
            >
              <FileCode className={`h-5 w-5 mb-2 ${format === "json" ? "text-yellow-400" : "text-white/40"}`} />
              <div className="font-bold text-xs">JSON Data</div>
              <div className="text-[10px] text-white/40 mt-0.5">Machine readable raw</div>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="bg-white/5 hover:bg-white/10 text-white border-white/10 text-xs h-9 px-4 rounded-xl cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleExport}
            disabled={downloaded}
            className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-xs h-9 px-5 rounded-xl flex items-center gap-2 cursor-pointer shadow-md"
          >
            {downloaded ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-black" />
                <span>Downloaded!</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span>Download {format.toUpperCase()}</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
