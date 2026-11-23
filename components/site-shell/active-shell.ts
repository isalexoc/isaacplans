/**
 * The page frame app/[locale]/layout.tsx draws, picked when the app is BUILT.
 *
 * Why at build time: Next ships every client component a layout imports to the browser with the
 * layout's code, whichever branch renders. A runtime `if (product)` in the layout still sent Clerk,
 * Isaac's header and footer, GA, the Pixel loader and the CRM scripts (with his name and number in
 * them) to every page of the product domain.
 *
 * This file is Isaac's frame (main-shell.tsx): what his site builds, and what TypeScript checks the
 * layout against. When the build runs with APP_SURFACE=product, next.config.mjs replaces every
 * import of this module with product-shell.tsx, so main-shell.tsx and everything it imports are not
 * in the product build at all. Both frames export the same names with the same types
 * (./shared.ts), and the layout refuses to draw a frame built for the other surface.
 */

export { default, shellMetadata, SHELL_SURFACE } from "./main-shell";
