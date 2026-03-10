# Area 5: Feature UIs Review

## User Perspective
- [ ] [medium] PDF export uses browser print dialog via hidden iframe instead of actual PDF generation — user picks save path that is never written to
- [ ] [medium] WelcomeView and OnboardingScreen hardcode `Ctrl+O/N/P` — incorrect on macOS where modifier is Cmd
- [ ] [medium] FileConflictDialog, OnboardingScreen, FeatureWiki all have hardcoded English strings — no i18n
- [ ] [low] ExportModal batch abort doesn't confirm cancellation to user via toast
- [ ] [low] FilePropertiesDialog "Close" button is hardcoded English
- [ ] [low] WelcomeView `formatRelativeTime` returns hardcoded English strings

## Developer Perspective
- [x] [medium] ExportModal `markdownToHtml` builds HTML from user markdown and injects into iframe — fragile XSS surface; needs `sandbox` attribute on iframe
- [ ] [medium] ErrorBoundary only wraps AppShell — individual feature UIs have no error boundary, crash propagates to entire app
- [ ] [medium] 8 components have no i18n (FileConflictDialog, OnboardingScreen, FeatureWiki, NewFileModal, ListVariablesModal, SetVariableModal, ErrorBoundary, ToastContainer)
- [ ] [medium] ExportModal is ~1080 lines with converter functions, batch export, and UI — should extract converters for testability
- [ ] [medium] SettingsModal uses `useShallow((s) => s)` — subscribes to entire store causing re-renders on any property change
- [ ] [low] PdfViewer creates all page canvases upfront — not virtualized for large PDFs
- [ ] [low] Modal pattern inconsistency — some use createPortal to document.body, others render inline
- [ ] [nitpick] SetVariableModal duplicates sidebar localStorage key constants

## Status: Complete
