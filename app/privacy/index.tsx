import { Link } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function PrivacyPagePT() {
  return (
    <ScrollView contentContainerStyle={s.container}>
      <View style={s.content}>
        <Text style={s.logo}>WrapSheet</Text>
        <Text style={s.title}>Política de Privacidade</Text>
        <Text style={s.updated}>Última atualização: 24 de julho de 2026</Text>

        <Text style={s.body}>
          Esta política explica, em linguagem simples, que dados a WrapSheet
          recolhe, para que servem e quais são os teus direitos. A WrapSheet é
          uma aplicação de folha de horas para técnicos de cinema e publicidade
          em Portugal.
        </Text>

        <Text style={s.sectionTitle}>1. Quem trata os teus dados</Text>
        <Text style={s.body}>
          O responsável pelo tratamento dos dados é Francisco Costa. Para
          qualquer questão sobre privacidade, contacta-nos pelo email:{"\n"}
          getwrapsheet@gmail.com{"\n"}
          [PREENCHER: morada postal — opcional, só se quiseres indicá-la]
        </Text>

        <Text style={s.sectionTitle}>2. Que dados recolhemos</Text>
        <Text style={s.body}>
          • Conta: o teu email e password. A conta é gerida pelo Supabase e a
          password fica guardada de forma cifrada — nunca é acessível em texto,
          nem a nós.{"\n"}
          • Perfil de técnico: nome, função, empresa, telefone, email, NIF, IBAN
          e SWIFT.{"\n"}
          • Projetos: nome do filme, produtora, NIF da produtora, valores
          acordados, dias de trabalho, horários e valores calculados.{"\n"}
          • Dados técnicos mínimos de funcionamento e registo de erros, para
          manter a app estável e corrigir problemas.
        </Text>

        <Text style={s.sectionTitle}>3. Para que usamos os dados</Text>
        <Text style={s.body}>
          Os dados servem apenas para operar a app: guardar as tuas folhas de
          horas, sincronizá-las na tua conta e gerar o PDF.{"\n\n"}
          Os teus dados NÃO são vendidos. NÃO são partilhados com produtoras nem
          com terceiros para fins publicitários. Não existe rastreio publicitário
          nem criação de perfis de marketing.
        </Text>

        <Text style={s.sectionTitle}>4. Onde ficam guardados</Text>
        <Text style={s.body}>
          Os dados da tua conta ficam alojados nos servidores do Supabase, na
          União Europeia. Para funcionar, a app recorre a alguns fornecedores que
          tratam dados apenas em nosso nome: o Supabase (base de dados e
          autenticação), o serviço de envio de emails da conta (confirmação e
          recuperação de password) e o Sentry (registo de erros).{"\n\n"}
          O PDF da folha é gerado no teu dispositivo e só é partilhado se fores
          tu a enviá-lo.
        </Text>

        <Text style={s.sectionTitle}>5. Durante quanto tempo</Text>
        <Text style={s.body}>
          Guardamos os teus dados enquanto a tua conta existir. Podes eliminar a
          conta e todos os dados associados a qualquer momento em Definições →
          Conta → Eliminar conta, ou pedindo-nos por email. Respondemos aos
          pedidos até 30 dias.
        </Text>

        <Text style={s.sectionTitle}>6. Os teus direitos (RGPD)</Text>
        <Text style={s.body}>
          Ao abrigo do Regulamento Geral sobre a Proteção de Dados, tens direito
          a: aceder aos teus dados, retificá-los, apagá-los, à portabilidade e a
          opor-te ao tratamento. Para exercer qualquer destes direitos,
          contacta-nos pelo email acima. Tens também o direito de apresentar
          reclamação à autoridade de controlo — em Portugal, a CNPD (Comissão
          Nacional de Proteção de Dados).
        </Text>

        <Text style={s.sectionTitle}>7. Menores</Text>
        <Text style={s.body}>
          A WrapSheet destina-se a profissionais e não se dirige a menores de 16
          anos. Não recolhemos intencionalmente dados de menores de 16 anos.
        </Text>

        <Text style={s.sectionTitle}>8. Alterações a esta política</Text>
        <Text style={s.body}>
          Podemos atualizar esta política ao longo do tempo. Quando o fizermos,
          alteramos a data de "Última atualização" no topo desta página.
        </Text>

        <View style={s.links}>
          <Link href="/terms" style={s.link}>Termos de Utilização</Link>
          <Text style={s.linkSep}>·</Text>
          <Link href="https://wrapsheet-app.com/support" style={s.link}>Suporte</Link>
          <Text style={s.linkSep}>·</Text>
          <Link href="/privacy/en" style={s.link}>English</Link>
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    padding: 24,
  },
  content: {
    width: "100%",
    maxWidth: 680,
  },
  logo: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  updated: {
    fontSize: 13,
    color: "#888",
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1a1a1a",
    marginTop: 24,
    marginBottom: 8,
  },
  body: {
    fontSize: 15,
    color: "#444",
    lineHeight: 24,
  },
  links: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
    marginTop: 40,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  link: {
    fontSize: 14,
    color: "#1a1a1a",
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  linkSep: {
    fontSize: 14,
    color: "#bbb",
  },
});
