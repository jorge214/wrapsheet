// app/profiles/index.tsx
import { router, useFocusEffect } from "expo-router";
import { useIsWide } from "../../src/ui/useBreakpoint";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  Profile,
  createProfile,
  deleteProfile,
  getActiveProfileId,
  listProfiles,
  setActiveProfileId,
} from "../../src/storage/profile";
import {
  backfillProfileIds,
  listArchivedProjects,
  listProjects,
} from "../../src/storage/projects";
import { useAuth } from "../../src/auth/AuthContext";
import { deleteProfileFromCloud } from "../../src/sync/syncService";
import { useTheme } from "../../src/theme/ThemeProvider";

export default function ProfilesListScreen() {
  const { COLORS, mode } = useTheme();
  const { t } = useTranslation();
  const isWide = useIsWide();
  const s = useMemo(() => createStyles(COLORS, mode), [COLORS, mode]);

  const { user } = useAuth();
  const [items, setItems] = useState<Profile[]>([]);
  const [activeId, setActiveId] = useState("");
  // Relance por perfil: nº de folhas do mês corrente e quantas por fechar
  const [glance, setGlance] = useState<Record<string, { total: number; open: number }>>({});

  // modal opções
  const [optsId, setOptsId] = useState<string | null>(null);
  const selected = useMemo(
    () => items.find((x) => x.id === optsId) || null,
    [items, optsId]
  );

  async function refresh() {
    // Carimba legados primeiro para as contagens por perfil serem exatas
    await backfillProfileIds().catch(() => {});
    const [list, active, projs, arch] = await Promise.all([
      listProfiles(),
      getActiveProfileId(),
      listProjects(),
      listArchivedProjects(),
    ]);
    list.sort((a, b) => Number(b.id) - Number(a.id));
    setItems(list);
    setActiveId(active);

    // Folhas do mês corrente por perfil: total + por fechar (não pagas)
    const now = new Date();
    const monthKey = `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
    const map: Record<string, { total: number; open: number }> = {};
    for (const it of [...projs, ...arch]) {
      if (it.mes !== monthKey || !it.profileId) continue;
      const g = map[it.profileId] ?? (map[it.profileId] = { total: 0, open: 0 });
      g.total++;
      if (!it.pago) g.open++;
    }
    setGlance(map);
  }

  useEffect(() => {
    refresh();
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [])
  );

  async function handleNew() {
    // Limite de 1 perfil. Se já existe pelo menos um perfil — e a conta não foi
    // desbloqueada à mão (app_metadata.profiles_unlocked, só service-role) —, em
    // vez de criar abre o ecrã de contacto. Quem já tem vários perfis mantém-nos:
    // o limite só trava a CRIAÇÃO de novos, nunca a edição/uso dos existentes.
    const unlocked = (user?.app_metadata as any)?.profiles_unlocked === true;
    if (!unlocked) {
      const existing = await listProfiles();
      if (existing.length >= 1) {
        router.push("/profiles/unlock");
        return;
      }
    }
    const p = await createProfile();
    await setActiveProfileId(p.id);
    router.push(`/profiles/${p.id}?edit=1`);
  }

  async function handleDelete(id: string) {
    // Multi-perfil: perfil com folhas não se apaga (ficariam órfãs/invisíveis)
    const [projs, arch] = await Promise.all([listProjects(), listArchivedProjects()]);
    const nOwned = [...projs, ...arch].filter((i) => i.profileId === id).length;
    if (nOwned > 0) {
      const title = t("profile_has_sheets_title", { defaultValue: "Perfil com folhas" });
      const msg = t("profile_has_sheets_msg", {
        n: nOwned,
        defaultValue:
          "Este perfil tem {{n}} folha(s). Apaga-as ou duplica-as para outro perfil antes de apagares o perfil.",
      });
      if (Platform.OS === "web") (window as any).alert(`${title}\n${msg}`);
      else Alert.alert(title, msg);
      setOptsId(null);
      return;
    }

    if (Platform.OS === "web") {
      const ok = (window as any).confirm(
        `${t("profile_delete_title", { defaultValue: "Apagar perfil" })}\n${t("profile_delete_msg", { defaultValue: "Tens a certeza que queres apagar?" })}`
      );
      if (ok) {
        await deleteProfile(id);
        if (user) await deleteProfileFromCloud(user.id, id);
        setOptsId(null);
        await refresh();
      }
      return;
    }

    Alert.alert(
      t("profile_delete_title", { defaultValue: "Apagar perfil" }),
      t("profile_delete_msg", { defaultValue: "Tens a certeza que queres apagar?" }),
      [
        { text: t("cancel", { defaultValue: "Cancelar" }), style: "cancel" },
        {
          text: t("delete", { defaultValue: "Apagar" }),
          style: "destructive",
          onPress: async () => {
            await deleteProfile(id);
            if (user) await deleteProfileFromCloud(user.id, id);
            setOptsId(null);
            await refresh();
          },
        },
      ]
    );
  }

  async function handleSetActive(id: string) {
    await setActiveProfileId(id);
    setActiveId(id);
    setOptsId(null);
  }

  function handleEdit(id: string) {
    setOptsId(null);
    router.push(`/profiles/${id}`);
  }

  // "3 folhas este mês · 1 por fechar" / "… · tudo fechado ✓" / "Sem folhas este mês"
  function glanceText(g?: { total: number; open: number }): string {
    if (!g || g.total === 0)
      return t("profile_glance_none", { defaultValue: "Sem folhas este mês" });
    const total =
      g.total === 1
        ? t("profile_glance_one", { defaultValue: "1 folha este mês" })
        : t("profile_glance_many", { n: g.total, defaultValue: "{{n}} folhas este mês" });
    const state =
      g.open > 0
        ? t("profile_glance_open", { n: g.open, defaultValue: "{{n}} por fechar" })
        : t("profile_glance_done", { defaultValue: "tudo fechado ✓" });
    return `${total} · ${state}`;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* HEADER (igual aos Projetos) */}
      <View style={s.header}>
        {!isWide && (
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={s.backLink}>
              ‹ {t("back", { defaultValue: "Voltar" })}
            </Text>
          </Pressable>
        )}

        <Text style={s.headerTitle}>
          {t("profiles_title", { defaultValue: "Perfis" })}
        </Text>

        <Pressable
          onPress={handleNew}
          hitSlop={8}
          style={({ pressed }) => [s.newBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={s.newBtnText}>
            {t("new", { defaultValue: "Novo" })}
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const isActive = activeId === item.id;

          return (
            <Pressable
              onPress={() => handleEdit(item.id)}
              style={({ pressed }) => [pressed && { opacity: 0.93 }]}
            >
              <View style={s.card}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <View style={s.titleRow}>
                    <Text style={s.title}>{item.nome || t("no_name", { defaultValue: "Sem nome" })}</Text>

                    {isActive ? (
                      <View style={s.badgePill}>
                        <Text style={s.badgeText}>
                          {t("active", { defaultValue: "Ativo" })}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <Text style={s.sub}>{item.email || "—"}</Text>
                  <Text style={s.glance}>{glanceText(glance[item.id])}</Text>
                </View>

                {/* Troca rápida: ativar com 1 toque, sem abrir o menu */}
                {!isActive && (
                  <Pressable
                    onPress={() => handleSetActive(item.id)}
                    hitSlop={8}
                    style={({ pressed }) => [
                      s.activateBtn,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={s.activateBtnText}>
                      {t("activate", { defaultValue: "Ativar" })}
                    </Text>
                  </Pressable>
                )}

                <Pressable
                  onPress={() => setOptsId(item.id)}
                  hitSlop={10}
                  style={({ pressed }) => [
                    s.moreBtn,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={s.moreText}>…</Text>
                </Pressable>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={s.emptyBox}>
            <Text style={s.emptyText}>
              {t("profiles_empty", {
                defaultValue: "Ainda não tens perfis. Cria o primeiro.",
              })}
            </Text>
          </View>
        }
      />

      {/* MODAL OPÇÕES (igual ideia aos Projetos/Arquivados) */}
      <Modal transparent animationType="fade" visible={!!optsId}>
        <Pressable style={s.modalBackdrop} onPress={() => setOptsId(null)}>
          <Pressable style={s.modalCard} onPress={() => {}}>
            <Text style={s.modalTitle}>
              {selected?.nome ||
                t("profile", { defaultValue: "Perfil" })}
            </Text>

            <Pressable
              style={({ pressed }) => [s.optRow, pressed && { opacity: 0.85 }]}
              onPress={() => selected && handleEdit(selected.id)}
            >
              <Text style={s.optText}>
                {t("edit", { defaultValue: "Editar" })}
              </Text>
            </Pressable>

            {selected ? (
              activeId === selected.id ? (
                <View style={[s.optRow, { opacity: 0.55 }]}>
                  <Text style={s.optText}>
                    {t("active", { defaultValue: "Ativo" })}
                  </Text>
                </View>
              ) : (
                <Pressable
                  style={({ pressed }) => [
                    s.optRow,
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={() => handleSetActive(selected.id)}
                >
                  <Text style={s.optText}>
                    {t("activate", { defaultValue: "Ativar" })}
                  </Text>
                </Pressable>
              )
            ) : null}

            <Pressable
              style={({ pressed }) => [s.optRow, pressed && { opacity: 0.85 }]}
              onPress={() => selected && handleDelete(selected.id)}
            >
              <Text style={s.optTextDanger}>
                {t("delete", { defaultValue: "Apagar" })}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                s.closeBtn,
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => setOptsId(null)}
            >
              <Text style={s.closeBtnText}>
                {t("close", { defaultValue: "Fechar" })}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (COLORS: any, mode: "light" | "dark") =>
  StyleSheet.create({
    header: {
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 20,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    backLink: {
      color: COLORS.text, // ✅ neutro (igual ideia aos Projetos)
      fontSize: 15,
      fontWeight: "800",
      width: 70,
    },
    headerTitle: {
      color: COLORS.text,
      fontSize: 28,
      fontWeight: "900",
      letterSpacing: -0.2,
    },
    newBtn: {
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: "transparent",
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      minWidth: 70,
      alignItems: "center",
    },
    newBtnText: {
      color: COLORS.text,
      fontWeight: "900",
      fontSize: 14,
    },

    list: {
      paddingHorizontal: 16,
      paddingTop: 6,
      paddingBottom: 30,
      gap: 10,
    },

    card: {
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 16,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      shadowColor: COLORS.shadow,
      shadowOpacity: mode === "dark" ? 0.28 : 0.12,
      shadowRadius: 6,
    },

    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flexWrap: "wrap",
    },
    title: {
      color: COLORS.text,
      fontSize: 18, // ✅ igual aos cards dos Projetos
      fontWeight: "900",
    },
    sub: {
      color: COLORS.sub,
      fontSize: 13,
      marginTop: 4,
    },
    glance: {
      color: COLORS.sub,
      fontSize: 12,
      marginTop: 6,
      fontWeight: "700",
      opacity: 0.9,
    },

    badgePill: {
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bg,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
    },
    badgeText: {
      color: COLORS.text,
      fontWeight: "900",
      fontSize: 12,
    },

    activateBtn: {
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bg,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      marginRight: 8,
    },
    activateBtnText: {
      color: COLORS.text,
      fontWeight: "900",
      fontSize: 13,
    },
    moreBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    moreText: {
      color: COLORS.text,
      fontSize: 22,
      fontWeight: "900",
      marginTop: -4,
    },

    emptyBox: {
      paddingTop: 20,
      alignItems: "center",
    },
    emptyText: {
      color: COLORS.sub,
      fontSize: 13,
      textAlign: "center",
    },

    // modal
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.35)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 24,
    },
    modalCard: {
      width: "100%",
      maxWidth: 420,
      backgroundColor: COLORS.card,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: "900",
      color: COLORS.text,
      textAlign: "center",
      marginBottom: 10,
    },
    optRow: {
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
      marginTop: 10,
      backgroundColor: COLORS.bg,
      alignItems: "center",
    },
    optText: {
      color: COLORS.text,
      fontWeight: "900",
      fontSize: 14,
    },
    optTextDanger: {
      color: COLORS.danger,
      fontWeight: "900",
      fontSize: 14,
    },
    closeBtn: {
      marginTop: 12,
      alignSelf: "center",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: "transparent",
    },
    closeBtnText: {
      color: COLORS.text,
      fontWeight: "900",
      fontSize: 13,
    },
  });
