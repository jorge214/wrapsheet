// app/+html.tsx
// Custom HTML shell for Expo web builds.
// Sets global cursor styles so interactive elements feel native to the browser.
import { ScrollViewStyleReset } from "expo-router/html";
import React from "react";

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              /* Pointer cursor on all interactive elements */
              [role="button"], button, a, select { cursor: pointer !important; }
              /* Text cursor on inputs */
              input, textarea { cursor: text !important; }
              /* Remove tap highlight on mobile web */
              * { -webkit-tap-highlight-color: transparent; }
              /* Prevent text selection on buttons */
              [role="button"] { user-select: none; -webkit-user-select: none; }
              /* Smooth transitions on interactive elements */
              [role="button"] {
                transition: opacity 0.12s ease, background-color 0.12s ease,
                            border-color 0.12s ease, box-shadow 0.12s ease;
              }
              /* Focus ring for keyboard navigation */
              [role="button"]:focus-visible {
                outline: 2px solid #555;
                outline-offset: 2px;
              }
              /* Remove default focus outline (we handle it above) */
              [role="button"]:focus:not(:focus-visible) { outline: none; }
              input:focus, textarea:focus { outline: none; }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
