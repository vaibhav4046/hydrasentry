"use client";

/**
 * Import / export the tenant ruleset. Export downloads the real ruleset JSON
 * from GET /rules/export. Import reads a picked JSON file, POSTs it to
 * /rules/import, and reports the real {imported, skipped} counts. Both paths
 * fail honestly: a parse error or a backend error surfaces to the user, never a
 * fake success.
 */
import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { exportRules, importRules } from "@/lib/consoleApi";
import { C } from "@/lib/cockpit/derive";

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

interface RuleImportExportProps {
  token: string | null;
  onImported: () => void;
  onError: (message: string) => void;
}

function downloadJson(data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `hydrasentry-ruleset-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function RuleImportExport({ token, onImported, onError }: RuleImportExportProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function handleExport() {
    if (!token || exporting) return;
    setExporting(true);
    setNote(null);
    const result = await exportRules(token);
    setExporting(false);
    if (result.ok) {
      downloadJson(result.data);
      setNote("Ruleset downloaded.");
    } else {
      onError(result.error);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input so picking the same file twice re-fires onChange.
    if (fileRef.current) fileRef.current.value = "";
    if (!file || !token) return;
    setImporting(true);
    setNote(null);
    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        setImporting(false);
        onError("That file is not valid JSON.");
        return;
      }
      const result = await importRules(parsed, token);
      setImporting(false);
      if (result.ok) {
        setNote(
          `Imported ${result.data.imported}, skipped ${result.data.skipped}.`,
        );
        onImported();
      } else {
        onError(result.error);
      }
    } catch {
      setImporting(false);
      onError("Could not read that file.");
    }
  }

  return (
    <div className="cockpit-card" style={{ padding: 18 }}>
      <h3 className="cockpit-display" style={{ fontSize: 14.5, fontWeight: 600, color: C.ink, marginBottom: 6 }}>
        Import / export
      </h3>
      <p style={{ fontSize: 12, lineHeight: 1.6, color: C.muted, marginBottom: 14 }}>
        Move your tenant ruleset between environments. Export downloads the
        current rules as JSON; import merges a ruleset file.
      </p>

      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={!token || exporting}
          aria-busy={exporting}
          className="hydra-button-secondary"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            flex: 1,
            padding: "9px 12px",
            borderRadius: 9,
            fontSize: 12,
            fontWeight: 500,
            cursor: !token || exporting ? "wait" : "pointer",
          }}
        >
          <Download size={14} />
          {exporting ? "Exporting…" : "Export"}
        </button>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={!token || importing}
          aria-busy={importing}
          className="hydra-button-secondary"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            flex: 1,
            padding: "9px 12px",
            borderRadius: 9,
            fontSize: 12,
            fontWeight: 500,
            cursor: !token || importing ? "wait" : "pointer",
          }}
        >
          <Upload size={14} />
          {importing ? "Importing…" : "Import"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={(e) => void handleFile(e)}
          style={{ display: "none" }}
          aria-hidden
          tabIndex={-1}
        />
      </div>

      {note && (
        <div
          role="status"
          style={{ fontFamily: MONO, fontSize: 10.5, color: C.silver, marginTop: 12 }}
        >
          {note}
        </div>
      )}
    </div>
  );
}
