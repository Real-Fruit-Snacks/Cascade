# Contributing to Cascade

Thank you for your interest in contributing to Cascade! This guide will help you get started.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/Cascade.git
   cd cascade
   ```
3. **Install dependencies:**
   ```bash
   npm install
   ```
4. **Run in development mode:**
   ```bash
   npm run tauri dev
   ```

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) 1.70+
- [Tauri CLI prerequisites](https://tauri.app/start/prerequisites/)

## Development Workflow

1. Create a new branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your changes
3. Run the checks:
   ```bash
   npm run lint          # ESLint
   npm run build         # TypeScript check + Vite build
   npm test              # Unit tests
   cd src-tauri && cargo clippy -- -D warnings  # Rust lint
   ```
4. Commit your changes with a clear, descriptive message
5. Push to your fork and open a Pull Request

## Project Structure

| Directory | Description |
|-----------|-------------|
| `src/` | React frontend (components, stores, hooks, editor extensions) |
| `src-tauri/` | Rust backend (Tauri commands, file I/O, error handling) |
| `tests/e2e/` | Playwright end-to-end tests |
| `docs/` | Documentation, screenshots, and assets |

## Code Style

- **TypeScript**: Follow the existing ESLint configuration (`eslint.config.js`)
- **Rust**: Follow `cargo clippy` recommendations with `-D warnings`
- **CSS**: Use Tailwind CSS utility classes; custom CSS goes through the theme system
- **Commits**: Use clear, imperative-mood commit messages (e.g., "Add backlinks panel filter")

## What to Contribute

- **Bug fixes** — check the [Issues](https://github.com/Real-Fruit-Snacks/Cascade/issues) page
- **Features** — open an issue first to discuss before implementing
- **Documentation** — improvements to README, inline docs, or guides
- **Translations** — add or improve i18n translations in `src/locales/`
- **Themes** — create new themes following the existing JSON format
- **Tests** — increase unit or E2E test coverage

## Pull Request Guidelines

- Keep PRs focused on a single change
- Include a clear description of what and why
- Ensure all CI checks pass
- Add tests for new functionality when possible
- Update documentation if your change affects user-facing behavior

## Reporting Bugs

When filing a bug report, please include:

- Cascade version (from Settings or `package.json`)
- Operating system and version
- Steps to reproduce the issue
- Expected vs. actual behavior
- Screenshots if applicable

## Code of Conduct

This project follows our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold a welcoming and respectful environment.

## License

By contributing to Cascade, you agree that your contributions will be licensed under the [MIT License](LICENSE).
