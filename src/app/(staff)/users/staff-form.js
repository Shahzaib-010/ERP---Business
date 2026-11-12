"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { SaveIcon, ShieldIcon, UserIcon, UserPlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FormAlert } from "@/components/app/form-alert";
import { TextField } from "@/components/app/form-fields";
import { SubmitButton } from "@/components/submit-button";
import { PERMISSION_GROUPS } from "@/lib/permissions-catalog";

const ROLE_HELP = {
  admin: "Admins can manage customers, bikes, plans, payments, documents and the cash book. They cannot manage staff accounts or system settings.",
  user: "A User can do only what is ticked below.",
};

// Permissions no role gets by default (e.g. removing documents); shown for Admins too.
const OPT_IN_GROUPS = PERMISSION_GROUPS.map((g) => ({ ...g, actions: g.actions.filter((a) => a.optIn) })).filter((g) => g.actions.length);

function PermissionCheck({ action, checked }) {
  return (
    <div className="flex items-start gap-2">
      <Checkbox id={`perm-${action.key}`} name="permissions" value={action.key} defaultChecked={checked} className="mt-0.5" />
      <Label htmlFor={`perm-${action.key}`} className="flex-col items-start gap-0.5 font-normal">
        {action.label}
        {action.optIn && <span className="text-xs text-muted-foreground">Sensitive — give only when needed</span>}
      </Label>
    </div>
  );
}

/**
 * Create (no `user`) or edit (with `user`) an Admin or User account.
 * `action` is a Server Action already bound to the account id when editing.
 */
export function StaffForm({ action, user }) {
  const isEdit = Boolean(user);
  const [state, formAction] = useActionState(action, null);
  const values = state?.values ?? user ?? {};
  const [role, setRole] = useState(values.role ?? "user");
  const errors = state?.fieldErrors ?? {};
  const granted = new Set(values.permissions ?? []);
  const formKey = state?.values ? JSON.stringify(state.values) : "initial";

  useEffect(() => {
    if (isEdit && state?.ok) toast.success("Changes saved");
  }, [state, isEdit]);

  return (
    <form key={formKey} action={formAction} className="flex flex-col gap-6" noValidate>
      <FormAlert>{state && !state.ok ? state.error : null}</FormAlert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserIcon className="size-4 text-primary" /> Account
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <TextField name="name" label="Full name" required defaultValue={values.name ?? ""} error={errors.name} />
          {isEdit ? (
            <TextField name="username-readonly" label="Username" value={user.username} disabled readOnly hint="Usernames cannot be changed." />
          ) : (
            <TextField
              name="username"
              label="Username"
              required
              defaultValue={values.username ?? ""}
              autoCapitalize="none"
              spellCheck={false}
              hint="Used to sign in. Cannot be changed later."
              error={errors.username}
              inputClassName="font-mono"
            />
          )}
          <Field data-invalid={errors.role ? true : undefined}>
            <FieldLabel htmlFor="role">Role</FieldLabel>
            <Select name="role" value={role} onValueChange={setRole}>
              <SelectTrigger id="role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User — only ticked permissions</SelectItem>
                <SelectItem value="admin">Admin — all daily business work</SelectItem>
              </SelectContent>
            </Select>
            {errors.role && <FieldError>{errors.role}</FieldError>}
          </Field>
          {!isEdit && (
            <TextField
              name="password"
              type="password"
              label="Starting password"
              required
              autoComplete="new-password"
              hint="At least 8 characters. Give it to the person privately."
              error={errors.password}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldIcon className="size-4 text-primary" /> Permissions
          </CardTitle>
          <CardDescription>{ROLE_HELP[role]}</CardDescription>
        </CardHeader>
        {role === "user" && (
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PERMISSION_GROUPS.map((group) => (
              <div key={group.module} className="rounded-lg border p-4">
                <p className="mb-3 text-sm font-medium">{group.label}</p>
                <div className="space-y-2.5">
                  {group.actions.map((a) => (
                    <PermissionCheck key={a.key} action={a} checked={granted.has(a.key)} />
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        )}
        {role === "admin" && OPT_IN_GROUPS.length > 0 && (
          <CardContent className="space-y-3">
            <p className="text-sm font-medium">Extra access</p>
            <p className="text-sm text-muted-foreground">Admins do not get these automatically. Tick them only for Admins who need them.</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {OPT_IN_GROUPS.map((group) => (
                <div key={group.module} className="rounded-lg border p-4">
                  <p className="mb-3 text-sm font-medium">{group.label}</p>
                  <div className="space-y-2.5">
                    {group.actions.map((a) => (
                      <PermissionCheck key={a.key} action={a} checked={granted.has(a.key)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {isEdit && (
        <Card>
          <CardContent className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="isActive" className="text-sm font-medium">
                Account active
              </Label>
              <p className="text-sm text-muted-foreground">Turning this off signs the person out at once.</p>
            </div>
            <Switch id="isActive" name="isActive" defaultChecked={values.isActive ?? true} />
          </CardContent>
        </Card>
      )}

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-col-reverse gap-2 border-t bg-background/90 px-4 py-3 backdrop-blur sm:mx-0 sm:flex-row sm:justify-end sm:rounded-xl sm:border">
        <Button variant="outline" asChild>
          <Link href="/users">Cancel</Link>
        </Button>
        <SubmitButton icon={isEdit ? SaveIcon : UserPlusIcon}>{isEdit ? "Save changes" : "Create account"}</SubmitButton>
      </div>
    </form>
  );
}
