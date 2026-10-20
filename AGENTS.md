# AGENTS.md - Project Rules & Assistant Instructions

This file defines project-specific rules, conventions, and constraints for the AI Coding Agent.

---

## 1. UI & Text Cleanliness Rules
- **No Parenthetical Annotations**: Never explain a button, tab, header, or title with parenthetical notes like `(description)`, `(count)`, `(3)`, `(optional)`, etc. Keep titles and button text clean, concise, and professional.
- **Concise UI/UX Copy**: Never add too much text to a button, title, or simple description. Keep copy punchy, direct, and scannable.
- **Typography Sizing Constraints**:
  - **Minimum text size**: Keep all user-facing text size **at or above `14.sp` / `14px` (`text-sm`)** (never use tiny 8px–11px micro-copy).
  - **Maximum text size**: Keep large display text **below `64.sp` / `64px`**.
- **Clean Badges**: Use clean badges/tags for item states, avoiding redundant manual switch clutter or micro-text.
- **Card Nesting Limit**: Never embed 3 levels of cards (only 2 embeds are allowed). If there is a different section inside of a card, change the background of that section instead of putting it inside of another card.
- **Vertical-First Column Alignment (Every Element in a Column, Not in a Row)**: Never put text in a horizontal row alongside other elements (such as action buttons, icons, badges, inputs, or metadata) inside an item, card, list entry, or log record. Every element inside of an item MUST be laid out in a column (`flex flex-col`), vertically aligned and vertically stacked, and NOT in a horizontal row where elements are horizontally aligned side by side. All items must stack elements vertically:
  1. Top metadata / timestamp / type tag
  2. Full-width item title / name (at least 14px / `text-sm`, bold, clean)
  3. Secondary description / details / subtitle
  4. Metrics, values, or macro badges in their own dedicated vertical section
  5. Action buttons (edit, delete, favorite, log, view) in their own dedicated vertical action section (full width or dedicated row at bottom, with at least 48px touch targets)
  No item should crush text horizontally next to buttons, icons, or controls.
- **Deletion & Discard Confirmation Required**: Any delete, remove, discard, or clear button or action anywhere in the application must always present a confirmation pop-up dialog before executing. Never perform destructive removals without explicit user confirmation. All delete buttons must have at least 48px touch targets and safe spacing to prevent accidental taps during scrolling.

---

## 2. Versioning & Release Rules
- **Automatic Version Bump**: With **every code change or iteration**, always bump:
  - `versionCode` (integer increment in `app/build.gradle.kts` / version config)
  - `versionName` (semantic or minor version increment in `package.json` and `src/version.ts`, e.g., 1.0 -> 1.1)
- **Menu Version Display**: Always display the current active application version in the menu footer at the bottom.

---

## 3. General Architecture & Design Guidelines
- **Edge-to-Edge & Accessibility**: Ensure touch targets are at least 48dp / 48px and UI elements adapt gracefully to light and dark themes.
- **Scannable Layout**: Use generous spacing and clear visual hierarchy across all screens.
