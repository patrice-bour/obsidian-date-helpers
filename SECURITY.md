# Security Policy

## Supported versions

Only the latest released version of **Date Helpers** receives security fixes. Please make sure you are running the latest release before reporting an issue.

| Version | Supported |
|---|---|
| 0.1.x   | ✅ |
| < 0.1.0 | ❌ |

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

If you discover a security issue, report it privately by email:

**patrice.bour.71@gmail.com**

Include in your report:

- A clear description of the vulnerability
- Steps to reproduce it (minimal proof of concept if possible)
- The affected version of Date Helpers
- Your assessment of the impact

You should receive an acknowledgment within **7 days**. If the issue is confirmed, a fix will be prepared and coordinated with you before public disclosure.

## Scope

This plugin runs inside Obsidian and has access to:

- The currently opened vault (read/write)
- The user's settings for this plugin
- No network connections (all parsing is local)
- No telemetry or analytics

If you find behavior that contradicts any of the above, please report it as a security issue.
