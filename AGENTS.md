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
