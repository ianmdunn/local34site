import React, { useState } from 'react';

export default function YaleWealthSignup({ formAction = 'https://unitehere.jotform.com/submit/260136005054039' }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="yale-wealth-signup">
      <h2 className="yale-wealth-signup__title">Stay in the loop</h2>
      <p className="yale-wealth-signup__subtitle">
        Join the text list for real-time updates on negotiations, actions, and contract wins.
      </p>
      <button
        type="button"
        className="yale-wealth-signup__toggle"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        {expanded ? 'Close form' : 'Join the fight'}
      </button>
      {expanded && (
        <div className="yale-wealth-signup__form-wrap yale-wealth-fade-in">
          <form
            action={formAction}
            method="post"
            className="yale-wealth-signup__form"
            aria-label="Sign up for text updates"
          >
            <input type="hidden" name="formID" value="260136005054039" />
            <div className="yale-wealth-signup__row">
              <label htmlFor="yale-signup-first" className="sr-only">
                First name
              </label>
              <input
                id="yale-signup-first"
                type="text"
                name="q3_name[first]"
                placeholder="First name"
                required
                className="yale-wealth-signup__input"
                autoComplete="given-name"
              />
              <label htmlFor="yale-signup-last" className="sr-only">
                Last name
              </label>
              <input
                id="yale-signup-last"
                type="text"
                name="q3_name[last]"
                placeholder="Last name"
                required
                className="yale-wealth-signup__input"
                autoComplete="family-name"
              />
            </div>
            <label htmlFor="yale-signup-department" className="sr-only">
              Department
            </label>
            <input
              id="yale-signup-department"
              type="text"
              name="q7_department"
              placeholder="Department"
              className="yale-wealth-signup__input"
              autoComplete="organization-title"
            />
            <label htmlFor="yale-signup-phone" className="sr-only">
              Mobile phone
            </label>
            <input
              id="yale-signup-phone"
              type="tel"
              name="q5_phoneNumber[full]"
              placeholder="Mobile phone"
              required
              className="yale-wealth-signup__input"
              autoComplete="tel"
            />
            <p className="yale-wealth-signup__disclaimer">
              By providing your number, you opt-in to receive text messages from UNITE HERE. Standard rates apply.
            </p>
            <label htmlFor="yale-signup-email" className="sr-only">
              Email (optional)
            </label>
            <input
              id="yale-signup-email"
              type="email"
              name="q4_email"
              placeholder="Email (optional)"
              className="yale-wealth-signup__input"
              autoComplete="email"
            />
            <button type="submit" className="yale-wealth-signup__submit">
              Join the fight
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
