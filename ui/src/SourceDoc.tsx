import { useState } from "react";
import { useT } from "./i18n";
import type { SourceDocument } from "./tasks";

// The task's source document, shown to the audience so the doc-anchoring is
// verifiable on screen: the same text the (scripted) agents cite. Rendered
// by WorkspacePanel above the task card; key by doc.id at the call site so
// the expansion state resets when the dataset changes.

export function SourceDoc({ doc }: { doc: SourceDocument }) {
  const { t } = useT();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="source-doc">
      <button className="source-doc-head" onClick={() => setExpanded((v) => !v)} title={expanded ? t.collapse : t.readFull}>
        <span aria-hidden="true">📄</span>
        <span className="source-doc-title">{doc.title}</span>
        <span className="source-doc-kind">
          {t.docKind[doc.kind]} · {doc.pages} {t.pagesSuffix}
        </span>
        <span className="source-doc-chevron">{expanded ? "▾" : "▸"}</span>
      </button>
      {expanded ? (
        <pre className="source-doc-text">{doc.text}</pre>
      ) : (
        <div className="source-doc-excerpt">{doc.text.slice(0, 170).trimEnd()}…</div>
      )}
    </div>
  );
}
