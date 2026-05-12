import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function PrivacyPage() {
  return (
    <ScrollView contentContainerStyle={s.container}>
      <View style={s.content}>
        <Text style={s.logo}>WrapSheet</Text>
        <Text style={s.title}>Privacy Policy</Text>
        <Text style={s.updated}>Last updated: May 2026</Text>

        <Text style={s.sectionTitle}>1. Data stored</Text>
        <Text style={s.body}>
          WrapSheet stores your projects, profiles and settings locally on your
          device. This data is not sent to external servers by the app's author.
        </Text>

        <Text style={s.sectionTitle}>2. Permissions and integrations</Text>
        <Text style={s.body}>
          Some features, such as file export, may use operating system services
          or third-party apps (email, cloud storage, etc.). In those cases, the
          privacy policies of those services apply.
        </Text>

        <Text style={s.sectionTitle}>3. User rights</Text>
        <Text style={s.body}>
          You can delete your data at any time by removing projects, profiles,
          or uninstalling the app. If cloud sync is added in the future, this
          policy will be updated accordingly.
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
