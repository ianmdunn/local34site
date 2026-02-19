# Security Policy

## Supported Versions

We focus on the latest release. Security updates are applied to the current development branch.

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly:

1. **Do not** open a public GitHub issue for security vulnerabilities.
2. Email the maintainers directly or use GitHub's [private vulnerability reporting](https://github.com/local34/local34site/security/advisories/new) if available.
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We aim to acknowledge reports within 48 hours and will keep you updated on progress.

## Security Practices

- Secrets (API keys, tokens, credentials) are stored in `.env` files, which are gitignored.
- Dependencies are monitored via Dependabot and `npm audit`.
