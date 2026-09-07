import type { Preview } from "@storybook/web-components-vite";
// @ts-expect-error "@gts/client/public/colors.css" is not a module, but we want to import it for its side effects"
import "@gts/client/public/colors.css";

/**
 * @storybook/web-components-vite relies on `import.meta.hot.decline()` to
 * force a full page reload on every source change (Lit components can't do
 * React-style fast refresh). That call is a documented no-op as of Vite 3+,
 * so edits instead fall through to a normal HMR module swap, re-running each
 * component's `@customElement(...)` decorator against a tag name that's
 * already registered — which throws. Guard `define` so a re-registration is
 * a no-op instead of a crash. Note: the already-mounted element keeps running
 * its old class until you manually refresh the tab — this only stops the
 * error, it doesn't restore live-reload for component source changes.
 */
if (typeof customElements !== "undefined") {
  const nativeDefine = customElements.define.bind(customElements);
  customElements.define = (name, ctor, options) => {
    if (customElements.get(name)) {
      return;
    }
    nativeDefine(name, ctor, options);
  };
}

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: "todo",
    },
  },
};

export default preview;
