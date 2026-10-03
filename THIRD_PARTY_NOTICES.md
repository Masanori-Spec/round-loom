# Third-party inventory

No third-party JavaScript, fonts, images, or CSS are shipped in the runtime application. All browser graphics are simple original CSS shapes.

Development-only browser tooling is pinned in package-lock.json:

- @playwright/test 1.56.0, Playwright 1.56.0, playwright-core 1.56.0 (Microsoft; Apache-2.0)
- Optional fsevents transitive package on macOS (MIT; see installed package metadata)

Dependencies' own notices and license files remain in their packages when installed; node_modules is excluded from the deliverable archive. Their licenses do not establish a license for this project's original source. An original-project license has not been selected.
