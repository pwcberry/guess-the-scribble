import { css } from "lit";

/**
 * Shared element-level styles that mirror the global rules in public/index.css.
 *
 * Because Lit components render into Shadow DOM, global stylesheets do not
 * penetrate the shadow boundary — only CSS custom properties do. Spread this
 * stylesheet into every component that uses h1, h2, button, or input so they
 * get the design-system appearance consistently.
 *
 * Usage:
 *   import { elementStyles } from "./element-styles.ts";
 *   static styles = [elementStyles, css`...component-specific styles...`];
 */
export const elementStyles = css`
  h1 {
    font-family: "Merriweather", serif;
    font-optical-sizing: auto;
    font-weight: 700;
    font-style: normal;
    font-variation-settings: "wdth" 100;
    font-size: 2.75rem;
    margin-block: 0.5em 0.875em;
    line-height: 1;
  }

  h2 {
    font-family: "Merriweather", serif;
    font-optical-sizing: auto;
    font-weight: 700;
    font-style: normal;
    font-variation-settings: "wdth" 100;
    font-size: 1.875rem;
    margin-block: 0.875em 0.5em;
    line-height: 1;
  }

  input,
  button,
  textarea,
  select {
    font: inherit;
  }

  button {
    cursor: pointer;
    line-height: 1.875em;
    text-decoration: none;
    -webkit-appearance: none;
    white-space: normal;
    user-select: none;
    vertical-align: middle;
    border-radius: 0.25rem;
    border-width: 1px;
    border-style: solid;
    padding-block: 0.25em 0.375em;
    padding-inline: 0.75em;
    font-size: 1rem;
    font-weight: 500;
    font-family: "Inter", Helvetica, Arial, sans-serif;
  }

  button.primary {
    color: var(--color-button-primary-text);
    background-color: var(--color-button-primary-background);
    border-color: var(--color-button-primary-border);
    transition: background-color 0.2s ease-in-out, border-color 0.2s ease-in-out;
  }

  button.primary:hover {
    background-color: var(--color-button-primary-background-hover);
    border-color: var(--color-button-primary-border-hover);
  }

  button.secondary {
    color: var(--color-button-secondary-text);
    background-color: var(--color-button-secondary-background);
    border-color: var(--color-button-secondary-border);
    transition: background-color 0.2s ease-in-out;
  }

  button.secondary:hover {
    background-color: var(--color-button-secondary-background-hover);
  }

  button[disabled],
  button:disabled {
    background-color: transparent;
    border-color: transparent;
    color: var(--color-sandstone);
    cursor: default;
  }

  button[disabled] *,
  button:disabled * {
    pointer-events: none;
  }

  input[type="text"],
  textarea {
    border: 1px solid var(--color-charcoal-40);
    border-radius: 0.25rem;
    padding: 0.25em;
    font-size: 1rem;
    font-weight: 400;
    font-family: "Inter", Helvetica, Arial, sans-serif;
  }
`;
