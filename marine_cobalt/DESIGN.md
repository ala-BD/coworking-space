---
name: Marine & Cobalt
colors:
  surface: '#fbf9fb'
  surface-dim: '#dbd9dc'
  surface-bright: '#fbf9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3f6'
  surface-container: '#efedf0'
  surface-container-high: '#e9e7ea'
  surface-container-highest: '#e4e2e5'
  on-surface: '#1b1b1e'
  on-surface-variant: '#44474d'
  inverse-surface: '#303033'
  inverse-on-surface: '#f2f0f3'
  outline: '#75777e'
  outline-variant: '#c5c6ce'
  surface-tint: '#4d5f7e'
  primary: '#000d23'
  on-primary: '#ffffff'
  primary-container: '#10233f'
  on-primary-container: '#798bac'
  inverse-primary: '#b5c7eb'
  secondary: '#0054cb'
  on-secondary: '#ffffff'
  secondary-container: '#2d6deb'
  on-secondary-container: '#fefcff'
  tertiary: '#180a00'
  on-tertiary: '#ffffff'
  tertiary-container: '#361d00'
  on-tertiary-container: '#aa8259'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d6e3ff'
  primary-fixed-dim: '#b5c7eb'
  on-primary-fixed: '#071b37'
  on-primary-fixed-variant: '#364765'
  secondary-fixed: '#dae2ff'
  secondary-fixed-dim: '#b1c5ff'
  on-secondary-fixed: '#001847'
  on-secondary-fixed-variant: '#0040a0'
  tertiary-fixed: '#ffdcbc'
  tertiary-fixed-dim: '#ecbe90'
  on-tertiary-fixed: '#2c1700'
  on-tertiary-fixed-variant: '#60401d'
  background: '#fbf9fb'
  on-background: '#1b1b1e'
  surface-variant: '#e4e2e5'
typography:
  headline-xl:
    fontFamily: Sora
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Sora
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Sora
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
  headline-md:
    fontFamily: Sora
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Sora
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 16px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 16px
  md: 24px
  lg: 32px
  xl: 48px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 32px
---

## Brand & Style
The design system is engineered for premium B2B SaaS environments, prioritizing clarity, authority, and a high-end technological feel. The brand personality is sophisticated yet energetic, balancing deep, trustworthy tones with vibrant action accents.

The aesthetic leans into **Modern Minimalism** with a focus on structured data and editorial-grade spacing. It draws inspiration from industry leaders like Stripe and Notion, utilizing generous white space, crisp typography, and subtle depth to guide the user through complex workflows without cognitive overload. The emotional response should be one of "effortless power"—the interface feels stable, professional, and precision-engineered.

## Colors
The palette is anchored by **Encre Marine (#10233F)**, used for high-authority surfaces like sidebars, headers, and primary headings to establish a premium "dark mode" foundation within a light-themed app. 

**Bleu Cobalt (#2F6FED)** serves as the sole action color, reserved for primary buttons, active states, and links. **Vert Sève (#2FBE8F)** is utilized strictly for positive growth indicators and success states, while **Corail Chaleureux (#FF6F59)** provides a warm, high-visibility contrast for alerts or secondary calls-to-action. Backgrounds should primarily use **Gris Perle (#F4F6F9)** to maintain a soft, low-strain environment for long-term dashboard usage, with **Anthracite (#1C1F26)** providing high-legibility contrast for body copy.

## Typography
This design system employs a dual-typeface strategy to distinguish between brand identity and functional utility. 

**Sora** is used for all headlines and brand elements. Its geometric construction conveys a modern, tech-forward vibe. Tighten letter-spacing slightly on larger sizes to maintain a premium, "locked-in" look. 

**Inter** is the workhorse for the UI. It is used for all body text, data tables, form fields, and labels. It ensures maximum readability at small sizes and high-density information environments. Use a medium weight (500/600) for labels and buttons to ensure they stand out against body copy.

## Layout & Spacing
The layout follows a **Fixed-Fluid Hybrid Grid**. Dashboards should use a fixed-width left navigation (256px) with a fluid content area that caps at a maximum width of 1280px to prevent line lengths from becoming unreadable.

We use an **8px linear scale** for spacing (4, 8, 16, 24, 32, 48, 64). 
- **Desktop:** 12-column grid, 24px gutters, 32px side margins.
- **Tablet:** 8-column grid, 16px gutters, 24px side margins.
- **Mobile:** 4-column grid, 16px gutters, 16px side margins.

Content should be grouped using "logical containers"—white cards on the Gris Perle background—to create a clear visual hierarchy of information modules.

## Elevation & Depth
Depth is communicated through **Ambient Shadows** and **Tonal Layering**. We avoid heavy, black shadows in favor of soft, diffused shadows tinted with the primary Encre Marine hue.

- **Level 0 (Floor):** Background color Gris Perle (#F4F6F9).
- **Level 1 (Cards):** White (#FFFFFF) surface with a very soft shadow (0px 2px 4px rgba(16, 35, 63, 0.04)). Use for secondary layout containers.
- **Level 2 (Interactive):** White (#FFFFFF) surface with a medium shadow (0px 8px 16px rgba(16, 35, 63, 0.08)). Use for primary cards and hover states.
- **Level 3 (Overlays):** White (#FFFFFF) surface with a deep, diffused shadow (0px 16px 32px rgba(16, 35, 63, 0.12)). Use for modals and dropdown menus.

## Shapes
The shape language is consistently **Rounded**, reinforcing the approachable premium feel. 
- **Standard UI elements** (Buttons, Inputs): 0.5rem (8px).
- **Secondary Containers** (Small Cards, Chips): 1rem (16px).
- **Large Layout Containers** (Main Dashboard Cards): 1.5rem (24px).

Avoid sharp 90-degree corners entirely. Interactive elements like checkboxes should maintain a slight 4px radius to stay consistent with the broader system while remaining distinct from circular radio buttons.

## Components

### Buttons
- **Primary:** Solid Bleu Cobalt (#2F6FED) with white text. Use 16px horizontal padding.
- **Secondary:** Encre Marine (#10233F) outline or ghost style for less prominent actions.
- **Tertiary:** Corail Chaleureux (#FF6F59) reserved for destructive actions (e.g., Delete) or high-attention secondary CTAs.

### Input Fields
- Background: White. 
- Border: 1px solid Encre Marine at 10% opacity. 
- Focus State: 2px solid Bleu Cobalt with a subtle glow (shadow).
- Text: Anthracite (#1C1F26).

### Cards
- Always White background.
- Border-radius: 16px (rounded-lg).
- Shadow: Level 1 or Level 2 depending on importance.
- Internal Padding: 24px (md).

### Chips/Tags
- **Success:** Vert Sève (#2FBE8F) at 10% opacity background with 100% opacity text.
- **Alert:** Corail Chaleureux (#FF6F59) at 10% opacity background with 100% opacity text.
- Roundedness: Pill-shaped.

### Data Tables
- Header: Encre Marine background with white Sora (Label-sm) text.
- Rows: Alternating white and Gris Perle, or separated by 1px light borders.
- Hover state: Slight elevation shift (Level 1 shadow).