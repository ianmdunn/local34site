import { useState, useEffect, useMemo } from 'react';
import { sanitizeHtml } from '~/utils/sanitize';
import './ActionCenter.css';
import { getAutocompleteForField, getAutocompleteForSubfield } from '~/utils/jotform';

const DEFAULT_ZOOM_BASE = '/zoom-backgrounds';

function tabFromHash() {
  const hash = typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
  const lower = hash.toLowerCase();
  return lower === 'events' || lower.startsWith('event-') ? 'events' : 'tools';
}

function eventSlugFromHash() {
  const hash = typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
  if (!hash.toLowerCase().startsWith('event-')) return null;
  try {
    return decodeURIComponent(hash.slice(6)).trim() || null;
  } catch {
    return hash.slice(6).trim() || null;
  }
}

const url = (base, filename) => `${base || DEFAULT_ZOOM_BASE}/${encodeURIComponent(filename)}`;

const hasHtmlTag = (text) => /<\/?[a-z][\s\S]*>/i.test(String(text || ''));

const escapeHtml = (text) =>
  String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Sanitize event body HTML from Directus. Uses DOMPurify for XSS safety. */
const toEventHtml = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  // WYSIWYG HTML from Directus: sanitize then render.
  if (hasHtmlTag(raw)) {
    return sanitizeHtml(raw);
  }

  // Fallback for plain text values.
  return `<p>${escapeHtml(raw).replace(/\r\n/g, '\n').replace(/\n/g, '<br />')}</p>`;
};

const plainTextLength = (value) =>
  String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim().length;

const isExternalUrl = (value) => /^https?:\/\/\S+$/i.test(String(value || '').trim());

const ZOOM_SECTIONS = [
  {
    title: "We Can't Keep Up",
    images: [
      { file: "Zoom Background - We Can't Keep Up.jpg", label: 'Standard' },
      { file: "Zoom Background - We Can't Keep Up - Image.jpg", label: 'With image' },
      { file: "Zoom Background - We Can't Keep Up - Grid.jpg", label: 'Grid' },
      { file: "Zoom Background - We Can't Keep Up - Button.jpg", label: 'Button' },
      { file: "Zoom Background - We Can't Keep Up - Button Only.jpg", label: 'Button only' },
    ],
  },
  {
    title: 'Union Strong',
    images: [
      { file: 'Zoom Background - Union Strong.jpg', label: 'Standard' },
      { file: 'Zoom Background - Union Strong - Image.jpg', label: 'With image' },
      { file: 'Zoom Background - Union Strong - Grid.jpg', label: 'Grid' },
      { file: 'Zoom Background - Union Strong - Button.jpg', label: 'Button' },
      { file: 'Zoom Background - Union Strong - Button Only.jpg', label: 'Button only' },
    ],
  },
  {
    title: "We're Worth It",
    images: [
      { file: 'Zoom Background - We\u2019re Worth It!.jpg', label: 'Standard' },
      { file: "Zoom Background - We're Worth It - Image.jpg", label: 'With image' },
      { file: "Zoom Background - We're Worth It - Grid.jpg", label: 'Grid' },
      { file: "Zoom Background - We're Worth It - Button.jpg", label: 'Button' },
      { file: "Zoom Background - We're Worth It - Button Only.jpg", label: 'Button only' },
    ],
  },
  {
    title: 'United for a Great Contract',
    images: [
      { file: 'Zoom Background - United for a Great Contract.jpg', label: 'Standard' },
      { file: 'Zoom Background - United for a Great Contract - Image.jpg', label: 'With image' },
      { file: 'Zoom Background - United for a Great Contract - Grid.jpg', label: 'Grid' },
    ],
  },
  {
    title: 'Yale Can Afford It',
    images: [
      { file: 'Zoom Background - Yale Can Afford It - Image.jpg', label: 'With image' },
      { file: 'Zoom Background - Yale Can Afford It - Grid.jpg', label: 'Grid' },
    ],
  },
];

const PROFILE_IMAGES = [
  { file: "We're Worth It Profile Image.jpg", label: "We're Worth It" },
  { file: 'Union Strong Profile Image.jpg', label: 'Union Strong' },
  { file: "We Can't Keep Up Profile Image.jpg", label: "We Can't Keep Up" },
];

const ActionCenter = ({ zoomBase = DEFAULT_ZOOM_BASE, upcomingEvents, layout = 'tabs' }) => {
  const isUnified = layout === 'unified';
  const [activeTab, setActiveTab] = useState(() =>
    typeof window !== 'undefined' ? tabFromHash() : 'tools'
  );
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [rsvpEventSlug, setRsvpEventSlug] = useState(null);
  const [submittedEventSlugs, setSubmittedEventSlugs] = useState([]);
  const [submittingSlug, setSubmittingSlug] = useState(null);
  const [formValuesBySlug, setFormValuesBySlug] = useState({});
  const [expandedTextBySlug, setExpandedTextBySlug] = useState({});
  const [isBannerImageBySlug, setIsBannerImageBySlug] = useState({});
  const base = zoomBase ?? DEFAULT_ZOOM_BASE;
  const directusEvents = Array.isArray(upcomingEvents) ? upcomingEvents : [];
  const events = useMemo(
    () =>
      [...directusEvents].sort((a, b) => {
        const aTime = a.sortDate ? Date.parse(a.sortDate) : Number.NaN;
        const bTime = b.sortDate ? Date.parse(b.sortDate) : Number.NaN;
        if (!Number.isNaN(aTime) && !Number.isNaN(bTime)) return aTime - bTime;
        if (!Number.isNaN(aTime)) return -1;
        if (!Number.isNaN(bTime)) return 1;
        return 0;
      }),
    [directusEvents]
  );

  const eventShareUrl = (event) => {
    const raw = typeof event.eventUrl === 'string' ? event.eventUrl.trim() : '';
    if (raw && /^https?:\/\//i.test(raw)) return raw;
    if (raw && typeof window !== 'undefined') {
      if (raw.startsWith('/')) return `${window.location.origin}${raw}`;
      return `${window.location.origin}/${raw.replace(/^\/+/, '')}`;
    }
    if (typeof window !== 'undefined') return `${window.location.origin}${window.location.pathname}#event-${event.slug}`;
    return `/actions#event-${event.slug}`;
  };

  const shareEvent = async (event) => {
    const shareUrl = eventShareUrl(event);
    const shareTitle = event.title || 'Event';
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({
          title: shareTitle,
          text: shareTitle,
          url: shareUrl,
        });
        return;
      }
    } catch {
      // If user cancels share sheet or sharing fails, fall back below.
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        return;
      }
    } catch {
      // Final fallback is opening the URL.
    }

    if (typeof window !== 'undefined') window.open(shareUrl, '_blank', 'noopener,noreferrer');
  };

  const markImageKind = (eventSlug, imageElement) => {
    const width = Number(imageElement?.naturalWidth || 0);
    const height = Number(imageElement?.naturalHeight || 0);
    if (!width || !height) return;
    const isBanner = width / height >= 1.6;
    setIsBannerImageBySlug((prev) => (prev[eventSlug] === isBanner ? prev : { ...prev, [eventSlug]: isBanner }));
  };

  function scrollToEvent() {
    const slug = eventSlugFromHash();
    if (!slug) return;
    const attemptScroll = () => {
      const el = document.getElementById(`event-${slug}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return true;
      }
      return false;
    };
    if (attemptScroll()) return;
    requestAnimationFrame(() => {
      if (!attemptScroll()) {
        requestAnimationFrame(attemptScroll);
      }
    });
  }

  useEffect(() => {
    const syncFromHash = () => setActiveTab(tabFromHash());
    const handleHashChange = () => {
      syncFromHash();
      setTimeout(scrollToEvent, 0);
      const slug = eventSlugFromHash();
      if (slug && events.some((e) => e.slug === slug)) {
        setExpandedTextBySlug((prev) => ({ ...prev, [slug]: true }));
      }
    };
    syncFromHash();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [events]);

  useEffect(() => {
    if (activeTab !== 'events') return;
    setTimeout(scrollToEvent, 0);
    const slug = eventSlugFromHash();
    if (slug && events.some((e) => e.slug === slug)) {
      setExpandedTextBySlug((prev) => ({ ...prev, [slug]: true }));
    }
  }, [activeTab, events]);

  const handleJotformSubmit = async (e, eventSlug, eventTitle = '') => {
    e.preventDefault();
    const form = e.target;
    if (!form || !form.action) return;
    setSubmittingSlug(eventSlug);
    try {
      const formData = new FormData(form);
      const body = new URLSearchParams(formData).toString();
      const res = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (res.ok) {
        setSubmittedEventSlugs((prev) => (prev.includes(eventSlug) ? prev : [...prev, eventSlug]));
        setRsvpEventSlug(null);
      } else {
        throw new Error('Submit failed');
      }
    } catch (err) {
      if (typeof window.__trackEvent === 'function') {
        window.__trackEvent('rsvp_submit_failed', {
          event_slug: eventSlug,
          event_name: eventTitle,
          error: err?.message || 'unknown',
        });
      }
      const webhookUrl = import.meta.env.PUBLIC_RSVP_ERROR_WEBHOOK_URL;
      if (typeof webhookUrl === 'string' && webhookUrl.trim()) {
        fetch(webhookUrl.trim(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'rsvp_submit_failed',
            event_slug: eventSlug,
            event_name: eventTitle,
            url: typeof window !== 'undefined' ? window.location.href : '',
            timestamp: new Date().toISOString(),
          }),
        }).catch(() => {});
      }
      alert('Your RSVP could not be submitted. Please check your connection and try again.');
    } finally {
      setSubmittingSlug(null);
    }
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    const hash = tab === 'events' ? '#events' : '';
    const url = hash ? `${window.location.pathname}${hash}` : window.location.pathname;
    window.history.replaceState(null, '', url);
    if (typeof window.__trackEvent === 'function') window.__trackEvent('actions_tab_switch', { tab });
  };

  const forceDownload = (filename, downloadName, assetType = 'zoom', sectionTitle = '', label = '') => {
    const link = document.createElement('a');
    link.href = url(base, filename);
    link.download = downloadName || filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (typeof window.__trackEvent === 'function') {
      window.__trackEvent(assetType === 'profile' ? 'actions_profile_download' : 'actions_zoom_download', {
        file_name: filename,
        asset_type: assetType,
        section_title: sectionTitle || undefined,
        image_label: label || undefined,
      });
    }
  };

  const toIdToken = (value = '') =>
    String(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const fieldInputType = (fieldType) => {
    if (fieldType === 'email') return 'email';
    if (fieldType === 'tel') return 'tel';
    return 'text';
  };

  const buildFieldId = (eventSlug, fieldName, suffix = '') => {
    const base = `l34-rsvp-${toIdToken(eventSlug)}-${toIdToken(fieldName)}`;
    return suffix ? `${base}-${toIdToken(suffix)}` : base;
  };

  const defaultFieldValue = (field) => {
    if (field.type === 'checkbox') return Array.isArray(field.defaultValues) ? field.defaultValues : [];
    if (field.type === 'radio') return Array.isArray(field.defaultValues) ? field.defaultValues[0] || '' : '';
    return field.defaultValue || '';
  };

  const getFieldByQid = (event, qid) => {
    const schemaFields = event.jotformSchema?.fields || [];
    const qidStr = String(qid || '').trim();
    let field = schemaFields.find((f) => String(f.qid) === qidStr || f.name === qidStr);
    if (!field && /^q\d+/.test(qidStr)) {
      const num = qidStr.replace(/^q(\d+).*$/, '$1');
      field = schemaFields.find((f) => String(f.qid) === num);
    }
    return field || null;
  };

  const valueForQid = (event, qid) => {
    const schemaFields = event.jotformSchema?.fields || [];
    const qidStr = String(qid || '').trim();
    let targetField = schemaFields.find((field) => String(field.qid) === qidStr || field.name === qidStr);
    if (!targetField && /^q\d+/.test(qidStr)) {
      const num = qidStr.replace(/^q(\d+).*$/, '$1');
      targetField = schemaFields.find((field) => String(field.qid) === num);
    }
    if (!targetField) return '';
    // Fullname and address fields store values under subField.name (e.g. q5_fullname[first], q7_address[addr_line1])
    if (
      (targetField.type === 'fullname' || targetField.type === 'address') &&
      Array.isArray(targetField.subFields) &&
      targetField.subFields.length
    ) {
      const parts = targetField.subFields.map((sub) => {
        const v = formValuesBySlug[event.slug]?.[sub.name];
        return v !== undefined ? String(v || '').trim() : String(sub.defaultValue || '').trim();
      });
      return parts.join(' ').trim();
    }
    const stateValue = formValuesBySlug[event.slug]?.[targetField.name];
    return stateValue === undefined ? defaultFieldValue(targetField) : stateValue;
  };

  const matchesConditionTerm = (value, operator, compareValue = '', field = null) => {
    const normalizedOperator = String(operator || '').toLowerCase();
    const asArray = Array.isArray(value) ? value : [value];
    const joined = asArray.map((item) => String(item || '').trim()).join(' ').trim();
    const compare = String(compareValue || '').trim();
    // JotForm conditions often use option LABEL (e.g. "In Person") while our input value may be different (e.g. "0")
    const effectiveValues = [...new Set([joined, ...asArray.map(String)])];
    if (field && (field.type === 'radio' || field.type === 'select') && Array.isArray(field.options)) {
      const selectedVal = Array.isArray(value) ? value[0] : value;
      const selectedOption = field.options.find(
        (o) => String(o.value || '').trim() === String(selectedVal || '').trim()
      );
      if (selectedOption?.label) effectiveValues.push(String(selectedOption.label).trim());
    }
    if (field && field.type === 'checkbox' && Array.isArray(field.options) && Array.isArray(value)) {
      for (const v of value) {
        const opt = field.options.find((o) => String(o.value || '').trim() === String(v || '').trim());
        if (opt?.label) effectiveValues.push(String(opt.label).trim());
      }
    }
    const compareLower = compare.toLowerCase();
    const anyMatches = (pred) => effectiveValues.some((v) => pred(String(v || '').trim()));
    const allMatch = (pred) => effectiveValues.every((v) => pred(String(v || '').trim()));
    if (normalizedOperator === 'isfilled') return joined.length > 0;
    if (normalizedOperator === 'isnotfilled' || normalizedOperator === 'isempty') return joined.length === 0;
    if (normalizedOperator === 'equals' || normalizedOperator === 'is')
      return anyMatches((v) => v === compare || v.toLowerCase() === compareLower);
    if (normalizedOperator === 'notequals' || normalizedOperator === 'isnot')
      return allMatch((v) => v !== compare && v.toLowerCase() !== compareLower);
    if (normalizedOperator === 'contains')
      return anyMatches((v) => v.toLowerCase().includes(compareLower));
    if (normalizedOperator === 'doesnotcontain')
      return allMatch((v) => !v.toLowerCase().includes(compareLower));
    return false;
  };

  const fieldIdsMatch = (a, b) => {
    const x = String(a || '').trim();
    const y = String(b || '').trim();
    if (x === y) return true;
    const numX = x.replace(/^q(\d+).*$/, '$1');
    const numY = y.replace(/^q(\d+).*$/, '$1');
    return numX && numY && numX === numY;
  };

  const isJotformFieldVisible = (event, field) => {
    const conditions = event.jotformSchema?.conditions || [];
    let visible = !field.hiddenByDefault;
    const relevant = conditions.filter((condition) =>
      (condition.actions || []).some((action) => fieldIdsMatch(action.field, field.qid))
    );
    for (const condition of relevant) {
      const terms = Array.isArray(condition.terms) ? condition.terms : [];
      const matches =
        (condition.link || 'All') === 'Any'
          ? terms.some((term) =>
              matchesConditionTerm(
                valueForQid(event, term.field),
                term.operator,
                term.value,
                getFieldByQid(event, term.field)
              )
            )
          : terms.every((term) =>
              matchesConditionTerm(
                valueForQid(event, term.field),
                term.operator,
                term.value,
                getFieldByQid(event, term.field)
              )
            );
      if (!matches) continue;
      const actions = (condition.actions || []).filter((action) => fieldIdsMatch(action.field, field.qid));
      for (const action of actions) {
        if (action.visibility === 'Hide') visible = false;
        if (action.visibility === 'Show') visible = true;
      }
    }
    return visible;
  };

  const onDynamicFormChange = (eventSlug, target) => {
    const fieldName = String(target?.name || '').trim();
    if (!fieldName) return;
    setFormValuesBySlug((prev) => {
      const current = { ...(prev[eventSlug] || {}) };
      if (target.type === 'checkbox') {
        const existing = Array.isArray(current[fieldName]) ? current[fieldName] : [];
        if (target.checked) {
          current[fieldName] = Array.from(new Set([...existing, target.value]));
        } else {
          current[fieldName] = existing.filter((value) => value !== target.value);
        }
      } else {
        current[fieldName] = target.value;
      }
      return { ...prev, [eventSlug]: current };
    });
  };

  const renderJotformField = (event, field, index) => {
    // JotForm labels often include " *" for required fields; strip to avoid double asterisks
    const labelText = (String(field.label || 'Field').replace(/\s*\*+\s*$/, '').trim()) || 'Field';
    const helperText = field.helperText || '';

    if (
      (field.type === 'fullname' || field.type === 'address') &&
      Array.isArray(field.subFields) &&
      field.subFields.length
    ) {
      return (
        <div key={`${event.slug}-${field.name}-${index}`} className="l34-dynamic-field">
          <label className="l34-label">{labelText}{field.required ? ' *' : ''}</label>
          {helperText ? <small className="l34-field-helper">{helperText}</small> : null}
          <div className="l34-form-row">
            {field.subFields.map((subField, subIndex) => {
              const inputId = buildFieldId(event.slug, subField.name, `${index}-${subIndex}`);
              const subLabel = subField.label || `Part ${subIndex + 1}`;
              const autoComplete = getAutocompleteForSubfield(subField);
              return (
                <div key={`${subField.name}-${subIndex}`} className={field.type === 'address' ? 'l34-address-part' : 'l34-name-part'}>
                  <label htmlFor={inputId} className="sr-only">
                    {subLabel}
                  </label>
                  <input
                    id={inputId}
                    type="text"
                    name={subField.name}
                    placeholder={subField.placeholder || subLabel}
                    required={Boolean(subField.required)}
                    className="l34-input"
                    autoComplete={autoComplete}
                    aria-label={subLabel}
                    defaultValue={subField.defaultValue || ''}
                  />
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if ((field.type === 'radio' || field.type === 'checkbox') && Array.isArray(field.options) && field.options.length) {
      return (
        <fieldset key={`${event.slug}-${field.name}-${index}`} className="l34-choice-group">
          <legend className="l34-label">
            {labelText}
            {field.required ? ' *' : ''}
          </legend>
          {helperText ? <small className="l34-field-helper">{helperText}</small> : null}
          <div className="l34-choice-options">
            {field.options.map((option, optionIndex) => {
              const optionId = buildFieldId(event.slug, field.name, `${index}-${optionIndex}`);
              return (
                <label key={`${option.value}-${optionIndex}`} htmlFor={optionId} className="l34-choice-label">
                  <input
                    id={optionId}
                    type={field.type}
                    name={field.name}
                    value={option.value}
                    required={Boolean(field.required && (field.type === 'radio' || optionIndex === 0))}
                  defaultChecked={Boolean(option.selected || (field.defaultValues || []).includes(option.value))}
                  />
                  <span>{option.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      );
    }

    if (field.type === 'select') {
      const selectId = buildFieldId(event.slug, field.name, index);
      return (
        <div key={`${event.slug}-${field.name}-${index}`}>
          <label htmlFor={selectId} className="l34-label">
            {labelText}
            {field.required ? ' *' : ''}
          </label>
          {helperText ? <small className="l34-field-helper">{helperText}</small> : null}
            <select
            id={selectId}
            name={field.name}
            className="l34-input"
            required={Boolean(field.required)}
            autoComplete={getAutocompleteForField(field)}
            defaultValue={field.defaultValue || ''}
          >
            {(field.options || []).map((option, optionIndex) => (
              <option key={`${option.value}-${optionIndex}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (field.type === 'textarea') {
      const textareaId = buildFieldId(event.slug, field.name, index);
      return (
        <div key={`${event.slug}-${field.name}-${index}`}>
          <label htmlFor={textareaId} className="l34-label">
            {labelText}
            {field.required ? ' *' : ''}
          </label>
          {helperText ? <small className="l34-field-helper">{helperText}</small> : null}
          <textarea
            id={textareaId}
            name={field.name}
            required={Boolean(field.required)}
            className="l34-input l34-textarea"
            placeholder={field.placeholder || ''}
            rows={4}
            autoComplete={getAutocompleteForField(field)}
            defaultValue={field.defaultValue || ''}
          />
        </div>
      );
    }

    const inputId = buildFieldId(event.slug, field.name, index);
    return (
      <div key={`${event.slug}-${field.name}-${index}`}>
        <label htmlFor={inputId} className="l34-label">
          {labelText}
          {field.required ? ' *' : ''}
        </label>
        {helperText ? <small className="l34-field-helper">{helperText}</small> : null}
        <input
          id={inputId}
          type={fieldInputType(field.type)}
          name={field.name}
          required={Boolean(field.required)}
          className="l34-input"
          placeholder={field.placeholder || ''}
          autoComplete={getAutocompleteForField(field)}
          defaultValue={field.defaultValue || ''}
        />
      </div>
    );
  };

  return (
    <div className={`l34-action-center ${isUnified ? 'l34-action-center--unified' : ''}`}>
      {!isUnified && (
        <div className="l34-tab-nav" role="tablist" aria-label="Actions">
          <button
            type="button"
            role="tab"
            id="l34-tab-tools"
            aria-selected={activeTab === 'tools'}
            aria-controls="l34-panel-tools"
            tabIndex={activeTab === 'tools' ? 0 : -1}
            className={`l34-tab-btn ${activeTab === 'tools' ? 'active' : ''}`}
            onClick={() => switchTab('tools')}
          >
            <span className="l34-tab-short">Tools</span>
            <span className="l34-tab-long">Zoom backgrounds &amp; profile images</span>
          </button>
          <button
            type="button"
            role="tab"
            id="l34-tab-events"
            aria-selected={activeTab === 'events'}
            aria-controls="l34-panel-events"
            tabIndex={activeTab === 'events' ? 0 : -1}
            className={`l34-tab-btn ${activeTab === 'events' ? 'active' : ''}`}
            onClick={() => switchTab('events')}
          >
            <span className="l34-tab-short">Events</span>
            <span className="l34-tab-long">Upcoming events</span>
          </button>
        </div>
      )}

      {(activeTab === 'tools' || isUnified) && (
        <div id="l34-panel-tools" className={`l34-tab-content fade-in ${isUnified ? 'l34-tools-panel--unified' : ''}`} role="tabpanel" aria-labelledby={isUnified ? undefined : 'l34-tab-tools'}>
          {!isUnified && (
            <p className="l34-intro">
              Click any image to download. Use them as meeting backgrounds or profile pictures to show your support.
            </p>
          )}
          {isUnified && (
            <h2 className="l34-unified-section-title">Meeting backgrounds</h2>
          )}

          {ZOOM_SECTIONS.map((section) => (
            <section key={section.title} className="l34-section">
              <h2 className="l34-section-title">{section.title}</h2>
              <div
                className="l34-asset-grid l34-asset-row"
                style={{ gridTemplateColumns: `repeat(${section.images.length}, minmax(0, 1fr))` }}
              >
                {section.images.map((img) => (
                  <button
                    key={img.file}
                    type="button"
                    className="l34-asset-card"
                    onClick={() => forceDownload(img.file, img.file, 'zoom', section.title, img.label)}
                  >
                    <img src={url(base, img.file)} alt={`${section.title} – ${img.label}`} className="l34-asset-img" />
                    <span className="l34-asset-label">{img.label}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}

          <section className="l34-section">
            <h2 className="l34-section-title">Profile images (camera-off solidarity)</h2>
            <p className="l34-section-desc">
              Use these as your profile picture so support stays visible when your camera is off.
            </p>
            <div className="l34-profile-grid">
              {PROFILE_IMAGES.map((img) => (
                <button
                  key={img.file}
                  type="button"
                  className="l34-asset-card l34-profile-card"
                  onClick={() => forceDownload(img.file, img.file, 'profile', '', img.label)}
                >
                  <img src={url(base, img.file)} alt={img.label} className="l34-asset-img l34-circular" />
                  <span className="l34-asset-label">{img.label}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="l34-instruction-box">
            <h3 className="l34-instruction-header">Set as your meeting background</h3>
            <div className="l34-instruction-grid">
              <div className="l34-instruction-col">
                <h4 className="l34-instruction-app">Zoom</h4>
                <ol className="l34-instruction-steps">
                  <li>Download an image above.</li>
                  <li>
                    In a meeting, click the <strong>^</strong> next to Start Video.
                  </li>
                  <li>
                    Choose <strong>Background &amp; Effects</strong>.
                  </li>
                  <li>
                    Click <strong>+</strong> to upload your file.
                  </li>
                </ol>
              </div>
              <div className="l34-instruction-col">
                <h4 className="l34-instruction-app">Microsoft Teams</h4>
                <ol className="l34-instruction-steps">
                  <li>Download an image above.</li>
                  <li>
                    In a meeting, select <strong>More…</strong> → <strong>Video effects</strong>.
                  </li>
                  <li>
                    Click <strong>+ Add new</strong> to upload.
                  </li>
                  <li>
                    Click <strong>Apply</strong> to save.
                  </li>
                </ol>
              </div>
            </div>
          </section>

          <section className="l34-instruction-box l34-profile-instructions">
            <h3 className="l34-instruction-header">Set profile image</h3>
            <p>
              In Zoom or Teams account settings, choose <strong>Change Picture</strong> or <strong>Edit Profile</strong>{' '}
              and upload your chosen circular graphic.
            </p>
          </section>

          <section className="l34-instruction-box l34-firewall-box">
            <h3 className="l34-instruction-header l34-dark-header">Can’t download?</h3>
            <p>We can email these files to you.</p>
            <button
              type="button"
              className="l34-btn l34-dark-btn"
              onClick={() => {
                setShowEmailForm(!showEmailForm);
                if (!showEmailForm && typeof window.__trackEvent === 'function') {
                  window.__trackEvent('actions_email_form_open', {});
                }
              }}
            >
              {showEmailForm ? 'Close form' : 'Email me the assets'}
            </button>
            {showEmailForm && (
              <div className="l34-form-container fade-in">
                <form
                  action="https://unitehere.jotform.com/submit/260285893381062"
                  method="post"
                  target="_self"
                  encType="application/x-www-form-urlencoded"
                  aria-label="Request assets by email"
                  onSubmit={() => {
                    if (typeof window.__trackEvent === 'function') {
                      window.__trackEvent('actions_email_submit', {});
                    }
                  }}
                >
                  <input type="hidden" name="formID" value="260285893381062" />
                  <div className="l34-form-row">
                    <label htmlFor="l34-email-first" className="sr-only">
                      First name
                    </label>
                    <input
                      id="l34-email-first"
                      type="text"
                      name="q4_name[first]"
                      placeholder="First name"
                      required
                      className="l34-input"
                      autoComplete="given-name"
                    />
                    <label htmlFor="l34-email-last" className="sr-only">
                      Last name
                    </label>
                    <input
                      id="l34-email-last"
                      type="text"
                      name="q4_name[last]"
                      placeholder="Last name"
                      required
                      className="l34-input"
                      autoComplete="family-name"
                    />
                  </div>
                  <label htmlFor="l34-email-address" className="sr-only">
                    Email address
                  </label>
                  <input
                    id="l34-email-address"
                    type="email"
                    name="q3_email"
                    placeholder="Email address"
                    required
                    className="l34-input"
                    autoComplete="email"
                  />
                  <button type="submit" className="l34-btn l34-submit-btn">
                    Send request
                  </button>
                </form>
              </div>
            )}
          </section>
        </div>
      )}

      {(activeTab === 'events' || isUnified) && (
        <div id="l34-panel-events" className={`l34-tab-content fade-in ${isUnified ? 'l34-events-panel--unified' : ''}`} role="tabpanel" aria-labelledby={isUnified ? undefined : 'l34-tab-events'}>
          {!isUnified && (
            <p className="l34-intro">Join us at these upcoming actions and meetings.</p>
          )}
          {isUnified && (
            <h2 className="l34-unified-section-title">Upcoming events</h2>
          )}

          {!events.length ? (
            <p className="l34-event-empty">No upcoming events are published yet. Please check back soon.</p>
          ) : null}

          {events.map((event) => {
            const isBanner = isBannerImageBySlug[event.slug] ?? true;
            const imageLinkClass = `l34-event-image-link ${isBanner ? 'l34-event-image-link-banner' : 'l34-event-image-link-float'}`;
            const imageClass = `l34-event-image ${isBanner ? 'l34-event-image-banner' : 'l34-event-image-float'}`;
            return (
            <article key={event.slug} id={`event-${event.slug}`} className="l34-event-card">
              <div className="l34-event-date">
                <span className="l34-month">{event.month}</span>
                <span className="l34-day">{event.day}</span>
              </div>
              <div className="l34-event-details">
                <h3 className="l34-event-title">{event.title}</h3>
                {event.imageUrl ? (
                  event.eventUrl ? (
                    <a href={event.eventUrl} target="_blank" rel="noopener noreferrer" className={imageLinkClass}>
                      <img
                        src={event.imageUrl}
                        alt={event.imageAlt || `${event.title} image`}
                        loading="lazy"
                        className={imageClass}
                        onLoad={(eventObj) => markImageKind(event.slug, eventObj.currentTarget)}
                      />
                    </a>
                  ) : (
                    <img
                      src={event.imageUrl}
                      alt={event.imageAlt || `${event.title} image`}
                      loading="lazy"
                      className={imageClass}
                      onLoad={(eventObj) => markImageKind(event.slug, eventObj.currentTarget)}
                    />
                  )
                ) : null}
                {event.cancelled ? (
                  <div className="l34-event-cancelled-banner" role="status" aria-live="polite">
                    <strong className="l34-event-cancelled-label">Cancelled</strong>
                    <p className="l34-event-cancelled-message">{event.cancellationMessage}</p>
                  </div>
                ) : null}
                {event.meta?.length ? (
                  <div className="l34-event-meta">
                    {event.meta.map((m, i) =>
                      isExternalUrl(m) ? (
                        <a
                          key={i}
                          href={m}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="l34-event-location-link"
                        >
                          {m}
                        </a>
                      ) : (
                        <span key={i}>{m}</span>
                      )
                    )}
                  </div>
                ) : null}
                {event.address ? (
                  <p className="l34-event-address">
                    {isExternalUrl(event.address) ? (
                      <a href={event.address} target="_blank" rel="noopener noreferrer" className="l34-event-location-link">
                        {event.address}
                      </a>
                    ) : (
                      event.address
                    )}
                  </p>
                ) : null}
                {(() => {
                  const bodyTextLength =
                    plainTextLength(event.desc) + (event.details || []).reduce((sum, detail) => sum + plainTextLength(detail), 0);
                  const hasExpandableText = bodyTextLength > 100;
                  const expanded = Boolean(expandedTextBySlug[event.slug]);
                  const bodyId = `event-body-${event.slug}`;
                  return (
                    <>
                      <div
                        id={bodyId}
                        className={`l34-event-body-preview ${expanded ? 'is-expanded' : ''}`}
                      >
                        {event.desc ? (
                          <div
                            className="l34-event-desc l34-event-richtext"
                            dangerouslySetInnerHTML={{ __html: toEventHtml(event.desc) }}
                          />
                        ) : null}
                        {event.details?.map((detail, idx) => (
                          <div
                            key={`${event.slug}-detail-${idx}`}
                            className="l34-event-detail l34-event-richtext"
                            dangerouslySetInnerHTML={{ __html: toEventHtml(detail) }}
                          />
                        ))}
                      </div>
                      {hasExpandableText ? (
                        <button
                          type="button"
                          className="l34-event-expand-toggle"
                          aria-expanded={expanded}
                          aria-controls={bodyId}
                          onClick={() => {
                            setExpandedTextBySlug((prev) => ({ ...prev, [event.slug]: !expanded }));
                          }}
                        >
                          <span className="l34-event-expand-icon" aria-hidden />
                          {expanded ? 'Show less' : 'Read more'}
                        </button>
                      ) : null}
                    </>
                  );
                })()}
                {!event.cancelled ? (
                  <>
                    {Boolean(
                      event.jotformSchema?.action &&
                        Array.isArray(event.jotformSchema.fields) &&
                        event.jotformSchema.fields.length
                    ) ||
                    event.mobilizeUrl ? (
                      <div className="l34-event-actions-row">
                        <div className="l34-event-actions">
                          {Boolean(
                            event.jotformSchema?.action &&
                              Array.isArray(event.jotformSchema.fields) &&
                              event.jotformSchema.fields.length
                          ) ? (
                            submittedEventSlugs.includes(event.slug) ? (
                              <span className="l34-submitted-badge" role="status">
                                <span className="l34-submitted-check" aria-hidden>✓</span> Submitted
                              </span>
                            ) : (
                            <button
                              type="button"
                              className="l34-btn"
                              onClick={() => {
                                const open = rsvpEventSlug !== event.slug;
                                setRsvpEventSlug(open ? event.slug : null);
                                if (open && typeof window.__trackEvent === 'function') {
                                  window.__trackEvent('actions_rsvp_open', { event_name: event.title, destination: 'jotform' });
                                }
                              }}
                            >
                              {rsvpEventSlug === event.slug ? 'Close RSVP' : event.rsvpLabel || 'Submit'}
                            </button>
                            )
                          ) : null}
                          {event.mobilizeUrl ? (
                            <a
                              className="l34-btn"
                              href={event.mobilizeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => {
                                if (typeof window.__trackEvent === 'function') {
                                  window.__trackEvent('actions_rsvp_open', { event_name: event.title, destination: 'mobilize' });
                                }
                              }}
                            >
                              {Boolean(
                                event.jotformSchema?.action &&
                                  Array.isArray(event.jotformSchema.fields) &&
                                  event.jotformSchema.fields.length
                              )
                                ? 'Complete Mobilize Sign-up'
                                : event.rsvpLabel || "I'll Be There on Mobilize"}
                            </a>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className="l34-event-share-icon-btn"
                          aria-label={`Share ${event.title}`}
                          title="Share this event"
                          onClick={() => {
                            shareEvent(event);
                          }}
                        >
                          ↗
                        </button>
                      </div>
                    ) : null}
                    {Boolean(
                      event.jotformSchema?.action &&
                        Array.isArray(event.jotformSchema.fields) &&
                        event.jotformSchema.fields.length
                    ) &&
                      rsvpEventSlug === event.slug && (
                      <div className="l34-form-container fade-in">
                        {event.jotformSchema?.action && Array.isArray(event.jotformSchema.fields) && event.jotformSchema.fields.length ? (
                          <form
                            key={event.slug}
                            action={event.jotformSchema.action}
                            method="post"
                            encType="application/x-www-form-urlencoded"
                            autoComplete="on"
                            data-l34-no-guard
                            aria-label={`RSVP form for ${event.title}`}
                            onChange={(eventObj) => onDynamicFormChange(event.slug, eventObj.target)}
                            onSubmit={(e) => handleJotformSubmit(e, event.slug, event.title)}
                          >
                            <input type="hidden" name="event_slug" value={event.slug} />
                            <input type="hidden" name="event_title" value={event.title || ''} />
                            {(event.jotformSchema.hiddenFields || []).map((hiddenField, hiddenIndex) => (
                              <input
                                key={`${hiddenField.name}-${hiddenIndex}`}
                                type="hidden"
                                name={hiddenField.name}
                                value={hiddenField.value || ''}
                              />
                            ))}
                            {event.jotformSchema.fields
                              .filter((field) => isJotformFieldVisible(event, field))
                              .map((field, fieldIndex) => renderJotformField(event, field, fieldIndex))}
                            <button
                              type="submit"
                              className="l34-btn l34-submit-btn"
                              disabled={submittingSlug === event.slug}
                            >
                              {submittingSlug === event.slug ? 'Submitting…' : 'Submit'}
                            </button>
                          </form>
                        ) : null}
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ActionCenter;
