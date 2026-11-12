"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CameraIcon, FileUpIcon, RotateCcwIcon, Trash2Icon, UploadIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormAlert } from "@/components/app/form-alert";
import { TextField, TextareaField } from "@/components/app/form-fields";
import { SubmitButton } from "@/components/submit-button";
import { SelectField } from "@/app/(staff)/plans/plan-fields";
import {
  confirmUploadAction,
  eraseDocumentAction,
  removeDocumentAction,
  restoreDocumentAction,
  startUploadAction,
} from "@/app/(staff)/documents/actions";
import {
  ACCEPT_ATTRIBUTE,
  DEFAULT_CATEGORY,
  DOCUMENT_CATEGORIES,
  DOCUMENT_TYPES,
  MAX_DOCUMENT_BYTES,
  extensionOf,
  formatFileSize,
} from "@/lib/documents";

// Photos larger than this (or wider/taller than MAX_SIDE) are shrunk in the browser before
// upload: phone photos drop from ~4-8 MB to well under 1 MB and stay readable.
const SHRINK_ABOVE_BYTES = 1.5 * 1024 * 1024;
const MAX_SIDE = 2000;

async function shrinkImage(file) {
  if (!file.type.startsWith("image/") || typeof createImageBitmap !== "function") return file;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= SHRINK_ABOVE_BYTES) return file;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  if (!blob || blob.size >= file.size) return file;
  const base = file.name.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}

/** PUT with progress (fetch cannot report upload progress). */
function putWithProgress(url, file, contentType, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", contentType);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`status ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("network"));
    xhr.send(file);
  });
}

function defaultLabel(fileName) {
  return fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 120);
}

export function UploadDocumentDialog({ ownerType, ownerId }) {
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setRound((r) => r + 1);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <UploadIcon /> Add document
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add document</DialogTitle>
          <DialogDescription>
            PDF, JPG, PNG or WEBP, up to {formatFileSize(MAX_DOCUMENT_BYTES)}. Documents are private: only staff with document access can open them.
          </DialogDescription>
        </DialogHeader>
        <UploadForm key={round} ownerType={ownerType} ownerId={ownerId} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function UploadForm({ ownerType, ownerId, onDone }) {
  const [file, setFile] = useState(null);
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState(DEFAULT_CATEGORY[ownerType] ?? "general");
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [stage, setStage] = useState(null); // null | "preparing" | number (percent) | "checking"
  const cameraRef = useRef(null);
  const fileRef = useRef(null);
  const busy = stage !== null;

  const pick = (f) => {
    if (!f) return;
    setErrors({});
    setFormError(null);
    if (!DOCUMENT_TYPES[f.type] || !DOCUMENT_TYPES[f.type].includes(extensionOf(f.name))) {
      setErrors({ file: "Only PDF, JPG, PNG or WEBP files can be added." });
      return;
    }
    setFile(f);
    if (!label) setLabel(defaultLabel(f.name));
  };

  const submit = async (e) => {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    if (!file) return setErrors({ file: "Choose a file or take a photo." });
    if (!label.trim()) return setErrors({ label: "Give the document a label." });

    try {
      setStage("preparing");
      const upload = await shrinkImage(file);
      if (upload.size > MAX_DOCUMENT_BYTES) {
        setStage(null);
        return setErrors({ file: `This file is ${formatFileSize(upload.size)}. The limit is ${formatFileSize(MAX_DOCUMENT_BYTES)}.` });
      }
      const started = await startUploadAction({
        ownerType,
        ownerId,
        category,
        label: label.trim(),
        fileName: upload.name,
        mimeType: upload.type,
        size: upload.size,
      });
      if (!started.ok) {
        setStage(null);
        setErrors(started.fieldErrors ?? {});
        return setFormError(started.error);
      }
      setStage(0);
      await putWithProgress(started.data.uploadUrl, upload, started.data.contentType, setStage);
      setStage("checking");
      const confirmed = await confirmUploadAction(started.data.documentId);
      if (!confirmed.ok) {
        setStage(null);
        return setFormError(confirmed.error);
      }
      toast.success("Document added", { description: label.trim() });
      onDone();
    } catch {
      setStage(null);
      setFormError("The upload failed. Check the internet connection and try again.");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormAlert>{formError}</FormAlert>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      <input ref={fileRef} type="file" accept={ACCEPT_ATTRIBUTE} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />

      {file ? (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
          <FileUpIcon className="size-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(file.size)}
              {file.type.startsWith("image/") && file.size > SHRINK_ABOVE_BYTES && " · will be made smaller before upload"}
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon-xs" aria-label="Choose another file" disabled={busy} onClick={() => setFile(null)}>
            <XIcon />
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" className="h-20 flex-col gap-1.5" onClick={() => cameraRef.current?.click()}>
            <CameraIcon className="size-5" />
            Take photo
          </Button>
          <Button type="button" variant="outline" className="h-20 flex-col gap-1.5" onClick={() => fileRef.current?.click()}>
            <FileUpIcon className="size-5" />
            Choose file
          </Button>
        </div>
      )}
      {errors.file && <p className="text-sm text-destructive">{errors.file}</p>}

      <SelectField name="category" label="Group" value={category} onValueChange={setCategory} options={DOCUMENT_CATEGORIES} error={errors.category} />
      <TextField
        name="label"
        label="Label"
        required
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="e.g. CNIC front, Agreement page 1, Security cheque"
        maxLength={120}
        error={errors.label}
      />

      {busy && (
        <div className="space-y-1.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${typeof stage === "number" ? stage : stage === "checking" ? 100 : 5}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {stage === "preparing" ? "Preparing…" : stage === "checking" ? "Checking the file…" : `Uploading… ${stage}%`}
          </p>
        </div>
      )}

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={busy}>
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={busy}>
          <UploadIcon /> {busy ? "Uploading…" : "Upload"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Reason dialog shared by "move to bin" and "erase permanently". */
function ReasonDialog({ trigger, title, description, action, submitLabel, destructive, confirmWord }) {
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setRound((r) => r + 1);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <ReasonForm key={round} action={action} submitLabel={submitLabel} destructive={destructive} confirmWord={confirmWord} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ReasonForm({ action, submitLabel, destructive, confirmWord, onDone }) {
  const [state, formAction] = useActionState(action, null);
  const [typed, setTyped] = useState("");
  useEffect(() => {
    if (state?.ok) {
      toast.success(submitLabel === "Move to bin" ? "Moved to the bin" : "Document erased");
      onDone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  const blocked = confirmWord && typed.trim().toUpperCase() !== confirmWord;
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormAlert>{state && !state.ok && !state.fieldErrors?.reason ? state.error : null}</FormAlert>
      <TextareaField name="reason" label="Reason" rows={2} required placeholder="e.g. Wrong customer, blurry photo, duplicate" error={state?.fieldErrors?.reason} />
      {confirmWord && (
        <TextField
          name="confirm"
          label={`Type ${confirmWord} to confirm`}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          inputClassName="font-mono uppercase"
        />
      )}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <SubmitButton variant={destructive ? "destructive" : "default"} disabled={blocked}>
          {submitLabel}
        </SubmitButton>
      </DialogFooter>
    </form>
  );
}

export function RemoveDocumentButton({ documentId, label }) {
  return (
    <ReasonDialog
      trigger={
        <Button variant="ghost" size="icon-xs" aria-label={`Remove ${label}`} className="text-muted-foreground hover:text-destructive">
          <Trash2Icon />
        </Button>
      }
      title="Move this document to the bin?"
      description={`“${label}” will be hidden from this record. It can be restored from the bin.`}
      action={removeDocumentAction.bind(null, documentId)}
      submitLabel="Move to bin"
    />
  );
}

export function EraseDocumentButton({ documentId, label }) {
  return (
    <ReasonDialog
      trigger={
        <Button variant="ghost" size="xs" className="text-destructive hover:text-destructive">
          <Trash2Icon /> Erase
        </Button>
      }
      title="Erase permanently?"
      description={`The file “${label}” will be deleted from storage and cannot be recovered. A note that it existed stays in the history.`}
      action={eraseDocumentAction.bind(null, documentId)}
      submitLabel="Erase permanently"
      destructive
      confirmWord="ERASE"
    />
  );
}

export function RestoreDocumentButton({ documentId }) {
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="ghost"
      size="xs"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const result = await restoreDocumentAction(documentId);
        setPending(false);
        if (result.ok) toast.success("Document restored");
        else toast.error(result.error);
      }}
    >
      <RotateCcwIcon /> Restore
    </Button>
  );
}
