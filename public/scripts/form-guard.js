/**
 * JotForm Posting Guard – client-side bot protection for JotForm embeddings.
 * Targets: form[action*="jotform.com/submit/"]
 *
 * Does not submit forms; decides whether a user's submission is allowed to reach JotForm.
 */

(function () {
  'use strict';

  // Exclude data-l34-no-guard forms (e.g. RSVP) – honeypot with autocomplete='off' breaks browser autofill
  const FORM_SELECTOR = 'form[action*="jotform.com/submit/"]:not([data-l34-no-guard])';
  const MIN_SECONDS_BEFORE_SUBMIT = 8;
  const MIN_HUMAN_SIGNALS = 2;
  const MIN_SUBMIT_INTERVAL_MS = 30000;
  const STORAGE_KEY = 'local34_last_submit_ts';
  const RESET_BUTTON_TEXT = 'Submit';

  const PAGE_LOAD_TS = Date.now();
  let humanSignalCount = 0;

  function countHumanSignal() {
    humanSignalCount += 1;
  }

  const HONEYPOT_NAME = 'l34_hp_url';
  function injectHoneypot(form) {
    if (form.querySelector('input[name="' + HONEYPOT_NAME + '"]')) return;
    const hp = document.createElement('input');
    hp.type = 'text';
    hp.name = HONEYPOT_NAME;
    hp.setAttribute('aria-hidden', 'true');
    hp.setAttribute('tabindex', '-1');
    hp.autocomplete = 'off';
    hp.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
    form.appendChild(hp);
  }

  function hasSpamText(form) {
    const urlPattern = /\b(https?:\/\/|www\.)/i;
    const inputs = form.querySelectorAll('input[type="text"], input[type="email"], input:not([type]), textarea');
    for (let i = 0; i < inputs.length; i++) {
      const v = (inputs[i].value || '').trim();
      if (v && urlPattern.test(v)) return true;
    }
    return false;
  }

  function getSubmitButton(form) {
    return form.querySelector('button[type="submit"], input[type="submit"]');
  }

  function resetButton(btn) {
    if (!btn) return;
    btn.disabled = false;
    btn.textContent = RESET_BUTTON_TEXT;
  }

  function blockSubmit(form, reason) {
    const btn = getSubmitButton(form);
    resetButton(btn);
    alert('Please complete the form manually to submit.');
  }

  function maybeInjectPayloadMetadata(form) {
    if (form.querySelector('input[name="js_submit_started_at"]')) return;
    const el = document.createElement('input');
    el.type = 'hidden';
    el.name = 'js_submit_started_at';
    el.value = String(PAGE_LOAD_TS);
    form.appendChild(el);
  }

  function onSubmit(e) {
    const form = e.target;
    if (!form || !form.matches || !form.matches(FORM_SELECTOR)) return;

    injectHoneypot(form);

    const honeypot = form.querySelector('input[name="' + HONEYPOT_NAME + '"]');
    if (honeypot && honeypot.value) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      blockSubmit(form, 'honeypot');
      return;
    }

    const elapsed = (Date.now() - PAGE_LOAD_TS) / 1000;
    if (elapsed < MIN_SECONDS_BEFORE_SUBMIT) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      blockSubmit(form, 'timing');
      return;
    }

    if (humanSignalCount < MIN_HUMAN_SIGNALS) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      blockSubmit(form, 'human_signals');
      return;
    }

    const last = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
    if (Date.now() - last < MIN_SUBMIT_INTERVAL_MS) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      blockSubmit(form, 'rate_limit');
      return;
    }

    if (hasSpamText(form)) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      blockSubmit(form, 'spam');
      return;
    }

    maybeInjectPayloadMetadata(form);
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  }

  function tryBind() {
    document.querySelectorAll(FORM_SELECTOR).forEach(function (form) {
      if (form.dataset.jotformGuardBound) return;
      form.dataset.jotformGuardBound = '1';
      form.addEventListener('submit', onSubmit, true);
      injectHoneypot(form);
    });
  }

  document.addEventListener('pointerdown', countHumanSignal, { passive: true });
  document.addEventListener('keydown', countHumanSignal, { passive: true });
  document.addEventListener('touchstart', countHumanSignal, { passive: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryBind);
  } else {
    tryBind();
  }

  const obs = new MutationObserver(function () {
    tryBind();
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();
