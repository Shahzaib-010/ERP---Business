"use client";

import { useActionState, useState } from "react";
import { Alert, Field, Input, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { PERMISSION_GROUPS } from "@/lib/permissions-catalog";

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

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <Alert>{state && !state.ok ? state.error : null}</Alert>
      <Alert tone="success">{state?.ok ? "Saved." : null}</Alert>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" name="name" error={errors.name}>
          <Input name="name" defaultValue={values.name ?? ""} error={errors.name} />
        </Field>
        {isEdit ? (
          <Field label="Username" name="username-readonly">
            <Input name="username-readonly" value={user.username} disabled readOnly />
          </Field>
        ) : (
          <Field label="Username" name="username" error={errors.username} hint="Used to log in. Cannot be changed later.">
            <Input
              name="username"
              defaultValue={values.username ?? ""}
              autoCapitalize="none"
              spellCheck={false}
              error={errors.username}
            />
          </Field>
        )}
        <Field label="Role" name="role" error={errors.role}>
          <select
            id="role"
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={inputClass}
          >
            <option value="user">User (only the permissions ticked below)</option>
            <option value="admin">Admin (all daily business work)</option>
          </select>
        </Field>
        {!isEdit && (
          <Field label="Starting password" name="password" error={errors.password} hint="At least 8 characters. Give it to the person privately.">
            <Input name="password" type="password" autoComplete="new-password" error={errors.password} />
          </Field>
        )}
      </div>

      {role === "user" ? (
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Permissions</legend>
          <p className="text-xs text-slate-500">A User can do only what is ticked here.</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PERMISSION_GROUPS.map((group) => (
              <div key={group.module} className="rounded-lg border border-slate-200 p-3">
                <p className="mb-2 text-sm font-medium">{group.label}</p>
                {group.actions.map((a) => (
                  <label key={a.key} className="flex items-center gap-2 py-0.5 text-sm">
                    <input
                      type="checkbox"
                      name="permissions"
                      value={a.key}
                      defaultChecked={granted.has(a.key)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    {a.label}
                  </label>
                ))}
              </div>
            ))}
          </div>
        </fieldset>
      ) : (
        <p className="text-sm text-slate-600">
          Admins can manage customers, bikes, plans, payments and the cash book. They cannot
          manage staff accounts or system settings.
        </p>
      )}

      {isEdit && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={values.isActive ?? true}
            className="h-4 w-4 rounded border-slate-300"
          />
          Account active (unticking signs the person out at once)
        </label>
      )}

      <SubmitButton>{isEdit ? "Save changes" : "Create account"}</SubmitButton>
    </form>
  );
}
