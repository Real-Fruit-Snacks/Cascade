# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 0.3.x   | Yes                |
| < 0.3   | No                 |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please report vulnerabilities through one of these channels:

1. **GitHub Security Advisories** (preferred) -- use the "Report a vulnerability" button on the [Security tab](https://github.com/Real-Fruit-Snacks/Cascade/security/advisories)
2. **Private disclosure** -- contact the maintainers directly through GitHub

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Affected versions
- Potential impact
- Suggested fix (if any)

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 7 days
- **Fix release**: Within 30 days for critical issues, 90 days for others

### Scope

The following areas are in scope for security reports:

- Path traversal in file operations
- XSS in markdown rendering or plugin system
- Authentication bypass in collaboration sessions
- Arbitrary code execution via plugins or deep links
- Dependency vulnerabilities with exploitable impact

### Out of Scope

- Issues requiring physical access to the machine
- Social engineering attacks
- Denial of service against local application
- Vulnerabilities in dependencies without demonstrated impact

## Security Architecture

Cascade implements defense-in-depth:

- **Rust backend** with canonical path validation and traversal protection
- **Plugin sandboxing** via restrictive CSP and iframe isolation
- **Collaboration server** binds to localhost with Argon2 password hashing
- **Asset protocol** scoped to user document directories only
- **DOMPurify** sanitization on all rendered HTML content
- **CI pipeline** with SHA-pinned actions, cargo clippy, and npm audit

## License

This security policy is part of the [Cascade](https://github.com/Real-Fruit-Snacks/Cascade) project, licensed under [MIT](LICENSE).
