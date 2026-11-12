import { ExternalLinkIcon, FolderLockIcon, Trash2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { can } from "@/server/permissions";
import { listDocuments } from "@/server/services/documents";
import { formatBusinessDate } from "@/lib/business-date";
import { EraseDocumentButton, RestoreDocumentButton, UploadDocumentDialog } from "./document-dialogs";
import { DocIcon, DocumentList } from "./document-viewer";

/**
 * Private documents on a customer, plan or bike. Renders nothing for staff without
 * "documents.view". Clicking a document opens it in a viewer on the same page; files load
 * through /api/documents/:id, which checks access every time.
 */
export async function DocumentsSection({ actor, ownerType, ownerId, className }) {
  if (!can(actor, "documents.view")) return null;
  const data = await listDocuments(actor, { ownerType, ownerId });
  // Dates are formatted here (business timezone) so the client shows the same text.
  const documents = data.documents.map((d) => ({ ...d, uploadedLabel: formatBusinessDate(d.uploadedAt) }));
  const { bin } = data;

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2 text-base">
            <FolderLockIcon className="size-4 text-muted-foreground" /> Documents
            {documents.length > 0 && <Badge variant="secondary">{documents.length}</Badge>}
          </CardTitle>
          <CardDescription>Private. Only staff with document access can open these.</CardDescription>
        </div>
        {data.canUpload && data.storageReady && <UploadDocumentDialog ownerType={ownerType} ownerId={ownerId} />}
      </CardHeader>
      <CardContent className="space-y-4">
        {!data.storageReady && (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Document storage is not set up yet, so files cannot be added. The Superadmin needs to add the storage settings.
          </p>
        )}

        {documents.length === 0
          ? data.storageReady && <p className="text-sm text-muted-foreground">No documents yet.</p>
          : <DocumentList documents={documents} canRemove={data.canRemove} />}

        {data.canRemove && bin.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                <Trash2Icon /> Bin ({bin.length})
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="mt-2 divide-y rounded-lg border border-dashed">
                {bin.map((d) => (
                  <li key={d.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <DocIcon doc={d} muted />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-muted-foreground line-through decoration-muted-foreground/40">{d.label}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          Removed {d.removedAt && formatBusinessDate(d.removedAt)}
                          {d.removedByName && ` by ${d.removedByName}`}
                          {d.removeReason && ` · “${d.removeReason}”`}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 self-end sm:self-auto">
                      <Button variant="ghost" size="xs" asChild>
                        <a href={`/api/documents/${d.id}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLinkIcon /> Open
                        </a>
                      </Button>
                      <RestoreDocumentButton documentId={d.id} />
                      <EraseDocumentButton documentId={d.id} label={d.label} />
                    </div>
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
