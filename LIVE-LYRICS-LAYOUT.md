# Live Lyrics View: Layout Rules

This document records the layout and presentation rules currently implemented by
the **Live** lyrics view. It describes the restored `live` mode, which renders
`LiveLyricsView`; it does not describe the separate Live Scroll implementation,
Focused view, or Group Chat view.

The rules are drawn from the current source. Where a setting label and its actual
CSS unit disagree, this document calls out the implemented behavior rather than
the label.

## Implementation map

- `src/Studio/components/Workspaces/Lyrics/LyricsDisplay.jsx` selects Live mode
  when synced data is available and `lyricsViewMode === 'live'`.
- `src/Studio/components/Workspaces/Lyrics/Views/LiveLyricsView.jsx` owns the
  scroll region, playback-time tracking, active-line centering, layout readiness,
  and optional entrance reveal.
- `src/Studio/components/Workspaces/Lyrics/Views/LiveLyricsView.css` defines the
  scroll region, lyric-line typography, active/inactive states, and motion.
- `src/Studio/components/Workspaces/Lyrics/LyricsLineRenderer.jsx` measures and
  positions translated text and split ad-libs, guards against collisions, and
  caches measured layouts.
- `src/Studio/components/Workspaces/Lyrics/LyricsLineRenderer.css` contains
  Live-specific translation, transliteration, and split-ad-lib layout rules.
- `src/components/LyricsRenderer/StandardLine.jsx` and
  `src/components/LyricsRenderer/SplitLine.jsx` provide the text structures that
  the Live layout measures.
- `src/App.jsx` maps saved settings to CSS custom properties;
  `src/Application/components/Settings/TypographySettings.jsx`,
  `src/Application/components/Settings/TranslationSettings.jsx`, and
  `src/Application/components/Settings/LayoutSettings.jsx` expose the related
  controls.

## 1. When Live layout is shown

- Live rendering is selected only when the lyrics are not being edited, synced
  data is valid, and the selected view mode is `live`.
- The view renders one `LyricLineWrapper` per parsed lyric line, in source order.
- Each line receives its matching sync record, if available. Missing start or
  end timestamps are represented as unsynchronized values for that line.
- The playback-time offset is subtracted before matching audio time to sync
  timestamps.
- Playback matching chooses a line whose start has passed and whose end and next
  line start have not been passed. If no timed line matches, no line is active.
- A line becomes the visual active line by receiving the `active` class. Ad-lib
  visibility and activity are updated from their own timing boundaries.
- While the song shown is not the playing song, the view does not mark a lyric
  line active from playback time. Its ad-libs are instead initialized as
  visible.

## 2. Scroll region and available space

The Live list is a flex child intended to occupy the available lyrics-column
height:

- `flex: 1 1 0` and `min-height: 0` let it shrink inside the surrounding modal
  layout instead of forcing the column taller.
- It is an inline-size query container (`container-type: inline-size`). Font
  sizing can therefore respond to the lyrics column width.
- Vertical overflow scrolls; horizontal overflow is clipped.
- Browser scroll anchoring is disabled (`overflow-anchor: none`), and the
  container's CSS scroll behavior is `auto`. Smooth movement is requested
  explicitly by the playback-centering code instead.
- The list has `120px` top padding, `20px` left and right padding, and bottom
  padding of `clamp(40px, 8vw, 80px)`. The top/bottom breathing room allows lines
  near the ends of the lyrics to approach the center while scrolling.
- A vertical CSS mask fades the first and last 8% of the scroll region from
  transparent to opaque; the central 84% is opaque.
- The scrollbar is hidden in Firefox, legacy Microsoft browsers, and WebKit.
  Hiding it does not disable scrolling.
- The view and related lyrics containers use `position: relative` and
  `z-index: 10` from the shared lyrics-display stylesheet.
- While the layout is pending, the region has `opacity: 0 !important` and
  `pointer-events: none`; it is also marked `aria-hidden`. It becomes available
  only after the required layout measurements finish and the song modal is
  ready.

### Space between lines

The flex gap between lyric wrappers is computed as:

```text
min(setting × 1vw, setting × 0.125vh)
```

The `Live Line Gap` setting defaults to `16` when absent and has a slider range
of `0`–`60`. The setting is a unitless multiplier used in the formula, not a
literal pixel gap. A zero value removes the flex gap.

## 3. Lyric line box and typography

Each standard line wrapper:

- Fills the available line width (`width: 100%`) and uses `box-sizing: border-box`.
- Uses the application font, weight `700`, and line-height `1.35`.
- Uses `white-space: pre-wrap`; ordinary spaces are retained and text can wrap
  at whitespace.
- Uses `word-break: normal` and `overflow-wrap: normal`; it does not force
  arbitrary breaks inside ordinary words.
- Has zero margin unless the collision-layout code adds a specific dynamic
  margin to make room for an ad-lib.
- Is left-origin scaled and translated in 3D for the inactive/active visual
  transition.

### Responsive font-size formula

At viewport widths above `900px`, each line uses:

```text
clamp(16px, min(5vw, 10cqw), Live Font Size)
```

At viewport widths of `900px` or less, it uses:

```text
clamp(14px, 5.5cqw, Live Font Size)
```

Here `cqw` is 1% of the Live container's inline size. `Live Font Size` is the
saved `liveSyncFontSize` converted to `vh` by `src/App.jsx`; its default is
`4.5vh`, and the settings slider offers `2`–`10vh` in `0.5vh` steps. The `clamp`
maximum means the setting caps the responsive preferred size; it does not
override the minimum.

### Active, inactive, and hover states

- An inactive line is at `opacity: 0.4` and scale `0.95`.
- The active line is at full opacity and scale `1`.
- Hovering a line raises its opacity to `0.8`; the active rule remains fully
  opaque.
- Opacity transitions take `0.5s`; scale transitions take `0.18s` with
  ease-out timing.
- The transform origin is the left center. Lines use backface-visibility
  safeguards for the transformed rendering.
- The active line's main lyrics and primary ad-lib text are prepared for
  transform/opacity/filter changes and receive a soft dark drop shadow.
- Entrance reveals use a 260ms animation: lines enter from 18px to the right at
  scale `0.95`; an already active line ends at scale `1` and full opacity.

## 4. Playback-driven scrolling and readiness

- When the active line changes, the view scrolls it toward the vertical center
  of the visible lyrics region. Initial centering is also requested when
  playback state first becomes available.
- The target is computed from the active line's bounding box and the container's
  visible viewport, then clamped between the top and maximum scroll position.
  Lines at the beginning or end therefore cannot be centered beyond the
  scrollable content bounds.
- When reduced motion is requested by the operating system, centering assigns
  `scrollTop` immediately. Otherwise, it uses smooth scrolling.
- Layout readiness is tracked per rendered line. When playing the selected
  song, every line must finish its layout measurement before the view is
  revealed. When not playing, the initially visible lines and their immediate
  neighbors (or all lines, if necessary) are sufficient.
- If an entrance reveal was requested, it waits for the layout and any pending
  centering to finish. Visible lines are briefly hidden during preparation and
  then revealed in order, staggered by `55ms` per line. A fallback completes the
  reveal if animation events do not arrive.
- The entrance reveal and active-ad-lib entrance animations are disabled under
  `prefers-reduced-motion: reduce`. In that case, the entrance completion
  callback is still notified.

## 5. Translation placement and appearance

Live translations are rendered as part of each lyric line but are not part of
the normal text flow above it:

- Inactive `.live-translation` text starts at zero opacity and hidden
  visibility. It becomes visible on an active line, with a `0.4s` opacity
  transition.
- The main translation is placed above the main lyric. Its width is measured
  from the widest rendered glyph row. The browser's intrinsic flex layout
  centers it within the main text's layout box and places it above the lyric;
  its bottom margin supplies the configured translation gap.
- Translations use the configured translation color and opacity, bold weight
  `800`, uppercase text, `0.5px` letter spacing, centered alignment, and line
  height `1.2`. They ignore pointer events.
- In Live mode the translation's measured width is constrained to the lyric
  line's available width. Normal word breaking is used; the layout does not
  intentionally break inside words.
- Translation font size comes from `translationFontSize`, defaulting to
  `0.55em`. The color and opacity default to white and `0.9`, respectively.
- `Translation Spacing (Top)` defaults to `8`. Although its settings control
  displays `vh`, `src/App.jsx` currently passes this value into the CSS variable
  with a `px` suffix. In Live mode the rendered translation's bottom margin
  consumes this variable, and the measurement code positions the translation
  using that margin.
- A translation with no measurable glyph row is not given a computed alignment
  offset; the renderer's base styles apply.

## 6. Transliteration and language direction

- The language renderer supplies pronunciation/transliteration text where
  available. Main lyric direction is selected from the lyric text (RTL or LTR);
  translation and pronunciation blocks are explicitly LTR.
- Pronunciation text uses the configured transliteration color and opacity,
  weight `700`, uppercase text, `1.5px` letter spacing, and the application
  font. It wraps normally within the available width and uses a dark text
  shadow.
- Its size comes from `transliterationFontSize`, defaulting to `0.55em`; its
  default color is white and opacity is `0.8`. Active-line pronunciation text
  becomes fully opaque.
- Pronunciation below a standard line's main text has an `8px` top margin,
  centered alignment, `1.4` line height, and `4px` word spacing.
- In split-line rendering, the pronunciation block's margin is controlled by
  `transliterationBottomPadding`. The component's inline fallback is `8px`, but
  the app-level CSS custom-property fallback is `4px`; when the app supplies the
  value it converts it to pixels. The settings control currently labels this
  slider `vh`, even though the value passed to CSS is in `px`.
- Main glyph row measurements exclude pronunciation text when determining
  wrapping, while the collision bounds include pronunciation blocks. This lets
  transliteration affect vertical clearance without distorting the measured
  main-glyph row width.

## 7. Split lines and ad-lib collision handling

For lines containing timed ad-libs, `SplitLine` supplies a flex-wrapping row
containing the main lyric chunks and ad-lib blocks. The Live layout measures
actual rendered text rectangles, including translated ad-lib text and
pronunciation, before deciding placement.

- Main text direction determines whether inline placement advances from left to
  right or right to left.
- An ad-lib with no main lyric is placed on a new wrapped row.
- Otherwise the layout first tries to place an ad-lib inline after the main
  text, aligned to the lyric baseline. The browser's flex layout calculates
  whether it fits beside the preceding content and wraps it onto a new row at
  the appropriate edge when necessary. The inline clearance is
  `min(0.72vw, 1.5vh)`.
- An ad-lib's secondary translation is sized to the widest row of its primary
  glyphs. If that translation would overlap a main glyph row, the ad-lib is
  moved to its own row and a dynamic collision gap is calculated.
- Wrapped ad-libs with translations put that translation before the ad-lib
  primary text. Wrapped content is constrained to the available width.
- The algorithm checks measured ad-lib text against the current line's main
  content and ad-libs, as well as the previous and next lyric wrappers. Its
  collision clearance is `min(0.5vw, 0.25vh)`.
- A collision with the current or previous line can force an ad-lib to a new
  row and add a start clearance. A collision extending below the current split
  line adds bottom padding so the following lyric line does not cover it.
- Lines with foreign-script pronunciation receive baseline-aware handling.
  When a non-foreign ad-lib sits inline with a foreign-only main line, the
  ad-lib is offset to account for the main pronunciation block. When an inline
  ad-lib has pronunciation beside a non-foreign main line, the main block and
  following line spacing can be shifted to preserve the baseline.
- The browser calculates inline placement, baseline alignment, and wrapping
  from the rendered content. JavaScript measurements remain for the documented
  collision decisions; dynamic collision clearances are passed to CSS as
  custom properties, and CSS applies the resulting row wrapping and spacing.
- Active ad-libs animate upward from `12px` and fade in over `320ms`. The
  animation applies only after layout is no longer pending and is removed for
  reduced-motion preferences.

## 8. Layout measurement, resizing, and caching

- DOM text ranges are used to determine rendered glyph rows and widest lines
  for translation sizing and collision decisions; the browser's flex layout
  calculates final positions and wrapping from the current font and column
  width rather than estimating from character counts.
- Measurements are queued instead of synchronously repeated for every change.
  Resize observers remeasure when a line's width changes by at least `0.5px`.
- Font loading and font changes invalidate or refresh measurements. The Live
  view also observes modal readiness and incorporates viewport dimensions and
  relevant typography settings into its layout-cache signature.
- Cached line layout is associated with the line data, sync record, line index,
  palette/layout signature, and current rendered measurements. A stale or
  mismatched cache is not reused.
- Cached measurements are invalidated when observed width or font metrics
  change. The signature also changes with track, lyrics/sync data, palette,
  viewport dimensions, live font size, line gap, translation spacing,
  transliteration size/spacing, and modal split ratio.
- While a line is being measured, previous computed layout classes and inline
  offsets are cleared first, so a resize or setting change is recomputed from
  the unadjusted line structure.

## 9. Settings reference

| Setting | Live layout use | Control range / fallback |
| --- | --- | --- |
| `liveSyncLineGap` | Unitless multiplier in the viewport-relative flex-gap formula | Slider `0`–`60`; fallback `16` |
| `liveSyncFontSize` | Upper bound for responsive lyric font size, supplied as `vh` | Slider `2`–`10vh`, step `0.5vh`; saved default `4.5vh` |
| `translationFontSize` | Translation font size relative to the lyric | Slider `0.3`–`1.5em`; fallback `0.55em` |
| `translationColor` | Translation text color | Fallback `#ffffff` |
| `translationOpacity` | Translation transparency | Fallback `0.9` |
| `translationTopPadding` | Gap used when positioning a translation above its lyric | Slider labels `vh`; implementation supplies `px`; fallback `8px` |
| `transliterationFontSize` | Pronunciation text size relative to the lyric | Slider `0.3`–`1.5em`; fallback `0.55em` |
| `transliterationColor` | Pronunciation text color | Fallback `#ffffff` |
| `transliterationOpacity` | Pronunciation transparency | Fallback `0.8` |
| `transliterationBottomPadding` | Split-line pronunciation spacing and baseline clearance | Slider labels `vh`; implementation supplies `px`; app fallback `4px` |
| `modalSplitRatio` | Indirectly changes the available lyrics column width; included in layout-cache signature | Slider `20`–`80`; saved default `50` |

## 10. Scope and known implementation distinctions

- The outer playback modal determines the width and height available to Live;
  Live itself fills the lyrics region it is given. Modal padding, album-art
  placement, and header layout are not defined by the Live view stylesheet.
- The translation and transliteration spacing controls currently advertise
  `vh` in their settings labels, but the app maps those values to pixel-valued
  custom properties. Treating them as viewport heights would not match current
  behavior.
- The Live view uses `.preview-line` styles from the shared lyric renderer.
  Other modes also use some of those shared selectors; the Live-specific
  behavior described here is the behavior when the wrapper is rendered with
  `viewMode="live"`.
- This document describes current implementation, not a promise that every
  line's layout is identical across fonts, viewport sizes, scripts, or browser
  font metrics. The measurement and collision rules intentionally respond to
  those differences.
