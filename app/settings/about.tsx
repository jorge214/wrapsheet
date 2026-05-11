import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../src/theme/ThemeProvider";

export default function AboutScreen() {
  const { COLORS } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 10, marginBottom: 10 }}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </Pressable>
        <Text style={{ fontSize: 20, fontWeight: "700", color: COLORS.text }}>Sobre</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={[ss.card, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
        <Text style={[ss.title, { color: COLORS.text }]}>Relatório de Horas</Text>
        <Text style={{ color: COLORS.sub, marginTop: 6 }}>
          App para gerir projetos e exportar relatórios de horas para PDF.
        </Text>
        <Pressable onPress={() => Linking.openURL("mailto:francarvfcosta@gmail.com")} style={[ss.btn, { backgroundColor: COLORS.accent }]}>
          <Text style={ss.btnText}>Contactar suporte</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const ss = StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: 12, borderWidth: 1, borderRadius: 14, padding: 14 },
  title: { fontSize: 18, fontWeight: "800" },
  btn: { marginTop: 12, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
});
