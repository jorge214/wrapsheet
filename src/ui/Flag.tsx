// src/ui/Flag.tsx
// Renders a real flag image instead of an emoji.
// Windows browsers (Chrome/Edge/Brave) do NOT render 🇵🇹-style flag emoji —
// they show the two-letter code as text. Bundled PNGs render everywhere
// (web + native) and work offline.
import React from "react";
import { Image } from "react-native";

// Bundled flag assets, keyed by ISO 3166-1 alpha-2.
const FLAGS: Record<string, any> = {
  pt: require("../../assets/flags/pt.png"),
  es: require("../../assets/flags/es.png"),
  fr: require("../../assets/flags/fr.png"),
  de: require("../../assets/flags/de.png"),
  gb: require("../../assets/flags/gb.png"),
  br: require("../../assets/flags/br.png"),
  it: require("../../assets/flags/it.png"),
  nl: require("../../assets/flags/nl.png"),
  pl: require("../../assets/flags/pl.png"),
  se: require("../../assets/flags/se.png"),
  ch: require("../../assets/flags/ch.png"),
  cz: require("../../assets/flags/cz.png"),
  no: require("../../assets/flags/no.png"),
  fi: require("../../assets/flags/fi.png"),
  be: require("../../assets/flags/be.png"),
  at: require("../../assets/flags/at.png"),
  hu: require("../../assets/flags/hu.png"),
};

// Map app region/language codes → ISO country code.
const ISO: Record<string, string> = {
  pt: "pt",
  "pt-br": "br",
  en: "gb",
  uk: "gb",
  es: "es",
  fr: "fr",
  de: "de",
  it: "it",
  nl: "nl",
  pl: "pl",
  se: "se",
  ch: "ch",
  cz: "cz",
  no: "no",
  fi: "fi",
  be: "be",
  at: "at",
  hu: "hu",
};

export function Flag({ code, size = 30 }: { code: string; size?: number }) {
  const iso = ISO[code.toLowerCase()] ?? code.toLowerCase();
  const src = FLAGS[iso];
  if (!src) return null;
  const height = Math.round(size * 0.72); // flags are ~4:3
  return (
    <Image
      source={src}
      style={{ width: size, height, borderRadius: 4, backgroundColor: "#eee" }}
      resizeMode="cover"
      accessibilityLabel={`${iso} flag`}
    />
  );
}
