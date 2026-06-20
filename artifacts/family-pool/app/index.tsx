import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import colors from "@/constants/colors";
import {
  Language,
  MINING_POOLS,
  TIER_CONFIG,
  TRANSLATIONS,
  Tier,
} from "@/constants/translations";

const C = colors.dark;
const ADMIN_PASSWORD = "$)963(_@";
const WALLET_ADDRESS = "bc1q9fam1lyp00lmn1ngaddr0000000000000admin";
const STORAGE_KEY_TIER = "fpool_tier";
const STORAGE_KEY_LANG = "fpool_lang";

function formatHashrate(hz: number): string {
  if (hz >= 1_000_000) return `${(hz / 1_000_000).toFixed(2)} MH/s`;
  if (hz >= 1_000) return `${(hz / 1_000).toFixed(1)} KH/s`;
  return `${hz.toFixed(0)} H/s`;
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

interface Block {
  id: number;
  height: number;
  pool: string;
  timestamp: string;
  txCount: number;
}

function generateBlock(height: number): Block {
  const pool = MINING_POOLS[Math.floor(Math.random() * MINING_POOLS.length)];
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, "0");
  const mins = now.getMinutes().toString().padStart(2, "0");
  return { id: height, height, pool, timestamp: `${hours}:${mins}`, txCount: randomBetween(1200, 3800) };
}

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top;

  const [language, setLanguage] = useState<Language>("en");
  const [tier, setTier] = useState<Tier | null>(null);
  const [isMining, setIsMining] = useState(false);
  const [hashrate, setHashrate] = useState(0);
  const [shares, setShares] = useState(0);
  const [minersCount, setMinersCount] = useState(randomBetween(1500, 40000));
  const [walletText, setWalletText] = useState(WALLET_ADDRESS);
  const [langDropOpen, setLangDropOpen] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);
  const [pwModalVisible, setPwModalVisible] = useState(false);
  const [pendingWallet, setPendingWallet] = useState("");
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [nextBlockSecs, setNextBlockSecs] = useState(randomBetween(180, 600));
  const [bgActive, setBgActive] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const ringRotate = useRef(new Animated.Value(0)).current;
  const miningIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const minersIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const t = TRANSLATIONS[language];
  const isRTL = language === "ar";

  useEffect(() => {
    AsyncStorage.multiGet([STORAGE_KEY_TIER, STORAGE_KEY_LANG]).then((pairs) => {
      const storedTier = pairs[0][1] as Tier | null;
      const storedLang = pairs[1][1] as Language | null;
      if (storedTier) setTier(storedTier);
      if (storedLang) setLanguage(storedLang);
    });

    const startHeight = randomBetween(840000, 860000);
    setBlocks([
      generateBlock(startHeight - 2),
      generateBlock(startHeight - 1),
      generateBlock(startHeight),
    ]);

    minersIntervalRef.current = setInterval(() => {
      setMinersCount(randomBetween(1500, 40000));
    }, randomBetween(3000, 7000));

    blockIntervalRef.current = setInterval(() => {
      setNextBlockSecs((s) => {
        if (s <= 1) {
          setBlocks((prev) => {
            const newHeight = prev[prev.length - 1].height + 1;
            const updated = [...prev.slice(1), generateBlock(newHeight)];
            return updated;
          });
          return randomBetween(180, 600);
        }
        return s - 1;
      });
    }, 1000);

    if (Platform.OS !== "web") {
      Notifications.requestPermissionsAsync();
    }

    return () => {
      if (minersIntervalRef.current) clearInterval(minersIntervalRef.current);
      if (blockIntervalRef.current) clearInterval(blockIntervalRef.current);
      if (miningIntervalRef.current) clearInterval(miningIntervalRef.current);
    };
  }, []);

  const startPulse = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.3, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.timing(ringRotate, { toValue: 1, duration: 3000, useNativeDriver: true, easing: Easing.linear })
    ).start();
  }, [pulseAnim, glowAnim, ringRotate]);

  const stopPulse = useCallback(() => {
    pulseAnim.stopAnimation();
    glowAnim.stopAnimation();
    ringRotate.stopAnimation();
    Animated.parallel([
      Animated.spring(pulseAnim, { toValue: 1, useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.timing(ringRotate, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [pulseAnim, glowAnim, ringRotate]);

  const handleStartMining = useCallback(async () => {
    if (!tier) return;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      await fetch("https://1.1.1.1", { signal: controller.signal, method: "HEAD" });
      clearTimeout(timeout);
    } catch {
      Alert.alert("", t.noInternet);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsMining(true);
    setBgActive(true);
    startPulse();

    const cfg = TIER_CONFIG[tier];
    miningIntervalRef.current = setInterval(() => {
      setHashrate(randomBetween(cfg.min, cfg.max));
      setShares((s) => s + randomBetween(1, 4));
    }, 1500);

    if (Platform.OS !== "web") {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Family Mining Pool",
          body: "Family Mining Pool is running...",
          sticky: true,
        },
        trigger: null,
      });
    }
  }, [tier, t, startPulse]);

  const handleStopMining = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsMining(false);
    setBgActive(false);
    stopPulse();
    setHashrate(0);
    if (miningIntervalRef.current) {
      clearInterval(miningIntervalRef.current);
      miningIntervalRef.current = null;
    }
  }, [stopPulse]);

  const selectTier = useCallback(async (t: Tier) => {
    Haptics.selectionAsync();
    setTier(t);
    await AsyncStorage.setItem(STORAGE_KEY_TIER, t);
  }, []);

  const selectLanguage = useCallback(async (lang: Language) => {
    Haptics.selectionAsync();
    setLanguage(lang);
    setLangDropOpen(false);
    await AsyncStorage.setItem(STORAGE_KEY_LANG, lang);
  }, []);

  const handleWalletFocus = useCallback(() => {
    setPendingWallet(walletText);
    setPwInput("");
    setPwError(false);
    setPwModalVisible(true);
  }, [walletText]);

  const handlePasswordConfirm = useCallback(() => {
    if (pwInput === ADMIN_PASSWORD) {
      setPwModalVisible(false);
      setPwError(false);
    } else {
      setPwError(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [pwInput]);

  const ringInterpolate = ringRotate.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const LANGS: { code: Language; label: string; native: string }[] = [
    { code: "en", label: "English", native: "English" },
    { code: "ar", label: "Arabic", native: "العربية" },
    { code: "es", label: "Spanish", native: "Español" },
    { code: "ru", label: "Russian", native: "Русский" },
  ];

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* TOP BAR */}
      <View style={styles.topBar}>
        <View style={styles.titleRow}>
          <Text style={[styles.mainTitle, isRTL && styles.rtlText]}>{t.title}</Text>
          <TouchableOpacity onPress={() => setInfoVisible(true)} style={styles.infoBtn}>
            <Feather name="info" size={18} color={C.primary} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.langBtn}
          onPress={() => setLangDropOpen((v) => !v)}
        >
          <Feather name="globe" size={14} color={C.textDim} />
          <Text style={styles.langBtnText}>{LANGS.find((l) => l.code === language)?.native}</Text>
          <Feather name={langDropOpen ? "chevron-up" : "chevron-down"} size={12} color={C.textDim} />
        </TouchableOpacity>
      </View>

      {/* MINERS COUNTER */}
      <View style={styles.minersRow}>
        <View style={styles.minersLive}>
          <View style={styles.liveDot} />
          <Text style={[styles.minersLabel, isRTL && styles.rtlText]}>{t.miners}:</Text>
          <Text style={styles.minersCount}>{minersCount.toLocaleString()}</Text>
        </View>
      </View>

      {/* LANG DROPDOWN */}
      {langDropOpen && (
        <View style={styles.langDropdown}>
          {LANGS.map((l) => (
            <TouchableOpacity
              key={l.code}
              style={[styles.langOption, l.code === language && styles.langOptionActive]}
              onPress={() => selectLanguage(l.code)}
            >
              <Text style={[styles.langOptionText, l.code === language && styles.langOptionTextActive]}>
                {l.native}
              </Text>
              {l.code === language && <Feather name="check" size={14} color={C.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, isWeb && { paddingBottom: 34 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* TIER SELECTOR */}
        {!tier ? (
          <View style={styles.tierContainer}>
            <Text style={[styles.tierTitle, isRTL && styles.rtlText]}>{t.selectTier}</Text>
            {(["low", "mid", "high"] as Tier[]).map((key) => {
              const icons: Record<Tier, string> = { low: "cellphone", mid: "cellphone-link", high: "rocket-launch" };
              const labels: Record<Tier, string> = { low: t.lowEnd, mid: t.midRange, high: t.highEnd };
              const descs: Record<Tier, string> = { low: t.lowEndDesc, mid: t.midRangeDesc, high: t.highEndDesc };
              const accent = key === "low" ? C.textDim : key === "mid" ? C.accent : C.gold;
              return (
                <TouchableOpacity key={key} style={[styles.tierCard, { borderColor: accent + "55" }]} onPress={() => selectTier(key)}>
                  <View style={[styles.tierIconWrap, { backgroundColor: accent + "22" }]}>
                    <MaterialCommunityIcons name={icons[key] as any} size={28} color={accent} />
                  </View>
                  <View style={styles.tierInfo}>
                    <Text style={[styles.tierLabel, { color: C.text }]}>{labels[key]}</Text>
                    <Text style={[styles.tierDesc, { color: accent }]}>{descs[key]}</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color={accent} />
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <>
            {/* MINING INDICATOR */}
            <View style={styles.indicatorSection}>
              {/* Rotating ring */}
              {isMining && (
                <Animated.View style={[styles.outerRing, { transform: [{ rotate: ringInterpolate }] }]} />
              )}
              <Animated.View
                style={[
                  styles.miningCircle,
                  isMining ? styles.miningCircleActive : styles.miningCircleIdle,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              >
                <Animated.View style={[styles.glowLayer, { opacity: glowAnim }]} />
                <MaterialCommunityIcons
                  name={isMining ? "bitcoin" : "sleep"}
                  size={36}
                  color={isMining ? C.primary : C.textMuted}
                  style={{ marginBottom: 6 }}
                />
                <Text style={[styles.statusText, { color: isMining ? C.primary : C.textMuted }]}>
                  {isMining ? t.mining : t.idle}
                </Text>
                {isMining && (
                  <Text style={styles.hashrateInCircle}>{formatHashrate(hashrate)}</Text>
                )}
              </Animated.View>

              {/* STATS ROW */}
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <MaterialCommunityIcons name="speedometer" size={18} color={C.primary} />
                  <Text style={styles.statLabel}>{t.hashrate}</Text>
                  <Text style={[styles.statValue, { color: C.primary }]}>
                    {isMining ? formatHashrate(hashrate) : "— —"}
                  </Text>
                </View>
                <View style={[styles.statCard, styles.statCardRight]}>
                  <MaterialCommunityIcons name="check-circle-outline" size={18} color={C.accent} />
                  <Text style={styles.statLabel}>{t.shares}</Text>
                  <Text style={[styles.statValue, { color: C.accent }]}>{shares.toLocaleString()}</Text>
                </View>
              </View>

              {/* MINE BUTTON */}
              <TouchableOpacity
                style={[styles.mineBtn, isMining ? styles.mineBtnStop : styles.mineBtnStart]}
                onPress={isMining ? handleStopMining : handleStartMining}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name={isMining ? "stop-circle-outline" : "play-circle-outline"}
                  size={22}
                  color={isMining ? C.destructive : C.background}
                />
                <Text style={[styles.mineBtnText, { color: isMining ? C.destructive : C.background }]}>
                  {isMining ? t.stopMining : t.startMining}
                </Text>
              </TouchableOpacity>

              {/* BG ACTIVE BADGE */}
              {bgActive && (
                <View style={styles.bgBadge}>
                  <MaterialCommunityIcons name="bell-ring-outline" size={12} color={C.gold} />
                  <Text style={styles.bgBadgeText}>{t.bgNotice}</Text>
                </View>
              )}
            </View>

            {/* WALLET SECTION */}
            <View style={styles.walletSection}>
              <View style={styles.walletHeader}>
                <MaterialCommunityIcons name="wallet-outline" size={16} color={C.textDim} />
                <Text style={[styles.walletLabel, isRTL && styles.rtlText]}>{t.wallet}</Text>
                <View style={styles.lockBadge}>
                  <Feather name="lock" size={10} color={C.gold} />
                </View>
              </View>
              <Pressable onPress={handleWalletFocus} style={styles.walletBox}>
                <Text style={styles.walletText} numberOfLines={1}>{walletText}</Text>
              </Pressable>
              <Text style={[styles.walletProtect, isRTL && styles.rtlText]}>{t.protect}</Text>
            </View>
          </>
        )}

        {/* MEMPOOL FEED */}
        <View style={styles.mempoolSection}>
          <View style={styles.mempoolHeader}>
            <MaterialCommunityIcons name="cube-outline" size={16} color={C.textDim} />
            <Text style={styles.mempoolTitle}>Mempool</Text>
            <View style={styles.nextBlockBadge}>
              <Feather name="clock" size={11} color={C.primary} />
              <Text style={styles.nextBlockText}>{t.nextBlock}: {formatCountdown(nextBlockSecs)}</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.blocksFeed}>
            {/* NEXT BLOCK */}
            <View style={[styles.blockCard, styles.blockCardNext]}>
              <View style={styles.blockCardTop}>
                <Text style={styles.blockCardNextLabel}>NEXT BLOCK</Text>
                <Text style={styles.blockCountdown}>{formatCountdown(nextBlockSecs)}</Text>
              </View>
              <View style={styles.blockCardRow}>
                <MaterialCommunityIcons name="hammer" size={14} color={C.textMuted} />
                <Text style={styles.blockCardSub}>~{randomBetween(1500, 3500)} txs waiting</Text>
              </View>
            </View>
            {/* RECENT BLOCKS */}
            {[...blocks].reverse().map((block) => (
              <View key={block.id} style={styles.blockCard}>
                <View style={styles.blockCardTop}>
                  <Text style={styles.blockHeight}>#{block.height.toLocaleString()}</Text>
                  <Text style={styles.blockTime}>{block.timestamp}</Text>
                </View>
                <Text style={styles.blockPool}>{block.pool}</Text>
                <View style={styles.blockCardRow}>
                  <MaterialCommunityIcons name="swap-horizontal" size={12} color={C.textMuted} />
                  <Text style={styles.blockCardSub}>{block.txCount.toLocaleString()} txs</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>

      {/* INFO MODAL */}
      <Modal visible={infoVisible} transparent animationType="fade" onRequestClose={() => setInfoVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.infoModalCard}>
            <Text style={styles.infoModalTitle}>{t.infoTitle}</Text>
            <ScrollView style={styles.infoScroll}>
              <Text style={styles.infoMsgText}>{t.infoMsg}</Text>
            </ScrollView>
            <TouchableOpacity style={styles.infoOkBtn} onPress={() => setInfoVisible(false)}>
              <Text style={styles.infoOkText}>{t.ok}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* PASSWORD MODAL */}
      <Modal visible={pwModalVisible} transparent animationType="slide" onRequestClose={() => setPwModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.pwModalCard}>
            <View style={styles.pwModalIcon}>
              <Feather name="shield" size={28} color={C.gold} />
            </View>
            <Text style={[styles.pwModalTitle, isRTL && styles.rtlText]}>{t.passwordTitle}</Text>
            <TextInput
              style={[styles.pwInput, pwError && styles.pwInputError]}
              placeholder={t.passwordPlaceholder}
              placeholderTextColor={C.textMuted}
              secureTextEntry
              value={pwInput}
              onChangeText={(v) => { setPwInput(v); setPwError(false); }}
              autoFocus
            />
            {pwError && (
              <Text style={[styles.pwErrorText, isRTL && styles.rtlText]}>{t.wrongPassword}</Text>
            )}
            <View style={styles.pwModalBtns}>
              <TouchableOpacity style={styles.pwCancelBtn} onPress={() => setPwModalVisible(false)}>
                <Text style={styles.pwCancelText}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pwConfirmBtn} onPress={handlePasswordConfirm}>
                <Text style={styles.pwConfirmText}>{t.confirm}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const CIRCLE_SIZE = 180;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.background,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mainTitle: {
    fontWeight: "700",
    fontSize: 22,
    letterSpacing: 3,
    color: C.primary,
  },
  infoBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.primaryDim,
    alignItems: "center",
    justifyContent: "center",
  },
  langBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: C.surface,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: C.border,
  },
  langBtnText: {
    fontWeight: "500",
    fontSize: 12,
    color: C.textDim,
  },
  minersRow: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  minersLive: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.accent,
  },
  minersLabel: {
    fontWeight: "400",
    fontSize: 13,
    color: C.textDim,
  },
  minersCount: {
    fontWeight: "700",
    fontSize: 14,
    color: C.accent,
  },
  langDropdown: {
    position: "absolute",
    top: 80,
    right: 16,
    zIndex: 100,
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
    shadowColor: C.shadow,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
    minWidth: 150,
  },
  langOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  langOptionActive: {
    backgroundColor: C.primaryDim,
  },
  langOptionText: {
    fontWeight: "400",
    fontSize: 14,
    color: C.textDim,
  },
  langOptionTextActive: {
    fontWeight: "600",
    color: C.primary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  tierContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 12,
  },
  tierTitle: {
    fontWeight: "700",
    fontSize: 17,
    color: C.text,
    marginBottom: 4,
  },
  tierCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 16,
  },
  tierIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
  },
  tierInfo: {
    flex: 1,
  },
  tierLabel: {
    fontWeight: "600",
    fontSize: 15,
    marginBottom: 3,
  },
  tierDesc: {
    fontWeight: "500",
    fontSize: 13,
  },
  indicatorSection: {
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 10,
    paddingHorizontal: 20,
  },
  outerRing: {
    position: "absolute",
    width: CIRCLE_SIZE + 30,
    height: CIRCLE_SIZE + 30,
    borderRadius: (CIRCLE_SIZE + 30) / 2,
    borderWidth: 2,
    borderColor: C.primary,
    borderStyle: "dashed",
    top: 16 - 15,
    opacity: 0.5,
  },
  miningCircle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    overflow: "hidden",
    position: "relative",
  },
  miningCircleIdle: {
    backgroundColor: C.card,
    borderColor: C.idleBorder,
    shadowColor: C.shadow,
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  miningCircleActive: {
    backgroundColor: C.backgroundSecondary,
    borderColor: C.primary,
    shadowColor: C.primary,
    shadowOpacity: 0.7,
    shadowRadius: 20,
    elevation: 12,
  },
  glowLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.primaryDim,
    borderRadius: CIRCLE_SIZE / 2,
  },
  statusText: {
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 2,
  },
  hashrateInCircle: {
    fontWeight: "600",
    fontSize: 13,
    color: C.textDim,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
    width: "100%",
  },
  statCard: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    alignItems: "center",
    gap: 5,
  },
  statCardRight: {
    borderColor: C.accentDim,
  },
  statLabel: {
    fontWeight: "500",
    fontSize: 10,
    color: C.textMuted,
    letterSpacing: 1,
  },
  statValue: {
    fontWeight: "700",
    fontSize: 18,
  },
  mineBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 30,
    paddingVertical: 14,
    paddingHorizontal: 36,
    marginTop: 18,
    borderWidth: 2,
  },
  mineBtnStart: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  mineBtnStop: {
    backgroundColor: C.destructiveDim,
    borderColor: C.destructive,
  },
  mineBtnText: {
    fontWeight: "700",
    fontSize: 14,
    letterSpacing: 1.5,
  },
  bgBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 10,
    backgroundColor: C.goldDim,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  bgBadgeText: {
    fontWeight: "500",
    fontSize: 11,
    color: C.gold,
  },
  walletSection: {
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
  },
  walletHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  walletLabel: {
    fontWeight: "600",
    fontSize: 12,
    color: C.textDim,
    letterSpacing: 1,
    flex: 1,
  },
  lockBadge: {
    backgroundColor: C.goldDim,
    borderRadius: 10,
    padding: 4,
  },
  walletBox: {
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  walletText: {
    fontWeight: "400",
    fontSize: 12,
    color: C.textDim,
    letterSpacing: 0.5,
  },
  walletProtect: {
    fontWeight: "400",
    fontSize: 11,
    color: C.textMuted,
    marginTop: 7,
  },
  mempoolSection: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  mempoolHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 12,
  },
  mempoolTitle: {
    fontWeight: "700",
    fontSize: 14,
    color: C.text,
    flex: 1,
  },
  nextBlockBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.primaryDim,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  nextBlockText: {
    fontWeight: "600",
    fontSize: 11,
    color: C.primary,
  },
  blocksFeed: {
    gap: 10,
    paddingRight: 8,
  },
  blockCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    width: 148,
  },
  blockCardNext: {
    borderColor: C.primaryDim,
    backgroundColor: C.backgroundSecondary,
  },
  blockCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  blockCardNextLabel: {
    fontWeight: "600",
    fontSize: 10,
    color: C.primary,
    letterSpacing: 0.5,
  },
  blockCountdown: {
    fontWeight: "700",
    fontSize: 16,
    color: C.primary,
  },
  blockHeight: {
    fontWeight: "600",
    fontSize: 13,
    color: C.text,
  },
  blockTime: {
    fontWeight: "400",
    fontSize: 11,
    color: C.textMuted,
  },
  blockPool: {
    fontWeight: "500",
    fontSize: 12,
    color: C.textDim,
    marginBottom: 6,
  },
  blockCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  blockCardSub: {
    fontWeight: "400",
    fontSize: 11,
    color: C.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: C.overlay,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  infoModalCard: {
    width: "100%",
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 24,
    maxHeight: "70%",
  },
  infoModalTitle: {
    fontWeight: "700",
    fontSize: 16,
    color: C.primary,
    marginBottom: 14,
    textAlign: "center",
  },
  infoScroll: {
    maxHeight: 260,
  },
  infoMsgText: {
    fontWeight: "400",
    fontSize: 14,
    color: C.text,
    lineHeight: 24,
    textAlign: "right",
    writingDirection: "rtl",
  },
  infoOkBtn: {
    marginTop: 18,
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  infoOkText: {
    fontWeight: "600",
    fontSize: 15,
    color: C.background,
  },
  pwModalCard: {
    width: "100%",
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 24,
    alignItems: "center",
  },
  pwModalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.goldDim,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  pwModalTitle: {
    fontWeight: "700",
    fontSize: 17,
    color: C.text,
    textAlign: "center",
    marginBottom: 18,
  },
  pwInput: {
    width: "100%",
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontWeight: "400",
    fontSize: 15,
    color: C.text,
    marginBottom: 8,
  },
  pwInputError: {
    borderColor: C.destructive,
  },
  pwErrorText: {
    fontWeight: "400",
    fontSize: 12,
    color: C.destructive,
    marginBottom: 10,
    textAlign: "center",
  },
  pwModalBtns: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
    width: "100%",
  },
  pwCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: C.surface,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  pwCancelText: {
    fontWeight: "500",
    fontSize: 14,
    color: C.textDim,
  },
  pwConfirmBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: C.gold,
    alignItems: "center",
  },
  pwConfirmText: {
    fontWeight: "600",
    fontSize: 14,
    color: "#000",
  },
  rtlText: {
    textAlign: "right",
    writingDirection: "rtl",
  },
});
