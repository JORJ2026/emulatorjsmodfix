# Security policy

## Supported versions
The latest release receives fixes.

## Reporting a problem
Please report a vulnerability **privately**: use *Security, Report a vulnerability* on https://github.com/OWNER/REPO/security/advisories/new. Do not open a public issue for it. Describe what you found and how to reproduce it; we aim to reply within 7 days.

## Design notes
* The site makes no calls to third-party servers while you play; games and saves never leave the device.
* The desktop app serves its bundled files only on 127.0.0.1 and opens other web addresses in your normal browser.
* Release files come with SHA-256 checksums.
