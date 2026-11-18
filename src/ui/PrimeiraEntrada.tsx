// src/ui/PrimeiraEntrada.tsx
// O ecrã de boas-vindas das contas novas (18/11/2026): publicidade ou cinema,
// a função e quanto ganha — e a folha desta semana fica criada e aberta. As
// regras de quando aparece estão em storage/primeiraEntrada.ts (SyncProvider);
// aqui é só o formulário. Fica por cima de qualquer ecrã (AppShell).
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "../auth/AuthContext";
import { getPreset } from "../constants/countryPresets";
import { getSettings } from "../storage/appSettings";
import { lerValor, type DadosPrimeiraEntrada } from "../storage/passosRegras";
import { adiarPrimeiraEntrada, concluirPrimeiraEntrada } from "../storage/primeiraEntrada";
import { useTheme } from "../theme/ThemeProvider";

// As cores de cada formato, as mesmas dos botões do perfil e da lista
const COR = { publicidade: "#c00000", cinema: "#2e75b6" } as const;

export function PrimeiraEntrada({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { COLORS } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [formato, setFormato] = useState<DadosPrimeiraEntrada["formato"] | null>(null);
  const [funcao, setFuncao] = useState("");
  const [valor, setValor] = useState("");
  const [aCriar, setACriar] = useState(false);
  const [erro, setErro] = useState(false);
  const [moeda, setMoeda] = useState("€");

  useEffect(() => {
    if (!visible) return;
    getSettings()
      .then((s) => setMoeda(getPreset((s.region as any) ?? "pt")?.currencySymbol ?? "€"))
      .catch(() => {});
  }, [visible]);

  const criar = async () => {
    if (!user || !formato || aCriar) return;
    setACriar(true);
    setErro(false);
    try {
      const id = await concluirPrimeiraEntrada(user.id, { formato, funcao, valor: lerValor(valor) });
      onClose();
      // A folha abre logo: é lá que se regista o primeiro dia
      if (id) router.push(`/projects/${id}`);
    } catch {
      setErro(true);
    } finally {
      setACriar(false);
    }
  };

  const agoraNao = async () => {
    if (!user || aCriar) return;
    onClose();
    adiarPrimeiraEntrada(user as any).catch(() => {});
  };

  const label = { color: COLORS.text, fontWeight: "800" as const, fontSize: 14, marginBottom: 8 };
  const input = {
    backgroundColor: "#E8EBF0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "web" ? 12 : 11,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={() => {}}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", padding: 16 }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 460,
            maxHeight: "92%",
            backgroundColor: COLORS.card,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: COLORS.border,
            overflow: "hidden",
          }}
        >
          <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <Text style={{ fontSize: 21, fontWeight: "900", color: COLORS.text }}>
              {t("pe_title", { defaultValue: "Vamos fazer a tua primeira folha" })}
            </Text>
            <Text style={{ fontSize: 14, color: COLORS.sub, marginTop: 6, marginBottom: 20, lineHeight: 20 }}>
              {t("pe_subtitle", { defaultValue: "Três perguntas e fica pronta. O resto preenches quando quiseres." })}
            </Text>

            <Text style={label}>{t("pe_format_q", { defaultValue: "Em que trabalhas mais?" })}</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 18 }}>
              {(["publicidade", "cinema"] as const).map((f) => {
                const on = formato === f;
                return (
                  <Pressable
                    key={f}
                    onPress={() => setFormato(f)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={({ pressed }) => [
                      {
                        flex: 1,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: COR[f],
                        backgroundColor: on ? COR[f] : COLORS.card,
                        paddingVertical: 12,
                        paddingHorizontal: 8,
                        alignItems: "center",
                      },
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={{ fontWeight: "900", fontSize: 15, color: on ? "#fff" : COR[f], textAlign: "center" }}>
                      {f === "publicidade"
                        ? t("pe_format_ads", { defaultValue: "Publicidade" })
                        : t("pe_format_cinema", { defaultValue: "Cinema e séries" })}
                    </Text>
                    <Text style={{ fontWeight: "700", fontSize: 12, marginTop: 2, color: on ? "rgba(255,255,255,0.85)" : COLORS.sub, textAlign: "center" }}>
                      {f === "publicidade"
                        ? t("pe_format_ads_sub", { defaultValue: "pago ao dia" })
                        : t("pe_format_cinema_sub", { defaultValue: "pago à semana" })}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={label}>{t("pe_role_q", { defaultValue: "A tua função" })}</Text>
            <TextInput
              value={funcao}
              onChangeText={setFuncao}
              placeholder={t("pe_role_ph", { defaultValue: "Ex: 1.º Assistente de Câmara" })}
              placeholderTextColor="#9aa0a6"
              autoCapitalize="sentences"
              returnKeyType="next"
              style={[input, { marginBottom: 18 }]}
            />

            <Text style={label}>
              {formato === "cinema"
                ? t("pe_rate_week_q", { defaultValue: "Quanto ganhas por semana (5 dias)?" })
                : t("pe_rate_day_q", { defaultValue: "Quanto ganhas por dia?" })}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <TextInput
                value={valor}
                onChangeText={setValor}
                placeholder={formato === "cinema" ? "1250" : "250"}
                placeholderTextColor="#9aa0a6"
                keyboardType="decimal-pad"
                returnKeyType="done"
                style={[input, { flex: 1 }]}
              />
              <Text style={{ fontSize: 18, fontWeight: "800", color: COLORS.sub }}>{moeda}</Text>
            </View>
            <Text style={{ fontSize: 12, color: COLORS.sub, marginTop: 6, marginBottom: 22 }}>
              {t("pe_rate_hint", { defaultValue: "Só serve para as contas. Podes mudar quando quiseres." })}
            </Text>

            {erro && (
              <Text style={{ color: COLORS.danger, fontWeight: "700", marginBottom: 10, textAlign: "center" }}>
                {t("pe_error", { defaultValue: "Não foi possível criar a folha. Tenta outra vez." })}
              </Text>
            )}

            <Pressable
              onPress={criar}
              disabled={!formato || aCriar}
              style={({ pressed }) => [
                { alignItems: "center", paddingVertical: 14, borderRadius: 999, backgroundColor: COLORS.text },
                (!formato || aCriar) && { opacity: 0.35 },
                pressed && { opacity: 0.85 },
              ]}
            >
              {aCriar ? (
                <ActivityIndicator color={COLORS.bg} />
              ) : (
                <Text style={{ color: COLORS.bg, fontWeight: "900", fontSize: 16 }}>
                  {t("pe_create", { defaultValue: "Criar a minha folha" })}
                </Text>
              )}
            </Pressable>
            <Pressable onPress={agoraNao} hitSlop={8} style={({ pressed }) => [{ alignItems: "center", paddingVertical: 12, marginTop: 4 }, pressed && { opacity: 0.7 }]}>
              <Text style={{ color: COLORS.sub, fontWeight: "800", fontSize: 14 }}>
                {t("pe_later", { defaultValue: "Agora não" })}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
