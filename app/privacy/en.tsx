import { Link } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function PrivacyPageEN() {
  return (
    <ScrollView contentContainerStyle={s.container}>
      <View style={s.content}>
        <Text style={s.logo}>WrapSheet</Text>
        <Text style={s.title}>Privacy Policy</Text>
        <Text style={s.updated}>Last updated: July 24, 2026</Text>

        <Text style={s.body}>
          This policy explains, in plain language, what data WrapSheet collects,
          what it is used for, and what your rights are. WrapSheet is a timesheet
          app for film and advertising technicians in Portugal.
        </Text>

        <Text style={s.sectionTitle}>1. Who processes your data</Text>
        <Text style={s.body}>
          The data controller is Francisco Costa. For any privacy question,
          contact us at:{"\n"}
          getwrapsheet@gmail.com{"\n"}
          [PREENCHER: postal address — optional, only if you want to list one]
        </Text>

        <Text style={s.sectionTitle}>2. What data we collect</Text>
        <Text style={s.body}>
          • Account: your email and password. The account is managed by Supabase
          and the password is stored encrypted — it is never accessible in plain
          text, not even to us.{"\n"}
          • Technician profile: name, role, company, phone, email, tax number
          (NIF), IBAN and SWIFT.{"\n"}
          • Projects: film name, production company, the production company's tax
          number, agreed rates, working days, schedules and calculated amounts.
          {"\n"}
          • Minimal technical operating data and error logs, to keep the app
          stable and fix problems.
        </Text>

        <Text style={s.sectionTitle}>3. What we use the data for</Text>
        <Text style={s.body}>
          The data is used only to operate the app: to store your timesheets,
          sync them to your account and generate the PDF.{"\n\n"}
          Your data is NOT sold. It is NOT shared with production companies or
          with third parties for advertising purposes. There is no ad tracking
          and no marketing profiling.
        </Text>

        <Text style={s.sectionTitle}>4. Where it is stored</Text>
        <Text style={s.body}>
          Your account data is hosted on Supabase servers, within the European
          Union. To operate, the app relies on a few providers that process data
          solely on our behalf: Supabase (database and authentication), the
          account email service (confirmation and password recovery) and Sentry
          (error logging).{"\n\n"}
          The sheet PDF is generated on your device and is only shared if you
          send it yourself.
        </Text>

        <Text style={s.sectionTitle}>5. How long we keep it</Text>
        <Text style={s.body}>
          We keep your data for as long as your account exists. You can delete
          your account and all associated data at any time in Settings → Account
          → Delete account, or by asking us via email. We respond to requests
          within 30 days.
        </Text>

        <Text style={s.sectionTitle}>6. Your rights (GDPR)</Text>
        <Text style={s.body}>
          Under the General Data Protection Regulation, you have the right to:
          access your data, rectify it, erase it, data portability, and to object
          to processing. To exercise any of these rights, contact us at the email
          above. You also have the right to lodge a complaint with the
          supervisory authority — in Portugal, the CNPD (Comissão Nacional de
          Proteção de Dados).
        </Text>

        <Text style={s.sectionTitle}>7. Minors</Text>
        <Text style={s.body}>
          WrapSheet is intended for professionals and is not directed at children
          under 16. We do not knowingly collect data from children under 16.
        </Text>

        <Text style={s.sectionTitle}>8. Changes to this policy</Text>
        <Text style={s.body}>
          We may update this policy over time. When we do, we change the "Last
          updated" date at the top of this page.
        </Text>

        <View style={s.links}>
          <Link href="/terms" style={s.link}>Terms of Use</Link>
          <Text style={s.linkSep}>·</Text>
          <Link href="https://wrapsheet-app.com/support" style={s.link}>Support</Link>
          <Text style={s.linkSep}>·</Text>
          <Link href="/privacy" style={s.link}>Português</Link>
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
