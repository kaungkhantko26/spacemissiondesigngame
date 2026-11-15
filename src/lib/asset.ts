/** Prefix for files in /public so they also resolve under a GitHub Pages sub-path (set NEXT_PUBLIC_BASE_PATH at build). */
export const asset = (path: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${path}`;
