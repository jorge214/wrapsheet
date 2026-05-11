// app/profile.tsx
import { router } from "expo-router";
import { useEffect } from "react";
export default function RedirectProfiles() {
  useEffect(() => { router.replace("/profiles"); }, []);
  return null;
}
