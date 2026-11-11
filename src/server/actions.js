import "server-only";
import { unstable_rethrow } from "next/navigation";
import { AppError } from "@/server/errors";

/**
 * Wraps the body of a Server Action so forms get a plain result object:
 *   { ok: true, data } or { ok: false, error, fieldErrors }
 * Expected errors (AppError) show their message. Anything else is logged and hidden.
 * redirect() and notFound() still work inside `fn`.
 */
export async function runAction(fn) {
  try {
    const data = await fn();
    return { ok: true, data: data ?? null };
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof AppError) {
      return { ok: false, error: err.message, fieldErrors: err.fieldErrors ?? {} };
    }
    // Log the type and message only: error objects can carry request data.
    console.error("[action] unexpected error:", err?.name, err?.message);
    return { ok: false, error: "Something went wrong. Please try again.", fieldErrors: {} };
  }
}

/** FormData -> plain object. Repeated keys (checkbox groups) become arrays when listed. */
export function formToObject(formData, { arrays = [], booleans = [] } = {}) {
  const out = {};
  for (const key of new Set(formData.keys())) {
    if (key.startsWith("$ACTION")) continue;
    out[key] = arrays.includes(key) ? formData.getAll(key).map(String) : String(formData.get(key));
  }
  for (const key of arrays) out[key] ??= [];
  for (const key of booleans) out[key] = formData.get(key) === "on" || formData.get(key) === "true";
  return out;
}

/**
 * FormData -> nested object. "schedule.frequency" -> { schedule: { frequency } } and
 * "guarantors.0.name" -> { guarantors: [{ name }] }. Field names match the dotted keys that
 * validation errors use, so errors land on the right inputs.
 */
export function formToNestedObject(formData) {
  const out = {};
  for (const [key, raw] of formData.entries()) {
    if (key.startsWith("$ACTION")) continue;
    const parts = key.split(".");
    let node = out;
    parts.forEach((part, i) => {
      const last = i === parts.length - 1;
      const nextIsIndex = !last && /^\d+$/.test(parts[i + 1]);
      if (last) node[part] = String(raw);
      else node = node[part] ??= nextIsIndex ? [] : {};
    });
  }
  // Drop holes left by removed rows (e.g. guarantors.0 and guarantors.2).
  const compact = (v) => (Array.isArray(v) ? v.filter((x) => x != null).map(compact) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, compact(x)])) : v);
  return compact(out);
}
