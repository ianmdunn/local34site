/**
 * Actions – layout and toolset for /actions.
 * Ported from ActionCenter with a fresh design system.
 */
import { useState, useMemo, useEffect } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { sanitizeHtml } from '~/utils/sanitize';
import './Actions.css';

const hasHtmlTag = (text) => /<\/?[a-z][\s\S]*>/i.test(String(text || ''));

const escapeHtml = (text) =>
  String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const toEventHtml = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (hasHtmlTag(raw)) return sanitizeHtml(raw);
  return `<p>${escapeHtml(raw).replace(/\r\n/g, '\n').replace(/\n/g, '<br />')}</p>`;
};

const plainTextLength = (value) =>
  String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim().length;

const isExternalUrl = (v) => /^https?:\/\/\S+$/i.test(String(v || '').trim());

const shuffleArray = (arr) => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const isValidImageUrl = (v) => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s.length > 0 && (s.startsWith('/') || s.startsWith('http://') || s.startsWith('https://'));
};

const Actions = ({
  upcomingEvents,
  backgroundsHref = '/meeting-backgrounds',
  backgroundsPortalImages,
  backgroundsPortalImage = null,
}) => {
  const images = useMemo(() => {
    let arr = [];
    if (Array.isArray(backgroundsPortalImages) && backgroundsPortalImages.length) {
      arr = backgroundsPortalImages.filter(isValidImageUrl);
    } else if (backgroundsPortalImage && isValidImageUrl(backgroundsPortalImage)) {
      arr = [backgroundsPortalImage];
    }
    return arr.length > 1 ? shuffleArray(arr) : arr;
  }, [backgroundsPortalImages, backgroundsPortalImage]);

  const [failedImageUrls, setFailedImageUrls] = useState(() => new Set());

  const autoplayPlugin = useMemo(
    () =>
      Autoplay({
        delay: 2500,
        rootNode: (emblaRoot) => emblaRoot.closest('a'),
      }),
    []
  );

  const displayedImages = useMemo(
    () => images.filter((url) => !failedImageUrls.has(url)),
    [images, failedImageUrls]
  );

  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: 'center' },
    displayedImages.length > 1 ? [autoplayPlugin] : []
  );

  useEffect(() => {
    if (emblaApi && displayedImages.length > 1) {
      emblaApi.plugins()?.autoplay?.play();
    }
  }, [emblaApi, displayedImages.length]);

  const [rsvpEventSlug, setRsvpEventSlug] = useState(null);
  const [submittedEventSlugs, setSubmittedEventSlugs] = useState([]);
  const [submittingSlug, setSubmittingSlug] = useState(null);
  const [jotformModalSlug, setJotformModalSlug] = useState(null);
  const [formValuesBySlug, setFormValuesBySlug] = useState({});
  const [expandedTextBySlug, setExpandedTextBySlug] = useState({});
  const [isBannerBySlug, setIsBannerBySlug] = useState({});

  const events = useMemo(
    () =>
      [...(Array.isArray(upcomingEvents) ? upcomingEvents : [])].sort((a, b) => {
        const aT = a.sortDate ? Date.parse(a.sortDate) : Number.NaN;
        const bT = b.sortDate ? Date.parse(b.sortDate) : Number.NaN;
        if (!Number.isNaN(aT) && !Number.isNaN(bT)) return aT - bT;
        if (!Number.isNaN(aT)) return -1;
        if (!Number.isNaN(bT)) return 1;
        return 0;
      }),
    [upcomingEvents]
  );

  const eventShareUrl = (event) => {
    const raw = String(event.eventUrl || '').trim();
    if (raw && /^https?:\/\//i.test(raw)) return raw;
    if (raw && typeof window !== 'undefined') {
      if (raw.startsWith('/')) return `${window.location.origin}${raw}`;
      return `${window.location.origin}/${raw.replace(/^\/+/, '')}`;
    }
    const path = typeof window !== 'undefined' ? window.location.pathname : '/actions';
    return `${typeof window !== 'undefined' ? window.location.origin : ''}${path}#event-${event.slug}`;
  };

  const shareEvent = async (event) => {
    const url = eventShareUrl(event);
    try {
      if (navigator?.share) {
        await navigator.share({ title: event.title || 'Event', text: event.title, url });
        return;
      }
    } catch {}
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        return;
      }
    } catch {}
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const markImageKind = (slug, el) => {
    const w = Number(el?.naturalWidth || 0);
    const h = Number(el?.naturalHeight || 0);
    if (!w || !h) return;
    const banner = w / h >= 1.6;
    setIsBannerBySlug((p) => (p[slug] === banner ? p : { ...p, [slug]: banner }));
  };

  const handleJotformSubmit = (e, eventSlug, eventTitle = '') => {
    e.preventDefault();
    if (typeof window.__trackEvent === 'function') {
      window.__trackEvent('actions_rsvp_submit', { event_slug: eventSlug, event_name: eventTitle });
    }
    setJotformModalSlug(eventSlug);
    e.target.submit();
  };

  const closeJotformModal = (eventSlug) => {
    setJotformModalSlug(null);
    if (eventSlug) {
      setSubmittedEventSlugs((p) => (p.includes(eventSlug) ? p : [...p, eventSlug]));
      setRsvpEventSlug(null);
    }
  };

  const handleBackdropClick = () => {
    if (jotformModalSlug) closeJotformModal(jotformModalSlug);
  };

  const toId = (v = '') =>
    String(v)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const buildFieldId = (slug, name, suf = '') => {
    const b = `adv-rsvp-${toId(slug)}-${toId(name)}`;
    return suf ? `${b}-${toId(suf)}` : b;
  };

  const getAutocomplete = (field) => {
    if (field.type === 'email') return 'email';
    if (field.type === 'tel') return 'tel';
    const s = `${(field.name || '')} ${(field.label || '')}`.toLowerCase();
    if (/\b(organization|org|company|department|dept)\b/.test(s)) return 'organization';
    if (/\b(name|full name|fullname)\b/.test(s)) return 'name';
    return 'on';
  };

  const getSubfieldAutocomplete = (subfieldName) => {
    const n = String(subfieldName || '').toLowerCase();
    if (/first|given/.test(n)) return 'given-name';
    if (/last|family|surname/.test(n)) return 'family-name';
    if (/middle|additional/.test(n)) return 'additional-name';
    if (/addr_line1|addr_line_1|street/.test(n)) return 'street-address';
    if (/addr_line2|addr_line_2/.test(n)) return 'address-line2';
    if (/city|address-level2/.test(n)) return 'address-level2';
    if (/state|address-level1/.test(n)) return 'address-level1';
    if (/postal|zip/.test(n)) return 'postal-code';
    if (/country/.test(n)) return 'country-name';
    return 'on';
  };

  const defaultFieldValue = (field) => {
    if (field.type === 'checkbox') return Array.isArray(field.defaultValues) ? field.defaultValues : [];
    if (field.type === 'radio') return Array.isArray(field.defaultValues) ? field.defaultValues[0] || '' : '';
    return field.defaultValue || '';
  };

  const getFieldByQid = (event, qid) => {
    const fields = event.jotformSchema?.fields || [];
    const str = String(qid || '').trim();
    let f = fields.find((x) => String(x.qid) === str || x.name === str);
    if (!f && /^q\d+/.test(str)) {
      const num = str.replace(/^q(\d+).*$/, '$1');
      f = fields.find((x) => String(x.qid) === num);
    }
    return f || null;
  };

  const valueForQid = (event, qid) => {
    const fields = event.jotformSchema?.fields || [];
    const str = String(qid || '').trim();
    let target = fields.find((f) => String(f.qid) === str || f.name === str);
    if (!target && /^q\d+/.test(str)) {
      const num = str.replace(/^q(\d+).*$/, '$1');
      target = fields.find((f) => String(f.qid) === num);
    }
    if (!target) return '';
    if (
      (target.type === 'fullname' || target.type === 'address') &&
      Array.isArray(target.subFields) &&
      target.subFields.length
    ) {
      return target.subFields
        .map((s) => {
          const v = formValuesBySlug[event.slug]?.[s.name];
          return v !== undefined ? String(v || '').trim() : String(s.defaultValue || '').trim();
        })
        .join(' ')
        .trim();
    }
    const v = formValuesBySlug[event.slug]?.[target.name];
    return v === undefined ? defaultFieldValue(target) : v;
  };

  const fieldIdsMatch = (a, b) => {
    const x = String(a || '').trim();
    const y = String(b || '').trim();
    if (x === y) return true;
    const nx = x.replace(/^q(\d+).*$/, '$1');
    const ny = y.replace(/^q(\d+).*$/, '$1');
    return nx && ny && nx === ny;
  };

  const matchesCondition = (value, op, compare = '', field = null) => {
    const o = String(op || '').toLowerCase();
    const arr = Array.isArray(value) ? value : [value];
    const joined = arr.map((i) => String(i || '').trim()).join(' ').trim();
    const cmp = String(compare || '').trim();
    const vals = [...new Set([joined, ...arr.map(String)])];
    if (field?.type === 'radio' && Array.isArray(field.options)) {
      const sel = arr[0];
      const opt = field.options.find((o) => String(o.value || '').trim() === String(sel || '').trim());
      if (opt?.label) vals.push(String(opt.label).trim());
    }
    if (field?.type === 'checkbox' && Array.isArray(field.options) && Array.isArray(value)) {
      for (const v of value) {
        const opt = field.options.find((o) => String(o.value || '').trim() === String(v || '').trim());
        if (opt?.label) vals.push(String(opt.label).trim());
      }
    }
    const cl = cmp.toLowerCase();
    const any = (pred) => vals.some((v) => pred(String(v || '').trim()));
    const all = (pred) => vals.every((v) => pred(String(v || '').trim()));
    if (o === 'isfilled') return joined.length > 0;
    if (o === 'isnotfilled' || o === 'isempty') return joined.length === 0;
    if (o === 'equals' || o === 'is') return any((v) => v === cmp || v.toLowerCase() === cl);
    if (o === 'notequals' || o === 'isnot') return all((v) => v !== cmp && v.toLowerCase() !== cl);
    if (o === 'contains') return any((v) => v.toLowerCase().includes(cl));
    if (o === 'doesnotcontain') return all((v) => !v.toLowerCase().includes(cl));
    return false;
  };

  const isFieldVisible = (event, field) => {
    const conditions = event.jotformSchema?.conditions || [];
    let visible = !field.hiddenByDefault;
    for (const cond of conditions.filter((c) =>
      (c.actions || []).some((a) => fieldIdsMatch(a.field, field.qid))
    )) {
      const terms = cond.terms || [];
      const match =
        (cond.link || 'All') === 'Any'
          ? terms.some((t) =>
              matchesCondition(
                valueForQid(event, t.field),
                t.operator,
                t.value,
                getFieldByQid(event, t.field)
              )
            )
          : terms.every((t) =>
              matchesCondition(
                valueForQid(event, t.field),
                t.operator,
                t.value,
                getFieldByQid(event, t.field)
              )
            );
      if (!match) continue;
      for (const a of (cond.actions || []).filter((ac) => fieldIdsMatch(ac.field, field.qid))) {
        if (a.visibility === 'Hide') visible = false;
        if (a.visibility === 'Show') visible = true;
      }
    }
    return visible;
  };

  const onFormChange = (slug, target) => {
    const name = String(target?.name || '').trim();
    if (!name) return;
    setFormValuesBySlug((p) => {
      const cur = { ...(p[slug] || {}) };
      if (target.type === 'checkbox') {
        const prev = Array.isArray(cur[name]) ? cur[name] : [];
        cur[name] = target.checked
          ? [...new Set([...prev, target.value])]
          : prev.filter((v) => v !== target.value);
      } else cur[name] = target.value;
      return { ...p, [slug]: cur };
    });
  };

  const fieldInputType = (t) => (t === 'email' ? 'email' : t === 'tel' ? 'tel' : 'text');

  /** Format phone to (###) ###-#### for JotForm Fill Mask validation */
  const formatPhoneForMask = (el) => {
    if (!el || el.type !== 'tel') return;
    const digits = String(el.value || '').replace(/\D/g, '').slice(0, 10);
    if (digits.length >= 10) {
      el.value = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
  };

  const renderField = (event, field, idx) => {
    const label = (String(field.label || 'Field').replace(/\s*\*+\s*$/, '').trim()) || 'Field';
    const helper = field.helperText || '';

    if (
      (field.type === 'fullname' || field.type === 'address') &&
      Array.isArray(field.subFields) &&
      field.subFields.length
    ) {
      return (
        <div key={`${event.slug}-${field.name}-${idx}`} className="adv-field">
          <label className="adv-label">{label}{field.required ? ' *' : ''}</label>
          {helper ? <small className="adv-helper">{helper}</small> : null}
          <div className="adv-field-row">
            {field.subFields.map((sf, si) => (
              <div key={sf.name} className={field.type === 'address' ? 'adv-addr-part' : 'adv-name-part'}>
                <label htmlFor={buildFieldId(event.slug, sf.name, `${idx}-${si}`)} className="sr-only">
                  {sf.label || `Part ${si + 1}`}
                </label>
                <input
                  id={buildFieldId(event.slug, sf.name, `${idx}-${si}`)}
                  type="text"
                  name={sf.name}
                  placeholder={sf.placeholder || sf.label}
                  required={Boolean(sf.required)}
                  className="adv-input"
                  autoComplete={getSubfieldAutocomplete(sf.name)}
                  defaultValue={sf.defaultValue || ''}
                  onChange={(e) => onFormChange(event.slug, e.target)}
                />
              </div>
            ))}
          </div>
        </div>
      );
    }

    if ((field.type === 'radio' || field.type === 'checkbox') && Array.isArray(field.options) && field.options.length) {
      return (
        <fieldset key={`${event.slug}-${field.name}-${idx}`} className="adv-fieldset">
          <legend className="adv-label">{label}{field.required ? ' *' : ''}</legend>
          {helper ? <small className="adv-helper">{helper}</small> : null}
          <div className="adv-options">
            {field.options.map((opt, oi) => (
              <label key={opt.value} htmlFor={buildFieldId(event.slug, field.name, `${idx}-${oi}`)} className="adv-option-label">
                <input
                  id={buildFieldId(event.slug, field.name, `${idx}-${oi}`)}
                  type={field.type}
                  name={field.name}
                  value={opt.value}
                  required={Boolean(field.required && (field.type === 'radio' || oi === 0))}
                  defaultChecked={Boolean(opt.selected || (field.defaultValues || []).includes(opt.value))}
                  onChange={(e) => onFormChange(event.slug, e.target)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      );
    }

    if (field.type === 'select') {
      const id = buildFieldId(event.slug, field.name, idx);
      return (
        <div key={`${event.slug}-${field.name}-${idx}`} className="adv-field">
          <label htmlFor={id} className="adv-label">{label}{field.required ? ' *' : ''}</label>
          {helper ? <small className="adv-helper">{helper}</small> : null}
          <select
            id={id}
            name={field.name}
            className="adv-input adv-select"
            required={Boolean(field.required)}
            autoComplete={/\b(organization|org|company)\b/.test(`${(field.name||'')} ${(field.label||'')}`.toLowerCase()) ? 'organization' : 'on'}
            defaultValue={field.defaultValue || ''}
            onChange={(e) => onFormChange(event.slug, e.target)}
          >
            {(field.options || []).map((o, oi) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      );
    }

    if (field.type === 'textarea') {
      const id = buildFieldId(event.slug, field.name, idx);
      return (
        <div key={`${event.slug}-${field.name}-${idx}`} className="adv-field">
          <label htmlFor={id} className="adv-label">{label}{field.required ? ' *' : ''}</label>
          {helper ? <small className="adv-helper">{helper}</small> : null}
          <textarea
            id={id}
            name={field.name}
            required={Boolean(field.required)}
            className="adv-input adv-textarea"
            placeholder={field.placeholder || ''}
            rows={4}
            autoComplete={getAutocomplete(field)}
            defaultValue={field.defaultValue || ''}
            onChange={(e) => onFormChange(event.slug, e.target)}
          />
        </div>
      );
    }

    const id = buildFieldId(event.slug, field.name, idx);
    const hasPhoneMask = field.type === 'tel' && field.phoneMask;
    return (
      <div key={`${event.slug}-${field.name}-${idx}`} className="adv-field">
        <label htmlFor={id} className="adv-label">{label}{field.required ? ' *' : ''}</label>
        {helper ? <small className="adv-helper">{helper}</small> : null}
        <input
          id={id}
          type={fieldInputType(field.type)}
          name={field.name}
          required={Boolean(field.required)}
          className="adv-input"
          placeholder={field.placeholder || (hasPhoneMask ? '(000) 000-0000' : '') || ''}
          autoComplete={getAutocomplete(field)}
          defaultValue={field.defaultValue || ''}
          onChange={(e) => onFormChange(event.slug, e.target)}
          onBlur={hasPhoneMask ? (e) => formatPhoneForMask(e.target) : undefined}
        />
      </div>
    );
  };

  const hasJotform = (e) =>
    Boolean(
      e.jotformSchema?.action &&
        Array.isArray(e.jotformSchema?.fields) &&
      e.jotformSchema.fields.length
    );

  return (
    <div className="adv-page">
      <main className="adv-main" aria-label="Upcoming events">
          <div className="adv-events">
            {backgroundsHref && (
              <a
                href={backgroundsHref}
                className="adv-event adv-event--portal"
                id="event-meeting-backgrounds"
              >
                <div className="adv-event-header">
                  <div className="adv-event-date adv-event-date--portal" aria-hidden>
                    <span className="adv-event-month">Tool</span>
                    <span className="adv-event-day">✦</span>
                  </div>
                  <div className="adv-event-title-wrap">
                    <h3 className="adv-event-title">Meeting backgrounds & profile images</h3>
                    <p className="adv-event-desc" style={{ margin: '0.25rem 0 0 0' }}>
                      Download backgrounds for Zoom and Teams, plus profile pictures for when your camera is off.
                    </p>
                  </div>
                  <span className="adv-event-share adv-event-cta" aria-hidden>→</span>
                </div>
                {displayedImages.length > 0 && (
                  <div className="adv-event-carousel adv-event-img-link embla" key={displayedImages.length}>
                    <div className="embla__viewport" ref={emblaRef}>
                      <div className="embla__container">
                        {displayedImages.map((src, i) => (
                          <div className="embla__slide" key={`${i}-${src}`}>
                            <img
                              src={src}
                              alt=""
                              loading={i === 0 ? 'eager' : 'lazy'}
                              className="adv-event-carousel-img"
                              onError={() => setFailedImageUrls((prev) => new Set([...prev, src]))}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div className="adv-event-actions">
                  <span className="adv-btn adv-btn--primary">Browse & download</span>
                </div>
              </a>
            )}
            {!events.length ? (
              <p className="adv-empty">No upcoming events. Please check back soon.</p>
            ) : (
              <>
              {events.map((event) => {
                const isBanner = isBannerBySlug[event.slug] ?? true;
                const hasForm = hasJotform(event);
                const submitted = submittedEventSlugs.includes(event.slug);
                const openRsvp = rsvpEventSlug === event.slug;
                const bodyLen =
                  plainTextLength(event.desc) +
                  (event.details || []).reduce((s, d) => s + plainTextLength(d), 0);
                const expandable = bodyLen > 80;
                const expanded = Boolean(expandedTextBySlug[event.slug]);
                const bodyId = `adv-body-${event.slug}`;

                return (
                  <article
                    key={event.slug}
                    id={`event-${event.slug}`}
                    className={`adv-event ${event.cancelled ? 'adv-event--cancelled' : ''}`}
                  >
                    <div className="adv-event-header">
                      <div className="adv-event-date">
                        <span className="adv-event-month">{event.month}</span>
                        <span className="adv-event-day">{event.day}</span>
                      </div>
                      <div className="adv-event-title-wrap">
                        <h3 className="adv-event-title">{event.title}</h3>
                        {event.meta?.length ? (
                          <div className="adv-event-meta">
                            {event.meta.map((m, i) =>
                              isExternalUrl(m) ? (
                                <a key={i} href={m} target="_blank" rel="noopener noreferrer" className="adv-event-link">
                                  {m}
                                </a>
                              ) : (
                                <span key={i}>{m}</span>
                              )
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {event.imageUrl && (
                      event.eventUrl ? (
                        <a href={event.eventUrl} target="_blank" rel="noopener noreferrer" className="adv-event-img-link">
                          <img
                            src={event.imageUrl}
                            alt={event.imageAlt || `${event.title} image`}
                            loading="lazy"
                            className={`adv-event-img ${isBanner ? 'adv-event-img--banner' : 'adv-event-img--float'}`}
                            onLoad={(ev) => markImageKind(event.slug, ev.currentTarget)}
                          />
                        </a>
                      ) : (
                        <img
                          src={event.imageUrl}
                          alt={event.imageAlt || `${event.title} image`}
                          loading="lazy"
                          className={`adv-event-img ${isBanner ? 'adv-event-img--banner' : 'adv-event-img--float'}`}
                          onLoad={(ev) => markImageKind(event.slug, ev.currentTarget)}
                        />
                      )
                    )}

                    {event.cancelled && (
                      <div className="adv-event-cancelled" role="status">
                        <strong>Cancelled</strong>
                        {event.cancellationMessage && <p>{event.cancellationMessage}</p>}
                      </div>
                    )}

                    <div id={bodyId} className={`adv-event-body ${expanded ? 'adv-event-body--expanded' : ''}`}>
                      {event.desc && (
                        <div className="adv-event-desc" dangerouslySetInnerHTML={{ __html: toEventHtml(event.desc) }} />
                      )}
                      {event.details?.map((d, i) => (
                        <div key={i} className="adv-event-detail" dangerouslySetInnerHTML={{ __html: toEventHtml(d) }} />
                      ))}
                    </div>
                    {(expandable || !event.cancelled) && (
                      <div className="adv-event-actions">
                        <div className="adv-event-actions-row">
                          <div className="adv-event-actions-primary">
                            {!event.cancelled && (hasForm || event.mobilizeUrl) && (
                              hasForm ? (
                                submitted ? (
                                  <span className="adv-submitted">
                                    <span aria-hidden>✓</span> Submitted
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    className="adv-btn adv-btn--primary"
                                    onClick={() => {
                                      setRsvpEventSlug(openRsvp ? null : event.slug);
                                      if (!openRsvp && window.__trackEvent) {
                                        window.__trackEvent('actions_rsvp_open', { event_name: event.title, destination: 'jotform' });
                                      }
                                    }}
                                  >
                                    {openRsvp ? 'Close' : event.rsvpLabel || 'RSVP'}
                                  </button>
                                )
                              ) : (
                                <a
                                  className="adv-btn adv-btn--primary"
                                  href={event.mobilizeUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={() => window.__trackEvent?.('actions_rsvp_open', { event_name: event.title, destination: 'mobilize' })}
                                >
                                  {event.rsvpLabel || "I'll Be There"}
                                </a>
                              )
                            )}
                          </div>
                          <div className="adv-event-actions-links">
                            {expandable && (
                              <button
                                type="button"
                                className="adv-event-expand adv-event-action-link"
                                aria-expanded={expanded}
                                aria-controls={bodyId}
                                onClick={() => setExpandedTextBySlug((p) => ({ ...p, [event.slug]: !expanded }))}
                              >
                                {expanded ? 'Show less' : 'Read more'}
                              </button>
                            )}
                            <button
                              type="button"
                              className="adv-event-share adv-event-action-link"
                              aria-label={`Share ${event.title}`}
                              title="Share"
                              onClick={() => shareEvent(event)}
                            >
                              Share
                            </button>
                          </div>
                        </div>
                        {hasForm && openRsvp && (
                          <form
                            className="adv-form"
                            action={event.jotformSchema.action}
                            method="post"
                            target="jotform-response"
                            encType="application/x-www-form-urlencoded"
                            autoComplete="on"
                            aria-label={`RSVP for ${event.title}`}
                            data-l34-no-guard
                            onSubmit={(ev) => handleJotformSubmit(ev, event.slug, event.title)}
                          >
                            <input type="hidden" name="event_slug" value={event.slug} />
                            <input type="hidden" name="event_title" value={event.title || ''} />
                            {(event.jotformSchema.hiddenFields || []).map((hf, hi) => (
                              <input key={hi} type="hidden" name={hf.name} value={hf.value || ''} />
                            ))}
                            {event.jotformSchema.fields
                              .filter((f) => isFieldVisible(event, f))
                              .map((f, fi) => renderField(event, f, fi))}
                            <button
                              type="submit"
                              className="adv-btn adv-btn--submit"
                              disabled={submittingSlug === event.slug}
                            >
                              {submittingSlug === event.slug ? 'Submitting…' : 'Submit'}
                            </button>
                          </form>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
              </>
            )}
          </div>
        </main>
      <div
        className={`adv-jotform-modal ${jotformModalSlug ? 'adv-jotform-modal--open' : ''}`}
        role="dialog"
        aria-labelledby="jotform-modal-title"
        aria-modal="true"
        aria-hidden={!jotformModalSlug}
      >
        <div className="adv-jotform-modal-backdrop" onClick={handleBackdropClick} />
        <div className="adv-jotform-modal-content">
          <div className="adv-jotform-modal-header">
            <h2 id="jotform-modal-title" className="adv-jotform-modal-title">Completing RSVP</h2>
            <button
              type="button"
              className="adv-jotform-modal-close"
              onClick={() => closeJotformModal(jotformModalSlug)}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <iframe
            name="jotform-response"
            title="JotForm submission"
            className="adv-jotform-modal-iframe"
            sandbox="allow-forms allow-scripts allow-same-origin"
          />
        </div>
      </div>
    </div>
  );
};

export default Actions;
