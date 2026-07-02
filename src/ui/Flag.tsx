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
