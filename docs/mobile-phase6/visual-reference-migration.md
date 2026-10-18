# Explicit visual reference migration

The historical Phase 1 Video reference and Phase 2 Login/Legal references remain unchanged in tests/responsive/__screenshots__/win32. No old reference was overwritten or test deleted. The legacy visual.spec.ts now compares separately named phase6-login, phase6-legal and phase6-video-fixture references at the same routes, with the same hydration, font, screenshot and difference assertions.

The archived mobile Video image places the preview/carousel above its creation form. Phase 4 intentionally placed creation controls before the preview on compact/tablet screens (see mobile-phase4/README.md and video-studio-v2.module.css). The preview remains present below the form and in the desktop side column; this is not removed playback functionality. The two video CSS files and fixture page were unchanged between the verified Phase 4 and Phase 5 commits. Phase 6 changes only animation lifecycle in the Video controller/rail, not form/preview order. Both archived and current images are shown in review-mobile.jpg; review-candidates.jpg covers all 18 new images.

Login/Legal references predate the explicitly reviewed Phase 5 input typography, touch/focus and policy presentation changes. The retained Phase 5 public visual suite remains an independent current reference.

Candidates were generated with --update-snapshots=missing, visually reviewed as actual images, then compared without update permission. An initial WebKit legal candidate timed out under concurrent local auditing; that failed run is recorded and the missing file was generated separately. Newly named images require an explicit review; missing-file creation is not itself an accepted comparison. Final comparison logs are under verification. The older Phase 2/3/4/5 suites also run without updating their approved references.

OS/browser/viewport-specific references cannot be silently reused on Linux. CI runs the full functional matrix; approved Windows pixel comparisons are a separate verified run, with no claim of Linux screenshot baselines.
