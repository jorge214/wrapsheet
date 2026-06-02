// app/settings/backup.tsx
import { router } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../src/theme/ThemeProvider";

// funções já existentes na tua app
import { exportBackup, importBackup } from "../../src/storage/backup";

export default function BackupScreen() {
  const { COLORS } = useTheme();
  const { t } = useTranslation();
  const s = React.useMemo(() => createStyles(COLORS), [COLORS]);

  const [busy, setBusy] = React.useState<false | "export" | "import">(false);

  async function handleExport() {
    if (busy) return;
    setBusy("export");
    try {
      await exportBackup();
      Alert.alert(
        t("backup_export_success_title", {
          defaultValue: "Backup exportado",
        }),
        t("backup_export_success_message", {
          defaultValue:
            "O ficheiro de backup foi criado. Partilha-o ou guarda-o num local seguro.",
        })
      );
    } catch (e) {
      console.error("Erro ao exportar backup", e);
      Alert.alert(
        t("backup_error_title", { defaultValue: "Erro no backup" }),
        t("backup_export_error_message", {
          defaultValue:
            "Não foi possível exportar o backup. Tenta novamente ou verifica as permissões.",
        })
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    if (busy) return;
    Alert.alert(
      t("backup_import_confirm_title", { defaultValue: "Importar backup" }),
      t("backup_import_confirm_message", {
        defaultValue:
          "Ao importar um backup vais substituir os projetos e definições atuais pelos dados do ficheiro selecionado. Continuar?",
      }),
      [
        { text: t("cancel", { defaultValue: "Cancelar" }), style: "cancel" },
        {
          text: t("continue", { defaultValue: "Continuar" }),
          style: "destructive",
          onPress: async () => {
            setBusy("import");
            try {
              await importBackup();
              Alert.alert(
                t("backup_import_success_title", {
                  defaultValue: "Backup importado",
                }),
                t("backup_import_success_message", {
                  defaultValue:
                    "Os dados foram restaurados a partir do ficheiro de backup.",
                })
              );
            } catch (e) {
              console.error("Erro ao importar backup", e);
              Alert.alert(
                t("backup_error_title", { defaultValue: "Erro no backup" }),
                t("backup_import_error_message", {
                  defaultValue:
                    "Não foi possível importar o backup. Garante que o ficheiro é válido.",
                })
              );
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={s.backLink}>‹ {t("back", { defaultValue: "Voltar" })}</Text>
        </Pressable>
        <Text style={s.headerTitle}>
          {t("backup_title", { defaultValue: "Backup e importação" })}
        </Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {/* Secção Exportar */}
        <View style={s.card}>
          <Text style={s.cardTitle}>
            {t("backup_export_title", { defaultValue: "Exportar backup" })}
          </Text>
          <Text style={s.cardSub}>
            {t("backup_export_sub", {
              defaultValue:
                "Cria um ficheiro com todos os teus projetos, perfis e definições. Podes guardá-lo na cloud ou enviar por email.",
            })}
          </Text>

          <PrimaryButton
            label={
              busy === "export"
                ? t("backup_exporting", { defaultValue: "A exportar..." })
                : t("backup_export_button", {
                    defaultValue: "Exportar dados",
                  })
            }
            disabled={!!busy}
            onPress={handleExport}
          />
        </View>

        {/* Secção Importar */}
        <View style={s.card}>
          <Text style={s.cardTitle}>
            {t("backup_import_title", { defaultValue: "Importar backup" })}
          </Text>
          <Text style={s.cardSub}>
            {t("backup_import_sub", {
              defaultValue:
                "Restaura um backup a partir de um ficheiro criado pela aplicação. Usa apenas ficheiros de que confies.",
            })}
          </Text>

          <SecondaryButton
            label={
              busy === "import"
                ? t("backup_importing", { defaultValue: "A importar..." })
                : t("backup_import_button", {
                    defaultValue: "Escolher ficheiro e importar",
                  })
            }
            disabled={!!busy}
            onPress={handleImport}
          />
        </View>

        <Text style={s.footerNote}>
          {t("backup_footer_note", {
            defaultValue:
              "Sugestão: guarda o backup numa localização segura (ex.: serviço de cloud) para prevenir perda de dados.",
          })}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------- Botões ---------- */

function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { COLORS } = useTheme();
  const s = React.useMemo(() => createStyles(COLORS), [COLORS]);
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        s.primaryBtn,
        disabled && { opacity: 0.5 },
        pressed && !disabled && { opacity: 0.85 },
      ]}
    >
      <Text style={s.primaryBtnText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { COLORS } = useTheme();
  const s = React.useMemo(() => createStyles(COLORS), [COLORS]);
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        s.secondaryBtn,
        disabled && { opacity: 0.5 },
        pressed && !disabled && { opacity: 0.85 },
      ]}
    >
      <Text style={s.secondaryBtnText}>{label}</Text>
    </Pressable>
  );
}

/* ---------- Styles ---------- */

const createStyles = (COLORS: any) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderColor: COLORS.border,
    },
    backLink: {
      color: COLORS.text,
      fontWeight: "800",
      fontSize: 15,
      width: 70,
      opacity: 0.9,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: COLORS.text,
      textAlign: "center",
    },
    content: {
      padding: 16,
      paddingBottom: 32,
      gap: 16,
    },
    card: {
      backgroundColor: COLORS.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 14,
      shadowColor: COLORS.shadow,
      shadowOpacity: 0.12,
      shadowRadius: 4,
    },
    cardTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: COLORS.text,
      marginBottom: 4,
    },
    cardSub: {
      fontSize: 13,
      color: COLORS.sub,
      marginBottom: 12,
    },
    primaryBtn: {
      alignSelf: "flex-start",
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: COLORS.accent,
    },
    primaryBtnText: {
      color: "#fff",
      fontWeight: "600",
      fontSize: 14,
    },
    secondaryBtn: {
      alignSelf: "flex-start",
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bg,
    },
    secondaryBtnText: {
      color: COLORS.text,
      fontWeight: "600",
      fontSize: 14,
    },
    footerNote: {
      fontSize: 12,
      color: COLORS.sub,
      textAlign: "center",
      marginTop: 4,
    },
  });
