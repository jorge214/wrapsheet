import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { completeOnboarding } from "../src/storage/appSettings";
import { useTheme } from "../src/theme/ThemeProvider";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type Slide = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  titleKey: string;
  subKey: string;
};

const SLIDES: Slide[] = [
  { icon: "film-outline", titleKey: "onboarding_s1_title", subKey: "onboarding_s1_sub" },
  { icon: "time-outline", titleKey: "onboarding_s2_title", subKey: "onboarding_s2_sub" },
  { icon: "document-text-outline", titleKey: "onboarding_s3_title", subKey: "onboarding_s3_sub" },
];

export default function OnboardingScreen() {
  const { COLORS } = useTheme();
  const { t } = useTranslation();
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveIndex(index);
  }

  function goNext() {
    if (activeIndex < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    } else {
      finish();
    }
  }

  async function finish() {
    await completeOnboarding();
    router.replace("/");
  }

  const isLast = activeIndex === SLIDES.length - 1;

  return (
    <SafeAreaView style={[s.root, { backgroundColor: COLORS.bg }]}>
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <View style={[s.slide, { width: SCREEN_WIDTH }]}>
            <View style={[s.iconWrap, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
              <Ionicons name={item.icon} size={56} color={COLORS.accent} />
            </View>
            <Text style={[s.title, { color: COLORS.text }]}>{t(item.titleKey)}</Text>
            <Text style={[s.sub, { color: COLORS.sub }]}>{t(item.subKey)}</Text>
          </View>
        )}
      />

      {/* Dots */}
      <View style={s.dots}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[s.dot, { backgroundColor: i === activeIndex ? COLORS.accent : COLORS.border }]}
          />
        ))}
      </View>

      {/* Button */}
      <View style={s.footer}>
        <Pressable
          onPress={goNext}
          style={[s.btn, { backgroundColor: COLORS.accent }]}
        >
          <Text style={s.btnText}>
            {isLast ? t("onboarding_get_started") : t("continue")}
          </Text>
          {!isLast && <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 6 }} />}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 30,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 36,
  },
  title: { fontSize: 26, fontWeight: "800", textAlign: "center", marginBottom: 14 },
  sub: { fontSize: 16, textAlign: "center", lineHeight: 24 },
  dots: { flexDirection: "row", justifyContent: "center", marginBottom: 16, gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  footer: { paddingHorizontal: 24, paddingBottom: 16 },
  btn: {
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
