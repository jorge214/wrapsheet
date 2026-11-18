// src/ui/PrimeirosPassos.tsx
// Cartão "Primeiros passos" da página inicial (18/11/2026): registar um dia,
// exportar o PDF e completar o perfil. Só para contas novas (as que passaram
// pela primeira entrada); quem já usava a app nunca o vê. Cada passo feito
// fica riscado; com os três, o cartão dá os parabéns e pode fechar-se.
// Telemóvel: na página inicial. Ecrã largo: no topo da lista de projetos.
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, Text, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import type { EstadoPassos } from "../storage/passosRegras";
import { fecharPassos, lerEstadoPassos, ultimaFolhaPropria } from "../storage/primeirosPassos";
import { getActiveProfileId } from "../storage/profile";
import { useSync } from "../sync/SyncProvider";
import { useTheme } from "../theme/ThemeProvider";

const VERDE = "#137a3a";

export function PrimeirosPassos({ style }: { style?: any }) {
  const { COLORS } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { primeiraEntrada } = useSync();
  const [estado, setEstado] = useState<EstadoPassos | null>(null);
  const [perfilId, setPerfilId] = useState("");

  const carregar = useCallback(async () => {
    if (!user) return;
    try {
      const [e, pid] = await Promise.all([lerEstadoPassos(user.id), getActiveProfileId()]);
      setEstado(e);
      setPerfilId(pid);
    } catch {
      /* fica como estava */
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );
  // Ao acabar a primeira entrada o cartão aparece logo, sem mudar de ecrã
  useEffect(() => {
    if (!primeiraEntrada) carregar();
  }, [primeiraEntrada, carregar]);

  if (!estado?.visivel) return null;

  const fechar = () => {
    setEstado({ ...estado, visivel: false });
    fecharPassos(user?.id).catch(() => {});
  };
  const abrirFolha = async () => {
    const id = await ultimaFolhaPropria();
    router.push(id ? `/projects/${id}` : "/projects");
  };
  const abrirPerfil = () => router.push(perfilId ? `/profiles/${perfilId}` : "/profiles");

  const tudo = estado.feitos === 3;
  const passos = [
    {
      k: "dia",
      feito: estado.dia,
      titulo: t("passos_dia", { defaultValue: "Registar um dia" }),
      sub: t("passos_dia_sub", { defaultValue: "Mete a hora de início e de fim de um dia de trabalho." }),
      ir: abrirFolha,
    },
    {
      k: "pdf",
      feito: estado.pdf,
      titulo: t("passos_pdf", { defaultValue: "Exportar o PDF" }),
      sub: t("passos_pdf_sub", { defaultValue: "É a folha que envias à produção para seres pago." }),
      ir: abrirFolha,
    },
    {
      k: "perfil",
      feito: estado.perfil,
      titulo: t("passos_perfil", { defaultValue: "Completar o perfil" }),
      sub: t("passos_perfil_sub", { defaultValue: "Nome, NIF e IBAN, para saírem na folha." }),
      ir: abrirPerfil,
    },
  ];

  return (
    <View
      style={[
        {
          borderRadius: 16,
          borderWidth: 2,
          borderColor: tudo ? VERDE : COLORS.text,
          backgroundColor: COLORS.card,
          padding: 16,
          marginBottom: 12,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: tudo ? 4 : 10 }}>
        <Text style={{ flex: 1, fontSize: 17, fontWeight: "900", color: COLORS.text }}>
          {tudo
            ? t("passos_done_title", { defaultValue: "Está tudo pronto" })
            : t("passos_title", { defaultValue: "Primeiros passos" })}
        </Text>
        {!tudo && (
          <Text style={{ fontSize: 13, fontWeight: "800", color: COLORS.sub, marginRight: 12 }}>
            {t("passos_count", { n: estado.feitos, defaultValue: "{{n}} de 3" })}
          </Text>
        )}
        <Pressable onPress={fechar} hitSlop={10} style={({ pressed }) => [pressed && { opacity: 0.6 }, Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null]}>
          <Text style={{ fontSize: 13, fontWeight: "800", color: COLORS.sub, textDecorationLine: "underline" }}>
            {tudo ? t("passos_close", { defaultValue: "Fechar" }) : t("passos_hide", { defaultValue: "Esconder" })}
          </Text>
        </Pressable>
      </View>

      {tudo ? (
        <Text style={{ fontSize: 14, color: COLORS.sub }}>
          {t("passos_done_sub", { defaultValue: "Já sabes o essencial. Boas rodagens!" })}
        </Text>
      ) : (
        passos.map((p, i) => (
          <Pressable
            key={p.k}
            onPress={p.feito ? undefined : p.ir}
            disabled={p.feito}
            accessibilityRole="button"
            accessibilityState={{ checked: p.feito, disabled: p.feito }}
            style={({ pressed }) => [
              { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: COLORS.border },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons
              name={p.feito ? "checkmark-circle" : "ellipse-outline"}
              size={24}
              color={p.feito ? VERDE : COLORS.sub}
              style={{ marginRight: 12 }}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "800",
                  color: p.feito ? COLORS.sub : COLORS.text,
                  textDecorationLine: p.feito ? "line-through" : "none",
                }}
              >
                {p.titulo}
              </Text>
              {!p.feito && <Text style={{ fontSize: 13, color: COLORS.sub, marginTop: 2 }}>{p.sub}</Text>}
            </View>
            {!p.feito && <Ionicons name="chevron-forward" size={18} color={COLORS.sub} />}
          </Pressable>
        ))
      )}
    </View>
  );
}
