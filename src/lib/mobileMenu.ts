/**
 * Mobile menu: toggle, close on link/overlay/Escape/resize.
 * Call initMobileMenu() when the header is in the DOM (e.g. after parse or after-swap).
 */

const MOBILE_BREAKPOINT = '(max-width: 767px)';

function isMobile(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_BREAKPOINT).matches;
}

export function closeMobileMenu(): void {
  const header = document.getElementById('header');
  if (!header) return;
  const btn = header.querySelector<HTMLElement>('[data-aw-toggle-menu]');
  const nav = header.querySelector<HTMLElement>('nav');
  btn?.classList.remove('expanded');
  btn?.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('overflow-hidden');
  header.classList.remove('h-screen', 'expanded', 'bg-page');
  if (nav && isMobile()) nav.classList.add('hidden');
}

function openMenu(header: HTMLElement, btn: HTMLElement, nav: HTMLElement): void {
  btn.classList.add('expanded');
  btn.setAttribute('aria-expanded', 'true');
  document.body.classList.add('overflow-hidden');
  header.classList.add('h-screen', 'expanded', 'bg-page');
  nav.classList.remove('hidden');
}

export function initMobileMenu(): void {
  const header = document.getElementById('header');
  if (!header) return;

  const btn = header.querySelector<HTMLButtonElement>('[data-aw-toggle-menu]');
  const nav = header.querySelector<HTMLElement>('nav');
  if (!btn || !nav) return;

  if (btn.hasAttribute('data-aw-menu-bound')) return;
  btn.setAttribute('data-aw-menu-bound', 'true');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', nav.id || 'main-nav');

  function handleToggle(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
    if (!isMobile()) return;
    const isOpen = header!.classList.contains('expanded');
    if (isOpen) closeMobileMenu();
    else openMenu(header!, btn!, nav!);
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key !== 'Escape') return;
    if (header!.classList.contains('expanded')) {
      closeMobileMenu();
      btn!.focus();
    }
  }

  btn.addEventListener('click', handleToggle, { capture: true });

  document.addEventListener('keydown', handleKeydown);

  header.addEventListener('click', (e) => {
    if (!isMobile()) return;
    const target = e.target as HTMLElement;
    if (target.hasAttribute('data-aw-menu-overlay')) closeMobileMenu();
  });

  nav.addEventListener('click', () => {
    if (isMobile()) closeMobileMenu();
  });

  window.matchMedia(MOBILE_BREAKPOINT).addEventListener('change', closeMobileMenu);

  if (typeof window !== 'undefined') {
    (window as unknown as { __closeMobileMenu?: () => void }).__closeMobileMenu = closeMobileMenu;
  }
}
