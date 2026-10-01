# Legal pages design QA

## Evidence

- Source visual truth: `C:\Users\The Perfect Point\.codex\generated_images\01a0dd81-6b05-7693-b705-25ce65958701\exec-36bb724c-318a-49cc-9f52-f217e0bbdbe4.png`
- Desktop implementation: `C:\Users\The Perfect Point\Documents\Codex\2026-09-26\work-on-the-existing-all-model\work\allmodelhub-legal-pages\privacy-desktop-v2.png`
- Mobile implementation: `C:\Users\The Perfect Point\Documents\Codex\2026-09-26\work-on-the-existing-all-model\work\allmodelhub-legal-pages\privacy-mobile-cdp.png`
- Dark-theme implementation: `C:\Users\The Perfect Point\Documents\Codex\2026-09-26\work-on-the-existing-all-model\work\allmodelhub-legal-pages\privacy-mobile-dark.png`
- Combined source/implementation comparison: `C:\Users\The Perfect Point\Documents\Codex\2026-09-26\work-on-the-existing-all-model\work\allmodelhub-legal-pages\design-qa-comparison.png`
- Source pixels: 1487 × 1058.
- Desktop implementation pixels/CSS viewport: 1440 × 1024 at device scale factor 1.
- Mobile implementation pixels/CSS viewport: 390 × 844 at device scale factor 1.
- State: Privacy Policy, light mode by default, unauthenticated, page top. Dark mode was also captured and verified.
- Density normalization: both implementation captures were taken at device scale factor 1. The source and desktop implementation are close enough in size to compare full-view composition directly; the combined image preserves both at native size without resampling.

## Full-view comparison

The implementation preserves the selected concept's primary hierarchy: premium header, large editorial policy hero, branded trust visual, four-policy switcher, policy review state, left section navigation, concise at-a-glance panel, structured policy body, and support rail. The implementation intentionally uses the light theme because the product requirement specifies light as the first-visit default; the selected concept's dark palette remains available through the theme toggle.

## Focused-region comparison

The hero/header and policy switcher were reviewed at desktop and at a true 390px mobile viewport. The mobile hero, switcher, review notice, and title wrapping were inspected separately because these details are too small to judge reliably in the full-view comparison. The real Models Suite raster logo remains sharp at both sizes, Phosphor icons are consistent, the switcher remains horizontally usable on narrow screens, and the document has no horizontal page overflow.

## Required fidelity surfaces

- Fonts and typography: system/Inter stack matches the existing product; display hierarchy, optical weight, letter spacing, line height, title wrapping, and small UI labels are consistent with the reference and readable in both themes.
- Spacing and layout rhythm: desktop uses the reference's wide hero and three-column reading layout; tablet collapses the support rail; mobile becomes one column with compact navigation and a disclosure-based contents menu.
- Colors and visual tokens: cyan, deep ink, and violet map to existing Models Suite tokens. Light is the required default and dark remains a complete alternate state with sufficient contrast.
- Image quality and asset fidelity: the real transparent Models Suite logo is used. Standard interface symbols use the existing Phosphor icon library; no emoji or handcrafted SVG replacements are present.
- Copy and content: all four documents provide a plain-language overview plus detailed sections. The existing pre-launch legal-review gate remains visible and no unsupported certification or legal-review claim was introduced.

## Comparison history

### Iteration 1

- [P2] Narrow-screen policy titles could visually clip in an initial cropped mobile capture.
  - Fix: corrected the mobile width calculation, reduced the responsive title scale, and enabled safe title wrapping.
  - Post-fix evidence: `privacy-mobile-cdp.png` at a true 390 × 844 CSS viewport shows the full “Privacy Policy” title and reports `scrollWidth = clientWidth = 390`.
- [P2] The first implementation approximated the reference's orbital illustration with CSS shapes.
  - Fix: replaced the approximation with the real Models Suite logo and functional trust-summary cards using the existing icon library.
  - Post-fix evidence: `privacy-desktop-v2.png` and `design-qa-comparison.png` show the final branded trust panel.

### Final findings

- No actionable P0, P1, or P2 differences remain.
- Intentional difference: source visual is dark; implementation opens in light mode to satisfy the explicit product requirement and includes a fully styled dark mode.

## Interaction and runtime verification

- `/terms`, `/privacy`, `/acceptable-use`, and `/refunds` each returned HTTP 200 with route-specific metadata.
- At a 390px viewport all four routes had `scrollWidth = clientWidth = 390`, rendered the correct H1, and showed no Next.js error overlay.
- First-visit theme resolved to `light`; the theme button changed the page to `dark` and persisted that preference.
- Browser runtime exceptions: 0.
- Browser error log entries: 0.

## Final result

final result: passed
