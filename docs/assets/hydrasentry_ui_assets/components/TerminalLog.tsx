const lines = [
  'POST /mcp/scan_context 200 OK',
  'HydraDB query graph_context=true',
  'query_paths: 4 groups returned',
  'tainted source_chunk_id: mem_poison_047',
  'decision: block, action: quarantine'
];

export function TerminalLog() {
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-4 font-mono text-xs text-zinc-300">
      {lines.map((line, i) => (
        <div key={line} className="flex gap-2 py-1">
          <span className="text-zinc-600">{String(i + 1).padStart(2, '0')}</span>
          <span>{line}</span>
        </div>
      ))}
    </div>
  );
}
