# Design System Specification: The Kinetic Grocer

This design system is a high-performance framework engineered for speed, clarity, and tactile appeal. It moves away from the "flat web" by treating the interface as a physical, layered environment. Our goal is to replicate the energy of a bustling high-end marketplace—efficient, vibrant, and impeccably organized.

## 1. Overview & Creative North Star: "The Kinetic Curator"
The Creative North Star for this system is **The Kinetic Curator**. 

Unlike standard e-commerce platforms that feel like static grids, this system feels alive. We break the "template" look through **intentional asymmetry**—offsetting high-quality product photography against clean, bold typography. We use **overlapping elements** (e.g., a product image breaking the container's boundary) to create a sense of depth and urgency. The density is high, but the cognitive load is low, achieved through a sophisticated "Tonal Layering" strategy.

## 2. Colors & Surface Philosophy

The palette is anchored by a high-energy `primary` orange, balanced by a sophisticated spectrum of violet-tinted neutrals that prevent the interface from feeling sterile.

### The "No-Line" Rule
**Explicit Instruction:** You are prohibited from using 1px solid borders to section off content. 
Boundaries must be defined solely through background color shifts. For example, a `surface-container-low` section should sit on a `surface` background. This creates a "soft-edge" UI that feels modern and premium rather than "boxy."

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. 
- **Base:** `surface` (#f6f5ff)
- **Secondary Sections:** `surface-container-low` (#eef0ff)
- **Primary Cards:** `surface-container-lowest` (#ffffff) for maximum "pop."
- **Interactive Trays:** `surface-container-high` (#dfe2f3)

### The "Glass & Gradient" Rule
To elevate the "out-of-the-box" feel, use **Glassmorphism** for floating headers or navigation bars. Apply `surface` with 80% opacity and a 12px backdrop-blur. 
For main CTAs, do not use flat hex codes. Use a subtle linear gradient from `primary` (#934600) to `primary-container` (#fa7e17) to provide a "liquid" soul to the button.

## 3. Typography: Editorial Authority

We use a dual-font system to balance character with utility.

*   **Display & Headlines (Manrope):** These are our "Editorial" voices. Use `display-lg` and `headline-md` with tight letter-spacing (-0.02em) to create a bold, authoritative look.
*   **Body & Labels (Inter):** Inter is our "Utility" voice. It provides maximum legibility at high densities. 

**Hierarchy Note:** Use `title-lg` for product names and `label-md` for metadata (like weight or delivery time). Always ensure a high contrast between `on-surface` (titles) and `on-surface-variant` (secondary info).

## 4. Elevation & Depth: Tonal Layering

We convey hierarchy through **Tonal Layering** rather than traditional structural lines or heavy shadows.

*   **The Layering Principle:** Place a `surface-container-lowest` card on a `surface-container-low` background. This creates a natural "lift" that mimics fine paper stocks.
*   **Ambient Shadows:** For floating elements (like a "View Cart" bar), use extra-diffused shadows: `box-shadow: 0 12px 32px rgba(44, 46, 56, 0.06);`. The shadow color is a tint of our `on-surface` color, never pure black.
*   **The Ghost Border Fallback:** If a border is required for accessibility, use the `outline-variant` token at **15% opacity**. High-contrast borders are strictly forbidden.

## 5. Components

### Buttons
*   **Primary:** High-gloss gradient (`primary` to `primary-container`). `ROUND_TWELVE` (0.75rem). Use `on-primary` for text.
*   **Secondary:** `secondary-container` background with `on-secondary-container` text. No border.
*   **Tertiary:** Ghost style. No background, `primary` text. Use for low-priority actions like "See All."

### Cards & Lists
*   **Forbid Divider Lines:** Separate list items using `spacing-4` (0.9rem) of vertical white space or by alternating background tones between `surface` and `surface-container-low`.
*   **Product Cards:** Use `surface-container-lowest`. Product images should have a slight `0.5` spacing offset to "break" the container, creating an editorial feel.

### Input Fields
*   **Stateful Design:** Default state uses `surface-variant`. On focus, transition to an `outline` of `primary` at 20% opacity and a subtle `surface-container-lowest` background shift.

### Signature Component: The "Quick-Add" Stepper
A high-density component for grocery apps. When a user clicks "Add," the button morphs into a stepper (+ / -). This component should use `surface-container-highest` to feel grounded and tactile.

## 6. Do’s and Don’ts

### Do:
*   **Do** use asymmetrical layouts where imagery is slightly larger than the text block beside it.
*   **Do** use `ROUND_TWELVE` (0.75rem) as your default "softness" for all containers.
*   **Do** leverage the `tertiary` (yellow/gold) tokens for "Value" callouts (e.g., "Save $2.00").

### Don’t:
*   **Don’t** use pure black (#000000) for text. Use `on-surface` (#2c2e38) to maintain the premium, soft-touch feel.
*   **Don’t** use standard 1px gray dividers. They break the flow of the "Kinetic Curator" vibe.
*   **Don’t** crowd the edges. Even in a "high-density" system, the `spacing-4` (0.9rem) gutter is your minimum breathing room.

### Accessibility Note
While we use tonal shifts for sectioning, ensure that the contrast between `surface` and `on-surface` remains above 4.5:1. Use `outline-variant` (Ghost Border) at low opacity specifically to assist users with low-contrast sensitivity without compromising the "No-Line" aesthetic.