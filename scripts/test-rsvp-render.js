#!/usr/bin/env node
/**
 * Verify RSVP form render – checks autocomplete attributes in HTML.
 * Run: node scripts/test-rsvp-render.js [url]
 * Default: http://localhost:4321/actions
 */
const BASE_URL = process.argv[2] || 'http://localhost:4321/actions';

async function main() {
  console.log('Fetching', BASE_URL, '...');
  const res = await fetch(BASE_URL);
  const html = await res.text();

  // Find form inputs in adv-form (SSR output includes forms with display:none)
  const formMatch = html.match(/<form[^>]*class="[^"]*adv-form[^"]*"[^>]*>([\s\S]*?)<\/form>/);
  if (!formMatch) {
    console.error('No adv-form found');
    process.exit(1);
  }

  const formHtml = formMatch[1];
  const issues = [];
  const seen = [];

  const getAttr = (tag, attr) => {
    const re = new RegExp(`\\b${attr}=["']([^"']*)["']`, 'i');
    const m = tag.match(re);
    return m ? m[1] : null;
  };

  const inputTags = formHtml.match(/<input[^>]+\/?>/gi) || [];
  const selectTags = formHtml.match(/<select[^>]*>/gi) || [];

  for (const tag of inputTags) {
    const type = (getAttr(tag, 'type') || 'text').toLowerCase();
    const name = getAttr(tag, 'name');
    const autocomplete = getAttr(tag, 'autocomplete') || getAttr(tag, 'autoComplete');
    if (type === 'hidden' || !name) continue;
    if (name.includes('event_') || name.includes('website') || name.includes('formID')) continue;

    const key = name;
    if (seen.includes(key)) continue;
    seen.push(key);

    const record = { name, autocomplete: autocomplete || '(none)' };
    if (name.includes('first') || name.includes('[first]')) {
      if (autocomplete !== 'given-name') issues.push({ ...record, expected: 'given-name' });
    } else if (name.includes('last') || name.includes('[last]')) {
      if (autocomplete !== 'family-name') issues.push({ ...record, expected: 'family-name' });
    } else if (name.includes('email') || type === 'email') {
      if (autocomplete !== 'email') issues.push({ ...record, expected: 'email' });
    } else if (name.includes('phone') || type === 'tel' || name.includes('tel')) {
      if (autocomplete !== 'tel' && autocomplete !== 'tel-national')
        issues.push({ ...record, expected: 'tel or tel-national' });
    } else if (name.includes('organization') || name.includes('department')) {
      if (autocomplete !== 'organization') issues.push({ ...record, expected: 'organization' });
    }

    console.log(`  ${name}: autocomplete="${autocomplete || '(none)'}"`);
  }

  for (const tag of selectTags) {
    const name = getAttr(tag, 'name');
    const autocomplete = getAttr(tag, 'autocomplete') || getAttr(tag, 'autoComplete');
    if (!name) continue;
    if (name.includes('organization')) {
      if (autocomplete !== 'organization') issues.push({ name, autocomplete: autocomplete || '(none)', expected: 'organization' });
    }
    console.log(`  ${name} (select): autocomplete="${autocomplete || '(none)'}"`);
  }

  console.log('\n--- Result ---');
  if (issues.length) {
    console.log('Issues:');
    issues.forEach((i) => console.log(`  - ${i.name}: got "${i.autocomplete}", expected "${i.expected}"`));
    process.exit(1);
  }
  console.log('All autocomplete attributes look correct.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
