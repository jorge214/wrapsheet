// app/+html.tsx
// Custom HTML shell for Expo web builds.
// Sets global cursor styles so interactive elements feel native to the browser.
import { ScrollViewStyleReset } from "expo-router/html";
import React from "react";

const SITE_URL = "https://wrapsheet-app.com";
const TITLE = "WrapSheet — Film & Production Timesheet";
const DESCRIPTION =
  "Track your film and production work hours. Generate professional PDF timesheets in seconds. Free for individuals.";
const OG_IMAGE = `${SITE_URL}/favicon.png`;

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>{TITLE}</title>
        <meta name="description" content={DESCRIPTION} />
        <meta name="theme-color" content="#000000" />
        <link rel="canonical" href={SITE_URL} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={SITE_URL} />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:image" content={OG_IMAGE} />
        <meta property="og:site_name" content="WrapSheet" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={TITLE} />
        <meta name="twitter:description" content={DESCRIPTION} />
        <meta name="twitter:image" content={OG_IMAGE} />
        <meta name="application-name" content="WrapSheet" />
        <meta name="apple-mobile-web-app-title" content="WrapSheet" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="robots" content="index, follow" />
        {/* PWA: torna a app instalável no Chrome/Edge (PC) e Safari (Mac,
            "Adicionar à Dock") — o manifest vive em public/ */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/pwa-icon.png" />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              /* Cursor de seta por defeito (o RN Web mostra I-beam de texto em
                 qualquer <Text>). cursor herda-se, por isso o body chega — os
                 botões e inputs mantêm o deles (têm !important abaixo). */
              html, body { cursor: default; }
              /* Pointer cursor on all interactive elements */
              [role="button"], button, a, select { cursor: pointer !important; }
              /* Text cursor on inputs */
              input, textarea { cursor: text !important; }
              /* Remove tap highlight on mobile web */
              * { -webkit-tap-highlight-color: transparent; }
              /* Sem cursor de escrita a piscar fora de campos de texto:
                 clicar em rótulos ("Voltar", títulos, botões) deixava um
                 caret visível (ex.: caret browsing do Chrome ligado por F7).
                 O caret fica invisível em todo o lado exceto onde se escreve. */
              body { caret-color: transparent; }
              input, textarea, [contenteditable="true"], [contenteditable=""] {
                caret-color: auto;
              }
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
