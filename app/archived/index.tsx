// app/archived/index.tsx
// "Arquivados" foi fundido dentro de "Projetos" (pasta "Arquivados").
// Mantemos a rota como redirecionamento para não partir links antigos.
import { router } from "expo-router";
import { useEffect } from "react";

export default function RedirectArchived() {
  useEffect(() => {
    router.replace("/projects");
  }, []);
  return null;
}
