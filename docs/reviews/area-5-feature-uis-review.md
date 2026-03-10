# Area 5: Feature UIs Review

## User Perspective
- [ ] [deferred] PDF export uses browser print dialog via hidden iframe instead of actual PDF generation — user picks save path that is never written to
- [x] [medium] WelcomeView and OnboardingScreen hardcode `Ctrl+O/N/P` — replaced with platform-aware `mod` variable
- [ ] [deferred] FileConflictDialog, OnboardingScreen, FeatureWiki all have hardcoded English strings — no i18n
- [ ] [deferred] ExportModal batch abort doesn't confirm cancellation to user via toast
- [x] [low] FilePropertiesDialog "Close" button is hardcoded English — now uses `t('common:close')`
- [ ] [deferred] WelcomeView `formatRelativeTime` returns hardcoded English strings

## Developer Perspective
- [x] [medium] ExportModal `markdownToHtml` builds HTML from user markdown and injects into iframe — fragile XSS surface; needs `sandbox` attribute on iframe
- [ ] [deferred] ErrorBoundary only wraps AppShell — individual feature UIs have no error boundary, crash propagates to entire app
- [ ] [deferred] 8 components have no i18n (FileConflictDialog, OnboardingScreen, FeatureWiki, NewFileModal, ListVariablesModal, SetVariableModal, ErrorBoundary, ToastContainer)
- [ ] [deferred] ExportModal is ~1080 lines with converter functions, batch export, and UI — should extract converters for testability
- [x] [medium] SettingsModal uses `useShallow((s) => s)` — removed wasteful useShallow wrapping entire store
- [ ] [deferred] PdfViewer creates all page canvases upfront — not virtualized for large PDFs
- [ ] [deferred] Modal pattern inconsistency — some use createPortal to document.body, others render inline
- [ ] [deferred] SetVariableModal duplicates sidebar localStorage key constants

## Status: Complete
