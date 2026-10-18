# Baseline evidence index

Read `../mobile-responsive-test-matrix.md` for acceptance status, failure attribution and exact coverage limitations. Source baseline: `314c76404b98156ea4bdd8bb63899df24e9eb8b4`.

- `build.log`, `typecheck.log`, `lint.log`, `billing.log`, `security-ui.log`, `security-check.log`, `homepage.log`: completed repository checks. Empty typecheck/tooling-lint logs mean no diagnostics; exit outcomes are recorded in the matrix.
- `browser-install.log`: Chromium/WebKit installation, including a recovered CDN retry.
- `smoke.log` and `smoke-summary.json`: initial four-project diagnostic run. Includes two superseded mobile locator failures; never present that run as a clean acceptance result.
- `visual-create.log`: initial reference generation. This is not a regression pass.
- `visual-compare.log` and `visual-compare-summary.json`: actual comparison with generated references. Later final rerun logs, if present, take precedence.
- `interactions*.log` and `interactions*-summary.json`: safe navigation/form/dropdown/viewer checks. The final rerun takes precedence over cold-navigation timing failures in the earlier run.
- `all-viewports.log` and `all-viewports-summary.json`: all 24 engine/viewport projects for the nine public/recovery/fixture render targets.
- `screenshots/`: 36 curated viewport captures from nine targets at Chromium phone/tablet/laptop and WebKit phone. These include the development indicator; the visual regression references hide only Next.js development tooling.
- `geometry/`: corresponding control dimensions, typography, overflow candidates and console/resource diagnostics. Intentional local scrollers and decorative transforms may appear as candidates.
- `failures/` when present: curated screenshots and error context for reproduced failures. Full traces remain in ignored `test-results/` and HTML reports; public-only archives may be delivered separately.

Versioned visual reference PNGs are under `tests/responsive/__screenshots__/win32/<project>/`. HTML reports and raw test results are generated under `playwright-report/<run-label>/` and `test-results/<run-label>/`; `PW_RUN_LABEL` selects a safe lowercase slug so runs do not erase each other's artifacts. CI retains its own public-only artifacts for 14 days.

No sensitive browser session, `.env`, `.vercel`, provider credentials or build output is part of this evidence. Synthetic form text uses `example.invalid` and no form is submitted.
