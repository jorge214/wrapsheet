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

  // modal opções
  const [optsId, setOptsId] = useState<string | null>(null);
  const selected = useMemo(
    () => items.find((x) => x.id === optsId) || null,
    [items, optsId]
  );

  async function refresh() {
    const [list, active] = await Promise.all([
      listProfiles(),
      getActiveProfileId(),
    ]);
    list.sort((a, b) => Number(b.id) - Number(a.id));
    setItems(list);
    setActiveId(active);
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
    // TEMP (multi-perfil, remover antes do merge): permitir criar vários perfis
    // SÓ no Expo Go (nativo em dev). Nunca na web, nunca em build de produção.
    const DEV_MULTIPROFILE_BYPASS = __DEV__ && Platform.OS !== "web";
    const unlocked =
      DEV_MULTIPROFILE_BYPASS || (user?.app_metadata as any)?.profiles_unlocked === true;
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
                </View>

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
