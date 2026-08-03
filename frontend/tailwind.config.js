/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        /* — Primary — */
        "primary":                    "var(--color-primary)",
        "primary-container":          "var(--color-primary-container)",
        "on-primary":                 "var(--color-on-primary)",
        "on-primary-container":       "var(--color-on-primary-container)",
        "primary-fixed":              "var(--color-primary-fixed)",
        "on-primary-fixed":           "var(--color-on-primary-fixed)",
        "primary-fixed-dim":          "var(--color-primary-fixed-dim)",
        "on-primary-fixed-variant":   "var(--color-on-primary-fixed-variant)",

        /* — Secondary — */
        "secondary":                  "var(--color-secondary)",
        "secondary-container":        "var(--color-secondary-container)",
        "on-secondary":               "var(--color-on-secondary)",
        "on-secondary-container":     "var(--color-on-secondary-container)",
        "secondary-fixed":            "var(--color-secondary-fixed)",
        "on-secondary-fixed":         "var(--color-on-secondary-fixed)",
        "secondary-fixed-dim":        "var(--color-secondary-fixed-dim)",
        "on-secondary-fixed-variant": "var(--color-on-secondary-fixed-variant)",

        /* — Tertiary — */
        "tertiary":                   "var(--color-tertiary)",
        "tertiary-container":         "var(--color-tertiary-container)",
        "on-tertiary":                "var(--color-on-tertiary)",
        "on-tertiary-container":      "var(--color-on-tertiary-container)",
        "tertiary-fixed":             "var(--color-tertiary-fixed)",
        "on-tertiary-fixed":          "var(--color-on-tertiary-fixed)",
        "tertiary-fixed-dim":         "var(--color-tertiary-fixed-dim)",
        "on-tertiary-fixed-variant":  "var(--color-on-tertiary-fixed-variant)",

        /* — Surface & Background — */
        "background":                 "var(--color-background)",
        "on-background":              "var(--color-on-background)",
        "surface":                    "var(--color-surface)",
        "on-surface":                 "var(--color-on-surface)",
        "on-surface-variant":         "var(--color-on-surface-variant)",
        "surface-variant":            "var(--color-surface-variant)",
        "surface-dim":                "var(--color-surface-dim)",
        "surface-bright":             "var(--color-surface-bright)",
        "surface-tint":               "var(--color-surface-tint)",
        "surface-container-lowest":   "var(--color-surface-container-lowest)",
        "surface-container-low":      "var(--color-surface-container-low)",
        "surface-container":          "var(--color-surface-container)",
        "surface-container-high":     "var(--color-surface-container-high)",
        "surface-container-highest":  "var(--color-surface-container-highest)",

        /* — Outline — */
        "outline":                    "var(--color-outline)",
        "outline-variant":            "var(--color-outline-variant)",
        "inverse-surface":            "var(--color-inverse-surface)",
        "inverse-on-surface":         "var(--color-inverse-on-surface)",
        "inverse-primary":            "var(--color-inverse-primary)",

        /* — State — */
        "error":                      "var(--color-error)",
        "on-error":                   "var(--color-on-error)",
        "error-container":            "var(--color-error-container)",
        "on-error-container":         "var(--color-on-error-container)",
      },
      borderRadius: {
        "DEFAULT": "0.25rem",
        "sm":   "0.375rem",
        "md":   "0.5rem",
        "lg":   "0.75rem",
        "xl":   "1rem",
        "2xl":  "1.25rem",
        "3xl":  "1.75rem",
        "4xl":  "2.25rem",
        "full": "9999px"
      },
      spacing: {
        "container-max": "1280px",
        "xs": "8px",
        "sm": "16px",
        "md": "24px",
        "lg": "32px",
        "xl": "48px",
        "base": "4px",
        "margin-mobile": "16px",
        "margin-desktop": "32px",
        "gutter": "24px"
      },
      fontFamily: {
        "sora": ["Sora", "sans-serif"],
        "inter": ["Inter", "sans-serif"]
      }
    },
  },
  plugins: [],
}
