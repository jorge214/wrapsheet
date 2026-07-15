import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function TermsPage() {
  return (
    <ScrollView contentContainerStyle={s.container}>
      <View style={s.content}>
        <Text style={s.logo}>WrapSheet</Text>
        <Text style={s.title}>Terms of Use</Text>
        <Text style={s.updated}>Last updated: July 2026</Text>

        <Text style={s.sectionTitle}>1. Purpose</Text>
        <Text style={s.body}>
          WrapSheet is intended solely to help film and advertising technicians
          organise and calculate their working hours. It does not constitute
          legal, tax, or accounting advice.
        </Text>

        <Text style={s.sectionTitle}>2. Data responsibility</Text>
        <Text style={s.body}>
          Your data is stored on your device and, when you are signed in, it is
          also synced to your account so you can access it on other devices.
          You are responsible for keeping your credentials safe and for
          checking the values on your sheets before sending them.
        </Text>

        <Text style={s.sectionTitle}>3. Limitation of liability</Text>
        <Text style={s.body}>
          Despite every care taken in building the app, the absence of errors
          cannot be guaranteed. The author is not liable for any loss or damage
          resulting from the use of the app.
        </Text>

        <Text style={s.sectionTitle}>4. Contact</Text>
        <Text style={s.body}>
          For questions about these terms, contact us at:{"\n"}
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
