import {
  AchievementItem,
  ActivityDefinition,
  ActivityEntry,
  AnalyticsSnapshot,
  BackupPayload,
  CustomCategoryDef,
  DailyLog,
  InputType,
  Language,
  LevelConfig,
  UserProfileData,
} from '../types/quest';
import { TIME_AUDIT_ENTRY_KEY } from './defaults';
import {
  formatDigits,
  formatLocalizedDuration,
  getLastNDaysKeys,
  shiftDateKey,
} from './dhakaTime';
import {
  ACHIEVEMENT_COPY,
  getLocalizedActivityTitle,
  getLocalizedUnitLabel,
  RANK_TITLES,
  UI_COPY,
} from './i18n';

export interface ActivityProgressResult {
  ratio: number; // 0..1
  completed: boolean;
  earnedXp: number;
  summaryText: string;
}

export function isSpiritualActivity(
  activity: ActivityDefinition,
  customCategories: CustomCategoryDef[] = []
): boolean {
  if (activity.category === 'spiritual' || activity.inputType === 'prayer') {
    return true;
  }
  return customCategories.some((c) => c.id === activity.category && Boolean(c.isSpiritual));
}

export function getVisibleActivities(
  activities: ActivityDefinition[],
  religionTrackingEnabled: boolean = true,
  customCategories: CustomCategoryDef[] = []
): ActivityDefinition[] {
  if (religionTrackingEnabled) return activities;
  return activities.filter((a) => !isSpiritualActivity(a, customCategories));
}

export function safeNonNeg(val: unknown, max: number = Number.MAX_SAFE_INTEGER): number {
  const num = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.min(max, num);
}

export const MINUTES_PER_DAY = 1440;

/**
 * Ensures daily Productive + Wasted time never exceeds 24 hours (1440 min).
 * Remaining time (sleep, meals, rest, prayer, breaks) is treated as neutral/necessary—never wasted.
 */
export function clampTimeAuditPair(
  productiveRaw: unknown,
  wastedRaw: unknown
): {
  productiveMinutes: number;
  wastedMinutes: number;
  necessaryRestMinutes: number;
} {
  const productiveMinutes = Math.round(safeNonNeg(productiveRaw, MINUTES_PER_DAY));
  const rawWasted = Math.round(safeNonNeg(wastedRaw, MINUTES_PER_DAY));
  const wastedMinutes = Math.min(rawWasted, Math.max(0, MINUTES_PER_DAY - productiveMinutes));
  const necessaryRestMinutes = Math.max(0, MINUTES_PER_DAY - productiveMinutes - wastedMinutes);
  return { productiveMinutes, wastedMinutes, necessaryRestMinutes };
}

export function getEntryNumericValue(
  activity: ActivityDefinition,
  entry?: ActivityEntry
): number {
  if (!entry) return 0;
  if (activity.inputType === 'time') {
    const h = safeNonNeg(entry.hours, 24);
    const m = safeNonNeg(entry.minutes, 59);
    return Math.min(MINUTES_PER_DAY, h * 60 + m);
  }
  if (activity.inputType === 'number') {
    return safeNonNeg(entry.value, 100000);
  }
  if (activity.inputType === 'prayer') {
    const p = entry.prayers;
    if (!p) return 0;
    return [p.fajr, p.dhuhr, p.asr, p.maghrib, p.isha].filter(Boolean).length;
  }
  if (activity.inputType === 'checkbox') {
    return entry.completed ? 1 : 0;
  }
  if (activity.inputType === 'text') {
    return entry.textValue && entry.textValue.trim().length > 0 ? 1 : 0;
  }
  return 0;
}

export function calculateActivityProgress(
  activity: ActivityDefinition,
  entry?: ActivityEntry,
  lang: Language = 'bn'
): ActivityProgressResult {
  const t = UI_COPY[lang];
  if (!entry) {
    return {
      ratio: 0,
      completed: false,
      earnedXp: 0,
      summaryText: t.notStartedLabel,
    };
  }

  if (activity.inputType === 'prayer') {
    const count = getEntryNumericValue(activity, entry);
    const ratio = Math.min(1, count / 5);
    const earnedXp = Math.round((activity.xpReward * count) / 5);
    const unit = getLocalizedUnitLabel(activity.unitLabel || 'waqt', lang);
    return {
      ratio,
      completed: count === 5,
      earnedXp,
      summaryText: `${formatDigits(count, lang)} / ${formatDigits(5, lang)} ${unit}`,
    };
  }

  if (activity.inputType === 'checkbox') {
    const done = Boolean(entry.completed);
    return {
      ratio: done ? 1 : 0,
      completed: done,
      earnedXp: done ? activity.xpReward : 0,
      summaryText: done ? t.completedLabel : t.remainingLabel,
    };
  }

  if (activity.inputType === 'text') {
    const text = (entry.textValue ?? '').trim();
    const done = text.length > 0;
    return {
      ratio: done ? 1 : 0,
      completed: done,
      earnedXp: done ? activity.xpReward : 0,
      summaryText: done ? text : t.notWrittenLabel,
    };
  }

  const val = getEntryNumericValue(activity, entry);
  const target = Math.max(1, activity.dailyTarget || 1);
  const ratio = Math.min(1, val / target);
  const earnedXp = Math.round(activity.xpReward * ratio);

  if (activity.inputType === 'time') {
    return {
      ratio,
      completed: ratio >= 1,
      earnedXp,
      summaryText: formatLocalizedDuration(val, lang),
    };
  }

  const unit = getLocalizedUnitLabel(activity.unitLabel, lang);
  return {
    ratio,
    completed: ratio >= 1,
    earnedXp,
    summaryText: `${formatDigits(val, lang)} / ${formatDigits(target, lang)} ${unit}`,
  };
}

export function calculateActivityPeriodProgress(
  activity: ActivityDefinition,
  dailyLogs: Record<string, DailyLog>,
  todayKey: string,
  days: 7 | 30
): {
  accumulated: number;
  target: number;
  pct: number;
} {
  const keys = getLastNDaysKeys(todayKey, days);
  let accumulated = 0;
  for (const key of keys) {
    const entry = dailyLogs[key]?.entries?.[activity.id];
    accumulated += getEntryNumericValue(activity, entry);
  }
  const explicitTarget =
    days === 7 ? activity.weeklyTarget : activity.monthlyTarget;
  const fallbackTarget = Math.max(1, activity.dailyTarget || 1) * (days === 7 ? 7 : 30);
  const target = explicitTarget && explicitTarget > 0 ? explicitTarget : fallbackTarget;
  const pct = Math.min(100, Math.round((accumulated / Math.max(1, target)) * 100));
  return {
    accumulated: Math.round(accumulated * 10) / 10,
    target,
    pct,
  };
}

export function calculateDailySummary(
  activities: ActivityDefinition[],
  entries: Record<string, ActivityEntry>,
  config: LevelConfig
): {
  totalXpEarned: number;
  completionPct: number;
  completedCount: number;
  totalCount: number;
  bonusAwarded: boolean;
} {
  const active = activities.filter((a) => a.isActive);
  if (active.length === 0) {
    return {
      totalXpEarned: 0,
      completionPct: 0,
      completedCount: 0,
      totalCount: 0,
      bonusAwarded: false,
    };
  }

  let xpSum = 0;
  let ratioSum = 0;
  let completedCount = 0;

  for (const act of active) {
    const res = calculateActivityProgress(act, entries[act.id]);
    xpSum += res.earnedXp;
    ratioSum += res.ratio;
    if (res.completed) {
      completedCount += 1;
    }
  }

  const completionPct = Math.min(100, Math.max(0, Math.round((ratioSum / active.length) * 100)));
  const bonusXp = safeNonNeg(config.dailyBonusXp, 1000);
  const bonusAwarded = completionPct >= 80 && bonusXp > 0;
  const totalXpEarned = Math.round(xpSum + (bonusAwarded ? bonusXp : 0));

  return {
    totalXpEarned,
    completionPct,
    completedCount,
    totalCount: active.length,
    bonusAwarded,
  };
}

export function getRankTitle(level: number, lang: Language = 'bn'): string {
  const titles = RANK_TITLES[lang];
  if (level < 3) return titles[0];
  if (level < 6) return titles[1];
  if (level < 10) return titles[2];
  if (level < 15) return titles[3];
  if (level < 22) return titles[4];
  if (level < 30) return titles[5];
  return titles[6];
}

export function xpNeededForLevelStep(level: number, config: LevelConfig): number {
  const base = Math.max(50, safeNonNeg(config.baseXpPerLevel, 10000) || 250);
  const step = safeNonNeg(config.xpGrowthStep, 5000);
  return base + (level - 1) * step;
}

export function calculateLevelInfo(
  totalXp: number,
  config: LevelConfig,
  lang: Language = 'bn'
): {
  level: number;
  currentLevelXp: number;
  xpRequiredForNext: number;
  xpRemaining: number;
  progressPct: number;
  rankTitle: string;
} {
  let remaining = Math.round(safeNonNeg(totalXp));
  let level = 1;

  while (level < 200) {
    const req = xpNeededForLevelStep(level, config);
    if (remaining < req) {
      const progressPct = Math.min(100, Math.round((remaining / req) * 100));
      return {
        level,
        currentLevelXp: remaining,
        xpRequiredForNext: req,
        xpRemaining: req - remaining,
        progressPct,
        rankTitle: getRankTitle(level, lang),
      };
    }
    remaining -= req;
    level += 1;
  }

  return {
    level,
    currentLevelXp: remaining,
    xpRequiredForNext: 1000,
    xpRemaining: 0,
    progressPct: 100,
    rankTitle: getRankTitle(level, lang),
  };
}

export function calculateGentleStreak(
  dailyLogs: Record<string, DailyLog>,
  todayKey: string
): {
  currentStreak: number;
  longestStreak: number;
  activeToday: boolean;
  totalActiveDays: number;
} {
  const isDayActive = (log?: DailyLog) => Boolean(log && log.completionPct >= 30);

  const todayActive = isDayActive(dailyLogs[todayKey]);
  let cursor = todayActive ? todayKey : shiftDateKey(todayKey, -1);
  let currentStreak = 0;

  for (let i = 0; i < 365; i++) {
    if (isDayActive(dailyLogs[cursor])) {
      currentStreak += 1;
      cursor = shiftDateKey(cursor, -1);
    } else {
      break;
    }
  }

  const sortedKeys = Object.keys(dailyLogs).sort();
  let longestStreak = 0;
  let running = 0;
  let prevKey: string | null = null;
  let totalActiveDays = 0;

  for (const key of sortedKeys) {
    if (isDayActive(dailyLogs[key])) {
      totalActiveDays += 1;
      if (prevKey && shiftDateKey(prevKey, 1) === key) {
        running += 1;
      } else {
        running = 1;
      }
      if (running > longestStreak) {
        longestStreak = running;
      }
      prevKey = key;
    } else {
      running = 0;
      prevKey = null;
    }
  }

  return {
    currentStreak,
    longestStreak: Math.max(longestStreak, currentStreak),
    activeToday: todayActive,
    totalActiveDays,
  };
}

export function evaluateAchievements(
  dailyLogs: Record<string, DailyLog>,
  activities: ActivityDefinition[],
  config: LevelConfig,
  todayKey: string,
  lang: Language = 'bn',
  religionTrackingEnabled: boolean = false
): AchievementItem[] {
  const allLogs = Object.values(dailyLogs);
  const streakInfo = calculateGentleStreak(dailyLogs, todayKey);

  let fivePrayerDays = 0;
  let totalQuranMinutes = 0;
  let totalStudyMinutes = 0;
  let totalExerciseMinutes = 0;
  let totalDetoxMinutes = 0;
  let highCompletionDays = 0;

  for (const log of allLogs) {
    if (safeNonNeg(log.completionPct, 100) >= 80) {
      highCompletionDays += 1;
    }
    const p = log.entries?.prayer?.prayers;
    if (p && p.fajr && p.dhuhr && p.asr && p.maghrib && p.isha) {
      fivePrayerDays += 1;
    }
    totalQuranMinutes += safeNonNeg(log.entries?.quran?.value, MINUTES_PER_DAY);
    const studyEntry = log.entries?.study;
    if (studyEntry) {
      totalStudyMinutes += Math.min(
        MINUTES_PER_DAY,
        safeNonNeg(studyEntry.hours, 24) * 60 + safeNonNeg(studyEntry.minutes, 59)
      );
    }
    totalExerciseMinutes += safeNonNeg(log.entries?.exercise?.value, MINUTES_PER_DAY);
    totalDetoxMinutes += safeNonNeg(log.entries?.detox?.value, MINUTES_PER_DAY);
  }

  const baseXpFromLogs = allLogs.reduce(
    (acc, log) => acc + safeNonNeg(log.totalXpEarned),
    0
  );
  const copy = ACHIEVEMENT_COPY[lang];

  const rawDefinitions: Omit<AchievementItem, 'unlocked'>[] = [
    {
      id: 'first_step',
      ...copy.first_step,
      xpBonus: 50,
      progress: streakInfo.totalActiveDays,
      target: 1,
      tier: 'bronze',
    },
    {
      id: 'streak_7',
      ...copy.streak_7,
      xpBonus: 120,
      progress: streakInfo.longestStreak,
      target: 7,
      tier: 'silver',
    },
    {
      id: 'streak_14',
      ...copy.streak_14,
      xpBonus: 250,
      progress: streakInfo.longestStreak,
      target: 14,
      tier: 'gold',
    },
    {
      id: 'prayer_5',
      ...copy.prayer_5,
      xpBonus: 150,
      progress: fivePrayerDays,
      target: 5,
      tier: 'silver',
      isSpiritual: true,
    },
    {
      id: 'quran_180',
      ...copy.quran_180,
      xpBonus: 150,
      progress: totalQuranMinutes,
      target: 180,
      tier: 'gold',
      isSpiritual: true,
    },
    {
      id: 'study_600',
      ...copy.study_600,
      xpBonus: 160,
      progress: totalStudyMinutes,
      target: 600,
      tier: 'silver',
    },
    {
      id: 'exercise_180',
      ...copy.exercise_180,
      xpBonus: 140,
      progress: totalExerciseMinutes,
      target: 180,
      tier: 'silver',
    },
    {
      id: 'detox_300',
      ...copy.detox_300,
      xpBonus: 130,
      progress: totalDetoxMinutes,
      target: 300,
      tier: 'bronze',
    },
    {
      id: 'master_day_5',
      ...copy.master_day_5,
      xpBonus: 200,
      progress: highCompletionDays,
      target: 5,
      tier: 'gold',
    },
    {
      id: 'custom_creator',
      ...copy.custom_creator,
      xpBonus: 80,
      progress: activities.some((a) => !a.isCore) ? 1 : 0,
      target: 1,
      tier: 'bronze',
    },
    {
      id: 'xp_2500',
      ...copy.xp_2500,
      xpBonus: 300,
      progress: baseXpFromLogs,
      target: 2500,
      tier: 'legendary',
    },
  ];

  void config;

  // Hide spiritual achievements completely when religious tracking is disabled
  const filtered = religionTrackingEnabled
    ? rawDefinitions
    : rawDefinitions.filter((item) => !item.isSpiritual);

  return filtered.map((item) => ({
    ...item,
    unlocked: item.progress >= item.target,
  }));
}

export function calculateTotalXpWithAchievements(
  dailyLogs: Record<string, DailyLog>,
  achievements: AchievementItem[]
): {
  logsXp: number;
  achievementXp: number;
  totalXp: number;
} {
  const logsXp = Math.round(
    Object.values(dailyLogs).reduce((sum, log) => sum + safeNonNeg(log.totalXpEarned), 0)
  );
  const achievementXp = Math.round(
    achievements
      .filter((a) => a.unlocked)
      .reduce((sum, a) => sum + safeNonNeg(a.xpBonus), 0)
  );
  return {
    logsXp,
    achievementXp,
    totalXp: logsXp + achievementXp,
  };
}

export interface DailySeriesPoint {
  dateKey: string;
  completionPct: number;
  xpEarned: number;
  exerciseMinutes: number;
  studyMinutes: number;
  prayerCount: number;
  quranMinutes: number;
  productiveMinutes: number;
  wastedMinutes: number;
}

export interface ActivityStatItem {
  activity: ActivityDefinition;
  avgCompletionPct: number;
  daysMetTarget: number;
  totalLoggedDays: number;
  totalNumericSum: number;
}

export function calculateAnalytics(
  dailyLogs: Record<string, DailyLog>,
  activities: ActivityDefinition[],
  todayKey: string,
  rangeDays: number,
  religionTrackingEnabled: boolean = true,
  customCategories: CustomCategoryDef[] = []
): {
  series: DailySeriesPoint[];
  avgCompletionPct: number;
  totalXpInRange: number;
  prayerConsistencyPct: number;
  focusConsistencyPct: number;
  avgProductiveMinutes: number;
  avgWastedMinutes: number;
  avgNecessaryOrRestMinutes: number;
  auditEfficiencyPct: number | null;
  bestDays: DailyLog[];
  activityStats: ActivityStatItem[];
  needsImprovement: ActivityStatItem[];
} {
  const keys = getLastNDaysKeys(todayKey, rangeDays);
  const visibleActivities = getVisibleActivities(
    activities,
    religionTrackingEnabled,
    customCategories
  );
  const activeActivities = visibleActivities.filter((a) => a.isActive);

  const series: DailySeriesPoint[] = keys.map((dateKey) => {
    const log = dailyLogs[dateKey];
    const studyEntry = log?.entries?.study;
    const studyMinutes = studyEntry
      ? Math.min(
          MINUTES_PER_DAY,
          safeNonNeg(studyEntry.hours, 24) * 60 + safeNonNeg(studyEntry.minutes, 59)
        )
      : 0;
    const prayers = log?.entries?.prayer?.prayers;
    const prayerCount =
      religionTrackingEnabled && prayers
        ? [prayers.fajr, prayers.dhuhr, prayers.asr, prayers.maghrib, prayers.isha].filter(
            Boolean
          ).length
        : 0;
    const audit = log?.entries?.[TIME_AUDIT_ENTRY_KEY];
    const clampedAudit = clampTimeAuditPair(audit?.value, audit?.minutes);

    return {
      dateKey,
      completionPct: Math.min(100, Math.round(safeNonNeg(log?.completionPct, 100))),
      xpEarned: Math.round(safeNonNeg(log?.totalXpEarned)),
      exerciseMinutes: safeNonNeg(log?.entries?.exercise?.value, MINUTES_PER_DAY),
      studyMinutes,
      prayerCount,
      quranMinutes: religionTrackingEnabled
        ? safeNonNeg(log?.entries?.quran?.value, MINUTES_PER_DAY)
        : 0,
      productiveMinutes: clampedAudit.productiveMinutes,
      wastedMinutes: clampedAudit.wastedMinutes,
    };
  });

  const loggedDaysInRange = series.filter((s) => Boolean(dailyLogs[s.dateKey]));
  const avgCompletionPct =
    loggedDaysInRange.length > 0
      ? Math.round(
          loggedDaysInRange.reduce((sum, s) => sum + s.completionPct, 0) /
            loggedDaysInRange.length
        )
      : 0;
  const totalXpInRange = series.reduce((sum, s) => sum + s.xpEarned, 0);

  const totalPrayersPossible = Math.max(1, loggedDaysInRange.length * 5);
  const totalPrayersLogged = series.reduce((sum, s) => sum + s.prayerCount, 0);
  const prayerConsistencyPct =
    loggedDaysInRange.length > 0 && religionTrackingEnabled
      ? Math.round((totalPrayersLogged / totalPrayersPossible) * 100)
      : 0;

  const avgProductiveMinutes =
    loggedDaysInRange.length > 0
      ? Math.round(
          series.reduce((sum, s) => sum + s.productiveMinutes, 0) /
            loggedDaysInRange.length
        )
      : 0;

  const avgWastedMinutes =
    loggedDaysInRange.length > 0
      ? Math.round(
          series.reduce((sum, s) => sum + s.wastedMinutes, 0) /
            loggedDaysInRange.length
        )
      : 0;

  const avgNecessaryOrRestMinutes =
    loggedDaysInRange.length > 0
      ? Math.max(0, MINUTES_PER_DAY - avgProductiveMinutes - avgWastedMinutes)
      : 0;

  const totalAudit = avgProductiveMinutes + avgWastedMinutes;
  const auditEfficiencyPct =
    totalAudit > 0 ? Math.round((avgProductiveMinutes / totalAudit) * 100) : null;
  const focusConsistencyPct =
    auditEfficiencyPct !== null ? auditEfficiencyPct : avgCompletionPct;

  const bestDays = Object.values(dailyLogs)
    .filter((l) => safeNonNeg(l.completionPct, 100) > 0)
    .sort(
      (a, b) =>
        safeNonNeg(b.completionPct, 100) - safeNonNeg(a.completionPct, 100) ||
        safeNonNeg(b.totalXpEarned) - safeNonNeg(a.totalXpEarned)
    )
    .slice(0, 5);

  const activityStats: ActivityStatItem[] = activeActivities.map((activity) => {
    let ratioSum = 0;
    let daysMetTarget = 0;
    let totalNumericSum = 0;
    let totalLoggedDays = 0;

    for (const dateKey of keys) {
      const log = dailyLogs[dateKey];
      if (!log) continue;
      totalLoggedDays += 1;
      const entry = log.entries?.[activity.id];
      const prog = calculateActivityProgress(activity, entry);
      ratioSum += prog.ratio;
      if (prog.completed) daysMetTarget += 1;
      totalNumericSum += getEntryNumericValue(activity, entry);
    }

    const avgPct =
      totalLoggedDays > 0 ? Math.round((ratioSum / totalLoggedDays) * 100) : 0;

    return {
      activity,
      avgCompletionPct: avgPct,
      daysMetTarget,
      totalLoggedDays,
      totalNumericSum,
    };
  });

  const needsImprovement = [...activityStats]
    .sort((a, b) => a.avgCompletionPct - b.avgCompletionPct)
    .slice(0, 3);

  return {
    series,
    avgCompletionPct,
    totalXpInRange,
    prayerConsistencyPct,
    focusConsistencyPct,
    avgProductiveMinutes,
    avgWastedMinutes,
    avgNecessaryOrRestMinutes,
    auditEfficiencyPct,
    bestDays,
    activityStats,
    needsImprovement,
  };
}

export function buildBackupAnalyticsSnapshot(
  dailyLogs: Record<string, DailyLog>,
  activities: ActivityDefinition[],
  todayKey: string,
  profile: UserProfileData,
  extraBonusXp: number = 0
): AnalyticsSnapshot {
  const religionEnabled = Boolean(profile.religionTrackingEnabled);
  const customCategories = profile.customCategories ?? [];
  const achievements = evaluateAchievements(
    dailyLogs,
    activities,
    profile.levelConfig,
    todayKey,
    profile.language ?? 'en',
    religionEnabled
  );
  const xp = calculateTotalXpWithAchievements(dailyLogs, achievements);
  const totalXp = xp.totalXp + safeNonNeg(extraBonusXp);
  const levelInfo = calculateLevelInfo(totalXp, profile.levelConfig, profile.language ?? 'en');
  const streakInfo = calculateGentleStreak(dailyLogs, todayKey);
  const weekly = calculateAnalytics(
    dailyLogs,
    activities,
    todayKey,
    7,
    religionEnabled,
    customCategories
  );
  const monthly = calculateAnalytics(
    dailyLogs,
    activities,
    todayKey,
    30,
    religionEnabled,
    customCategories
  );

  return {
    totalXp,
    level: levelInfo.level,
    currentStreak: streakInfo.currentStreak,
    longestStreak: streakInfo.longestStreak,
    weeklyAvgCompletionPct: weekly.avgCompletionPct,
    monthlyAvgCompletionPct: monthly.avgCompletionPct,
    avgProductiveMinutes: monthly.avgProductiveMinutes,
    avgWastedMinutes: monthly.avgWastedMinutes,
    avgNecessaryOrRestMinutes: monthly.avgNecessaryOrRestMinutes,
    totalLoggedDays: Object.keys(dailyLogs).length,
  };
}

export function exportLogsToCsv(
  dailyLogs: Record<string, DailyLog>,
  activities: ActivityDefinition[],
  lang: Language = 'bn'
): string {
  const t = UI_COPY[lang];
  const ordered = [...activities].sort((a, b) => a.order - b.order);
  const headers = [
    t.csvHeaders.date,
    t.csvHeaders.completion,
    t.csvHeaders.xp,
    t.csvHeaders.productiveMin,
    t.csvHeaders.wastedMin,
    ...ordered.map(
      (a) =>
        `${getLocalizedActivityTitle(a, lang)} (${getLocalizedUnitLabel(a.unitLabel, lang) || '-'})`
    ),
  ];

  const escapeCell = (val: string | number) => {
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

    const rows = Object.keys(dailyLogs)
    .sort((a, b) => b.localeCompare(a))
    .map((dateKey) => {
      const log = dailyLogs[dateKey];
      const audit = log.entries?.[TIME_AUDIT_ENTRY_KEY];
      const clampedAudit = clampTimeAuditPair(audit?.value, audit?.minutes);
      const cells: (string | number)[] = [
        dateKey,
        Math.min(100, Math.round(safeNonNeg(log.completionPct, 100))),
        Math.round(safeNonNeg(log.totalXpEarned)),
        clampedAudit.productiveMinutes,
        clampedAudit.wastedMinutes,
        ...ordered.map((act) => {
          const entry = log.entries?.[act.id];
          if (!entry) return '';
          if (act.inputType === 'prayer') {
            const p = entry.prayers;
            if (!p) return '0/5';
            const done = [p.fajr, p.dhuhr, p.asr, p.maghrib, p.isha].filter(Boolean).length;
            return `${done}/5`;
          }
          if (act.inputType === 'checkbox') {
            return entry.completed ? t.csvStatusDone : t.csvStatusNo;
          }
          if (act.inputType === 'time') {
            const mins = Math.min(
              MINUTES_PER_DAY,
              safeNonNeg(entry.hours, 24) * 60 + safeNonNeg(entry.minutes, 59)
            );
            return `${mins} ${t.minutesUnit}`;
          }
          if (act.inputType === 'text') {
            return entry.textValue ?? '';
          }
          return safeNonNeg(entry.value, 100000);
        }),
      ];
      return cells.map(escapeCell).join(',');
    });

  return '\uFEFF' + [headers.map(escapeCell).join(','), ...rows].join('\n');
}

const VALID_INPUT_TYPES: Set<InputType> = new Set([
  'prayer',
  'checkbox',
  'number',
  'time',
  'text',
]);
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const SAFE_ID_RE = /^[a-zA-Z0-9_\-]+$/;

export function parseBackupJson(
  raw: string,
  lang: Language = 'bn'
): {
  valid: boolean;
  data?: BackupPayload;
  error?: string;
} {
  const t = UI_COPY[lang];
  try {
    const parsed = JSON.parse(raw) as Partial<BackupPayload>;
    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, error: t.errorInvalidJson };
    }
    if (!Array.isArray(parsed.activities) || !parsed.dailyLogs || typeof parsed.dailyLogs !== 'object' || Array.isArray(parsed.dailyLogs)) {
      return { valid: false, error: t.errorMissingBackupFields };
    }

    const cleanActivities: ActivityDefinition[] = [];
    for (let idx = 0; idx < parsed.activities.length && cleanActivities.length < 100; idx++) {
      const a = parsed.activities[idx] as Partial<ActivityDefinition> | undefined;
      if (!a || typeof a !== 'object') continue;
      const id = String(a.id ?? '').trim();
      const title = String(a.title ?? '').trim().slice(0, 100);
      if (!SAFE_ID_RE.test(id) || !title) continue;
      const inputType: InputType = VALID_INPUT_TYPES.has(a.inputType as InputType)
        ? (a.inputType as InputType)
        : 'checkbox';
      cleanActivities.push({
        id,
        title,
        category: String(a.category ?? 'personal').trim().slice(0, 40) || 'personal',
        inputType,
        unitLabel: String(a.unitLabel ?? '').trim().slice(0, 40),
        dailyTarget: Math.round(safeNonNeg(a.dailyTarget, 100000)) || (inputType === 'checkbox' || inputType === 'text' ? 1 : inputType === 'prayer' ? 5 : 10),
        weeklyTarget: a.weeklyTarget !== undefined ? Math.round(safeNonNeg(a.weeklyTarget, 1000000)) : undefined,
        monthlyTarget: a.monthlyTarget !== undefined ? Math.round(safeNonNeg(a.monthlyTarget, 10000000)) : undefined,
        xpReward: Math.round(safeNonNeg(a.xpReward, 5000)),
        priority: a.priority === 'high' || a.priority === 'medium' || a.priority === 'low' ? a.priority : 'medium',
        reminderEnabled: Boolean(a.reminderEnabled),
        reminderTime: typeof a.reminderTime === 'string' ? a.reminderTime.slice(0, 10) : undefined,
        order: Number.isFinite(Number(a.order)) ? Math.max(0, Math.min(500, Math.round(Number(a.order)))) : idx,
        isCore: Boolean(a.isCore),
        isActive: a.isActive !== false,
      });
    }

    if (cleanActivities.length === 0) {
      return { valid: false, error: t.errorMissingBackupFields };
    }

    const cleanLogs: Record<string, DailyLog> = {};
    for (const [rawKey, rawLog] of Object.entries(parsed.dailyLogs)) {
      if (!DATE_KEY_RE.test(rawKey) || !rawLog || typeof rawLog !== 'object') continue;
      const l = rawLog as Partial<DailyLog>;
      const entries = l.entries && typeof l.entries === 'object' && !Array.isArray(l.entries) ? l.entries : {};
      cleanLogs[rawKey] = {
        dateKey: rawKey,
        entries,
        totalXpEarned: Math.round(safeNonNeg(l.totalXpEarned, 100000)),
        completionPct: Math.min(100, Math.round(safeNonNeg(l.completionPct, 100))),
        completedCount: Math.round(safeNonNeg(l.completedCount, 100)),
        totalCount: Math.round(safeNonNeg(l.totalCount, 100)),
        note: typeof l.note === 'string' ? l.note.slice(0, 500) : undefined,
        updatedAtIso: typeof l.updatedAtIso === 'string' ? l.updatedAtIso : undefined,
      };
    }

    const rawProf = parsed.profile;
    const rawCfg = rawProf?.levelConfig;
    const profile: UserProfileData = {
      ...(rawProf ?? {}),
      displayName: String(rawProf?.displayName ?? 'Adventurer').trim().slice(0, 100) || 'Adventurer',
      language: rawProf?.language === 'bn' || rawProf?.language === 'en' ? rawProf.language : lang,
      levelConfig: {
        baseXpPerLevel: Math.max(50, Math.round(safeNonNeg(rawCfg?.baseXpPerLevel, 10000)) || 250),
        xpGrowthStep: Math.round(safeNonNeg(rawCfg?.xpGrowthStep, 5000)),
        dailyBonusXp: Math.round(safeNonNeg(rawCfg?.dailyBonusXp, 1000)),
      },
    };

    return {
      valid: true,
      data: {
        version: Number(parsed.version ?? 1) || 1,
        exportedAt: String(parsed.exportedAt ?? new Date().toISOString()),
        profile,
        activities: cleanActivities,
        dailyLogs: cleanLogs,
        analyticsSnapshot: parsed.analyticsSnapshot,
      },
    };
  } catch {
    return { valid: false, error: t.errorReadJsonFailed };
  }
}
