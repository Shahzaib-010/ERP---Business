"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon, ExternalLinkIcon, FileTextIcon, ImageIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { categoryLabel, formatFileSize } from "@/lib/documents";
import { RemoveDocumentButton } from "./document-dialogs";

// Documents open in a viewer on the same page. The file is loaded from /api/documents/:id,
// which checks access and audits every open, then redirects to a 60-second signed URL.
// Images show directly; PDFs use the browser's own PDF viewer (phones may not show PDFs
// inside a page, so Download and "Open in new tab" are always there).

const fileUrl = (doc, { download = false } = {}) => `/api/documents/${doc.id}${download ? "?download" : ""}`;

export function DocumentList({ documents, canRemove }) {
  const [index, setIndex] = useState(null);
  const open = index !== null;
  const doc = open ? documents[index] : null;

  return (
    <>
      <ul className="divide-y rounded-lg border">
        {documents.map((d, i) => (
          <li key={d.id} className="flex items-center gap-1 p-1.5 pr-3">
            <button
              type="button"
              onClick={() => setIndex(i)}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-md p-1.5 text-left transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <DocIcon doc={d} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{d.label}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {categoryLabel(d.category)} · {formatFileSize(d.size)} · {d.uploadedLabel}
                  {d.uploadedByName && ` · ${d.uploadedByName}`}
                </p>
              </div>
            </button>
            <Button variant="ghost" size="icon-xs" asChild>
              <a href={fileUrl(d, { download: true })} aria-label={`Download ${d.label}`} title="Download">
                <DownloadIcon />
              </a>
            </Button>
            {canRemove && <RemoveDocumentButton documentId={d.id} label={d.label} />}
          </li>
        ))}
      </ul>

      <Dialog open={open} onOpenChange={(o) => !o && setIndex(null)}>
        {doc && <Viewer doc={doc} index={index} count={documents.length} onMove={setIndex} />}
      </Dialog>
    </>
  );
}

function Viewer({ doc, index, count, onMove }) {
  const prev = useCallback(() => index > 0 && onMove(index - 1), [index, onMove]);
  const next = useCallback(() => index < count - 1 && onMove(index + 1), [index, count, onMove]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next]);

  return (
    <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
      <DialogHeader className="flex-row items-center gap-3 border-b px-4 py-3 pr-12 text-left">
        <DocIcon doc={doc} />
        <div className="min-w-0 flex-1">
          <DialogTitle className="truncate text-base">{doc.label}</DialogTitle>
          <DialogDescription className="truncate text-xs">
            {categoryLabel(doc.category)} · {doc.fileName} · {formatFileSize(doc.size)} · {doc.uploadedLabel}
          </DialogDescription>
        </div>
        <div className="hidden shrink-0 items-center gap-1 sm:flex">
          <Button variant="outline" size="sm" asChild>
            <a href={fileUrl(doc, { download: true })}>
              <DownloadIcon /> Download
            </a>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <a href={fileUrl(doc)} target="_blank" rel="noopener noreferrer">
              <ExternalLinkIcon /> New tab
            </a>
          </Button>
        </div>
      </DialogHeader>

      <div className="relative flex min-h-[50vh] flex-1 items-center justify-center overflow-auto bg-muted/40">
        {/* key: a fresh load (and a fresh signed URL) for each document */}
        <Preview key={doc.id} doc={doc} />

        {count > 1 && (
          <>
            <Button
              variant="secondary"
              size="icon"
              onClick={prev}
              disabled={index === 0}
              aria-label="Previous document"
              className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full shadow-md disabled:opacity-0"
            >
              <ChevronLeftIcon />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={next}
              disabled={index === count - 1}
              aria-label="Next document"
              className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full shadow-md disabled:opacity-0"
            >
              <ChevronRightIcon />
            </Button>
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t px-4 py-2.5 text-xs text-muted-foreground">
        <span>{count > 1 ? `${index + 1} of ${count} · use ← → to move` : "Private document"}</span>
        <div className="flex items-center gap-1 sm:hidden">
          <Button variant="outline" size="xs" asChild>
            <a href={fileUrl(doc, { download: true })}>
              <DownloadIcon /> Download
            </a>
          </Button>
          <Button variant="ghost" size="xs" asChild>
            <a href={fileUrl(doc)} target="_blank" rel="noopener noreferrer">
              <ExternalLinkIcon /> New tab
            </a>
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}

function Preview({ doc }) {
  const [state, setState] = useState("loading"); // loading | ready | error
  if (state === "error") {
    return (
      <div className="flex flex-col items-center gap-3 p-8 text-center">
        <TriangleAlertIcon className="size-6 text-warning-foreground dark:text-warning" />
        <p className="text-sm text-muted-foreground">This document could not be shown here. Try downloading it instead.</p>
        <Button variant="outline" size="sm" asChild>
          <a href={fileUrl(doc, { download: true })}>
            <DownloadIcon /> Download
          </a>
        </Button>
      </div>
    );
  }
  return (
    <>
      {state === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Spinner /> Loading…
        </div>
      )}
      {doc.isImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- private, short-lived URL; must not go through image optimisation
        <img
          src={fileUrl(doc)}
          alt={doc.label}
          onLoad={() => setState("ready")}
          onError={() => setState("error")}
          className={cn("max-h-[75vh] w-auto max-w-full object-contain transition-opacity", state === "ready" ? "opacity-100" : "opacity-0")}
        />
      ) : (
        <iframe
          src={fileUrl(doc)}
          title={doc.label}
          onLoad={() => setState("ready")}
          className={cn("h-[75vh] w-full border-0 bg-background transition-opacity", state === "ready" ? "opacity-100" : "opacity-0")}
        />
      )}
    </>
  );
}

export function DocIcon({ doc, muted }) {
  const Icon = doc.isImage ? ImageIcon : FileTextIcon;
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-md",
        muted ? "bg-muted text-muted-foreground" : doc.isImage ? "bg-success/10 text-success" : "bg-primary/8 text-primary",
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}
