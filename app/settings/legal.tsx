// app/settings/legal.tsx
import { router } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../src/theme/ThemeProvider";

export default function LegalScreen() {
  const { COLORS } = useTheme();
  const s = React.useMemo(() => createStyles(COLORS), [COLORS]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.backLink} onPress={() => router.back()}>
          ‹ Voltar
        </Text>
        <Text style={s.headerTitle}>Termos & Privacidade</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {/* Termos de Utilização */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Termos de Utilização</Text>
          <Text style={s.cardSub}>
            Estes termos regulam a utilização da aplicação WrapSheet.
          </Text>

          <Text style={s.sectionTitle}>1. Finalidade</Text>
          <Text style={s.paragraph}>
            A aplicação destina-se apenas a ajudar técnicos de cinema e
            publicidade a organizar e calcular as suas horas de trabalho. Não
            constitui aconselhamento jurídico, fiscal ou contabilístico.
          </Text>

          <Text style={s.sectionTitle}>2. Responsabilidade pelos dados</Text>
          <Text style={s.paragraph}>
            Todos os dados inseridos são guardados apenas no dispositivo do
            utilizador. És responsável por manter o teu dispositivo seguro e por
            efetuar cópias de segurança dos teus dados.
          </Text>

          <Text style={s.sectionTitle}>3. Limitação de responsabilidade</Text>
          <Text style={s.paragraph}>
            Apesar de todo o cuidado na construção da aplicação, não é
            garantida a ausência de erros. O autor não se responsabiliza por
            perdas ou danos resultantes do uso da aplicação.
          </Text>
        </View>

        {/* Política de Privacidade */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Política de Privacidade</Text>
          <Text style={s.cardSub}>
            Uma visão geral simples de como os teus dados são tratados.
          </Text>

          <Text style={s.sectionTitle}>1. Dados armazenados</Text>
          <Text style={s.paragraph}>
            A aplicação guarda localmente os teus projetos, perfis e
            definições. Esses dados não são enviados para servidores externos
            pelo autor da aplicação.
          </Text>

          <Text style={s.sectionTitle}>2. Permissões e integrações</Text>
          <Text style={s.paragraph}>
            Algumas funcionalidades, como exportação de ficheiros, podem usar
            serviços do sistema operativo ou aplicações de terceiros
            (aplicações de email, armazenamento na nuvem, etc.). Nesses casos
            são aplicadas as políticas de privacidade desses serviços.
          </Text>

          <Text style={s.sectionTitle}>3. Direitos do utilizador</Text>
          <Text style={s.paragraph}>
            Podes apagar os teus dados a qualquer momento apagando projetos,
            perfis ou desinstalando a aplicação. Se, no futuro, for adicionada
            sincronização na nuvem, esta política será atualizada para refletir
            esse novo tratamento de dados.
          </Text>

          <Text style={s.sectionTitle}>4. Contacto</Text>
          <Text style={s.paragraph}>
            Para questões relacionadas com privacidade ou termos de utilização,
            contacta-nos através do email: francarvfcosta@gmail.com
          </Text>
        </View>

        <Text style={s.footerNote}>
          Última atualização: maio de 2026
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

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
      color: COLORS.accent,
      fontWeight: "600",
      fontSize: 16,
      width: 60,
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
      fontSize: 18,
      fontWeight: "700",
      color: COLORS.text,
      marginBottom: 4,
    },
    cardSub: {
      fontSize: 13,
      color: COLORS.sub,
      marginBottom: 10,
    },
    sectionTitle: {
      marginTop: 8,
      marginBottom: 4,
      fontSize: 14,
      fontWeight: "600",
      color: COLORS.text,
    },
    paragraph: {
      fontSize: 13,
      color: COLORS.sub,
      lineHeight: 18,
    },
    footerNote: {
      fontSize: 11,
      color: COLORS.sub,
      textAlign: "center",
      marginTop: 8,
    },
  });
