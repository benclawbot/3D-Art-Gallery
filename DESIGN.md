---
name: Stillroom
description: A walkable photography museum with a limestone courtyard entrance and a dark timber print wing.
colors:
  olive: "#545c42"
  olive-hover: "#414934"
  paper: "#f6f1e8"
  ink: "#2d2921"
  muted-ink: "#655d50"
  paper-rule: "#d7cec0"
  overlay-border: "#c3b6a2"
  overlay-hover: "#eae2d5"
  action-text: "#fffdf9"
  focus: "#69572b"
  field: "#faf6ee"
  field-border: "#bcb09f"
  upload-paper: "#f8f4ec"
  upload-hover: "#eee9dc"
  dark-room: "#211d18"
  print-control: "#241f1b"
  print-lettering: "#f6ebdc"
  print-divider: "#66564a"
  close-look-text: "#f7eee0"
typography:
  display:
    fontFamily: "Cormorant Garamond, Georgia, serif"
    fontSize: "clamp(55px, 6.1vw, 96px)"
    fontWeight: 400
    lineHeight: 0.87
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Cormorant Garamond, Georgia, serif"
    fontSize: "clamp(29px, 3vw, 38px)"
    fontWeight: 400
    lineHeight: 1
  title:
    fontFamily: "Cormorant Garamond, Georgia, serif"
    fontSize: "24px"
    fontWeight: 400
    lineHeight: 0.95
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "13px"
    fontWeight: 600
rounded:
  square: "0px"
spacing:
  compact: "6px"
  control-gap: "10px"
  label-inset: "12px"
  action-inset: "16px"
  gutter: "clamp(22px, 6.8vw, 106px)"
components:
  button-primary:
    backgroundColor: "{colors.olive}"
    textColor: "{colors.action-text}"
    typography: "{typography.label}"
    rounded: "{rounded.square}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.olive-hover}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.square}"
    padding: "10px 16px"
  title-input:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.square}"
    padding: "10px 12px"
  upload:
    backgroundColor: "{colors.upload-paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "20px 24px"
  viewer-actions:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "0 3px"
  room-navigation:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "3px"
  photograph-index:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "68px 24px 24px"
---

# Design System — Stillroom

## Overview

The gallery opens beside a glazed olive courtyard with flat limestone planes, then leads through offset passages to a darker print wing with graphite flooring and a flat timber ceiling. The interface borrows the proportions and typography of museum labels.

- Make photographs the focal points along the walk. Frame each in a slim dark wood surround with a cream mat and a small label below.
- Let the room occupy the full viewport. Put exhibition information, actions, and movement controls in compact panels around its edges.
- Use Cormorant Garamond for exhibition titles and headings, and DM Sans for instructions, captions, and controls.

## Colors

### Primary

Olive marks the main action, the current room, linked file selection, and the italic display line. The filled action deepens on hover.

### Neutral

Parchment and warm ink carry the interface. Use muted ink for instructions and counts, paper rules to divide content, and a slightly stronger border to set controls apart from the rendered room. The close-look view uses a charcoal-brown field and pale captions.

Warm limestone and bronze frame the entrance. The print wing pairs charcoal plaster and graphite slabs with dark timber. Its controls use a dark brown plate, pale lettering, and a warm divider. Dark frames and cream mats surround the work. Artwork uses unlit image surfaces to preserve each photograph's colors.

## Typography

Cormorant Garamond sets the large editorial heading, exhibition title, and index heading. The display line is tightly led and its olive italic phrase sits on a separate line. DM Sans sets body copy at regular weight and actions at semibold. Counts in the photo grid, index, and close-look viewer use tabular figures. The gallery title can wrap inside the top plate.

## Layout

The creation screen uses a centered container up to 1600px wide with fluid page gutters. The larger column of the two-column introduction holds the sample gallery. At 790px and below, the introduction stacks and the preview height scales with the viewport. The photo grid uses 132px minimum tracks and 12px gaps. At 490px and below, it uses three equal columns with 6px gaps.

Viewer controls sit at the top corners above the full-viewport scene. On wide screens the movement hint sits at bottom left, the room caption is centered, and room selection sits at bottom right. At 1050px and below, the keyboard hint stacks. At 790px and below, the upper panels tighten, a directional pad appears, and the caption sits just above the centered room selector. Coarse pointers also receive the pad and drag hint. The room selector appears for exhibitions with multiple rooms.

## Elevation & Depth

The interface uses flat surfaces, visible hairline rules, and tonal changes for hover. Glazing bars and leaves cast angled shadows into the entrance, while slim ceiling tracks wash the work in the print wing with warm light. Slab grain and shaded joints give the paving depth. The index adds a translucent warm-black scrim, while the full-screen photograph view uses a solid charcoal-brown backdrop.

## Shapes

Flat ceilings, deep openings with eased upper corners, and low linear benches give the rooms a consistent architectural language. Connected passages turn through varied footprints, with doorway positions set by the floor plan. Picture frames and interface plates are square-cornered. Thin rules divide segments and rows. The upload area uses a dashed outline to indicate its drop target.

## Components

### Actions and fields

Filled olive and outlined parchment actions share a minimum height of 46px. The file selector is an underlined olive button inside the drop area. Hover, focus within, and dragging bring a stronger border and warmer fill to the drop area. The title field uses a visible label above a single-line input, up to 440px wide. Keyboard focus uses a 2px outline with a 4px offset. Disabled buttons use reduced opacity.

### Gallery controls

The exhibition plate uses a vertical rule between the wordmark or back control and the title. The Photos and Copy link actions share a parchment plate with a separator and 44px minimum control height. Room buttons use a filled olive current state. The directional pad uses four 43px square buttons with 4px gaps.

### Photograph index and close look

The index is a full-height parchment drawer up to 435px wide with a serif heading and ruled rows. Each row aligns a 54 × 45px thumbnail, a tabular sequence number, and a wrapping title. The full row is interactive. Its focus outline sits inside the row. Close look fits the entire photograph in the available space and puts the title and count underneath. At 490px and below, previous and next controls move from the sides to the bottom. The dialogs use native modal keyboard behavior, with Escape to close and left and right arrows to move through the close-look photographs.
