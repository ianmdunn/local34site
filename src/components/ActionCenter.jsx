import React, { useState } from 'react';
import './ActionCenter.css';

const DEFAULT_ZOOM_BASE = '/zoom-backgrounds';
const url = (base, filename) => `${base || DEFAULT_ZOOM_BASE}/${encodeURIComponent(filename)}`;

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

const ActionCenter = ({ zoomBase = DEFAULT_ZOOM_BASE }) => {
  const [activeTab, setActiveTab] = useState('tools');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [showRSVP, setShowRSVP] = useState(false);
  const base = zoomBase ?? DEFAULT_ZOOM_BASE;

  const forceDownload = (filename, downloadName) => {
    const link = document.createElement('a');
    link.href = url(base, filename);
    link.download = downloadName || filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="l34-action-center">
      <div className="l34-tab-nav" role="tablist" aria-label="Actions">
        <button
          type="button"
          role="tab"
          id="l34-tab-tools"
          aria-selected={activeTab === 'tools'}
          aria-controls="l34-panel-tools"
          tabIndex={activeTab === 'tools' ? 0 : -1}
          className={`l34-tab-btn ${activeTab === 'tools' ? 'active' : ''}`}
          onClick={() => setActiveTab('tools')}
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
          onClick={() => setActiveTab('events')}
        >
          <span className="l34-tab-short">Events</span>
          <span className="l34-tab-long">Upcoming events</span>
        </button>
      </div>

      {activeTab === 'tools' && (
        <div id="l34-panel-tools" className="l34-tab-content fade-in" role="tabpanel" aria-labelledby="l34-tab-tools">
          <p className="l34-intro">
            Click any image to download. Use them as meeting backgrounds or profile pictures to show your support.
          </p>

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
                    onClick={() => forceDownload(img.file, img.file)}
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
                  onClick={() => forceDownload(img.file, img.file)}
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
            <button type="button" className="l34-btn l34-dark-btn" onClick={() => setShowEmailForm(!showEmailForm)}>
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

      {activeTab === 'events' && (
        <div id="l34-panel-events" className="l34-tab-content fade-in" role="tabpanel" aria-labelledby="l34-tab-events">
          <p className="l34-intro">Join us at these upcoming actions and meetings.</p>

          <article className="l34-event-card">
            <div className="l34-event-date">
              <span className="l34-month">Feb</span>
              <span className="l34-day">24</span>
            </div>
            <div className="l34-event-details">
              <h3 className="l34-event-title">Solidarity Summit</h3>
              <div className="l34-event-meta">
                <span>5:30 PM (doors 5:00 PM)</span>
                <span>Trinity Temple C.O.G.I.C.</span>
              </div>
              <p className="l34-event-address">285 Dixwell Ave, New Haven, CT</p>
              <p className="l34-event-desc">
                Join New Haven Rising, Local 34, Local 33, Local 35, and community allies. We are coming together to
                demand a fair contract and a stronger community.
              </p>
              <button type="button" className="l34-btn" onClick={() => setShowRSVP(!showRSVP)}>
                {showRSVP ? 'Close RSVP' : 'RSVP'}
              </button>
              {showRSVP && (
                <div className="l34-form-container fade-in">
                  <form
                    action="https://unitehere.jotform.com/submit/260136005054039"
                    method="post"
                    target="_self"
                    encType="application/x-www-form-urlencoded"
                    aria-label="RSVP form"
                  >
                    <input type="hidden" name="formID" value="260136005054039" />
                    <label htmlFor="l34-rsvp-first" className="l34-label">
                      Name *
                    </label>
                    <div className="l34-form-row">
                      <input
                        id="l34-rsvp-first"
                        type="text"
                        name="q3_name[first]"
                        placeholder="First name"
                        required
                        className="l34-input"
                        autoComplete="given-name"
                      />
                      <input
                        id="l34-rsvp-last"
                        type="text"
                        name="q3_name[last]"
                        placeholder="Last name"
                        required
                        className="l34-input"
                        autoComplete="family-name"
                        aria-label="Last name"
                      />
                    </div>
                    <label htmlFor="l34-rsvp-email" className="l34-label">
                      Email *
                    </label>
                    <input
                      id="l34-rsvp-email"
                      type="email"
                      name="q4_email"
                      required
                      className="l34-input"
                      autoComplete="email"
                    />
                    <label htmlFor="l34-rsvp-phone" className="l34-label">
                      Phone
                    </label>
                    <input
                      id="l34-rsvp-phone"
                      type="tel"
                      name="q5_phoneNumber[full]"
                      placeholder="(000) 000-0000"
                      className="l34-input"
                      autoComplete="tel"
                    />
                    <small className="l34-disclaimer" id="l34-rsvp-disclaimer">
                      By submitting your cell # and email, you are opting into mobile and email outreach from UNITE
                      HERE! and its allies. Standard rates apply. Cancel anytime by replying STOP.
                    </small>
                    <label htmlFor="l34-rsvp-org" className="l34-label">
                      Organization *
                    </label>
                    <select id="l34-rsvp-org" name="q6_organization" className="l34-input" required>
                      <option value="">Select…</option>
                      <option value="New Haven Rising">New Haven Rising</option>
                      <option value="Local 34-UNITE HERE!">Local 34-UNITE HERE!</option>
                      <option value="Local 33 – UNITE HERE!">Local 33 – UNITE HERE!</option>
                      <option value="Local 35 – UNITE HERE!">Local 35 – UNITE HERE!</option>
                      <option value="Local 217 – UNITE HERE!">Local 217 – UNITE HERE!</option>
                      <option value="SUNY URA">SUNY URA</option>
                      <option value="Other">Other</option>
                    </select>
                    <label htmlFor="l34-rsvp-org-other" className="l34-label">
                      Other organization (if not listed)
                    </label>
                    <input
                      id="l34-rsvp-org-other"
                      type="text"
                      name="q7_whatOrganization"
                      placeholder="Optional"
                      className="l34-input"
                    />
                    <button type="submit" className="l34-btn l34-submit-btn">
                      Submit RSVP
                    </button>
                  </form>
                </div>
              )}
            </div>
          </article>
        </div>
      )}
    </div>
  );
};

export default ActionCenter;
