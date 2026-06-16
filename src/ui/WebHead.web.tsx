import { Head } from "expo-router/head";
import React from "react";

const SITE_URL = "https://wrapsheet-app.com";
const TITLE = "WrapSheet — Film & Production Timesheet";
const DESCRIPTION =
  "Track your film and production work hours. Generate professional PDF timesheets in seconds. Free for individuals.";
const OG_IMAGE = `${SITE_URL}/favicon.png`;

export function WebHead() {
  return (
    <Head>
      {/* Primary */}
      <title>{TITLE}</title>
      <meta name="description" content={DESCRIPTION} />
      <meta name="theme-color" content="#000000" />
      <link rel="canonical" href={SITE_URL} />

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={SITE_URL} />
      <meta property="og:title" content={TITLE} />
      <meta property="og:description" content={DESCRIPTION} />
      <meta property="og:image" content={OG_IMAGE} />
      <meta property="og:site_name" content="WrapSheet" />
      <meta property="og:locale" content="en_US" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={TITLE} />
      <meta name="twitter:description" content={DESCRIPTION} />
      <meta name="twitter:image" content={OG_IMAGE} />

      {/* PWA / Mobile */}
      <meta name="application-name" content="WrapSheet" />
      <meta name="apple-mobile-web-app-title" content="WrapSheet" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta name="mobile-web-app-capable" content="yes" />

      {/* Indexing */}
      <meta name="robots" content="index, follow" />
    </Head>
  );
}
