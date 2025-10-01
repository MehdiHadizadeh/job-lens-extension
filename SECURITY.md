# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via:
- Email: [mehdihadizadeh.k@gmail.com]
- GitHub Security Advisory (preferred)

Include:
- Type of vulnerability
- Full paths of source file(s) related to the issue
- Location of the affected source code (tag/branch/commit)
- Step-by-step instructions to reproduce
- Proof-of-concept or exploit code (if possible)
- Impact of the issue

## What to Expect

- **Response Time**: We aim to acknowledge reports within 48 hours
- **Updates**: We'll keep you informed of progress
- **Fix Timeline**: We'll work to fix verified issues as quickly as possible
- **Disclosure**: We follow coordinated disclosure practices

## Security Best Practices

### For Users
- Only install from official sources
- Review permissions before installation
- Keep the extension updated
- Report suspicious behavior

### For Contributors
- Never commit API keys, passwords, or secrets
- Sanitize user input
- Use HTTPS for all external requests
- Follow principle of least privilege
- Validate data from external sources

## Known Security Considerations

### Data Storage
- Notes stored in `chrome.storage.local` (device-only)
- Settings stored in `chrome.storage.sync` (synced with account)
- No data sent to third parties
- Feedback votes stored on Cloudflare Workers KV

### Permissions
- `storage`: For saving notes and settings
- Host permissions: Only for Jobinja.ir and Jobvision.ir
- No access to browsing history or other sites

### Third-Party Services
- Tajrobe.wiki API: For company reviews (read-only)
- Cloudflare Workers: For feedback aggregation

## Privacy

See [privacy.html](privacy.html) for our complete privacy policy.

## Disclosure Policy

When we receive a security report:
1. Confirm the issue
2. Determine severity
3. Develop and test a fix
4. Release a patched version
5. Publicly disclose after users have had time to update

Security advisories will be published on GitHub.
