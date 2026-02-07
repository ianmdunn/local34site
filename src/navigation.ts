import { getCanonical, getPathWithBase } from './utils/permalinks';

/**
 * Nav link href: relative path on localhost (dev) for in-site navigation; full canonical URL in production.
 */
const navHref = (path: string): string => {
  const pathNorm = path.startsWith('/') ? path : `/${path}`;
  if (import.meta.env.DEV) {
    return getPathWithBase(pathNorm);
  }
  const url = getCanonical(pathNorm);
  return typeof url === 'string' ? url : url.toString();
};

export interface NavLink {
  text: string;
  href: string;
  children?: { text: string; href: string }[];
}

const mainNavLinks: NavLink[] = [
  { text: 'Who We Are', href: navHref('/who-we-are') },
  { text: 'Our Contract', href: navHref('/our-contract') },
  { text: 'How We Win', href: navHref('/how-we-win') },
  { text: 'Actions', href: navHref('/actions') },
  { text: "Yale's Wealth", href: navHref('/yales-wealth') },
  { text: 'Contact Us', href: navHref('/contact') },
];

export const headerData = { links: mainNavLinks };
export const footerData = {
  links: mainNavLinks,
  socialLinks: [{ ariaLabel: 'Facebook', text: 'Facebook', href: 'https://www.facebook.com/34unitehere' }],
  address: {
    name: 'Local 34-UNITE HERE!',
    line1: '425 College Street, 2nd Floor',
    cityStateZip: 'New Haven, CT 06511',
  },
  privacyPolicyUrl: 'https://unitehere.org/privacy-policy/',
};
