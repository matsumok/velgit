import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DrawingWithStatus } from "../../lib/drawingStatus";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
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
  mode: "commit" | "release" | "browse";
  onPreviewChange: (filename: string) => void;
  onSelectionChange: (filenames: string[]) => void;
}

const STATUS_COLOR: Record<string, string> = {
  new: "text-green-600",
  modified: "text-yellow-600",
  unchanged: "",
};

function canSelect(status: DrawingWithStatus["status"], mode: string): boolean {
  return mode !== "browse" && (mode === "release" || status !== "unchanged");
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

  // Reset to all-selected when row list changes (after commit / release).
  // Skip the first run — useState initializer already set the correct initial state.
  const isMountedRef = useRef(false);
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    setRowSelection(Object.fromEntries(rows.map((r) => [r.filename, true])));
    setActiveRow(null);
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
              aria-label={row.original.filename}
              onClick={(e) => e.stopPropagation()}
            />
          ) : null,
      },
      {
        accessorKey: "filename",
        header: "図面",
        cell: ({ row }) => (
          <span
            className={cn(
              "block truncate text-xs",
              STATUS_COLOR[row.original.status],
            )}
          >
            {row.original.filename}
          </span>
        ),
      },
      {
        id: "badge",
        cell: ({ row }) =>
          row.original.isMinor ? (
            <Badge variant="secondary" className="text-xs">
              ~
            </Badge>
          ) : null,
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
    <div className="flex-1 overflow-y-auto">
      <p className="text-xs text-muted-foreground px-4 pt-3 pb-1">図面一覧</p>
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
                className="cursor-pointer"
                onClick={() => {
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
