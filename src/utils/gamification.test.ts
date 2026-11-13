import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBackupAnalyticsSnapshot,
  calculateActivityPeriodProgress,
  calculateActivityProgress,
  calculateAnalytics,
  calculateDailySummary,
  calculateGentleStreak,
  calculateLevelInfo,
  clampTimeAuditPair,
  evaluateAchievements,
  exportLogsToCsv,
  getRankTitle,
  getVisibleActivities,
  parseBackupJson,
  safeNonNeg,
} from './gamification';
import {
  DEFAULT_ACTIVITIES,
  DEFAULT_LEVEL_CONFIG,
  DEFAULT_PROFILE,
  OPTIONAL_SPIRITUAL_TEMPLATES,
  TIME_AUDIT_ENTRY_KEY,
} from './defaults';
import {
  formatBengaliDate,
  formatDigits,
  formatLocalizedDate,
  getDhakaTodayKey,
  shiftDateKey,
  toBengaliDigits,
} from './dhakaTime';
import { DEVELOPER_CREDIT, getLocalizedActivityTitle } from './i18n';
import { DailyLog } from '../types/quest';

test('toBengaliDigits and formatDigits handle EN and BN cleanly', () => {
  assert.equal(toBengaliDigits('2026-11-13'), '২০২৬-১১-১৩');
  assert.equal(toBengaliDigits(150), '১৫০');
  assert.equal(formatDigits(150, 'en'), '150');
  assert.equal(formatDigits(150, 'bn'), '১৫০');
});

test('getDhakaTodayKey respects Asia/Dhaka UTC+6 offset and bilingual date formats', () => {
  const utcEvening = new Date('2026-11-13T20:00:00.000Z');
  assert.equal(getDhakaTodayKey(utcEvening), '2026-11-14');
  assert.equal(formatBengaliDate('2026-11-14', false), '১৪ নভেম্বর ২০২৬');
  assert.equal(formatLocalizedDate('2026-11-14', 'en', false), '14 Nov 2026');
});

test('default activities never force religious tracking and optional templates hide when disabled', () => {
  assert.equal(DEFAULT_ACTIVITIES.some((a) => a.category === 'spiritual'), false);
  const combined = [...DEFAULT_ACTIVITIES, ...OPTIONAL_SPIRITUAL_TEMPLATES];
  const hidden = getVisibleActivities(combined, false);
  assert.equal(hidden.some((a) => a.category === 'spiritual'), false);
  const shown = getVisibleActivities(combined, true);
  assert.equal(shown.some((a) => a.category === 'spiritual'), true);
});

test('deterministic XP calculation prevents duplicate XP awards on repeated edits', () => {
  const combined = [...DEFAULT_ACTIVITIES, ...OPTIONAL_SPIRITUAL_TEMPLATES];
  const entries = {
    prayer: {
      prayers: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true },
    },
    quran: { value: 15 },
    study: { hours: 2, minutes: 0 },
  };

  const firstPass = calculateDailySummary(combined, entries, DEFAULT_LEVEL_CONFIG);
  const secondPass = calculateDailySummary(combined, entries, DEFAULT_LEVEL_CONFIG);
  assert.equal(firstPass.totalXpEarned, secondPass.totalXpEarned);
  assert.equal(firstPass.totalXpEarned, 200);

  const toggledOff = {
    ...entries,
    prayer: { prayers: { fajr: false, dhuhr: true, asr: true, maghrib: true, isha: true } },
  };
  const midPass = calculateDailySummary(combined, toggledOff, DEFAULT_LEVEL_CONFIG);
  assert.equal(midPass.totalXpEarned, 180);

  const toggledBack = calculateDailySummary(combined, entries, DEFAULT_LEVEL_CONFIG);
  assert.equal(toggledBack.totalXpEarned, 200);
});

test('duration-based goals cap XP and compute weekly/monthly targets accurately', () => {
  const quran = OPTIONAL_SPIRITUAL_TEMPLATES.find((a) => a.id === 'quran')!;
  const half = calculateActivityProgress(quran, { value: 7.5 });
  assert.equal(half.earnedXp, 20);
  assert.equal(half.completed, false);

  const overAchieved = calculateActivityProgress(quran, { value: 60 });
  assert.equal(overAchieved.earnedXp, 40);
  assert.equal(overAchieved.completed, true);
  assert.equal(overAchieved.ratio, 1);

  const study = DEFAULT_ACTIVITIES.find((a) => a.id === 'study')!;
  const today = '2026-11-13';
  const logs: Record<string, DailyLog> = {
    '2026-11-13': { dateKey: '2026-11-13', entries: { study: { hours: 3, minutes: 0 } }, totalXpEarned: 60, completionPct: 50, completedCount: 1, totalCount: 8 },
    '2026-11-12': { dateKey: '2026-11-12', entries: { study: { hours: 3, minutes: 0 } }, totalXpEarned: 60, completionPct: 50, completedCount: 1, totalCount: 8 },
  };
  const weeklyProg = calculateActivityPeriodProgress(study, logs, today, 7);
  assert.equal(weeklyProg.accumulated, 360);
  assert.equal(weeklyProg.target, 720);
  assert.equal(weeklyProg.pct, 50);
});

test('level progression computes level and remaining XP accurately', () => {
  const lv1 = calculateLevelInfo(100, DEFAULT_LEVEL_CONFIG, 'en');
  assert.equal(lv1.level, 1);
  assert.equal(lv1.xpRemaining, 150);
  assert.equal(lv1.rankTitle, 'Novice Adventurer');

  const lv2 = calculateLevelInfo(300, DEFAULT_LEVEL_CONFIG, 'bn');
  assert.equal(lv2.level, 2);
  assert.equal(lv2.currentLevelXp, 50);
  assert.equal(lv2.xpRequiredForNext, 350);
  assert.equal(lv2.xpRemaining, 300);
  assert.equal(getRankTitle(2, 'bn'), 'নবীন অভিযাত্রী');
});

test('gentle streak does not punish before today is completed', () => {
  const today = '2026-11-13';
  const d1 = shiftDateKey(today, -1);
  const d2 = shiftDateKey(today, -2);
  const d3 = shiftDateKey(today, -3);

  const logs: Record<string, DailyLog> = {
    [d3]: { dateKey: d3, entries: {}, totalXpEarned: 100, completionPct: 60, completedCount: 6, totalCount: 10 },
    [d2]: { dateKey: d2, entries: {}, totalXpEarned: 120, completionPct: 70, completedCount: 7, totalCount: 10 },
    [d1]: { dateKey: d1, entries: {}, totalXpEarned: 140, completionPct: 80, completedCount: 8, totalCount: 10 },
    [today]: { dateKey: today, entries: {}, totalXpEarned: 10, completionPct: 10, completedCount: 1, totalCount: 10 },
  };

  const streak = calculateGentleStreak(logs, today);
  assert.equal(streak.currentStreak, 3);
  assert.equal(streak.activeToday, false);

  logs[today].completionPct = 50;
  const extended = calculateGentleStreak(logs, today);
  assert.equal(extended.currentStreak, 4);
  assert.equal(extended.activeToday, true);
});

test('achievements hide spiritual badges when disabled and bilingual CSV/JSON work cleanly', () => {
  const combined = [...DEFAULT_ACTIVITIES, ...OPTIONAL_SPIRITUAL_TEMPLATES];
  const today = '2026-11-13';
  const logs: Record<string, DailyLog> = {
    [today]: {
      dateKey: today,
      entries: {
        prayer: { prayers: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true } },
        quran: { value: 20 },
        [TIME_AUDIT_ENTRY_KEY]: { value: 180, minutes: 45 },
      },
      totalXpEarned: 140,
      completionPct: 45,
      completedCount: 2,
      totalCount: 10,
    },
  };

  const hiddenAch = evaluateAchievements(logs, combined, DEFAULT_LEVEL_CONFIG, today, 'en', false);
  assert.equal(hiddenAch.some((a) => a.id === 'prayer_5'), false);

  const achievementsEn = evaluateAchievements(logs, combined, DEFAULT_LEVEL_CONFIG, today, 'en', true);
  assert.equal(achievementsEn.some((a) => a.id === 'prayer_5'), true);
  assert.equal(achievementsEn.find((a) => a.id === 'first_step')?.unlocked, true);

  const achievementsBn = evaluateAchievements(logs, combined, DEFAULT_LEVEL_CONFIG, today, 'bn', true);
  assert.equal(achievementsBn.find((a) => a.id === 'first_step')?.title, 'প্রথম পদক্ষেপ');

  const prayerAct = OPTIONAL_SPIRITUAL_TEMPLATES.find((a) => a.id === 'prayer')!;
  assert.equal(getLocalizedActivityTitle(prayerAct, 'en'), 'Five Daily Prayers');
  assert.equal(getLocalizedActivityTitle(prayerAct, 'bn'), 'পাঁচ ওয়াক্ত নামাজ');

  const analytics = calculateAnalytics(logs, combined, today, 7, true);
  assert.equal(analytics.avgProductiveMinutes, 180);
  assert.equal(analytics.avgWastedMinutes, 45);
  assert.equal(analytics.avgNecessaryOrRestMinutes, 1440 - 180 - 45);
  assert.equal(analytics.auditEfficiencyPct, 80);

  const csvEn = exportLogsToCsv(logs, combined, 'en');
  assert.ok(csvEn.startsWith('\uFEFF'));
  assert.ok(csvEn.includes('Date (YYYY-MM-DD)'));
  assert.ok(csvEn.includes('Five Daily Prayers'));
  assert.ok(csvEn.includes('5/5'));

  const csvBn = exportLogsToCsv(logs, combined, 'bn');
  assert.ok(csvBn.includes('তারিখ (YYYY-MM-DD)'));
  assert.ok(csvBn.includes('পাঁচ ওয়াক্ত নামাজ'));

  assert.equal(DEVELOPER_CREDIT, "Developed by Shohag (RUET ME'23)");

  const backupStr = JSON.stringify({
    version: 1,
    exportedAt: '2026-11-13T00:00:00Z',
    profile: { displayName: 'Test', language: 'en', levelConfig: DEFAULT_LEVEL_CONFIG },
    activities: DEFAULT_ACTIVITIES,
    dailyLogs: logs,
  });
  const parsed = parseBackupJson(backupStr, 'en');
  assert.equal(parsed.valid, true);
  assert.equal(parsed.data?.activities.length, DEFAULT_ACTIVITIES.length);
});

test('24h time audit cap keeps rest/sleep neutral and sanitizes NaN/negative values', () => {
  assert.equal(safeNonNeg(NaN), 0);
  assert.equal(safeNonNeg(Infinity), 0);
  assert.equal(safeNonNeg(-25), 0);

  // Typical day: 480m productive, 60m wasted => remaining 900m is rest/sleep/meals/prayer (never wasted)
  const normalDay = clampTimeAuditPair(480, 60);
  assert.equal(normalDay.productiveMinutes, 480);
  assert.equal(normalDay.wastedMinutes, 60);
  assert.equal(normalDay.necessaryRestMinutes, 900);
  assert.equal(
    normalDay.productiveMinutes + normalDay.wastedMinutes + normalDay.necessaryRestMinutes,
    1440
  );

  // Over-entered day: 1000m productive + 700m wasted must clamp wasted to 440m (<= 1440 total)
  const cappedDay = clampTimeAuditPair(1000, 700);
  assert.equal(cappedDay.productiveMinutes, 1000);
  assert.equal(cappedDay.wastedMinutes, 440);
  assert.equal(cappedDay.necessaryRestMinutes, 0);

  // Corrupt NaN / negative entry inputs never poison daily summary or level math
  const summary = calculateDailySummary(
    DEFAULT_ACTIVITIES,
    {
      study: { hours: -3, minutes: Number.NaN },
      exercise: { value: Number.POSITIVE_INFINITY },
    },
    DEFAULT_LEVEL_CONFIG
  );
  assert.equal(Number.isFinite(summary.totalXpEarned), true);
  assert.equal(summary.totalXpEarned, 0);
  assert.equal(summary.completionPct, 0);

  const lvl = calculateLevelInfo(Number.NaN, {
    baseXpPerLevel: -10,
    xpGrowthStep: Number.NaN,
    dailyBonusXp: -5,
  });
  assert.equal(lvl.level, 1);
  assert.equal(lvl.xpRemaining, 250);
});

test('empty analytics returns null auditEfficiencyPct and backup v2 snapshots & validation work', () => {
  const today = '2026-11-13';
  const pausedActs = DEFAULT_ACTIVITIES.map((a) => ({ ...a, isActive: false }));
  const emptyAnalytics = calculateAnalytics({}, pausedActs, today, 7, false);
  assert.equal(emptyAnalytics.avgCompletionPct, 0);
  assert.equal(emptyAnalytics.auditEfficiencyPct, null);
  assert.equal(emptyAnalytics.avgProductiveMinutes, 0);
  assert.equal(emptyAnalytics.avgWastedMinutes, 0);
  assert.equal(emptyAnalytics.avgNecessaryOrRestMinutes, 0);

  const logs: Record<string, DailyLog> = {
    [today]: {
      dateKey: today,
      entries: {
        [TIME_AUDIT_ENTRY_KEY]: { value: 240, minutes: 60 },
      },
      totalXpEarned: 120,
      completionPct: 80,
      completedCount: 5,
      totalCount: 6,
    },
  };
  const snapshot = buildBackupAnalyticsSnapshot(
    logs,
    DEFAULT_ACTIVITIES,
    today,
    DEFAULT_PROFILE,
    100
  );
  assert.equal(snapshot.totalXp >= 220, true);
  assert.equal(snapshot.avgProductiveMinutes, 240);
  assert.equal(snapshot.avgWastedMinutes, 60);
  assert.equal(snapshot.avgNecessaryOrRestMinutes, 1140);
  assert.equal(snapshot.totalLoggedDays, 1);

  // Strict backup validation strips invalid date keys and clamps negative/NaN numbers
  const dirtyBackup = JSON.stringify({
    version: 2,
    exportedAt: '2026-11-13T00:00:00Z',
    profile: { displayName: 'Test', language: 'bn', levelConfig: DEFAULT_LEVEL_CONFIG },
    activities: DEFAULT_ACTIVITIES,
    dailyLogs: {
      [today]: {
        dateKey: today,
        entries: {},
        totalXpEarned: -999,
        completionPct: 250,
      },
      'not-a-date': { dateKey: 'not-a-date', entries: {}, totalXpEarned: 50, completionPct: 50 },
    },
    analyticsSnapshot: snapshot,
  });
  const parsedDirty = parseBackupJson(dirtyBackup, 'en');
  assert.equal(parsedDirty.valid, true);
  assert.equal(Object.keys(parsedDirty.data?.dailyLogs ?? {}).length, 1);
  assert.equal(parsedDirty.data?.dailyLogs[today].totalXpEarned, 0);
  assert.equal(parsedDirty.data?.dailyLogs[today].completionPct, 100);
  assert.equal(parsedDirty.data?.analyticsSnapshot?.totalLoggedDays, 1);

  // Reject missing fields or invalid JSON
  assert.equal(parseBackupJson('{bad json', 'en').valid, false);
  assert.equal(parseBackupJson(JSON.stringify({ activities: [], dailyLogs: {} }), 'en').valid, false);
});
