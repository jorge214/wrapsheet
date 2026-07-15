import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function PrivacyPage() {
  return (
    <ScrollView contentContainerStyle={s.container}>
      <View style={s.content}>
        <Text style={s.logo}>WrapSheet</Text>
        <Text style={s.title}>Privacy Policy</Text>
        <Text style={s.updated}>Last updated: July 2026</Text>

        <Text style={s.sectionTitle}>1. Data stored</Text>
        <Text style={s.body}>
          WrapSheet stores your projects, profiles and settings on your device.
          If you create an account, this data and your email address are also
          stored securely on the servers of our database provider (Supabase) to
          sync across devices. We do not sell or share your data for marketing
          purposes.
        </Text>

        <Text style={s.sectionTitle}>2. Permissions and integrations</Text>
        <Text style={s.body}>
          Some features use third-party services: account emails (confirmation
          and password recovery) are sent by our email provider; crash reports
          help us fix errors (Sentry); file export and sharing use your
          operating system's services. In those cases, the privacy policies of
          those services also apply.
        </Text>

        <Text style={s.sectionTitle}>3. User rights</Text>
        <Text style={s.body}>
          You can delete projects and profiles at any time. You can delete your
          account and all associated data in Settings → Account → Delete
          account. For any request about your data, contact us.
        </Text>

        <Text style={s.sectionTitle}>4. Contact</Text>
        <Text style={s.body}>
          For questions about privacy or terms of use, contact us at:{"\n"}
          getwrapsheet@gmail.com
        </Text>
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
});
