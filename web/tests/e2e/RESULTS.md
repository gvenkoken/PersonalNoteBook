# T14 acceptance verification

Status: NOT RUN. Acceptance remains Unknown until the Factory records results.
No restore, build or test commands were executed during implementation.

The existing `web/package.json` test script runs Vitest once and discovers
`tests/e2e/App.acceptance.test.tsx` automatically. No browser, external service,
new package or API-method mock is required.

Coverage:

- AC01.35: App through fetch, new note, Ctrl+S and naming, duplicate warning
  before writing, failed save with retained content and dirty/unload warning,
  cancel/save/discard closure, saved-note opening, cancel/confirm deletion,
  and remount with persisted order and a deleted id skipped.
- AC01.36: status and JSON both report 15 for `Süt al\nEkmek al`;
  captured download Blob text equals each preview; standalone HTML escapes
  title and body, parses without a script, and preserves body text; filenames
  and content types are checked.

Factory should record the Vitest output and exit status here or in its run
artifacts. No successful test result or human acceptance is claimed.
