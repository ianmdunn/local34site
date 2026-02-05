import defaultTheme from 'tailwindcss/defaultTheme';
import plugin from 'tailwindcss/plugin';
import typographyPlugin from '@tailwindcss/typography';

export default {
  content: ['./src/**/*.{astro,html,js,jsx,json,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      fontSize: {
        /* Slightly tighter scale for best-practice readability; base stays 16px */
        xs: ['0.75rem', { lineHeight: '1.25rem' }],
        sm: ['0.875rem', { lineHeight: '1.375rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.625rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '1.75rem' }],
        '3xl': ['1.875rem', { lineHeight: '2rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.25rem' }],
        '5xl': ['2.5rem', { lineHeight: '2.5rem' }],
        '6xl': ['3rem', { lineHeight: '2.75rem' }],
      },
      colors: {
        primary: 'var(--aw-color-primary)',
        secondary: 'var(--aw-color-secondary)',
        accent: 'var(--aw-color-accent)',
        default: 'var(--aw-color-text-default)',
        heading: 'var(--aw-color-text-heading)',
        muted: 'var(--aw-color-text-muted)',
      },
      fontFamily: {
        sans: ['ibm-plex-sans', 'var(--aw-font-sans)', ...defaultTheme.fontFamily.sans],
        serif: ['ibm-plex-serif', 'var(--aw-font-serif)', ...defaultTheme.fontFamily.serif],
        heading: ['archer-pro', 'var(--aw-font-heading)', ...defaultTheme.fontFamily.sans],
        condensed: ['ibm-plex-sans-condensed', 'var(--aw-font-condensed)', ...defaultTheme.fontFamily.sans],
        mono: ['ibm-plex-mono', 'var(--aw-font-mono)', ...defaultTheme.fontFamily.mono],
      },

      animation: {
        fade: 'fadeInUp 1s both',
      },

      keyframes: {
        fadeInUp: {
          '0%': { opacity: 0, transform: 'translateY(2rem)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      },

      boxShadow: {
        primary: '0 4px 14px 0 color-mix(in srgb, var(--aw-color-primary) 25%, transparent)',
        'primary/25': '0 4px 14px 0 color-mix(in srgb, var(--aw-color-primary) 25%, transparent)',
        'primary-lg':
          '0 10px 15px -3px color-mix(in srgb, var(--aw-color-primary) 30%, transparent), 0 4px 6px -4px color-mix(in srgb, var(--aw-color-primary) 30%, transparent)',
        'primary-dark': '0 4px 14px 0 color-mix(in srgb, var(--aw-color-primary) 20%, transparent)',
      },
    },
  },
  plugins: [
    typographyPlugin,
    plugin(({ addVariant }) => {
      addVariant('intersect', '&:not([no-intersect])');
    }),
  ],
  darkMode: 'class',
};
