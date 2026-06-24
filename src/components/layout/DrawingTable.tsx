import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DrawingWithStatus } from "../../lib/drawingStatus";
import { cn } from "../../lib/utils";
import { Checkbox } from "../ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

export interface DrawingTableProps {
  rows: DrawingWithStatus[];
  mode: "commit" | "release" | "browse" | "view";
  onPreviewChange: (filename: string | null) => void;
  onSelectionChange: (filenames: string[]) => void;
}

function getStatusColor(
  status: DrawingWithStatus["status"],
  isMinor: boolean,
): string {
  if (status === "new") return "text-green-600";
  if (status === "deleted") return "text-red-500 line-through";
  if (status === "modified")
    return isMinor ? "text-sky-500" : "text-orange-500";
  return "";
}

function canSelect(status: DrawingWithStatus["status"], mode: string): boolean {
  if (mode === "view") return false;
  if (mode === "browse") return true;
  return mode === "release" || status !== "unchanged";
}

export function DrawingTable({
  rows,
  mode,
  onPreviewChange,
  onSelectionChange,
}: DrawingTableProps) {
  const [activeRow, setActiveRow] = useState<string | null>(null);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>(
    () => Object.fromEntries(rows.map((r) => [r.filename, true])),
  );

  const onPreviewChangeRef = useRef(onPreviewChange);
  onPreviewChangeRef.current = onPreviewChange;

  const activeRowRef = useRef(activeRow);
  activeRowRef.current = activeRow;

  // Reset to all-selected when row list changes (after commit / release).
  // Skip the first run — useState initializer already set the correct initial state.
  const isMountedRef = useRef(false);
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    setRowSelection(Object.fromEntries(rows.map((r) => [r.filename, true])));
    const prev = activeRowRef.current;
    if (prev === null || !rows.some((r) => r.filename === prev)) {
      setActiveRow(null);
      onPreviewChangeRef.current(null);
    }
  }, [rows]);

  const columns = useMemo<ColumnDef<DrawingWithStatus>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => {
          const hasSelectable = table
            .getRowModel()
            .rows.some((r) => r.getCanSelect());
          if (!hasSelectable) return null;
          return (
            <Checkbox
              checked={table.getIsAllRowsSelected()}
              indeterminate={table.getIsSomeRowsSelected()}
              onCheckedChange={(v) => table.toggleAllRowsSelected(!!v)}
              aria-label="すべて選択"
            />
          );
        },
        cell: ({ row }) =>
          row.getCanSelect() ? (
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(v) => row.toggleSelected(!!v)}
              onClick={(e) => e.stopPropagation()}
              aria-label={row.original.filename}
            />
          ) : null,
      },
      {
        accessorKey: "filename",
        header: ({ table }) =>
          table.getRowModel().rows.some((r) => r.getCanSelect())
            ? "全図面"
            : null,
        cell: ({ row }) => (
          <span
            className={cn(
              "block truncate text-xs",
              getStatusColor(row.original.status, row.original.isMinor),
            )}
          >
            {row.original.filename}
          </span>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.filename,
    enableRowSelection: (row) => canSelect(row.original.status, mode),
  });

  // Notify parent — use ref to avoid stale closure without re-running effect
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;

  useEffect(() => {
    const selected = rows
      .filter((r) => canSelect(r.status, mode) && rowSelection[r.filename])
      .map((r) => r.filename);
    onSelectionChangeRef.current(selected);
  }, [rowSelection, rows, mode]);

  return (
    <div
      className="flex-1 overflow-y-auto"
      onClick={() => {
        setActiveRow(null);
        onPreviewChangeRef.current(null);
      }}
    >
      <p className="text-sm px-4 pt-3 pb-1">図面一覧</p>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id} className="hover:bg-transparent">
              {hg.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    "h-8 py-1",
                    header.column.id === "select" && "w-8 pr-0",
                    header.column.id === "badge" && "w-8 pl-0",
                  )}
                >
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                PDFファイルがありません
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={activeRow === row.id ? "selected" : undefined}
                className={cn(
                  "cursor-pointer border-l-2",
                  activeRow === row.id
                    ? "border-l-primary"
                    : "border-l-transparent",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveRow(row.id);
                  onPreviewChange(row.id);
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      "py-1.5",
                      cell.column.id === "select" && "w-8 pr-0",
                      cell.column.id === "badge" && "w-8 pl-0",
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
