"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  ClipboardPasteIcon,
  CopyIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  RotateCcwIcon,
  TriangleAlertIcon,
  UploadIcon,
  XCircleIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert } from "@/components/app/form-alert";
import { maskCnic, normalizeCnic } from "@/lib/cnic";
import { extensionOf } from "@/lib/documents";
import { CUSTOMER_IMPORT_FIELDS, IMPORT_CHUNK, IMPORT_MAX_ROWS, guessMapping, rowToRecord } from "@/lib/imports";
import { cn } from "@/lib/utils";
import { checkCustomerImportAction, importCustomerChunkAction } from "./actions";

// Steps: 1 choose a file or paste a table → 2 match columns → 3 check rows → 4 import.
// The file is read in the browser; only the matched text values are sent to the server,
// which checks every row again before saving.

const NONE = "__none__";
const STEPS = ["Choose file", "Match columns", "Check rows", "Import"];

async function parseText(text) {
  const Papa = (await import("papaparse")).default;
  // Delimiter is detected: commas (CSV), semicolons, or tabs (a table copied from Excel or Word).
  return Papa.parse(text.replace(/^﻿/, "").trim(), { skipEmptyLines: "greedy" }).data;
}

async function readRows(file) {
  const ext = extensionOf(file.name);
  if (ext === "xlsx") {
    const { readSheet } = await import("read-excel-file/browser");
    return readSheet(file);
  }
  if (["csv", "txt", "tsv"].includes(ext)) return parseText(await file.text());
  if (ext === "xls") throw new Error("Old Excel files (.xls) cannot be read. In Excel use File → Save As → “Excel Workbook (.xlsx)” or CSV, then choose that file.");
  if (ext === "doc" || ext === "docx") throw new Error("Word files cannot be read directly. Open the document, select the table, copy it (Ctrl+C) and paste it in the box below.");
  throw new Error("Choose an Excel (.xlsx) or CSV file, or paste a table.");
}

/** Drop empty rows; the first remaining row is the header. */
function splitTable(raw) {
  const rows = (raw ?? []).filter((r) => Array.isArray(r) && r.some((c) => c != null && String(c).trim() !== ""));
  if (rows.length < 2) throw new Error("No data found. The first row should be the column names, with one customer per row below it.");
  const width = Math.max(...rows.map((r) => r.length));
  const headers = Array.from({ length: width }, (_, i) => String(rows[0][i] ?? "").trim() || `Column ${i + 1}`);
  const body = rows.slice(1);
  if (body.length > IMPORT_MAX_ROWS) throw new Error(`The file has ${body.length} rows. Import at most ${IMPORT_MAX_ROWS} at a time; split the file.`);
  return { headers, body };
}

function toCsv(rows) {
  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `﻿${rows.map((r) => r.map(esc).join(",")).join("\r\n")}\r\n`;
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ImportWizard() {
  const [step, setStep] = useState(0);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sourceName, setSourceName] = useState("");
  const [table, setTable] = useState(null); // { headers, body }
  const [mapping, setMapping] = useState({});
  const [check, setCheck] = useState(null); // { summary, rows }
  const [progress, setProgress] = useState(null); // { done, total }
  const [result, setResult] = useState(null); // { created, skipped }
  const [paste, setPaste] = useState("");
  const fileRef = useRef(null);

  const records = useMemo(() => (table ? table.body.map((r) => rowToRecord(r, mapping)) : []), [table, mapping]);
  const missingRequired = CUSTOMER_IMPORT_FIELDS.filter((f) => f.required && mapping[f.key] == null);

  const loadTable = (raw, name) => {
    const t = splitTable(raw);
    setTable(t);
    setMapping(guessMapping(t.headers));
    setSourceName(name);
    setCheck(null);
    setResult(null);
    setStep(1);
  };

  const onFile = async (file) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      loadTable(await readRows(file), file.name);
    } catch (err) {
      setError(err.message || "The file could not be read.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onPaste = async () => {
    setError(null);
    try {
      loadTable(await parseText(paste), "Pasted table");
    } catch (err) {
      setError(err.message || "The pasted text could not be read.");
    }
  };

  const runCheck = async () => {
    setError(null);
    setBusy(true);
    const res = await checkCustomerImportAction(records);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setCheck(res.data);
    setStep(2);
  };

  const runImport = async () => {
    setError(null);
    setBusy(true);
    setStep(3);
    const ready = check.rows.filter((r) => r.status === "ready").map((r) => r.row);
    const readySet = new Set(ready);
    // Send only the ready rows, in chunks; keep their original row numbers for messages.
    const rowsToSend = records.map((rec, i) => ({ rec, row: i + 1 })).filter((x) => readySet.has(x.row));
    let created = 0;
    const skipped = check.rows.filter((r) => r.status !== "ready").map((r) => ({ row: r.row, status: r.status, message: r.errors.join("; ") }));
    setProgress({ done: 0, total: rowsToSend.length });
    for (let i = 0; i < rowsToSend.length; i += IMPORT_CHUNK) {
      const chunk = rowsToSend.slice(i, i + IMPORT_CHUNK);
      const res = await importCustomerChunkAction(
        chunk.map((x) => x.rec),
        chunk[0].row,
      );
      if (!res.ok) {
        chunk.forEach((x) => skipped.push({ row: x.row, status: "error", message: res.error }));
      } else {
        created += res.data.created;
        // Chunk rows are consecutive in `chunk`, not in the file: map back by position.
        res.data.skipped.forEach((s) => {
          const original = chunk[s.row - chunk[0].row];
          skipped.push({ ...s, row: original?.row ?? s.row });
        });
      }
      setProgress({ done: Math.min(i + IMPORT_CHUNK, rowsToSend.length), total: rowsToSend.length });
    }
    skipped.sort((a, b) => a.row - b.row);
    setResult({ created, skipped });
    setBusy(false);
    if (created > 0) toast.success(`${created} ${created === 1 ? "customer" : "customers"} imported`, { description: skipped.length ? `${skipped.length} rows skipped` : "All rows imported" });
    else toast.warning("No customers were imported", { description: "See the list of skipped rows." });
  };

  const reset = () => {
    setStep(0);
    setTable(null);
    setCheck(null);
    setResult(null);
    setProgress(null);
    setPaste("");
    setError(null);
  };

  const downloadSkipped = () => {
    const header = ["Row in file", "Reason", ...CUSTOMER_IMPORT_FIELDS.map((f) => f.label)];
    // "Row in file" counts the header row, like the screen does.
    const lines = result.skipped.map((s) => [s.row + 1, s.message, ...CUSTOMER_IMPORT_FIELDS.map((f) => records[s.row - 1]?.[f.key] ?? "")]);
    download("customers-not-imported.csv", toCsv([header, ...lines]));
  };

  return (
    <div className="space-y-6">
      <Stepper step={step} />
      <FormAlert>{error}</FormAlert>

      {step === 0 && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileSpreadsheetIcon className="size-4 text-primary" /> Choose a file
              </CardTitle>
              <CardDescription>Excel (.xlsx) or CSV. The first row must be the column names, with one customer per row below.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <input ref={fileRef} type="file" accept=".xlsx,.csv,.txt,.tsv,.xls,.doc,.docx" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
              <button
                type="button"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  onFile(e.dataTransfer.files?.[0]);
                }}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-60"
              >
                <UploadIcon className="size-6 text-primary" />
                <span className="text-sm font-medium">{busy ? "Reading the file…" : "Click to choose a file, or drop it here"}</span>
                <span className="text-xs text-muted-foreground">Up to {IMPORT_MAX_ROWS} customers at a time</span>
              </button>

              <div className="space-y-2">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <ClipboardPasteIcon className="size-4 text-muted-foreground" /> Or paste a table
                </p>
                <p className="text-xs text-muted-foreground">From Excel, Google Sheets or a Word table: select the table including the header row, copy (Ctrl+C) and paste here.</p>
                <Textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={5} placeholder={"Name\tCNIC\tPhone\nMuhammad Asif\t31303-1234567-1\t0300-1234567"} className="font-mono text-xs" />
                <Button variant="secondary" disabled={!paste.trim()} onClick={onPaste}>
                  <CopyIcon /> Use pasted table
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Template</CardTitle>
              <CardDescription>Start from the template so the columns match automatically. Delete the example row before importing.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" asChild>
                  <a href="/api/import/template?format=xlsx">
                    <DownloadIcon /> Excel template
                  </a>
                </Button>
                <Button variant="outline" asChild>
                  <a href="/api/import/template?format=csv">
                    <DownloadIcon /> CSV template
                  </a>
                </Button>
              </div>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li>• Required: Name and CNIC.</li>
                <li>• Your own column names usually work too (e.g. “Mobile”, “S/O”, “ID card”).</li>
                <li>• Customers whose CNIC is already in the system are skipped, never changed.</li>
                <li>• Plans and payments are added in the app after the customers are in.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 1 && table && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Match columns</CardTitle>
            <CardDescription>
              {sourceName}: {table.body.length} {table.body.length === 1 ? "row" : "rows"}. Check which column of your file goes into each field.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CUSTOMER_IMPORT_FIELDS.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <p className="text-sm font-medium">
                    {f.label}
                    {f.required && <span className="text-destructive"> *</span>}
                  </p>
                  <Select value={mapping[f.key] == null ? NONE : String(mapping[f.key])} onValueChange={(v) => setMapping((m) => ({ ...m, [f.key]: v === NONE ? null : Number(v) }))}>
                    <SelectTrigger className={cn("w-full", f.required && mapping[f.key] == null && "border-destructive")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>— Not in file —</SelectItem>
                      {table.headers.map((h, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Preview (first 3 rows)</p>
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="pl-3">Name</TableHead>
                      <TableHead>Father / husband</TableHead>
                      <TableHead>CNIC</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead className="hidden pr-3 md:table-cell">Address</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.slice(0, 3).map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="pl-3 font-medium">{r.name || "—"}</TableCell>
                        <TableCell>{r.fatherOrHusbandName || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{r.cnic ? (normalizeCnic(r.cnic) ? maskCnic(normalizeCnic(r.cnic)) : r.cnic) : "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{r.phone1 || "—"}</TableCell>
                        <TableCell className="hidden max-w-60 truncate pr-3 md:table-cell">{r.homeAddress || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {missingRequired.length > 0 && (
              <p className="text-sm text-destructive">Choose a column for: {missingRequired.map((f) => f.label).join(", ")}.</p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button variant="outline" onClick={reset}>
                <ArrowLeftIcon /> Choose another file
              </Button>
              <Button disabled={busy || missingRequired.length > 0} onClick={runCheck}>
                {busy ? "Checking…" : "Check rows"} <ArrowRightIcon />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && check && (
        <Card className="gap-0 overflow-hidden py-0">
          <CardHeader className="border-b py-4">
            <CardTitle className="text-base">Check rows</CardTitle>
            <CardDescription>Only rows marked “Ready” will be imported. Fix the others in your file and import them later.</CardDescription>
          </CardHeader>
          <div className="grid grid-cols-3 gap-px border-b bg-border">
            <SummaryTile label="Ready to import" value={check.summary.ready} tone="text-success" icon={CheckCircle2Icon} />
            <SummaryTile label="Already exist" value={check.summary.duplicates} tone="text-warning-foreground dark:text-warning" icon={TriangleAlertIcon} />
            <SummaryTile label="Have errors" value={check.summary.errors} tone="text-destructive" icon={XCircleIcon} />
          </div>
          <div className="max-h-112 overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 z-1 bg-muted">
                <TableRow>
                  <TableHead className="w-14 pl-4">Row</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="pr-4">Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {check.rows.map((r) => {
                  const rec = records[r.row - 1];
                  const digits = normalizeCnic(rec?.cnic ?? "");
                  return (
                    <TableRow key={r.row}>
                      <TableCell className="pl-4 text-muted-foreground tabular-nums">{r.row + 1}</TableCell>
                      <TableCell className="max-w-48 sm:max-w-80">
                        <p className="truncate font-medium">{rec?.name || "—"}</p>
                        <p className="truncate font-mono text-xs text-muted-foreground">
                          {digits ? maskCnic(digits) : rec?.cnic || "no CNIC"}
                          {rec?.phone1 && ` · ${rec.phone1}`}
                        </p>
                      </TableCell>
                      <TableCell className="pr-4 whitespace-normal">
                        <StatusBadge status={r.status} />
                        {r.errors.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{r.errors.join(" · ")}</p>}
                        {r.existingId && (
                          <Link href={`/customers/${r.existingId}`} target="_blank" className="text-xs text-primary hover:underline">
                            Open existing customer
                          </Link>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-col-reverse gap-2 border-t p-4 sm:flex-row sm:justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeftIcon /> Back to columns
            </Button>
            <Button disabled={busy || check.summary.ready === 0} onClick={runImport}>
              <UploadIcon /> Import {check.summary.ready} {check.summary.ready === 1 ? "customer" : "customers"}
            </Button>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{result ? "Import finished" : "Importing…"}</CardTitle>
            <CardDescription>{result ? "Each imported customer is recorded in the history with your name." : "Keep this page open until it finishes."}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {progress && (
              <div className="space-y-1.5">
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 100}%` }} />
                </div>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {progress.done} of {progress.total} rows saved
                </p>
              </div>
            )}

            {result && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border bg-success/5 p-4">
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2Icon className="size-4 text-success" /> Imported
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">{result.created}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <TriangleAlertIcon className="size-4 text-warning-foreground dark:text-warning" /> Not imported
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">{result.skipped.length}</p>
                  </div>
                </div>

                {result.skipped.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">Rows not imported</p>
                      <Button variant="outline" size="sm" onClick={downloadSkipped}>
                        <DownloadIcon /> Download these rows (CSV)
                      </Button>
                    </div>
                    <ul className="max-h-60 divide-y overflow-y-auto rounded-lg border text-sm">
                      {result.skipped.map((s) => (
                        <li key={s.row} className="flex gap-3 px-3 py-2">
                          <span className="w-14 shrink-0 text-muted-foreground tabular-nums">Row {s.row + 1}</span>
                          <span className="min-w-0 flex-1 text-muted-foreground">{s.message}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-muted-foreground">Fix them in the downloaded file and import it again; rows already imported will be skipped.</p>
                  </div>
                )}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                  <Button variant="outline" onClick={reset}>
                    <RotateCcwIcon /> Import another file
                  </Button>
                  <Button asChild>
                    <Link href="/customers">
                      Go to customers <ArrowRightIcon />
                    </Link>
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stepper({ step }) {
  return (
    <ol className="no-scrollbar flex items-center gap-2 overflow-x-auto text-sm">
      {STEPS.map((label, i) => (
        <li key={label} className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
              i < step ? "bg-primary text-primary-foreground" : i === step ? "bg-primary/12 text-primary ring-1 ring-primary/40" : "bg-muted text-muted-foreground",
            )}
          >
            {i + 1}
          </span>
          <span className={cn(i === step ? "font-medium" : "text-muted-foreground")}>{label}</span>
          {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-border" aria-hidden="true" />}
        </li>
      ))}
    </ol>
  );
}

function SummaryTile({ label, value, tone, icon: Icon }) {
  return (
    <div className="bg-card px-4 py-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className={cn("size-3.5", tone)} /> <span className="truncate">{label}</span>
      </p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  if (status === "ready") return <Badge className="bg-success/12 text-success hover:bg-success/12">Ready</Badge>;
  if (status === "duplicate") return <Badge className="bg-warning/18 text-warning-foreground hover:bg-warning/18 dark:text-warning">Already exists</Badge>;
  return <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/10">Error</Badge>;
}
