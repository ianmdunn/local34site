/**
 * JotForm form schema utilities.
 *
 * Fetches form HTML and parses field structure – no API key required.
 */
import type { ActionEventItem } from '~/utils/directus-events';

const JOTFORM_HOST = 'https://unitehere.jotform.com';
const REQUEST_TIMEOUT_MS = 8000;
const POLL_ATTEMPTS = 3;
const POLL_DELAY_MS = 700;

export interface JotformOption {
  label: string;
  value: string;
  selected?: boolean;
}

export interface JotformSubField {
  name: string;
  label: string;
  required: boolean;
  placeholder?: string;
  defaultValue?: string;
  /** HTML autocomplete token for browser autofill; parsed from JotForm when present */
  autocomplete?: string;
}

export interface JotformField {
  qid: string;
  name: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'fullname' | 'address';
  required: boolean;
  hiddenByDefault?: boolean;
  placeholder?: string;
  helperText?: string;
  defaultValue?: string;
  defaultValues?: string[];
  options?: JotformOption[];
  subFields?: JotformSubField[];
  /** Phone mask from JotForm.setPhoneMaskingValidator – e.g. "(###) ###-####" */
  phoneMask?: string;
  /** HTML autocomplete token for browser autofill; parsed from JotForm when present */
  autocomplete?: string;
}

export interface JotformConditionTerm {
  field: string;
  operator: string;
  value?: string;
}

export interface JotformConditionAction {
  field: string;
  visibility: 'Show' | 'Hide';
}

export interface JotformCondition {
  link: 'Any' | 'All';
  terms: JotformConditionTerm[];
  actions: JotformConditionAction[];
}

export interface JotformSchema {
  action: string;
  hiddenFields: Array<{ name: string; value: string }>;
  fields: JotformField[];
  conditions: JotformCondition[];
}

type EventWithJotformSchema = ActionEventItem & { jotformSchema?: JotformSchema };

interface NormalizedJotformRef {
  id: string;
  host: string;
  key: string;
}

const decodeHtml = (text: string): string =>
  text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

const stripTags = (text: string): string => decodeHtml(text.replace(/<[^>]+>/g, ''));

const parseAttrs = (tag: string): Record<string, string> => {
  const attrs: Record<string, string> = {};
  const re = /([a-zA-Z0-9:_-]+)\s*=\s*"([^"]*)"/g;
  let match: RegExpExecArray | null = null;
  while ((match = re.exec(tag))) {
    attrs[match[1].toLowerCase()] = decodeHtml(match[2]);
  }
  return attrs;
};

const hasAttr = (tag: string, attr: string): boolean => {
  const re = new RegExp(`\\b${attr}(?:\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+))?\\b`, 'i');
  return re.test(tag);
};

const normalizeJotformRef = (value: string): NormalizedJotformRef | null => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    return { id: raw, host: JOTFORM_HOST, key: `${JOTFORM_HOST}|${raw}` };
  }
  const urlMatch = raw.match(/^https?:\/\/([^/]+)\/(.+)$/i);
  if (!urlMatch) return null;
  const host = `https://${urlMatch[1]}`;
  const path = urlMatch[2];
  const idMatch = path.match(/(?:^|\/)(?:form\/|submit\/)?(\d{6,})(?:\/|$)/i);
  if (!idMatch) return null;
  const id = idMatch[1];
  return { id, host, key: `${host}|${id}` };
};

const getLabelText = (blockHtml: string, questionId: string): string => {
  const labelMatch =
    blockHtml.match(new RegExp(`<label[^>]*id="label_${questionId}"[^>]*>([\\s\\S]*?)</label>`, 'i')) ??
    blockHtml.match(/<label[^>]*class="[^"]*form-label[^"]*"[^>]*>([\s\S]*?)<\/label>/i);
  return stripTags(labelMatch?.[1] || '');
};

const getHelperText = (blockHtml: string): string => {
  const helperMatch =
    blockHtml.match(/<(?:p|div|span)[^>]*class="[^"]*(?:form-description|form-sub-label)[^"]*"[^>]*>([\s\S]*?)<\/(?:p|div|span)>/i) ??
    blockHtml.match(/<(?:p|div|span)[^>]*id="[^"]*(?:_description|_sublabel)[^"]*"[^>]*>([\s\S]*?)<\/(?:p|div|span)>/i);
  return stripTags(helperMatch?.[1] || '');
};

const parseHiddenFields = (html: string): Array<{ name: string; value: string }> => {
  const hidden: Array<{ name: string; value: string }> = [];
  const tagRe = /<input\b[^>]*>/gi;
  let tagMatch: RegExpExecArray | null = null;
  while ((tagMatch = tagRe.exec(html))) {
    const tag = tagMatch[0];
    const attrs = parseAttrs(tag);
    if ((attrs.type || '').toLowerCase() !== 'hidden') continue;
    const name = attrs.name;
    if (!name) continue;
    hidden.push({ name, value: attrs.value || '' });
  }
  return hidden;
};

/**
 * Normalize hidden fields for JotForm source compatibility.
 * From JotForm source export: simple_spc must be "formId-formId" (script overwrites initial value).
 * Ensures formID and website (honeypot) are present.
 */
export function normalizeHiddenFieldsForSubmit(
  hiddenFields: Array<{ name: string; value: string }>,
  formId: string
): Array<{ name: string; value: string }> {
  const byName = new Map(hiddenFields.map((h) => [h.name.toLowerCase(), h]));
  const result = hiddenFields.map((h) => ({ ...h }));

  const set = (name: string, value: string) => {
    const key = name.toLowerCase();
    const existing = result.find((h) => h.name.toLowerCase() === key);
    if (existing) existing.value = value;
    else result.push({ name, value });
  };

  set('formID', formId);
  set('website', ''); // honeypot – must be empty
  set('simple_spc', `${formId}-${formId}`); // Source export: script sets this format

  return result;
}

const parseOptionsFromInputs = (blockHtml: string): JotformOption[] => {
  const options: JotformOption[] = [];
  const inputRe = /<input\b[^>]*>/gi;
  let inputMatch: RegExpExecArray | null = null;
  while ((inputMatch = inputRe.exec(blockHtml))) {
    const inputTag = inputMatch[0];
    const attrs = parseAttrs(inputTag);
    const id = attrs.id;
    const value = attrs.value || '';
    if (!id) continue;
    const labelMatch = blockHtml.match(new RegExp(`<label[^>]*for="${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>([\\s\\S]*?)</label>`, 'i'));
    const label = stripTags(labelMatch?.[1] || value);
    if (!label && !value) continue;
    options.push({ label, value, selected: hasAttr(inputTag, 'checked') });
  }
  return options;
};

const parseSelectOptions = (blockHtml: string): JotformOption[] => {
  const options: JotformOption[] = [];
  const optionRe = /<option\b[^>]*>([\s\S]*?)<\/option>/gi;
  let optionMatch: RegExpExecArray | null = null;
  while ((optionMatch = optionRe.exec(blockHtml))) {
    const optionTag = optionMatch[0];
    const attrs = parseAttrs(optionTag);
    const label = stripTags(optionMatch[1] || '');
    const value = attrs.value || label;
    if (!label && !value) continue;
    options.push({ label, value, selected: hasAttr(optionTag, 'selected') });
  }
  return options;
};

const decodeUnicodeEscapes = (s: string): string =>
  s.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

const parsePhoneMasks = (html: string): Map<string, string> => {
  const map = new Map<string, string>();
  const re = /setPhoneMaskingValidator\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/gi;
  let m: RegExpExecArray | null = null;
  while ((m = re.exec(html))) {
    map.set(m[1], decodeUnicodeEscapes(m[2]));
  }
  return map;
};

const parseConditions = (html: string): JotformCondition[] => {
  const setConditionsMatch = html.match(/JotForm\.setConditions\((\[[\s\S]*?\])\)\s*;/i);
  if (!setConditionsMatch?.[1]) return [];
  try {
    const raw = JSON.parse(setConditionsMatch[1]) as Array<Record<string, unknown>>;
    return raw
      .map((item): JotformCondition | null => {
        const termsRaw = Array.isArray(item.terms) ? item.terms : [];
        const itemAny = item as Record<string, unknown>;
        const actionsRaw = Array.isArray(itemAny.actions) ? itemAny.actions : Array.isArray(itemAny.action) ? itemAny.action : [];
        const link: JotformCondition['link'] = String(item.link || 'All').toLowerCase() === 'any' ? 'Any' : 'All';
        const terms = termsRaw
          .map((term): JotformConditionTerm => {
            const obj = term as Record<string, unknown>;
            return {
              field: String(obj.field || '').trim(),
              operator: String(obj.operator || '').trim(),
              value: String(obj.value || ''),
            };
          })
          .filter((term) => Boolean(term.field && term.operator));
        const actions = actionsRaw
          .map((action): JotformConditionAction => {
            const obj = action as Record<string, unknown>;
            const visibility: JotformConditionAction['visibility'] =
              String(obj.visibility || '').toLowerCase() === 'hide' ? 'Hide' : 'Show';
            return {
              field: String(obj.field || '').trim(),
              visibility,
            };
          })
          .filter((action) => Boolean(action.field));
        if (!terms.length || !actions.length) return null;
        return { link, terms, actions };
      })
      .filter((condition): condition is JotformCondition => !!condition);
  } catch {
    return [];
  }
};

const parseVisibleFields = (html: string, phoneMasks?: Map<string, string>): JotformField[] => {
  const fields: JotformField[] = [];
  const blockRe =
    /<li\b[^>]*class="[^"]*form-line[^"]*"[^>]*data-type="([^"]+)"[^>]*id="id_(\d+)"[^>]*>([\s\S]*?)<\/li>/gi;
  let blockMatch: RegExpExecArray | null = null;

  while ((blockMatch = blockRe.exec(html))) {
    const dataType = blockMatch[1];
    const questionId = blockMatch[2];
    const blockHtml = blockMatch[3];
    const openingTag = blockMatch[0].match(/^<li\b[^>]*>/i)?.[0] || '';
    const hiddenByDefault = /form-field-hidden|display\s*:\s*none/i.test(openingTag);
    const label = getLabelText(blockHtml, questionId);
    const helperText = getHelperText(blockHtml) || undefined;
    const required = /required=|form-required/i.test(blockHtml);

    if (dataType === 'control_button' || dataType === 'control_text' || dataType === 'control_hidden') continue;

    if (dataType === 'control_fullname') {
      const subFields: JotformSubField[] = [];
      const inputRe = /<input\b[^>]*>/gi;
      let inputMatch: RegExpExecArray | null = null;
      while ((inputMatch = inputRe.exec(blockHtml))) {
        const inputTag = inputMatch[0];
        const attrs = parseAttrs(inputTag);
        const name = attrs.name;
        if (!name || !/\[(first|last|middle|suffix)\]/i.test(name)) continue;
        const inputId = attrs.id || '';
        const subLabelMatch = inputId
          ? blockHtml.match(new RegExp(`<label[^>]*for="${inputId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>([\\s\\S]*?)</label>`, 'i'))
          : null;
        subFields.push({
          name,
          label: stripTags(subLabelMatch?.[1] || ''),
          required,
          placeholder: attrs.placeholder || '',
          defaultValue: attrs.value || '',
          ...(attrs.autocomplete && attrs.autocomplete !== 'off' && { autocomplete: attrs.autocomplete }),
        });
      }
      if (subFields.length) {
        fields.push({
          qid: questionId,
          name: `q${questionId}_fullname`,
          label: label || 'Name',
          type: 'fullname',
          required,
          hiddenByDefault,
          helperText,
          subFields,
        });
      }
      continue;
    }

    if (dataType === 'control_radio' || dataType === 'control_checkbox') {
      const nameMatch = blockHtml.match(/<input\b[^>]*name="([^"]+)"[^>]*>/i);
      const name = decodeHtml(nameMatch?.[1] || '');
      if (!name) continue;
      fields.push({
        qid: questionId,
        name,
        label: label || 'Select one',
        type: dataType === 'control_radio' ? 'radio' : 'checkbox',
        required,
        hiddenByDefault,
        helperText,
        defaultValues: parseOptionsFromInputs(blockHtml)
          .filter((option) => option.selected)
          .map((option) => option.value),
        options: parseOptionsFromInputs(blockHtml),
      });
      continue;
    }

    if (dataType === 'control_address') {
      const subFields: JotformSubField[] = [];
      const inputRe = /<input\b[^>]*>/gi;
      let inputMatch: RegExpExecArray | null = null;
      while ((inputMatch = inputRe.exec(blockHtml))) {
        const inputTag = inputMatch[0];
        const attrs = parseAttrs(inputTag);
        const name = attrs.name;
        if (!name || !/\[(addr_line1|addr_line2|addr_line_1|addr_line_2|city|state|postal|zip|country)\]/i.test(name)) continue;
        const inputId = attrs.id || '';
        const subLabelMatch = inputId
          ? blockHtml.match(new RegExp(`<label[^>]*for="${inputId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>([\\s\\S]*?)</label>`, 'i'))
          : null;
        subFields.push({
          name,
          label: stripTags(subLabelMatch?.[1] || ''),
          required,
          placeholder: attrs.placeholder || '',
          defaultValue: attrs.value || '',
          ...(attrs.autocomplete && attrs.autocomplete !== 'off' && { autocomplete: attrs.autocomplete }),
        });
      }
      if (subFields.length) {
        const nameMatch = blockHtml.match(/<input\b[^>]*name="([^"]+)"[^>]*>/i);
        const baseName = decodeHtml(nameMatch?.[1] || '').replace(/\[\w+\]$/, '') || `q${questionId}_address`;
        fields.push({
          qid: questionId,
          name: baseName,
          label: label || 'Address',
          type: 'address',
          required,
          hiddenByDefault,
          helperText,
          subFields,
        });
      }
      continue;
    }

    if (dataType === 'control_dropdown') {
      const selectTag = blockHtml.match(/<select\b[^>]*>/i)?.[0] || '';
      const attrs = parseAttrs(selectTag);
      if (!attrs.name) continue;
      fields.push({
        qid: questionId,
        name: attrs.name,
        label: label || 'Select one',
        type: 'select',
        required,
        hiddenByDefault,
        helperText,
        options: parseSelectOptions(blockHtml),
        defaultValue: parseSelectOptions(blockHtml).find((option) => option.selected)?.value || '',
        ...(attrs.autocomplete && attrs.autocomplete !== 'off' && { autocomplete: attrs.autocomplete }),
      });
      continue;
    }

    if (dataType === 'control_textarea') {
      const textareaTag = blockHtml.match(/<textarea\b[^>]*>/i)?.[0] || '';
      const attrs = parseAttrs(textareaTag);
      if (!attrs.name) continue;
      fields.push({
        qid: questionId,
        name: attrs.name,
        label: label || 'Message',
        type: 'textarea',
        required,
        hiddenByDefault,
        helperText,
        defaultValue: decodeHtml(blockHtml.match(/<textarea\b[^>]*>([\s\S]*?)<\/textarea>/i)?.[1] || ''),
        placeholder: attrs.placeholder || '',
        ...(attrs.autocomplete && attrs.autocomplete !== 'off' && { autocomplete: attrs.autocomplete }),
      });
      continue;
    }

    if (dataType === 'control_email' || dataType === 'control_phone' || dataType === 'control_textbox') {
      const inputTag = blockHtml.match(/<input\b[^>]*>/i)?.[0] || '';
      const attrs = parseAttrs(inputTag);
      if (!attrs.name) continue;
      const guessedType =
        dataType === 'control_email'
          ? 'email'
          : dataType === 'control_phone'
            ? 'tel'
            : (attrs.type || 'text').toLowerCase() === 'email'
              ? 'email'
              : 'text';
      const phoneMask = dataType === 'control_phone' && attrs.id && phoneMasks?.get(attrs.id);
      fields.push({
        qid: questionId,
        name: attrs.name,
        label: label || 'Field',
        type: guessedType as JotformField['type'],
        required,
        hiddenByDefault,
        helperText,
        defaultValue: attrs.value || '',
        placeholder: attrs.placeholder || '',
        ...(phoneMask && { phoneMask }),
        ...(attrs.autocomplete && attrs.autocomplete !== 'off' && { autocomplete: attrs.autocomplete }),
      });
    }
  }

  return fields;
};

export async function fetchJotformSchema(jotformId: string): Promise<JotformSchema | null> {
  const ref = normalizeJotformRef(jotformId);
  if (!ref) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${ref.host}/${ref.id}`, {
      headers: { Accept: 'text/html' },
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const html = await response.text();
    const formTag = html.match(/<form\b[^>]*class="[^"]*jotform-form[^"]*"[^>]*>/i)?.[0] || '';
    const action = parseAttrs(formTag).action || `${ref.host}/submit/${ref.id}`;
    const rawHidden = parseHiddenFields(html);
    const hiddenFields = normalizeHiddenFieldsForSubmit(rawHidden, ref.id);
    const phoneMasks = parsePhoneMasks(html);
    const fields = parseVisibleFields(html, phoneMasks);
    const conditions = parseConditions(html);

    if (!fields.length) return null;
    return { action, hiddenFields, fields, conditions };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Standard autofill tokens – Safari and others match on these; section prefixes can break autofill */
const STANDARD_AUTOFILL_TOKENS = new Set([
  'given-name', 'family-name', 'additional-name', 'name', 'honorific-prefix', 'honorific-suffix',
  'email', 'tel', 'tel-country-code', 'tel-national', 'tel-area-code', 'tel-local', 'tel-extension',
  'street-address', 'address-line1', 'address-line2', 'address-level1', 'address-level2', 'address-level3', 'address-level4',
  'postal-code', 'country-name', 'country',
  'organization', 'organization-title', 'off', 'on'
]);

/** Strip section-* prefix from JotForm autocomplete; Safari needs plain tokens like "given-name" not "section-input_3 given-name" */
function normalizeAutocompleteForAutofill(value: string): string {
  const trimmed = String(value || '').trim();
  if (!trimmed) return 'on';
  const parts = trimmed.split(/\s+/);
  for (const p of parts) {
    if (p.toLowerCase().startsWith('section-')) continue;
    if (p === 'off') return 'off';
    if (STANDARD_AUTOFILL_TOKENS.has(p)) return p;
    if (/^address-|^tel-|^cc-/.test(p)) return p;
  }
  return 'on';
}

/**
 * Infer HTML autocomplete token for a JotForm field. Use when schema does not provide autocomplete.
 * Enables browser autofill for name, email, tel, address, etc.
 */
export function getAutocompleteForField(field: JotformField): string {
  if (field.type === 'email') return 'email';
  if (field.type === 'tel') return 'tel'; // Safari prefers plain "tel" over "tel-national"
  if (field.autocomplete) return normalizeAutocompleteForAutofill(field.autocomplete);
  const s = `${(field.name || '')} ${(field.label || '')}`.toLowerCase();
  if (/\b(organization|org|company|department|dept)\b/.test(s)) return 'organization';
  if (/\b(name|full name|fullname)\b/.test(s)) return 'name';
  return 'on';
}

/**
 * Infer HTML autocomplete token for fullname/address subfields. Use when subField does not provide autocomplete.
 * Maps JotForm names (e.g. q5_fullname[first], q7_address[addr_line1]) to standard tokens.
 */
export function getAutocompleteForSubfield(subField: JotformSubField): string {
  if (subField.autocomplete) return normalizeAutocompleteForAutofill(subField.autocomplete);
  const n = String(subField.name || '').toLowerCase();
  if (/first|given/.test(n)) return 'given-name';
  if (/last|family|surname/.test(n)) return 'family-name';
  if (/middle|additional/.test(n)) return 'additional-name';
  if (/addr_line1|addr_line_1|street/.test(n)) return 'address-line1';
  if (/addr_line2|addr_line_2/.test(n)) return 'address-line2';
  if (/city/.test(n)) return 'address-level2';
  if (/state/.test(n)) return 'address-level1';
  if (/postal|zip/.test(n)) return 'postal-code';
  if (/country/.test(n)) return 'country-name';
  return 'on';
}

async function pollJotformSchema(jotformId: string): Promise<JotformSchema | null> {
  for (let attempt = 1; attempt <= POLL_ATTEMPTS; attempt += 1) {
    const schema = await fetchJotformSchema(jotformId);
    if (schema) return schema;
    if (attempt < POLL_ATTEMPTS) await sleep(POLL_DELAY_MS);
  }
  return null;
}

export async function hydrateEventsWithJotformSchemas(events: ActionEventItem[]): Promise<EventWithJotformSchema[]> {
  if (!Array.isArray(events) || !events.length) return [];

  const schemaByRef = new Map<string, JotformSchema | null>();
  const refs = Array.from(
    new Map(
      events
        .map((event) => normalizeJotformRef(String(event.jotformId || '').trim()))
        .filter((ref): ref is NormalizedJotformRef => !!ref)
        .map((ref) => [ref.key, ref] as const)
    ).values()
  );

  const polled = await Promise.all(
    refs.map(async (ref) => [ref.key, await pollJotformSchema(`${ref.host}/${ref.id}`)] as const)
  );
  for (const [key, schema] of polled) schemaByRef.set(key, schema);

  return events.map((event) => {
    const ref = normalizeJotformRef(String(event.jotformId || '').trim());
    const jotformSchema = ref ? schemaByRef.get(ref.key) || undefined : undefined;
    return { ...event, jotformSchema };
  });
}
