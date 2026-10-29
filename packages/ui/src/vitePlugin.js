import { themeInitScript } from './theme/initScript.js';

/** Vite plugin: injects the theme-init script at the top of <head> (no flash of wrong theme). */
export function rrbThemeInitPlugin() {
  return {
    name: 'rrb-theme-init',
    transformIndexHtml: () => [{ tag: 'script', children: themeInitScript, injectTo: 'head-prepend' }],
  };
}
export default rrbThemeInitPlugin;
