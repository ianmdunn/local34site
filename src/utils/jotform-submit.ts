/**
 * JotForm submit payload utilities.
 *
 * Builds source-compatible payloads based on JotForm export patterns.
 * Used by proxy and for validation. Keeps our form ingestion logic
 * consistent with JotForm's expected submit structure.
 */
import { normalizeHiddenFieldsForSubmit } from './jotform';
import type { JotformSchema } from './jotform';

/**
 * Extract form ID from JotForm action URL.
 */
export function parseFormIdFromAction(actionUrl: string): string | null {
  if (!actionUrl || typeof actionUrl !== 'string') return null;
  const m = actionUrl.match(/\/(?:submit|form)\/(\d{6,})(?:\?|$)/i);
  return m ? m[1] : null;
}

/**
 * Build a JotForm-compatible form body from form data and schema.
 * Applies source export patterns: simple_spc = formId-formId, required hidden fields.
 */
export function buildJotformPayload(
  formId: string,
  schema: JotformSchema,
  formData: Record<string, string | string[]>
): string {
  const params = new URLSearchParams();
  const normalizedHidden = normalizeHiddenFieldsForSubmit(schema.hiddenFields, formId);

  for (const { name, value } of normalizedHidden) {
    params.set(name, value);
  }

  const append = (name: string, value: string | string[]) => {
    if (Array.isArray(value)) {
      for (const v of value) params.append(name, v);
    } else {
      params.set(name, String(value ?? ''));
    }
  };

  for (const [name, value] of Object.entries(formData)) {
    if (name && value !== undefined && value !== null) append(name, value);
  }

  if (!params.has('formID')) params.set('formID', formId);
  if (!params.has('simple_spc')) params.set('simple_spc', `${formId}-${formId}`);
  if (!params.has('website')) params.set('website', '');

  return params.toString();
}
