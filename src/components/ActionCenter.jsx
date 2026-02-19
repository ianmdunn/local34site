import { useState, useEffect } from 'react';
import './ActionCenter.css';

const DEFAULT_ZOOM_BASE = '/zoom-backgrounds';

function tabFromHash() {
  const hash = typeof window !== 'undefined' ? window.location.hash.slice(1).toLowerCase() : '';
  return hash === 'events' || hash.startsWith('event-') ? 'events' : 'tools';
}

function eventSlugFromHash() {
  const hash = typeof window !== 'undefined' ? window.location.hash.slice(1).toLowerCase() : '';
  return hash.startsWith('event-') ? hash.slice(6) : null;
}

const url = (base, filename) => `${base || DEFAULT_ZOOM_BASE}/${encodeURIComponent(filename)}`;

const UPCOMING_EVENTS = [
  {
    slug: 'solidarity-summit',
    title: 'Solidarity Summit',
    month: 'Feb',
    day: '24',
    meta: ['5:30 PM (doors 5:00 PM)', 'Trinity Temple C.O.G.I.C.'],
    address: '285 Dixwell Ave, New Haven, CT 06511, United States',
    desc: "Join New Haven Rising, Local 34, Local 33, Local 35, and community allies as we stand together for affordability, dignity, and a fair contract.",
    details: [
      'The good contracts we have fought for are not just about paychecks and healthcare. They are about dignity, worker voice, and the legacy of thousands of workers who fought for respect in the workplace.',
      'Inflation and Yale austerity threats are putting that progress at risk. We are coming together to demand transformational change for our city and our future.',
      "Now is the time to fight for affordability. The reality is simple: we can't keep up.",
    ],
    parkingTitle: 'Parking Details',
    parkingLocations: [
      {
        label: 'Trinity Temple (285 Dixwell Ave, New Haven, CT 06511, United States)',
        href: 'https://www.google.com/maps/place/285+Dixwell+Ave,+New+Haven,+CT+06511/',
      },
      {
        label: 'Varick Memorial AME Zion Church parking lot (242 Dixwell Ave, New Haven, CT 06511)',
        href: 'https://www.google.com/maps/place/242+Dixwell+Ave,+New+Haven,+CT+06511/',
      },
      {
        label: 'Wexler-Grant School parking lots on Admiral Street (55 Foote St, New Haven, CT 06511)',
        href: 'https://www.google.com/maps/place/55+Foote+St,+New+Haven,+CT+06511/',
      },
      {
        label: 'Q House parking (197 Dixwell Ave, New Haven, CT 06511)',
        href: 'https://www.google.com/maps/place/197+Dixwell+Ave,+New+Haven,+CT+06511/',
      },
    ],
    parkingMaps: [
      {
        src: '/events/solidarity-summit/shuttle-parking-overview-1.png',
        alt: 'Map showing Bowen Field parking area at Munson Street and Crescent Street.',
        caption: 'Parking & Shuttle Pickup: Bowen Field Parking Area (Munson St & Crescent St, New Haven, CT)',
        href: 'https://www.google.com/maps/place/Parking+lot,+Munson+St,+New+Haven,+CT+06511/',
      },
    ],
    shuttleTitle: 'Shuttle Pickup Locations',
    shuttleIntro:
      'For those who work downtown or near the hospital, shuttle service is available beginning at 4:45 PM. Event doors open at 5:00 PM.',
    shuttleLocations: [
      {
        label: 'Yale Medical School (333 Cedar St, New Haven, CT 06510)',
        href: 'https://www.google.com/maps/place/333+Cedar+St,+New+Haven,+CT+06510/',
      },
      {
        label: 'Union Office / First and Summerfield Church (425 College St, New Haven, CT 06511)',
        href: 'https://www.google.com/maps/place/425+College+St,+New+Haven,+CT+06511/',
      },
      {
        label: '2 Science Park parking lot (422 Winchester Ave, New Haven, CT 06511)',
        href: 'https://www.google.com/maps/place/422+Winchester+Ave,+New+Haven,+CT+06511/',
      },
      {
        label: 'Bowen Field Parking Area (Munson St & Crescent St, New Haven, CT 06511)',
        href: 'https://www.google.com/maps/place/Parking+lot,+Munson+St,+New+Haven,+CT+06511/',
      },
    ],
    shuttleMaps: [
      {
        src: '/events/solidarity-summit/333-cedar-st-pickup.png',
        alt: 'Map showing shuttle pickup location at 333 Cedar Street.',
        caption: 'Shuttle Pickup: Yale Medical School (333 Cedar St, New Haven, CT 06510)',
        href: 'https://www.google.com/maps/place/333+Cedar+St,+New+Haven,+CT+06510/',
      },
      {
        src: '/events/solidarity-summit/425-college-st-pickup.png',
        alt: 'Map showing shuttle pickup location at 425 College Street.',
        caption: 'Shuttle Pickup: Union Office / First & Summerfield (425 College St, New Haven, CT 06511)',
        href: 'https://www.google.com/maps/place/425+College+St,+New+Haven,+CT+06511/',
      },
      {
        src: '/events/solidarity-summit/2-science-park-pickup-highlighted.png',
        alt: 'Map showing highlighted pickup location at 2 Science Park.',
        caption: 'Parking & Shuttle Pickup: 2 Science Park (422 Winchester Ave, New Haven, CT 06511)',
        href: 'https://www.google.com/maps/place/422+Winchester+Ave,+New+Haven,+CT+06511/',
      },
    ],
    transportTitle: 'Parking & Shuttle Pickup',
    jotformId: '260136005054039',
    rsvpLabel: 'RSVP for our Solidarity Summit',
  },
];

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
  const [rsvpEventSlug, setRsvpEventSlug] = useState(null);
  const base = zoomBase ?? DEFAULT_ZOOM_BASE;

  function scrollToEvent() {
    const slug = eventSlugFromHash();
    if (!slug) return;
    const el = document.getElementById(`event-${slug}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  useEffect(() => {
    const syncFromHash = () => setActiveTab(tabFromHash());
    const handleHashChange = () => {
      syncFromHash();
      setTimeout(scrollToEvent, 0);
    };
    syncFromHash();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (activeTab !== 'events') return;
    setTimeout(scrollToEvent, 0);
  }, [activeTab]);

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

      {activeTab === 'events' && (
        <div id="l34-panel-events" className="l34-tab-content fade-in" role="tabpanel" aria-labelledby="l34-tab-events">
          <p className="l34-intro">Join us at these upcoming actions and meetings.</p>

          {UPCOMING_EVENTS.map((event) => (
            <article key={event.slug} id={`event-${event.slug}`} className="l34-event-card">
              <div className="l34-event-date">
                <span className="l34-month">{event.month}</span>
                <span className="l34-day">{event.day}</span>
              </div>
              <div className="l34-event-details">
                <h3 className="l34-event-title">{event.title}</h3>
                <div className="l34-event-meta">
                  {event.meta.map((m, i) => (
                    <span key={i}>{m}</span>
                  ))}
                </div>
                <p className="l34-event-address">{event.address}</p>
                <p className="l34-event-desc">{event.desc}</p>
                {event.details?.map((detail, idx) => (
                  <p key={`${event.slug}-detail-${idx}`} className="l34-event-detail">
                    {detail}
                  </p>
                ))}
                {event.parkingLocations?.length || event.shuttleLocations?.length ? (
                  <details className="l34-event-expand">
                    <summary className="l34-event-expand-summary">{event.transportTitle || 'Parking & Shuttle Pickup'}</summary>
                    <section className="l34-event-subsection" aria-label="Parking and shuttle information">
                      {event.parkingLocations?.length ? (
                        <>
                          <h4 className="l34-event-subtitle">{event.parkingTitle || 'Parking Details'}</h4>
                          <ul className="l34-event-list">
                            {event.parkingLocations.map((location) => (
                              <li key={`${event.slug}-parking-${location.label}`}>
                                {location.href ? (
                                  <a
                                    href={location.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="l34-event-location-link"
                                  >
                                    {location.label}
                                  </a>
                                ) : (
                                  location.label
                                )}
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : null}
                      {event.shuttleLocations?.length ? (
                        <>
                          <h4 className="l34-event-subtitle">{event.shuttleTitle || 'Shuttle Pickup Locations'}</h4>
                          {event.shuttleIntro ? <p className="l34-event-detail l34-event-subintro">{event.shuttleIntro}</p> : null}
                          <ul className="l34-event-list">
                            {event.shuttleLocations.map((location) => (
                              <li key={`${event.slug}-shuttle-${location.label}`}>
                                {location.href ? (
                                  <a
                                    href={location.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="l34-event-location-link"
                                  >
                                    {location.label}
                                  </a>
                                ) : (
                                  location.label
                                )}
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : null}
                      {event.parkingMaps?.length || event.shuttleMaps?.length ? (
                        <>
                          <h4 className="l34-event-subtitle">Maps</h4>
                          <div className="l34-event-map-grid">
                            {[...(event.shuttleMaps || []), ...(event.parkingMaps || [])].map((mapImage) => (
                              <figure key={`${event.slug}-${mapImage.src}`} className="l34-event-map-card">
                                {mapImage.href ? (
                                  <a
                                    href={mapImage.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="l34-event-map-link"
                                    aria-label={`Open map for ${mapImage.caption}`}
                                  >
                                    <img src={mapImage.src} alt={mapImage.alt} loading="lazy" className="l34-event-map-image" />
                                  </a>
                                ) : (
                                  <img src={mapImage.src} alt={mapImage.alt} loading="lazy" className="l34-event-map-image" />
                                )}
                                <figcaption>{mapImage.caption}</figcaption>
                              </figure>
                            ))}
                          </div>
                        </>
                      ) : null}
                    </section>
                  </details>
                ) : null}
                <button
                  type="button"
                  className="l34-btn"
                  onClick={() => {
                    const open = rsvpEventSlug !== event.slug;
                    setRsvpEventSlug(open ? event.slug : null);
                    if (open && typeof window.__trackEvent === 'function') {
                      window.__trackEvent('actions_rsvp_open', { event_name: event.title });
                    }
                  }}
                >
                  {rsvpEventSlug === event.slug ? 'Close RSVP' : event.rsvpLabel || 'RSVP'}
                </button>
                {rsvpEventSlug === event.slug && (
                  <div className="l34-form-container fade-in">
                    <form
                      action={`https://unitehere.jotform.com/submit/${event.jotformId}`}
                      method="post"
                      target="_self"
                      encType="application/x-www-form-urlencoded"
                      aria-label="RSVP form"
                      onSubmit={() => {
                        if (typeof window.__trackEvent === 'function') {
                          window.__trackEvent('actions_rsvp_submit', { event_name: event.title });
                        }
                      }}
                    >
                      <input type="hidden" name="formID" value={event.jotformId} />
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
          ))}
        </div>
      )}
    </div>
  );
};

export default ActionCenter;
