---
name: pixel-perfect-reference-to-responsive-web
description: >
  Reconstruct a website from one or more reference images with minimal human feedback.
  Analyze the visual system, infer layout and stacking behavior, extract or regenerate assets,
  implement the frontend, compare rendered output against the reference, and recursively refine
  the implementation until it is visually accurate, structurally clean, and responsive.
version: 1.0.0
category: frontend-engineering
recommended_for:
  - Codex
  - Claude Code
  - autonomous coding agents
  - multimodal frontend agents
primary_goal: >
  Convert a visual reference into a clean, maintainable, responsive website that matches the
  source image as closely as possible while preserving semantic HTML, accessibility, performance,
  and predictable behavior across viewports.
---

# Pixel-Perfect Reference Image to Responsive Website Skill

## 1. Mission

You are an autonomous frontend reconstruction engineer.

Your job is not merely to make a website that is “inspired by” a reference image.

Your job is to:

1. Understand the reference image as a visual system.
2. Decompose it into sections, layers, components, assets, typography, spacing, and interaction states.
3. Infer the likely document structure and stacking model.
4. Rebuild the page using clean, maintainable frontend code.
5. Render the implementation at the same viewport as the reference.
6. Compare the implementation against the reference.
7. Identify visual mismatches.
8. Refactor the code based primarily on the image comparison rather than repeated human feedback.
9. Repeat the comparison loop until the result is as close to 1:1 as reasonably possible.
10. Ensure the final implementation remains responsive, accessible, performant, and easy to modify.

The visual reference is the primary source of truth.

The codebase is the implementation medium.

Human feedback is a fallback, not the main validation mechanism.

---

# 2. Core Operating Principles

## 2.1 Treat the Image as a Specification

Do not treat the reference image as decoration or loose inspiration.

Treat it as a compressed design specification containing:

- page hierarchy
- section boundaries
- grid structure
- spacing rhythm
- alignment rules
- typography hierarchy
- color system
- component shapes
- shadow behavior
- image crops
- background layers
- overlap behavior
- responsive intent
- implied interaction patterns
- emphasis and visual priority

Every visible decision should be explained by an inferred layout rule.

Do not “eyeball and move on.” Measure, infer, implement, render, compare, and correct.

---

## 2.2 Prefer Structural Accuracy Over Pixel Hacks

A visually close result created with fragile absolute positioning is not a successful reconstruction.

The implementation should be:

- visually accurate
- semantically structured
- componentized
- responsive
- maintainable
- deterministic
- stable when content changes slightly

Use absolute positioning only when the visual design genuinely requires overlapping or floating elements.

Do not use arbitrary coordinates to compensate for incorrect parent layout.

---

## 2.3 Use the Reference More Than Human Feedback

The agent should independently detect and correct:

- wrong section heights
- incorrect margins
- misplaced decorative assets
- incorrect image crops
- typography mismatches
- wrong border radii
- misaligned content
- incorrect z-index ordering
- missing gradients
- inconsistent spacing
- overflow issues
- mobile breakage

Do not repeatedly ask the user whether the page “looks right.”

Render the page, compare it with the reference, diagnose the difference, and revise it.

Ask the user only when the reference genuinely does not contain enough information to make a defensible decision.

---

## 2.4 Build From Large Geometry to Fine Detail

Always refine in this order:

1. Page canvas and viewport assumptions
2. Major section boundaries
3. Content width and horizontal alignment
4. Large visual blocks and hero composition
5. Layering and overlap
6. Typography scale and line breaks
7. Images and crops
8. Components
9. Shadows, gradients, borders, and radii
10. Micro-spacing and decorative detail
11. Responsive behavior
12. Accessibility and code cleanup

Do not polish icons while the main layout is still wrong.

---

# 3. Inputs

The skill may receive any combination of:

- one desktop screenshot
- multiple screenshots from different viewport sizes
- a full-page screenshot
- screenshots of individual sections
- a partially implemented repository
- a blank frontend project
- source images or logos
- a URL to an existing codebase
- textual constraints from the user
- preferred framework or stack

When multiple images are available, treat them as a multi-view specification.

When only one image is available, infer responsive behavior using visual evidence and standard layout principles.

---

# 4. Required Outputs

The final result should include:

- a working frontend implementation
- clean component structure
- responsive behavior
- recreated or extracted assets
- no unnecessary background baked into assets
- sensible z-index architecture
- reusable design tokens
- visual comparison evidence where tooling permits
- a summary of remaining unavoidable differences
- clear run instructions
- no known horizontal overflow
- no broken assets
- no placeholder content unless the reference itself is ambiguous

Recommended deliverables:

```text
/
├── src/
│   ├── components/
│   ├── sections/
│   ├── assets/
│   ├── styles/
│   ├── hooks/
│   ├── utils/
│   └── pages/
├── public/
├── visual-tests/
│   ├── reference/
│   ├── renders/
│   ├── diffs/
│   └── reports/
├── README.md
└── IMPLEMENTATION_NOTES.md
```

---

# 5. High-Level Execution Loop

Use the following autonomous loop:

```text
ANALYZE REFERENCE
      ↓
CREATE VISUAL SPECIFICATION
      ↓
PLAN DOM + COMPONENT TREE
      ↓
PLAN LAYERS + Z-INDEX
      ↓
PREPARE ASSETS
      ↓
IMPLEMENT LARGE STRUCTURE
      ↓
RENDER AT REFERENCE VIEWPORT
      ↓
COMPARE AGAINST REFERENCE
      ↓
CLASSIFY MISMATCHES
      ↓
FIX HIGHEST-IMPACT MISMATCHES
      ↓
RENDER AGAIN
      ↓
REPEAT UNTIL STOPPING CRITERIA ARE MET
      ↓
VALIDATE RESPONSIVENESS
      ↓
REFACTOR WITHOUT CHANGING VISUAL OUTPUT
      ↓
FINAL VISUAL REGRESSION CHECK
```

This loop is mandatory.

A first-pass implementation is never considered final.

---

# 6. Phase 1 — Inspect the Repository

Before writing code, inspect the current environment.

Determine:

- framework
- build system
- package manager
- routing setup
- styling approach
- existing components
- existing design tokens
- available assets
- image tooling
- screenshot tooling
- testing setup
- linting and formatting rules
- deployment target

Typical commands:

```bash
pwd
find . -maxdepth 3 -type f | sort
cat package.json
cat vite.config.*
cat next.config.*
cat tsconfig.json
find src -maxdepth 4 -type f | sort
find public -maxdepth 4 -type f | sort
```

Do not replace an existing architecture without a reason.

Prefer adapting the repository’s current conventions.

If the project is empty, use a minimal production-ready stack such as:

- React
- TypeScript
- Vite or Next.js
- CSS Modules, Tailwind, or well-structured CSS
- Playwright for screenshots
- Sharp or ImageMagick for image processing

The user’s explicit stack preference overrides defaults.

---

# 7. Phase 2 — Reference Image Analysis

## 7.1 Establish Image Metadata

Record:

- image width
- image height
- aspect ratio
- apparent browser viewport
- whether browser chrome is included
- whether it is a full-page capture or a viewport crop
- whether the image is compressed
- whether text or images appear scaled
- whether the screenshot uses standard or retina pixel density

Create a reference record:

```yaml
reference:
  width_px: 1440
  height_px: 1024
  probable_viewport_css_px:
    width: 1440
    height: 1024
  pixel_ratio_assumption: 1
  capture_type: viewport
  browser_chrome_included: false
```

Do not assume the screenshot dimensions equal CSS viewport dimensions when evidence suggests retina scaling.

---

## 7.2 Build a Section Map

Divide the image vertically into major sections.

For each section, identify:

- estimated top position
- estimated height
- background
- content container width
- alignment model
- visible components
- overlap with adjacent sections
- likely responsive behavior

Example:

```yaml
sections:
  - id: header
    y_start: 0
    y_end: 88
    height: 88
    background: "#ffffff"
    layout: horizontal
    position: static
  - id: hero
    y_start: 88
    y_end: 760
    height: 672
    background: "warm off-white with radial glow"
    layout: two-column asymmetric
    overlap: "right-side product image overlaps bottom boundary"
  - id: trust-strip
    y_start: 720
    y_end: 820
    height: 100
    overlap: "sits above hero and next section"
```

Create section boundaries before implementing components.

---

## 7.3 Build a Horizontal Grid Map

Infer:

- full-page padding
- maximum content width
- number of columns
- column ratios
- gutters
- alignment anchors
- repeated x-coordinates
- left edges shared by headings, paragraphs, and buttons
- right edges shared by images or cards

Look for recurring vertical alignment lines.

Example:

```yaml
grid:
  viewport_width: 1440
  page_padding_left: 72
  page_padding_right: 72
  max_content_width: 1296
  columns:
    - name: hero-copy
      width_ratio: 0.46
    - name: hero-visual
      width_ratio: 0.54
  gutter: 48
```

Repeated alignment is more important than individual element coordinates.

---

## 7.4 Build a Typography Map

For every visible text style, estimate:

- font family category
- font weight
- font size
- line height
- letter spacing
- case
- color
- maximum width
- line breaks
- text alignment

Classify styles:

```yaml
typography:
  display:
    family: "modern geometric sans"
    size_px: 72
    line_height: 0.98
    weight: 650
    letter_spacing_em: -0.04
  body_large:
    size_px: 20
    line_height: 1.55
    weight: 400
  nav:
    size_px: 14
    line_height: 1.2
    weight: 500
```

When the exact font is unknown:

1. inspect any provided assets or source files
2. search existing project dependencies
3. use a visually similar system or open font
4. tune size, width, letter spacing, and line height to reproduce line wrapping

A wrong font can often be partially compensated through typography metrics, but do not force a poor match if a closer font is available.

---

## 7.5 Build a Color and Surface Map

Extract or estimate:

- page background
- section backgrounds
- text colors
- accent colors
- muted colors
- border colors
- gradient stops
- shadows
- overlays
- transparency
- blur intensity

Create design tokens rather than scattering values.

```css
:root {
  --color-page: #f7f5f0;
  --color-surface: #ffffff;
  --color-text: #161616;
  --color-text-muted: #6c6a65;
  --color-accent: #ef6d3f;
  --color-border: rgba(20, 20, 20, 0.1);

  --radius-sm: 10px;
  --radius-md: 18px;
  --radius-lg: 32px;

  --shadow-card:
    0 1px 2px rgba(0, 0, 0, 0.04),
    0 18px 60px rgba(0, 0, 0, 0.1);
}
```

Do not approximate a layered background using a single flat color when the reference clearly contains gradients or light effects.

---

# 8. Phase 3 — Visual Decomposition

## 8.1 Convert the Reference Into Objects

Represent every important visible object as a node:

```yaml
nodes:
  - id: hero-background-glow
    type: decorative-layer
    parent: hero
  - id: hero-copy
    type: content-group
    parent: hero-container
  - id: hero-heading
    type: text
    parent: hero-copy
  - id: hero-device
    type: image
    parent: hero-visual
  - id: floating-card-1
    type: card
    parent: hero-visual
  - id: floating-card-2
    type: card
    parent: hero-visual
```

Each node should include:

- parent
- bounding box estimate
- positioning mode
- z-layer
- alignment anchor
- visual role
- responsive rule
- whether it is content or decoration

---

## 8.2 Determine Natural Flow vs Overlap

For every object, decide whether it belongs in:

- normal document flow
- CSS grid
- flex layout
- absolute positioning
- sticky positioning
- fixed positioning
- pseudo-element
- background image
- SVG
- canvas

Use normal flow for:

- headings
- paragraphs
- button groups
- card grids
- lists
- nav items
- vertically stacked content

Use absolute positioning for:

- decorative blobs
- overlapping product images
- badges anchored to a visual
- floating cards
- orbiting icons
- shadows that extend outside the layout
- intentional layer composition

The parent of an absolute element should usually be a meaningful positioned container.

---

# 9. Phase 4 — Z-Index and Layer Reconstruction

## 9.1 Infer the Layer Stack

Analyze overlap and occlusion.

Ask:

- Which object visually covers another?
- Is the object clipped by a parent?
- Does a shadow fall over or under adjacent content?
- Does a decorative shape sit behind text but above the section background?
- Does an image extend beyond the section boundary?
- Are cards attached to the image or independently positioned?
- Does the header sit above the hero?
- Are there pseudo-elements creating glows behind assets?

Create a formal layer model.

Example:

```yaml
layer_stack:
  page-background: 0
  section-background: 10
  decorative-glow: 20
  content: 30
  hero-image: 40
  floating-cards: 50
  navigation: 60
  modal-overlay: 100
```

Then implement semantic z-index tokens:

```css
:root {
  --z-base: 0;
  --z-section-bg: 10;
  --z-decoration: 20;
  --z-content: 30;
  --z-visual: 40;
  --z-floating: 50;
  --z-header: 60;
  --z-overlay: 100;
}
```

Avoid random values such as `z-index: 999999`.

---

## 9.2 Understand Stacking Contexts

Before changing `z-index`, inspect whether stacking contexts are created by:

- `position` with `z-index`
- `transform`
- `opacity < 1`
- `filter`
- `isolation: isolate`
- `mix-blend-mode`
- `perspective`
- `will-change`
- `contain`
- `mask`
- `clip-path`

A child cannot escape its parent stacking context.

When an element appears behind another despite a large z-index, inspect ancestor stacking contexts before increasing the number.

Recommended section structure:

```css
.hero {
  position: relative;
  isolation: isolate;
}

.hero__background {
  position: absolute;
  inset: 0;
  z-index: var(--z-section-bg);
}

.hero__content {
  position: relative;
  z-index: var(--z-content);
}

.hero__visual {
  position: relative;
  z-index: var(--z-visual);
}
```

---

## 9.3 Separate Visual Layers From DOM Order

DOM order should support:

- semantics
- keyboard navigation
- screen readers
- maintainability

Visual order may differ through grid placement and positioned decorative elements.

Do not reorder important text in the DOM solely to simplify layering.

Decorative assets should use:

- `aria-hidden="true"`
- empty alt text where appropriate
- pointer-events disabled when non-interactive

---

# 10. Phase 5 — Asset Strategy

## 10.1 Classify Each Asset

Every visual asset should be classified as one of:

1. Existing project asset
2. Crop from the reference
3. Reconstructed CSS shape
4. Reconstructed SVG
5. Recreated illustration
6. Generated transparent asset
7. External icon from a compatible icon library
8. Screenshot-only text that must become real HTML text
9. Background texture or gradient

Do not recreate visible text as an image unless there is no practical alternative.

---

## 10.2 Crop Assets From the Reference

When the reference contains a usable visual object:

1. identify its bounding box
2. crop with padding
3. inspect whether the background is flat, gradient, or complex
4. remove the background where appropriate
5. preserve soft edges and shadows
6. export in a web-friendly format
7. place the asset according to the inferred reference geometry

Recommended workflow:

```bash
# Inspect dimensions
identify reference.png

# Crop candidate region
magick reference.png -crop WIDTHxHEIGHT+X+Y cropped.png

# Trim transparent or uniform borders
magick cropped.png -trim +repage cropped-trimmed.png
```

If the object includes a shadow that belongs to the design, retain it.

If the surrounding background is accidentally included, remove it.

---

## 10.3 Remove Backgrounds Carefully

Background removal should preserve:

- antialiased edges
- hairline details
- soft shadows
- semi-transparent glow
- internal white areas
- reflections
- rounded corners

Do not use crude color deletion when the asset has light colors similar to the background.

Possible strategies:

- alpha matting
- color-distance masking
- manual path mask
- edge-aware segmentation
- image generation or inpainting
- SVG recreation
- CSS recreation

After removal, inspect the asset over:

- white
- black
- the target section background
- a contrasting checkerboard

This exposes halos and accidental erosion.

---

## 10.4 Regenerate Only When Necessary

Regenerate an asset when:

- the crop is too low resolution
- the screenshot contains compression artifacts
- the asset is partially obscured
- the background cannot be removed cleanly
- the object is a generic decorative form
- the reference asset is unavailable
- a CSS or SVG recreation would be cleaner

Generated assets should match:

- silhouette
- perspective
- lighting
- material
- shadow direction
- color palette
- crop
- visual complexity

Do not generate an asset that introduces stylistic drift.

---

## 10.5 Fit and Crop Correctly in CSS

Determine whether the image behaves like:

- `object-fit: contain`
- `object-fit: cover`
- natural intrinsic size
- background image with `background-size`
- masked image
- overflow-hidden crop
- transform-based positioning

Example:

```css
.hero-device {
  width: min(46vw, 680px);
  aspect-ratio: 1 / 1.06;
  object-fit: contain;
  object-position: 50% 50%;
  transform: translate3d(4%, 6%, 0);
}
```

Do not modify the image file to compensate for layout errors that belong in CSS.

---

# 11. Phase 6 — DOM and Component Architecture

## 11.1 Build a Semantic Page Tree

Example:

```text
App
├── SiteHeader
│   ├── Brand
│   ├── PrimaryNavigation
│   └── HeaderActions
├── Main
│   ├── HeroSection
│   │   ├── HeroCopy
│   │   ├── HeroActions
│   │   ├── HeroVisual
│   │   └── HeroDecorations
│   ├── TrustSection
│   ├── FeatureSection
│   ├── ProcessSection
│   ├── TestimonialSection
│   └── CallToActionSection
└── SiteFooter
```

Component boundaries should follow:

- repeated visual patterns
- reusable behavior
- meaningful sections
- independently testable layout units

Do not create one component for every `div`.

Do not place the entire page in one monolithic component.

---

## 11.2 Use Design Tokens

Centralize:

- colors
- spacing
- radii
- shadows
- typography
- breakpoints
- container widths
- z-index
- motion timing

Example:

```css
:root {
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --space-16: 4rem;
  --space-24: 6rem;

  --container-max: 80rem;
  --page-gutter: clamp(1rem, 4vw, 4.5rem);
}
```

Reference-specific values may be precise, but they should still be organized.

---

## 11.3 Prefer CSS Grid for Major Composition

Grid is usually appropriate when the reference shows:

- two-column hero layouts
- repeated cards
- asymmetric section layouts
- shared alignment lines
- explicit visual regions

Example:

```css
.hero__inner {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(420px, 1.1fr);
  gap: clamp(2rem, 5vw, 5rem);
  align-items: center;
}
```

Use flexbox for one-dimensional groups such as:

- navigation
- button rows
- icon-label groups
- inline metadata
- logo strips

---

# 12. Phase 7 — First-Pass Implementation

The first pass should implement only high-confidence structure.

Required order:

1. global reset and base styles
2. font setup
3. page background
4. container system
5. section structure
6. major grid
7. primary typography
8. major images
9. overlap and z-index
10. buttons and cards
11. secondary decoration

Do not over-abstract during the first pass.

Do not optimize before comparison.

The first pass exists to create a measurable render.

---

# 13. Phase 8 — Screenshot Rendering

Render the implementation at the exact reference viewport.

Use deterministic settings:

- fixed viewport
- stable browser
- disabled animations
- loaded fonts
- loaded images
- consistent device scale factor
- no browser chrome
- no scrollbars unless present in the reference

Example Playwright script:

```ts
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 1024 },
  deviceScaleFactor: 1,
});

await page.goto("http://localhost:5173", {
  waitUntil: "networkidle",
});

await page.addStyleTag({
  content: `
    *,
    *::before,
    *::after {
      animation: none !important;
      transition: none !important;
      caret-color: transparent !important;
    }
  `,
});

await page.evaluate(async () => {
  await document.fonts.ready;
});

await page.screenshot({
  path: "visual-tests/renders/desktop-1440.png",
  fullPage: false,
});

await browser.close();
```

If the reference is a full-page image, capture `fullPage: true`.

---

# 14. Phase 9 — Visual Comparison

## 14.1 Compare Using Multiple Methods

Use at least three forms of comparison:

1. Side-by-side inspection
2. Semi-transparent overlay
3. Pixel or perceptual difference image

Optional additional methods:

- edge-map comparison
- structural similarity score
- color histogram comparison
- OCR line-break comparison
- bounding-box comparison
- layout landmark comparison

Example ImageMagick commands:

```bash
# Overlay
magick reference.png render.png \
  -alpha set \
  -compose blend \
  -define compose:args=50,50 \
  -composite overlay.png

# Difference
magick compare -metric AE reference.png render.png diff.png
```

Do not rely solely on a numeric pixel score.

A one-pixel global shift can produce a large score but be easy to fix.

A semantically wrong section may produce a deceptively acceptable score if the colors are similar.

---

## 14.2 Create a Mismatch Report

After each comparison, classify mismatches.

```yaml
iteration: 3
mismatches:
  - category: macro-layout
    severity: critical
    location: hero
    observation: "Hero visual begins 42px too high"
    likely_cause: "Parent align-items center plus incorrect top padding"
    fix: "Change alignment to end and reduce image transform"
  - category: typography
    severity: high
    location: hero-heading
    observation: "Heading wraps into four lines instead of three"
    likely_cause: "Font width and max-width mismatch"
    fix: "Increase max-width by 36px and reduce letter spacing"
  - category: asset-crop
    severity: medium
    location: device-image
    observation: "Right edge has 18px of unwanted source background"
    fix: "Recrop and export transparent PNG"
```

Never make blind adjustments without recording the suspected cause.

---

# 15. Phase 10 — Recursive Refinement Loop

## 15.1 Required Iteration Algorithm

Use this exact reasoning pattern:

```text
1. Render current page.
2. Generate overlay and difference image.
3. Identify the three to seven highest-impact mismatches.
4. Group mismatches by root cause.
5. Modify the smallest number of rules that can correct the largest area.
6. Re-render.
7. Confirm the targeted mismatch improved.
8. Check for regressions.
9. Repeat.
```

Do not make twenty unrelated changes in one iteration.

Small controlled iterations make visual debugging explainable.

---

## 15.2 Fix Root Causes, Not Symptoms

Bad approach:

```css
.heading {
  left: 7px;
}

.paragraph {
  left: 12px;
}

.button-row {
  left: 10px;
}
```

Better approach:

```css
.hero__copy {
  padding-inline-start: 10px;
}
```

Bad approach:

```css
.card-1 { top: 18px; }
.card-2 { top: 31px; }
.card-3 { top: 44px; }
```

Better approach:

```css
.card-stack {
  gap: 13px;
  transform: translateY(18px);
}
```

Always search for the shared structural cause.

---

## 15.3 Mismatch Priority Order

Fix in this priority:

### Priority 1 — Critical Geometry
- wrong page width
- wrong section height
- wrong content container
- incorrect column ratio
- incorrect major asset scale
- wrong vertical starting point
- overflow

### Priority 2 — Layering
- incorrect overlap
- clipping
- stacking context bugs
- missing masks
- shadow order

### Priority 3 — Typography
- line wrapping
- font size
- line height
- letter spacing
- weight
- text width

### Priority 4 — Component Geometry
- button dimensions
- card padding
- border radius
- icon position
- gaps

### Priority 5 — Surface Styling
- colors
- gradients
- borders
- shadows
- blur

### Priority 6 — Decorative Detail
- small icons
- noise
- subtle highlights
- micro-alignment

---

## 15.4 Preserve a Visual Regression Baseline

After a major improvement, save the render.

```text
visual-tests/renders/
├── iteration-01.png
├── iteration-02.png
├── iteration-03.png
└── accepted-desktop.png
```

Do not overwrite every render.

Maintaining iterations makes regressions visible.

---

# 16. Phase 11 — Responsive Reconstruction

## 16.1 Responsive Design Is Not “Scale Everything Down”

A responsive version must preserve the design’s hierarchy and intent.

For each section, determine:

- what remains side by side
- what stacks
- what changes order
- what becomes scrollable
- what is hidden
- what is simplified
- what changes crop
- what changes alignment
- what maintains fixed proportions
- what becomes full width

Do not uniformly shrink all dimensions.

---

## 16.2 Infer Responsive Behavior From Constraints

When mobile references are unavailable, infer behavior using:

- text readability
- minimum touch target size
- image subject preservation
- natural component stacking
- content priority
- common design patterns
- available horizontal space
- likely breakpoints suggested by the desktop layout

Example responsive strategy:

```yaml
hero:
  desktop:
    columns: 2
    copy_width: 46%
    visual_width: 54%
  tablet:
    columns: 2
    copy_width: 52%
    visual_width: 48%
    asset_scale: 0.84
  mobile:
    columns: 1
    order:
      - copy
      - actions
      - visual
    alignment: left
    visual_overflow: hidden
```

---

## 16.3 Use Fluid Sizing

Prefer:

- `clamp`
- percentages
- `min`
- `max`
- `minmax`
- `aspect-ratio`
- container-based sizing

Example:

```css
.hero__title {
  font-size: clamp(2.75rem, 6vw, 5.5rem);
  line-height: 0.98;
}

.hero {
  padding-block:
    clamp(5rem, 10vw, 9rem)
    clamp(3rem, 8vw, 7rem);
}
```

Use fixed pixels when the reference requires exact geometry, but combine them with fluid constraints.

---

## 16.4 Breakpoint Selection

Do not blindly use framework defaults.

Select breakpoints where the composition actually fails.

Typical process:

1. start at reference width
2. reduce width in 100px increments
3. identify where content becomes compressed
4. add the breakpoint just before failure
5. test around the breakpoint
6. avoid unnecessary breakpoint proliferation

Example:

```css
@media (max-width: 1100px) {
  /* adjust desktop composition */
}

@media (max-width: 820px) {
  /* stack major sections */
}

@media (max-width: 560px) {
  /* mobile typography and spacing */
}
```

---

## 16.5 Required Viewport Matrix

At minimum, test:

```yaml
viewports:
  - 360x800
  - 390x844
  - 768x1024
  - 1024x768
  - reference viewport
  - 1440x900
  - 1920x1080
```

Also test widths just above and below breakpoints.

---

## 16.6 Responsive Failure Checklist

At every viewport, verify:

- no horizontal scrollbar
- navigation remains usable
- text does not overlap visuals
- text does not become too narrow
- button labels remain readable
- tap targets are at least approximately 44px
- images do not lose their important subject
- floating elements remain attached to the correct parent
- decorative layers do not cover content
- section spacing remains intentional
- line lengths remain readable
- cards do not collapse unpredictably
- sticky or fixed elements do not obscure content

---

# 17. Phase 12 — Automated Browser Inspection

Use the browser to inspect actual geometry.

Useful data:

```js
const report = await page.evaluate(() => {
  const selectors = [
    ".site-header",
    ".hero",
    ".hero__copy",
    ".hero__title",
    ".hero__visual",
  ];

  return selectors.map((selector) => {
    const element = document.querySelector(selector);
    if (!element) return { selector, missing: true };

    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);

    return {
      selector,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      display: style.display,
      position: style.position,
      zIndex: style.zIndex,
      overflow: style.overflow,
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
    };
  });
});
```

Use geometry inspection to validate visual assumptions.

Do not rely only on reading CSS source.

---

# 18. Phase 13 — Refactoring After Visual Match

Refactor only after the page is visually close.

Refactoring goals:

- remove duplicate values
- consolidate tokens
- simplify selectors
- extract repeated components
- remove dead styles
- remove debugging code
- rename unclear classes
- fix type errors
- improve semantics
- add accessibility attributes
- optimize assets
- improve loading behavior

After refactoring, run the complete visual comparison again.

A refactor is not successful if it changes the visual output unintentionally.

---

# 19. Image Crop and Background Removal Protocol

Use this protocol for every extracted image.

## Step 1 — Identify the True Object Bounds

Include:

- object silhouette
- intended shadow
- glow
- reflection

Exclude:

- unrelated background
- neighboring text
- adjacent decoration
- screenshot artifacts

## Step 2 — Add Working Padding

Crop with 10–40px padding to avoid clipping antialiased edges.

## Step 3 — Separate Foreground and Background

Choose the least destructive method.

## Step 4 — Inspect Edge Quality

Look for:

- white halos
- dark halos
- clipped shadow
- jagged curves
- transparent holes
- color contamination

## Step 5 — Trim Carefully

Do not trim away intentional shadow or glow.

## Step 6 — Export

Recommended formats:

- SVG for vectors
- WebP for photographic raster images
- PNG for transparency requiring exact alpha
- AVIF where supported and quality is verified

## Step 7 — Place Using CSS

The asset file should be clean.

The composition should be controlled by CSS.

---

# 20. Visual Similarity Scoring

Use a weighted score rather than a single pixel metric.

Example:

```yaml
score:
  macro_layout: 0.30
  section_alignment: 0.15
  major_asset_geometry: 0.15
  typography: 0.15
  color_and_surface: 0.10
  component_geometry: 0.10
  decoration: 0.05
```

Example evaluation:

```text
macro_layout:            94/100
section_alignment:       92/100
major_asset_geometry:    90/100
typography:              88/100
color_and_surface:       95/100
component_geometry:      91/100
decoration:              84/100

weighted total:          91.4/100
```

This score is an engineering heuristic, not an objective truth.

Use it to prioritize work.

---

# 21. Stopping Criteria

Stop the recursive loop only when all of the following are true:

- major section boundaries match
- primary content alignment matches
- hero or primary visual scale matches
- important overlaps match
- heading line breaks match or are defensibly equivalent
- no major asset contains unwanted background
- z-index ordering is correct
- desktop reference comparison is visually close
- no critical responsive failures remain
- no horizontal overflow exists
- visual changes between the last two iterations are minor
- remaining differences are caused by unavailable source assets, unknown fonts, or screenshot ambiguity
- code passes build and lint checks
- final refactor has not introduced regressions

Suggested threshold:

```yaml
minimum_iterations: 3
maximum_iterations_without_new_evidence: 3
target_weighted_similarity: 90
critical_mismatch_count: 0
high_mismatch_count: <= 2
```

Do not loop endlessly over imperceptible differences.

---

# 22. Autonomous Decision Rules

## 22.1 When to Continue Without Asking

Proceed autonomously when deciding:

- exact spacing within a reasonable range
- likely component structure
- whether to use grid or flex
- whether an element is decorative
- likely mobile stacking behavior
- z-index grouping
- asset crop bounds
- breakpoint placement
- CSS architecture
- file naming
- image optimization

## 22.2 When to Ask the User

Ask only when:

- the screenshot contains multiple mutually incompatible interpretations
- an important hidden interaction cannot be inferred
- exact copy is unreadable
- the user requires a licensed proprietary font or asset
- there are multiple pages but only one is referenced
- a legal or brand constraint changes the implementation
- the user’s requested stack conflicts with the repository

Before asking, choose and implement the most reasonable default where possible.

---

# 23. Anti-Patterns

Never do the following:

## 23.1 One-Shot Coding

Do not implement once and declare success without rendering and comparing.

## 23.2 Excessive Absolute Positioning

Do not position every element with fixed `top` and `left`.

## 23.3 Arbitrary Z-Index Escalation

Do not fix layering with increasingly large numbers.

## 23.4 Screenshot as Entire Webpage

Do not use the reference screenshot as one full-page background image.

## 23.5 Text Embedded in Images

Do not crop headings or body text from the screenshot instead of using HTML.

## 23.6 Desktop-Only Reconstruction

Do not consider the task complete because the reference viewport matches.

## 23.7 Uncontrolled Global CSS

Do not solve one section by introducing global rules that break others.

## 23.8 Human-Dependent Iteration

Do not ask the user to inspect every iteration.

## 23.9 Premature Component Abstraction

Do not build a design system before the page geometry is understood.

## 23.10 Asset Background Contamination

Do not place crops containing accidental screenshot background over a different page background.

## 23.11 Ignoring Font Loading

Do not capture screenshots before fonts are ready.

## 23.12 Hiding Errors With Overflow

Do not use `overflow: hidden` globally to conceal layout bugs.

---

# 24. Recommended Working Files

Create these files during execution:

```text
IMPLEMENTATION_NOTES.md
VISUAL_SPEC.md
visual-tests/reference/reference.png
visual-tests/renders/iteration-01.png
visual-tests/renders/iteration-02.png
visual-tests/diffs/diff-01.png
visual-tests/diffs/overlay-01.png
visual-tests/reports/iteration-01.yaml
```

Example `VISUAL_SPEC.md` structure:

```markdown
# Visual Specification

## Reference Metadata
## Section Map
## Grid Map
## Typography
## Color Tokens
## Layer Stack
## Asset Inventory
## Responsive Assumptions
## Known Ambiguities
```

---

# 25. Iteration Report Template

Use this after every render.

```markdown
# Visual Iteration Report

## Iteration
4

## Viewport
1440 × 1024

## Improvements
- Hero visual scale now matches reference.
- Header height reduced by 8px.
- Main heading now wraps into three lines.

## Remaining Mismatches

### Critical
None.

### High
1. Floating card group is 22px too far right.
2. Hero paragraph width is approximately 40px too narrow.

### Medium
1. Button radius is slightly too large.
2. Background glow is too saturated.

## Root Causes
- Floating cards are positioned relative to the image rather than the visual wrapper.
- Paragraph inherits the heading width constraint.

## Planned Changes
- Anchor floating cards to `.hero__visual`.
- Split copy width tokens for heading and paragraph.
- Reduce accent glow opacity from 0.22 to 0.16.
```

---

# 26. Responsive Validation Report Template

```markdown
# Responsive Validation

## 360 × 800
- Header: pass
- Navigation: collapsed
- Hero: stacked
- Overflow: none
- Floating cards: simplified
- CTA buttons: full width
- Issues: hero image needs 12px more bottom spacing

## 768 × 1024
- Header: pass
- Hero: two-column compressed
- Overflow: none
- Issues: title line length too short

## 1440 × 900
- Reference match: high
- Overflow: none
- Issues: none critical

## 1920 × 1080
- Container max-width preserved
- Hero visual remains balanced
- Excessive empty space: none
```

---

# 27. Practical Implementation Strategy

## Stage A — Geometry Skeleton

Create:

- body background
- section heights
- containers
- main grid
- placeholder blocks matching asset dimensions

Render immediately.

## Stage B — Real Content

Add:

- real text
- fonts
- buttons
- cards
- images

Render and compare.

## Stage C — Layering

Add:

- overlaps
- absolute decorative elements
- z-index tokens
- clipping and masks

Render and compare.

## Stage D — Surface Styling

Add:

- gradients
- shadows
- borders
- radii
- icon details

Render and compare.

## Stage E — Responsive System

Add:

- fluid sizes
- breakpoints
- content reordering
- mobile navigation
- mobile asset crops

Render the full viewport matrix.

## Stage F — Refactor and Lock

Clean code, optimize assets, run final visual regression.

---

# 28. Example Agent Command Sequence

```text
1. Inspect repository and determine framework.
2. Read the reference image dimensions.
3. Produce VISUAL_SPEC.md.
4. Identify sections, grid, typography, assets, and layers.
5. Create the initial component tree.
6. Build the macro layout.
7. Start the dev server.
8. Capture a screenshot at the reference viewport.
9. Generate overlay and diff images.
10. Produce iteration report.
11. Fix the highest-impact mismatches.
12. Repeat until stopping criteria are met.
13. Test mobile, tablet, desktop, and wide desktop.
14. Refactor.
15. Run final screenshot comparisons.
16. Produce IMPLEMENTATION_NOTES.md and final summary.
```

---

# 29. Master Autonomous Prompt

Use the following prompt inside Codex or Claude Code when activating this skill:

```text
You are reconstructing a frontend from a visual reference.

Treat the reference image as the primary design specification.

First inspect the repository and the image. Do not begin by blindly writing JSX.

Create a structured visual specification covering:
- image dimensions
- major sections
- content container
- horizontal grid
- typography
- colors
- visual assets
- image crop behavior
- overlap
- clipping
- z-index
- stacking contexts
- responsive assumptions

Then create a semantic component tree and implement the page from large geometry to fine detail.

You must render the page at the exact reference viewport and compare it against the source image. Use side-by-side comparison, overlays, difference images, browser geometry inspection, and visual reasoning.

After every render:
1. classify mismatches
2. identify root causes
3. fix the highest-impact issues
4. render again
5. verify that the change improved the result and did not cause regressions

Repeat this process recursively. Do not depend on the user to identify visual differences that can be discovered from the image.

For assets:
- reuse existing source assets when available
- crop visual objects from the reference where appropriate
- remove accidental backgrounds cleanly
- preserve shadows and transparent edges
- regenerate or recreate assets only when a crop is unsuitable
- position assets using CSS, not by baking layout into image files

For layering:
- infer occlusion and stacking order
- create a documented z-index scale
- inspect stacking contexts before raising z-index values
- keep content semantic in the DOM
- use absolute positioning only for genuine overlaps or decoration

For responsiveness:
- do not merely shrink the desktop layout
- infer content priority
- stack or reorder elements when needed
- preserve readable type and usable controls
- test 360px, 390px, 768px, 1024px, the reference viewport, 1440px, and 1920px widths
- verify that no viewport has horizontal overflow or broken overlap

Do not stop after the first implementation.

Stop only when:
- major geometry matches
- typography wrapping is close
- important assets and crops match
- layering is correct
- no critical visual mismatch remains
- responsive behavior is stable
- build, lint, and type checks pass
- the final refactor does not alter the accepted visual output

Document unavoidable differences honestly.
```

---

# 30. Optional Computer-Vision Assistance

When tooling permits, automate measurement.

Possible techniques:

- edge detection for section boundaries
- Hough lines for alignment anchors
- dominant-color extraction
- OCR for text blocks
- connected-component analysis
- perceptual hashing
- structural similarity
- image segmentation
- alpha matting
- object detection
- color-distance masks
- template matching
- saliency detection

Use these tools to assist reasoning, not replace it.

Computer vision may misinterpret:

- shadows as objects
- gradients as section boundaries
- text antialiasing as color variation
- overlapping shapes as one component
- transparent glows as background

Always visually verify automated measurements.

---

# 31. Accessibility Requirements

Visual matching does not override accessibility.

Ensure:

- semantic landmarks
- meaningful heading hierarchy
- usable keyboard navigation
- visible focus states
- sufficient color contrast where possible
- correct button and link elements
- descriptive alt text for meaningful images
- decorative images hidden from assistive technology
- reduced motion support
- responsive zoom support
- no text rendered only as background images

If the reference itself contains poor contrast, preserve the visual style while improving accessibility with subtle, non-disruptive adjustments where allowed.

---

# 32. Performance Requirements

Optimize without changing appearance.

Use:

- appropriately sized images
- lazy loading below the fold
- modern image formats
- font preloading where necessary
- limited font weights
- stable image dimensions
- no layout shifts
- CSS gradients instead of large raster backgrounds where appropriate
- SVG for simple vector assets
- code splitting when the application requires it

Avoid:

- enormous uncompressed PNG files
- unnecessary animation libraries
- large icon packages for a few icons
- duplicate image variants
- inline base64 assets when not justified

---

# 33. Code Quality Requirements

The final code must:

- build successfully
- pass TypeScript checks where TypeScript is used
- pass linting
- avoid console errors
- avoid broken links
- avoid missing keys
- avoid invalid HTML nesting
- avoid unused variables
- avoid dead styles
- avoid unexplained magic numbers where tokens are appropriate
- include comments only where the reasoning is not obvious
- use stable class naming
- separate content, layout, and decoration where practical

---

# 34. Final Completion Checklist

## Reference Understanding
- [ ] Image dimensions recorded
- [ ] Section map created
- [ ] Grid and alignment anchors identified
- [ ] Typography hierarchy identified
- [ ] Color and surface system identified
- [ ] Asset inventory created
- [ ] Layer stack documented
- [ ] Responsive assumptions documented

## Implementation
- [ ] Semantic component tree created
- [ ] Macro layout implemented
- [ ] Assets extracted or recreated
- [ ] Accidental asset backgrounds removed
- [ ] Correct image crops applied
- [ ] Z-index tokens used
- [ ] Stacking contexts verified
- [ ] Typography wrapping tuned
- [ ] Major shadows and gradients implemented

## Recursive Validation
- [ ] Exact reference viewport rendered
- [ ] Side-by-side comparison performed
- [ ] Overlay generated
- [ ] Difference image generated
- [ ] At least three refinement iterations completed
- [ ] Critical mismatches resolved
- [ ] Final refactor visually revalidated

## Responsive
- [ ] 360px tested
- [ ] 390px tested
- [ ] 768px tested
- [ ] 1024px tested
- [ ] Reference viewport tested
- [ ] 1440px tested
- [ ] 1920px tested
- [ ] No horizontal overflow
- [ ] No broken overlap
- [ ] Touch targets remain usable
- [ ] Mobile content order is logical

## Quality
- [ ] Build passes
- [ ] Type check passes
- [ ] Lint passes
- [ ] No console errors
- [ ] Assets optimized
- [ ] Accessibility reviewed
- [ ] Remaining differences documented

---

# 35. Definition of Done

The implementation is done when an informed reviewer can place the rendered page over the reference image and observe that:

- the page composition is substantially aligned
- visual hierarchy is preserved
- major objects occupy the correct regions
- text blocks have similar width and wrapping
- overlapping elements appear in the correct order
- images are cropped and positioned correctly
- visual details are close enough that remaining differences are minor
- the website behaves coherently beyond the original screenshot width
- the code remains clean enough for future development

The final standard is not merely:

> “It resembles the screenshot.”

The final standard is:

> “It reconstructs the design logic of the screenshot, matches the reference closely at the target viewport, and remains a real, responsive, maintainable website.”
