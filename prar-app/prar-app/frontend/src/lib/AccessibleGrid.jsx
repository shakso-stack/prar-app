import { useEffect, useRef, useState, useCallback } from "react";
import { COLORS, FONTS } from "./styles";

// AccessibleGrid — ARIA grid widget that behaves like Google Sheets for
// keyboard/screen-reader users. Roving tabindex, arrow keys cell-by-cell,
// Enter activates a cell's editor, Escape cancels.
//
// Ported from PRAR Bouquets. Extensions added for PRAR App:
//   - Columns may declare `onActivate(row, ctx)`. When present, pressing
//     Enter on the cell calls this callback instead of opening an editor.
//     Use for action cells like "Delete row".
//
// Props:
//   columns       : Array<{ key, label, width?, render?(row, ctx), editor?,
//                            onActivate?(row, ctx) }>
//                    - editor: undefined, "text", "select", "select-or-new",
//                      "preview", or function (row, ctx) returning one of those.
//                    - onActivate: function — invoked on Enter / click.
//                      Mutually exclusive with editor.
//   rows          : Array<row>
//   rowKey        : (row) => string
//   onEdit        : (row, columnKey, newValue) => Promise<void> | void
//   renderExpanded: (row) => ReactNode — when provided, every row gets a leading
//                   "expand" cell. Pressing Enter on it toggles the panel.
//   ctx           : object passed to render() and to editor() functions
//   ariaLabel     : table label for screen readers
//   announce      : (msg) => void — pushes to a live region
//   highlightRow  : id of a row to briefly highlight (e.g. after re-sort)

export default function AccessibleGrid({
  columns, rows, rowKey, onEdit, renderExpanded, ctx = {}, ariaLabel,
  announce = () => {}, highlightRow = null,
}) {
  // If renderExpanded is provided, prepend an "expand" column to the layout.
  const hasExpand = !!renderExpanded;
  const expandColumn = { key: "_expand", label: "", width: "36px", isExpander: true };
  const effectiveColumns = hasExpand ? [expandColumn, ...columns] : columns;

  const [focus, setFocus] = useState({ row: 0, col: 0 });
  const [editingCell, setEditingCell] = useState(null); // { row, col, editor }
  const [previewCell, setPreviewCell] = useState(null); // { row, col }
  const [expandedRows, setExpandedRows] = useState(() => new Set());

  const cellRefs = useRef({});
  const wrapperRef = useRef(null);

  const numRows = rows.length;
  const numCols = effectiveColumns.length;

  // Clamp focus when data shrinks
  useEffect(() => {
    setFocus(f => ({
      row: Math.min(f.row, Math.max(0, numRows - 1)),
      col: Math.min(f.col, Math.max(0, numCols - 1)),
    }));
  }, [numRows, numCols]);

  const setCellRef = useCallback((r, c, el) => {
    if (el) cellRefs.current[`${r}:${c}`] = el;
    else delete cellRefs.current[`${r}:${c}`];
  }, []);

  function focusCell(r, c) {
    queueMicrotask(() => {
      const el = cellRefs.current[`${r}:${c}`];
      if (el) el.focus();
    });
  }

  function moveFocus(dr, dc) {
    setFocus(f => {
      const nr = Math.max(0, Math.min(numRows - 1, f.row + dr));
      const nc = Math.max(0, Math.min(numCols - 1, f.col + dc));
      focusCell(nr, nc);
      return { row: nr, col: nc };
    });
  }

  function jumpTo(row, col) {
    setFocus({ row, col });
    focusCell(row, col);
  }

  function toggleRowExpanded(rowIndex) {
    setExpandedRows(prev => {
      const next = new Set(prev);
      const id = rowKey(rows[rowIndex]);
      if (next.has(id)) {
        next.delete(id);
        announce("Row collapsed.");
      } else {
        next.add(id);
        announce("Row expanded.");
      }
      return next;
    });
  }

  function onKeyDown(e) {
    if (editingCell || previewCell) return;
    switch (e.key) {
      case "ArrowDown":  e.preventDefault(); moveFocus(1, 0); break;
      case "ArrowUp":    e.preventDefault(); moveFocus(-1, 0); break;
      case "ArrowRight": e.preventDefault(); moveFocus(0, 1); break;
      case "ArrowLeft":  e.preventDefault(); moveFocus(0, -1); break;
      case "Home":
        e.preventDefault();
        if (e.ctrlKey) jumpTo(0, 0); else jumpTo(focus.row, 0);
        break;
      case "End":
        e.preventDefault();
        if (e.ctrlKey) jumpTo(numRows - 1, numCols - 1);
        else jumpTo(focus.row, numCols - 1);
        break;
      case "PageDown": e.preventDefault(); moveFocus(10, 0); break;
      case "PageUp":   e.preventDefault(); moveFocus(-10, 0); break;
      case "Enter":
      case "F2": {
        const col = effectiveColumns[focus.col];
        const row = rows[focus.row];
        if (!row || !col) return;
        if (col.isExpander) {
          e.preventDefault();
          toggleRowExpanded(focus.row);
          break;
        }
        // Action columns: invoke onActivate directly, no editor.
        if (typeof col.onActivate === "function") {
          e.preventDefault();
          col.onActivate(row, ctx);
          break;
        }
        const editor = typeof col.editor === "function" ? col.editor(row, ctx) : col.editor;
        if (editor === "preview") {
          e.preventDefault();
          setPreviewCell({ row: focus.row, col: focus.col });
          break;
        }
        if (editor) {
          e.preventDefault();
          setEditingCell({ row: focus.row, col: focus.col, editor });
        }
        break;
      }
      default: break;
    }
  }

  function commitEdit(newValue) {
    if (!editingCell) return;
    const row = rows[editingCell.row];
    const col = effectiveColumns[editingCell.col];
    const here = editingCell;
    setEditingCell(null);
    queueMicrotask(() => focusCell(here.row, here.col));
    if (row && col && onEdit) {
      Promise.resolve(onEdit(row, col.key, newValue))
        .then(() => announce(`${col.label} updated.`))
        .catch(err => announce(`Update failed: ${err.message || "error"}.`));
    }
  }

  function cancelEdit() {
    if (!editingCell) return;
    const here = editingCell;
    setEditingCell(null);
    queueMicrotask(() => focusCell(here.row, here.col));
  }

  function closePreview() {
    if (!previewCell) return;
    const here = previewCell;
    setPreviewCell(null);
    queueMicrotask(() => focusCell(here.row, here.col));
  }

  // Build the grid template string
  const gridTemplate = effectiveColumns.map(c => c.width || "1fr").join(" ");

  return (
    <div
      ref={wrapperRef}
      role="grid"
      aria-label={ariaLabel}
      aria-rowcount={numRows + 1}
      aria-colcount={numCols}
      onKeyDown={onKeyDown}
      style={{
        border: `1px solid ${COLORS.borderSoft}`,
        borderRadius: 8,
        background: COLORS.bgPanel,
        overflow: "auto",
        maxHeight: "70vh",
        outline: "none",
        boxShadow: COLORS.shadowSoft,
      }}
    >
      {/* Header */}
      <div
        role="row"
        aria-rowindex={1}
        style={{
          display: "grid",
          gridTemplateColumns: gridTemplate,
          background: COLORS.bgPanelDeep,
          borderBottom: `2px solid ${COLORS.gold}`,
          position: "sticky",
          top: 0,
          zIndex: 1,
        }}
      >
        {effectiveColumns.map((col, c) => (
          <div
            key={col.key}
            role="columnheader"
            aria-colindex={c + 1}
            style={{
              padding: "10px 12px",
              fontFamily: FONTS.serif,
              fontWeight: 600,
              fontSize: 11,
              letterSpacing: "0.7px",
              textTransform: "uppercase",
              color: COLORS.goldMuted,
              borderRight: c < effectiveColumns.length - 1 ? `1px solid ${COLORS.borderHair}` : "none",
            }}
          >
            {col.label}
          </div>
        ))}
      </div>

      {/* Rows */}
      {rows.map((row, r) => {
        const id = rowKey(row);
        const expanded = hasExpand && expandedRows.has(id);
        const highlighted = highlightRow === id;
        return (
          <div key={id}>
            <div
              role="row"
              aria-rowindex={r + 2}
              style={{
                display: "grid",
                gridTemplateColumns: gridTemplate,
                borderBottom: `1px solid ${COLORS.borderHair}`,
                background: highlighted
                  ? COLORS.goldSoft
                  : r % 2 === 0 ? COLORS.bgPanel : COLORS.bgPanelAlt,
                transition: "background 0.6s ease",
              }}
            >
              {effectiveColumns.map((col, c) => {
                const isFocused = focus.row === r && focus.col === c;
                const isEditing = editingCell && editingCell.row === r && editingCell.col === c;
                const isAction = typeof col.onActivate === "function";
                const editor = col.isExpander || isAction ? null :
                  (typeof col.editor === "function" ? col.editor(row, ctx) : col.editor);
                const editable = editor && editor !== "preview";
                const isExpander = col.isExpander;
                const isInteractive = isExpander || isAction || editor;

                let cellContent;
                if (col.isExpander) {
                  cellContent = (
                    <span aria-label={expanded ? "Collapse row" : "Expand row"}
                          style={{
                            display: "inline-flex",
                            width: "100%",
                            justifyContent: "center",
                            color: expanded ? COLORS.goldDeep : COLORS.textMuted,
                            fontSize: 14,
                            transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
                            transition: "transform 0.15s ease",
                          }}>
                      ▾
                    </span>
                  );
                } else if (isEditing) {
                  cellContent = (
                    <CellEditor
                      editor={editingCell.editor}
                      rawValue={row[col.key]}
                      onCommit={commitEdit}
                      onCancel={cancelEdit}
                    />
                  );
                } else {
                  cellContent = (
                    <span style={{
                      width: "100%",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {col.render ? col.render(row, ctx) : (row[col.key] ?? "")}
                    </span>
                  );
                }

                return (
                  <div
                    key={col.key}
                    role="gridcell"
                    aria-colindex={c + 1}
                    aria-readonly={!editable && !isExpander && !isAction}
                    aria-expanded={isExpander ? expanded : undefined}
                    tabIndex={isFocused ? 0 : -1}
                    ref={el => setCellRef(r, c, el)}
                    onFocus={() => setFocus({ row: r, col: c })}
                    onClick={() => {
                      setFocus({ row: r, col: c });
                      if (isExpander) {
                        toggleRowExpanded(r);
                      } else if (isAction) {
                        col.onActivate(row, ctx);
                      } else if (editor === "preview") {
                        setPreviewCell({ row: r, col: c });
                      } else if (editable && !isEditing) {
                        setEditingCell({ row: r, col: c, editor });
                      }
                    }}
                    style={{
                      padding: "8px 12px",
                      fontFamily: FONTS.serif,
                      fontSize: 14,
                      color: COLORS.textBody,
                      borderRight: c < effectiveColumns.length - 1 ? `1px solid ${COLORS.borderHair}` : "none",
                      outline: isFocused ? `2px solid ${COLORS.borderFocus}` : "none",
                      outlineOffset: -2,
                      cursor: isInteractive ? "pointer" : "default",
                      minHeight: 36,
                      display: "flex",
                      alignItems: "center",
                      overflow: "hidden",
                    }}
                  >
                    {cellContent}
                  </div>
                );
              })}
            </div>

            {expanded && (
              <div
                role="region"
                aria-label="Row details"
                style={{
                  padding: "14px 18px",
                  background: COLORS.bgPanelDeep,
                  borderBottom: `1px solid ${COLORS.borderHair}`,
                  borderLeft: `4px solid ${COLORS.gold}`,
                }}
              >
                {renderExpanded(row)}
              </div>
            )}
          </div>
        );
      })}

      {numRows === 0 && (
        <div role="row" style={{ padding: "30px", textAlign: "center", color: COLORS.textMuted }}>
          No rows.
        </div>
      )}

      {previewCell && (
        <PreviewDialog
          title={effectiveColumns[previewCell.col]?.label || "Preview"}
          content={rows[previewCell.row]?.[effectiveColumns[previewCell.col].key]}
          onClose={closePreview}
        />
      )}
    </div>
  );
}

// ─── CellEditor ──────────────────────────────────────────────────────────────

function CellEditor({ editor, rawValue, onCommit, onCancel }) {
  if (editor === "text" || editor?.kind === "text") {
    return <TextEditor initialValue={rawValue ?? ""} onCommit={onCommit} onCancel={onCancel} />;
  }
  if (editor?.kind === "select") {
    return <SelectEditor options={editor.options} initialValue={rawValue ?? ""} onCommit={onCommit} onCancel={onCancel} />;
  }
  if (editor?.kind === "select-or-new") {
    return <SelectOrNewEditor
      options={editor.options}
      initialValue={rawValue ?? ""}
      onCreate={editor.onCreate}
      createLabel={editor.createLabel ?? "+ New…"}
      onCommit={onCommit}
      onCancel={onCancel}
    />;
  }
  return null;
}

function TextEditor({ initialValue, onCommit, onCancel }) {
  const [v, setV] = useState(initialValue);
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  return (
    <input
      ref={ref}
      value={v}
      onChange={e => setV(e.target.value)}
      onBlur={() => onCommit(v)}
      onKeyDown={e => {
        if (e.key === "Enter") { e.preventDefault(); onCommit(v); }
        else if (e.key === "Escape") { e.preventDefault(); onCancel(); }
      }}
      style={{
        width: "100%",
        fontFamily: FONTS.serif,
        fontSize: 14,
        padding: "4px 6px",
        border: `1px solid ${COLORS.borderFocus}`,
        borderRadius: 3,
        background: COLORS.bgPanelDeep,
        color: COLORS.textBody,
        outline: "none",
      }}
    />
  );
}

function SelectEditor({ options, initialValue, onCommit, onCancel }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <select
      ref={ref}
      defaultValue={initialValue ?? ""}
      onChange={e => onCommit(e.target.value === "" ? null : e.target.value)}
      onBlur={() => onCancel()}
      onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); onCancel(); } }}
      style={{
        width: "100%",
        fontFamily: FONTS.serif,
        fontSize: 14,
        padding: "4px 6px",
        border: `1px solid ${COLORS.borderFocus}`,
        borderRadius: 3,
        background: COLORS.bgPanelDeep,
        color: COLORS.textBody,
        outline: "none",
      }}
    >
      {options.map(o => (
        <option key={o.value ?? "_blank"} value={o.value ?? ""}>{o.label}</option>
      ))}
    </select>
  );
}

function SelectOrNewEditor({ options, initialValue, onCreate, createLabel, onCommit, onCancel }) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const selectRef = useRef(null);
  const inputRef = useRef(null);
  useEffect(() => { selectRef.current?.focus(); }, []);
  useEffect(() => { if (creating) inputRef.current?.focus(); }, [creating]);

  if (creating) {
    return (
      <input
        ref={inputRef}
        value={newName}
        placeholder="New value"
        onChange={e => setNewName(e.target.value)}
        onKeyDown={async e => {
          if (e.key === "Enter") {
            e.preventDefault();
            const trimmed = newName.trim();
            if (!trimmed) { onCancel(); return; }
            try { const v = await onCreate(trimmed); onCommit(v); }
            catch { onCancel(); }
          } else if (e.key === "Escape") { e.preventDefault(); onCancel(); }
        }}
        onBlur={onCancel}
        style={{
          width: "100%",
          fontFamily: FONTS.serif,
          fontSize: 14,
          padding: "4px 6px",
          border: `1px solid ${COLORS.borderFocus}`,
          borderRadius: 3,
          background: COLORS.bgPanelDeep,
          color: COLORS.textBody,
        }}
      />
    );
  }

  return (
    <select
      ref={selectRef}
      defaultValue={initialValue ?? ""}
      onChange={e => {
        if (e.target.value === "__NEW__") setCreating(true);
        else onCommit(e.target.value === "" ? null : e.target.value);
      }}
      onBlur={() => { if (!creating) onCancel(); }}
      onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); onCancel(); } }}
      style={{
        width: "100%",
        fontFamily: FONTS.serif,
        fontSize: 14,
        padding: "4px 6px",
        border: `1px solid ${COLORS.borderFocus}`,
        borderRadius: 3,
        background: COLORS.bgPanelDeep,
        color: COLORS.textBody,
      }}
    >
      {options.map(o => (
        <option key={o.value ?? "_blank"} value={o.value ?? ""}>{o.label}</option>
      ))}
      <option value="__NEW__">{createLabel}</option>
    </select>
  );
}

// ─── Preview dialog (for long fields like Abstract) ──────────────────────────

function PreviewDialog({ title, content, onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-title"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.65)",
        display: "grid", placeItems: "center",
        padding: 24, zIndex: 300,
      }}
    >
      <div style={{
        background: COLORS.bgPanel,
        borderRadius: 10,
        padding: "26px 30px",
        maxWidth: 720,
        width: "100%",
        maxHeight: "80vh",
        overflow: "auto",
        boxShadow: COLORS.shadowDeep,
        border: `1px solid ${COLORS.borderSoft}`,
      }}>
        <h2 id="preview-title" style={{
          fontFamily: FONTS.display,
          fontSize: 22,
          fontWeight: 500,
          margin: "0 0 14px",
          color: COLORS.gold,
        }}>{title}</h2>
        <div style={{
          fontFamily: FONTS.serif,
          fontSize: 15,
          lineHeight: 1.6,
          color: COLORS.textBody,
          whiteSpace: "pre-wrap",
        }}>
          {content || <em style={{ color: COLORS.textFaint }}>Not available</em>}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
          <button onClick={onClose} style={{
            background: `linear-gradient(180deg, ${COLORS.goldHi} 0%, ${COLORS.gold} 100%)`,
            color: COLORS.textOnGold,
            border: "none",
            padding: "9px 22px",
            borderRadius: 5,
            fontFamily: FONTS.serif,
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            letterSpacing: "0.3px",
          }}>Close</button>
        </div>
      </div>
    </div>
  );
}
