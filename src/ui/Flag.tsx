// src/ui/Flag.tsx
// Renders a real flag image (flagcdn.com) instead of an emoji.
// Windows browsers (Chrome/Edge/Brave) do NOT render 🇵🇹-style flag emoji —
// they show the two-letter code as text. Images render everywhere (web + native).
import React from "react";
import { Image } from "react-native";

// Map app region/language codes → ISO 3166-1 alpha-2 country codes for flagcdn.
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
  const height = Math.round(size * 0.72); // flags are ~4:3
  return (
    <Image
      source={{ uri: `https://flagcdn.com/w80/${iso}.png` }}
      style={{ width: size, height, borderRadius: 4, backgroundColor: "#eee" }}
      resizeMode="cover"
      accessibilityLabel={`${iso} flag`}
    />
  );
}
