/**
 * MeetingBackgrounds – Zoom backgrounds, profile images, instructions, email form.
 * Preview-before-download, copy instructions, improved layout.
 */
import { useState, useEffect, useCallback } from 'react';
import './MeetingBackgrounds.css';

const DEFAULT_ZOOM_BASE = '/zoom-backgrounds';

const assetUrl = (base, filename) =>
  `${base || DEFAULT_ZOOM_BASE}/${encodeURIComponent(filename)}`;

const ZOOM_INSTRUCTIONS = {
  zoom: 'In a Zoom meeting: Click ^ next to Stop Video → Choose Video Background → Add Image → upload your downloaded file.',
  teams: 'In Teams: During a meeting, click … → Video effects → Add new → Upload and choose your file.',
};

const ZOOM_SECTIONS = [
  { title: "We Can't Keep Up", images: [
    { file: "Zoom Background - We Can't Keep Up.jpg", label: 'Standard' },
    { file: "Zoom Background - We Can't Keep Up - Image.jpg", label: 'With image' },
    { file: "Zoom Background - We Can't Keep Up - Grid.jpg", label: 'Grid' },
    { file: "Zoom Background - We Can't Keep Up - Button.jpg", label: 'Button' },
    { file: "Zoom Background - We Can't Keep Up - Button Only.jpg", label: 'Button only' },
  ]},
  { title: 'Union Strong', images: [
    { file: 'Zoom Background - Union Strong.jpg', label: 'Standard' },
    { file: 'Zoom Background - Union Strong - Image.jpg', label: 'With image' },
    { file: 'Zoom Background - Union Strong - Grid.jpg', label: 'Grid' },
    { file: 'Zoom Background - Union Strong - Button.jpg', label: 'Button' },
    { file: 'Zoom Background - Union Strong - Button Only.jpg', label: 'Button only' },
  ]},
  { title: "We're Worth It", images: [
    { file: 'Zoom Background - We\u2019re Worth It!.jpg', label: 'Standard' },
    { file: "Zoom Background - We're Worth It - Image.jpg", label: 'With image' },
    { file: "Zoom Background - We're Worth It - Grid.jpg", label: 'Grid' },
    { file: "Zoom Background - We're Worth It - Button.jpg", label: 'Button' },
    { file: "Zoom Background - We're Worth It - Button Only.jpg", label: 'Button only' },
  ]},
  { title: 'United for a Great Contract', images: [
    { file: 'Zoom Background - United for a Great Contract.jpg', label: 'Standard' },
    { file: 'Zoom Background - United for a Great Contract - Image.jpg', label: 'With image' },
    { file: 'Zoom Background - United for a Great Contract - Grid.jpg', label: 'Grid' },
  ]},
  { title: 'Yale Can Afford It', images: [
    { file: 'Zoom Background - Yale Can Afford It - Image.jpg', label: 'With image' },
    { file: 'Zoom Background - Yale Can Afford It - Grid.jpg', label: 'Grid' },
  ]},
];

const PROFILE_IMAGES = [
  { file: "We're Worth It Profile Image.jpg", label: "We're Worth It" },
  { file: 'Union Strong Profile Image.jpg', label: 'Union Strong' },
  { file: "We Can't Keep Up Profile Image.jpg", label: "We Can't Keep Up" },
];

const MeetingBackgrounds = ({ zoomBase = DEFAULT_ZOOM_BASE, eventsHref = '/actions' }) => {
  const base = zoomBase ?? DEFAULT_ZOOM_BASE;
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [preview, setPreview] = useState(null);

  const forceDownload = useCallback((filename, downloadName, assetType, sectionTitle, label) => {
    const link = document.createElement('a');
    link.href = assetUrl(base, filename);
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
  }, [base]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') setPreview(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const copyInstructions = (app) => {
    const text = app === 'zoom' ? ZOOM_INSTRUCTIONS.zoom : ZOOM_INSTRUCTIONS.teams;
    navigator.clipboard?.writeText(text).then(() => {
      if (typeof window.__trackEvent === 'function') {
        window.__trackEvent('actions_instructions_copy', { app });
      }
      alert('Copied to clipboard!');
    }).catch(() => {});
  };

  return (
    <div className="mb-page">
      <div className="mb-hero">
        <div className="mb-instructions mb-instructions--top">
          <h2 className="mb-instructions-title">How to use</h2>
          <p className="mb-instructions-text">
            <strong>Zoom:</strong> Click ^ next to Stop Video → Choose Video Background → Add Image → upload.
          </p>
          <p className="mb-instructions-text">
            <strong>Teams:</strong> … → Video effects → Add new → Upload.
          </p>
          <div className="mb-instructions-actions">
            <button type="button" className="mb-btn mb-btn--small" onClick={() => copyInstructions('zoom')}>
              Copy Zoom steps
            </button>
            <button type="button" className="mb-btn mb-btn--small" onClick={() => copyInstructions('teams')}>
              Copy Teams steps
            </button>
          </div>
        </div>
      </div>

      {ZOOM_SECTIONS.map((section) => (
        <section key={section.title} className="mb-section">
          <h2 className="mb-section-title">{section.title}</h2>
          <div className="mb-grid">
            {section.images.map((img) => (
              <button
                key={img.file}
                type="button"
                className="mb-card"
                onClick={() => setPreview({
                  url: assetUrl(base, img.file),
                  filename: img.file,
                  label: `${section.title} – ${img.label}`,
                  sectionTitle: section.title,
                  imageLabel: img.label,
                  assetType: 'zoom',
                })}
              >
                <img
                  src={assetUrl(base, img.file)}
                  alt={`${section.title} – ${img.label}`}
                  className="mb-card-img"
                />
                <span className="mb-card-label">{img.label}</span>
              </button>
            ))}
          </div>
        </section>
      ))}

      <section className="mb-section mb-profiles">
        <h2 className="mb-section-title">Profile images</h2>
        <p className="mb-desc">Camera-off solidarity. Use when your camera is off in meetings.</p>
        <div className="mb-profile-grid">
          {PROFILE_IMAGES.map((img) => (
            <button
              key={img.file}
              type="button"
              className="mb-profile-card"
              onClick={() => setPreview({
                url: assetUrl(base, img.file),
                filename: img.file,
                label: img.label,
                sectionTitle: '',
                imageLabel: img.label,
                assetType: 'profile',
              })}
            >
              <img src={assetUrl(base, img.file)} alt={img.label} className="mb-profile-img" />
              <span className="mb-profile-label">{img.label}</span>
            </button>
          ))}
        </div>
      </section>

      {preview && (
        <div
          className="mb-preview-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mb-preview-title"
          onClick={(e) => e.target === e.currentTarget && setPreview(null)}
        >
          <div className="mb-preview">
            <div className="mb-preview-header">
              <h2 id="mb-preview-title" className="mb-preview-title">{preview.label}</h2>
              <button
                type="button"
                className="mb-preview-close"
                aria-label="Close preview"
                onClick={() => setPreview(null)}
              >
                ×
              </button>
            </div>
            <div className="mb-preview-body">
              <img src={preview.url} alt={preview.label} className="mb-preview-img" />
            </div>
            <div className="mb-preview-actions">
              <button
                type="button"
                className="mb-btn mb-btn--submit"
                onClick={() => {
                  forceDownload(preview.filename, preview.filename, preview.assetType, preview.sectionTitle, preview.imageLabel);
                  setPreview(null);
                }}
              >
                Download
              </button>
              <button type="button" className="mb-btn mb-btn--secondary" onClick={() => setPreview(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-email-box">
        <button
          type="button"
          className="mb-btn mb-btn--secondary"
          onClick={() => {
            setShowEmailForm(!showEmailForm);
            if (!showEmailForm && window.__trackEvent) window.__trackEvent('actions_email_form_open', {});
          }}
        >
          {showEmailForm ? 'Close' : 'Email me the assets'}
        </button>
        {showEmailForm && (
          <form
            className="mb-form mb-email-form"
            action="https://unitehere.jotform.com/submit/260285893381062"
            method="post"
            target="_self"
            encType="application/x-www-form-urlencoded"
            aria-label="Request assets by email"
            onSubmit={() => window.__trackEvent?.('actions_email_submit', {})}
          >
            <input type="hidden" name="formID" value="260285893381062" />
            <input type="text" name="q4_name[first]" placeholder="First name" required className="mb-input" autoComplete="given-name" />
            <input type="text" name="q4_name[last]" placeholder="Last name" required className="mb-input" autoComplete="family-name" />
            <input type="email" name="q3_email" placeholder="Email" required className="mb-input" autoComplete="email" />
            <button type="submit" className="mb-btn mb-btn--submit">Send request</button>
          </form>
        )}
      </div>

      {eventsHref && (
        <p className="mb-back-link">
          <a href={eventsHref}>See upcoming events</a>
        </p>
      )}
    </div>
  );
};

export default MeetingBackgrounds;
