import React, { useMemo, useState } from 'react';
import { ArrowRight, Award, Bell, Flame, Sliders, Sparkles, TrendingUp } from 'lucide-react';
import {
  AchievementItem,
  ActivityDefinition,
  ActivityEntry,
  CustomCategoryDef,
  DailyLog,
  Language,
  NavPage,
} from '../types/quest';
import {
  formatDigits,
  formatLocalizedDate,
  getDhakaLocalizedTimeLabel,
} from '../utils/dhakaTime';
import { calculateAnalytics } from '../utils/gamification';
import { getLocalizedActivityTitle, getLocalizedDisplayName, UI_COPY } from '../utils/i18n';
import { AvatarBadge } from './AvatarBadge';
import { CompletionRing, ProgressBarChart } from './charts/QuestCharts';
import { QuestCard } from './QuestCard';

interface DashboardViewProps {
  todayKey: string;
  displayName: string;
  avatarId?: string;
  religionEnabled: boolean;
  remindersEnabled: boolean;
  customCategories: CustomCategoryDef[];
  lang: Language;
  activities: ActivityDefinition[];
  dailyLogs: Record<string, DailyLog>;
  todaySummary: {
    totalXpEarned: number;
    completionPct: number;
    completedCount: number;
    totalCount: number;
    bonusAwarded: boolean;
  };
  xpTotals: {
    logsXp: number;
    achievementXp: number;
    groupChallengeXp?: number;
    totalXp: number;
  };
  levelInfo: {
    level: number;
    currentLevelXp: number;
    xpRequiredForNext: number;
    xpRemaining: number;
    progressPct: number;
    rankTitle: string;
  };
  streakInfo: {
    currentStreak: number;
    longestStreak: number;
    activeToday: boolean;
    totalActiveDays: number;
  };
  achievements: AchievementItem[];
  onUpdateEntry: (dateKey: string, activityId: string, entry: ActivityEntry) => void;
  onNavigate: (page: NavPage) => void;
  onOpenWizard: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  todayKey,
  displayName,
  avatarId,
  religionEnabled,
  remindersEnabled,
  customCategories,
  lang,
  activities,
  dailyLogs,
  todaySummary,
  xpTotals,
  levelInfo,
  streakInfo,
  achievements,
  onUpdateEntry,
  onNavigate,
  onOpenWizard,
}) => {
  const t = UI_COPY[lang];
  const [chartRange, setChartRange] = useState<'weekly' | 'monthly'>('weekly');
  const [recentCount, setRecentCount] = useState(5);

  const activeActivities = useMemo(
    () => activities.filter((a) => a.isActive).sort((a, b) => a.order - b.order),
    [activities]
  );

  const todayEntries = dailyLogs[todayKey]?.entries ?? {};
  const featuredQuests = activeActivities.slice(0, 4);
  const reminderQuests = useMemo(
    () => (remindersEnabled ? activeActivities.filter((a) => a.reminderEnabled) : []),
    [activeActivities, remindersEnabled]
  );

  const analytics = useMemo(
    () =>
      calculateAnalytics(
        dailyLogs,
        activities,
        todayKey,
        chartRange === 'weekly' ? 7 : 30,
        religionEnabled,
        customCategories
      ),
    [activities, chartRange, customCategories, dailyLogs, religionEnabled, todayKey]
  );

  const allSortedLogs = useMemo(() => {
    return Object.values(dailyLogs).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [dailyLogs]);
  const recentLogs = useMemo(
    () => allSortedLogs.slice(0, recentCount),
    [allSortedLogs, recentCount]
  );

  const unlockedAchievements = achievements.filter((a) => a.unlocked);
  const localizedName = getLocalizedDisplayName(displayName, lang);

  return (
    <div className="space-y-6">
      {/* Hero RPG Status & Today Summary */}
      <section className="rounded-2xl bg-[#121824] border border-white/[0.08] p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4 sm:gap-5">
            <AvatarBadge avatarId={avatarId} size="lg" />

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-400">
                <span className="whitespace-nowrap">
                  {formatLocalizedDate(todayKey, lang, true)}
                </span>
                <span className="whitespace-nowrap text-slate-500">
                  {t.dhakaTimePrefix} {getDhakaLocalizedTimeLabel(lang)}
                </span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-100 mt-1">
                {t.welcome} {localizedName}
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-amber-400 mt-1">
                <span className="font-semibold whitespace-nowrap">
                  {t.level} {formatDigits(levelInfo.level, lang)} — {levelInfo.rankTitle}
                </span>
                <span className="font-tabular text-slate-300 whitespace-nowrap">
                  {t.total} {formatDigits(xpTotals.totalXp, lang)} XP
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-5 pt-4 lg:pt-0 border-t lg:border-t-0 border-white/[0.06]">
            <CompletionRing percentage={todaySummary.completionPct} lang={lang} />
            <div className="space-y-1.5 text-right">
              <div className="text-xs text-slate-400">{t.todaysEarnedXp}</div>
              <div className="font-tabular text-2xl font-bold text-amber-400">
                +{formatDigits(todaySummary.totalXpEarned, lang)}
              </div>
              <div className="text-xs text-slate-300 font-tabular">
                {formatDigits(todaySummary.completedCount, lang)} /{' '}
                {formatDigits(todaySummary.totalCount, lang)} {t.questsDoneOf}
              </div>
            </div>
          </div>
        </div>

        {/* Level XP Progress Bar */}
        <div className="mt-6 pt-5 border-t border-white/[0.06]">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm mb-2">
            <span className="text-slate-300 font-medium">
              {t.nextLevelProgress} ({t.level} {formatDigits(levelInfo.level + 1, lang)})
            </span>
            <span className="font-tabular text-slate-300">
              {formatDigits(levelInfo.currentLevelXp, lang)} /{' '}
              {formatDigits(levelInfo.xpRequiredForNext, lang)} XP ·{' '}
              {lang === 'bn' ? 'আরও ' : ''}
              <strong className="text-amber-400">
                {formatDigits(levelInfo.xpRemaining, lang)} XP
              </strong>{' '}
              {t.remainingXpSuffix}
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-[#0B0F17] border border-white/[0.05] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-300"
              style={{ width: `${levelInfo.progressPct}%` }}
            />
          </div>
        </div>
      </section>

      {/* Compact Personalize / Setup Wizard + Reminders Strip */}
      <section className="rounded-2xl bg-[#121824] border border-white/[0.07] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
            <Sliders className="w-4 h-4" aria-hidden="true" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-100">{t.onboardingBannerTitle}</div>
            <div className="text-xs text-slate-400">
              {reminderQuests.length > 0
                ? `${t.remindersToggleTitle}: ${reminderQuests
                    .map(
                      (q) =>
                        `${getLocalizedActivityTitle(q, lang)}${q.reminderTime ? ` (${q.reminderTime})` : ''}`
                    )
                    .join(', ')}`
                : t.onboardingBannerSub}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {reminderQuests.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-sky-300 font-tabular mr-1">
              <Bell className="w-3.5 h-3.5" aria-hidden="true" />
              {formatDigits(reminderQuests.length, lang)}
            </span>
          )}
          <button
            type="button"
            onClick={onOpenWizard}
            className="min-h-[40px] px-3.5 rounded-xl bg-[#1A2233] border border-white/[0.1] hover:border-amber-400/40 text-xs font-semibold text-amber-300 whitespace-nowrap"
          >
            {t.onboardingLaunchBtn}
          </button>
        </div>
      </section>

      {/* 4 Key KPI Summary Row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl bg-[#121824] border border-white/[0.07] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t.currentStreak}</span>
            <Flame className="w-4 h-4 text-amber-400" aria-hidden="true" />
          </div>
          <div className="font-tabular text-2xl font-bold text-slate-100 mt-2">
            {formatDigits(streakInfo.currentStreak, lang)} {t.daysUnit}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {streakInfo.currentStreak === 0
              ? t.gentleRestartHint
              : `${t.bestPrefix} ${formatDigits(streakInfo.longestStreak, lang)} ${t.daysUnit}`}
          </div>
        </div>

        <div className="rounded-2xl bg-[#121824] border border-white/[0.07] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t.todaysCompletion}</span>
            <Sparkles className="w-4 h-4 text-emerald-400" aria-hidden="true" />
          </div>
          <div className="font-tabular text-2xl font-bold text-slate-100 mt-2">
            {formatDigits(todaySummary.completionPct, lang)}%
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {todaySummary.bonusAwarded ? t.bonusActive : t.bonusHint}
          </div>
        </div>

        <div className="rounded-2xl bg-[#121824] border border-white/[0.07] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t.weeklyAvg}</span>
            <TrendingUp className="w-4 h-4 text-sky-400" aria-hidden="true" />
          </div>
          <div className="font-tabular text-2xl font-bold text-slate-100 mt-2">
            {formatDigits(analytics.avgCompletionPct, lang)}%
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {formatDigits(streakInfo.totalActiveDays, lang)} {t.totalActiveDays}
          </div>
        </div>

        <div className="rounded-2xl bg-[#121824] border border-white/[0.07] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t.unlockedBadges}</span>
            <Award className="w-4 h-4 text-amber-400" aria-hidden="true" />
          </div>
          <div className="font-tabular text-2xl font-bold text-slate-100 mt-2">
            {formatDigits(unlockedAchievements.length, lang)} /{' '}
            {formatDigits(achievements.length, lang)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {t.fromBadges} +{formatDigits(xpTotals.achievementXp, lang)} XP
          </div>
        </div>
      </section>

      {/* Main Split: Daily Quests Preview + Weekly/Monthly Progress Chart */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <section className="xl:col-span-7 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-slate-100">
                {t.todaysFeaturedQuests}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">{t.featuredQuestsSub}</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('quests')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold whitespace-nowrap transition-colors"
            >
              <span>{t.viewAllQuests}</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {featuredQuests.map((activity) => (
              <QuestCard
                key={activity.id}
                activity={activity}
                entry={todayEntries[activity.id]}
                lang={lang}
                customCategories={customCategories}
                onChange={(nextEntry) =>
                  onUpdateEntry(todayKey, activity.id, nextEntry)
                }
                compact
              />
            ))}
          </div>
        </section>

        <div className="xl:col-span-5 space-y-6">
          <section className="rounded-2xl bg-[#121824] border border-white/[0.07] p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="font-display text-base sm:text-lg font-semibold text-slate-100">
                {t.progressChart}
              </h2>
              <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0B0F17] border border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setChartRange('weekly')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    chartRange === 'weekly'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t.weekly}
                </button>
                <button
                  type="button"
                  onClick={() => setChartRange('monthly')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    chartRange === 'monthly'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t.monthly}
                </button>
              </div>
            </div>
            <ProgressBarChart
              series={analytics.series}
              metric="completionPct"
              lang={lang}
            />
          </section>

          <section className="rounded-2xl bg-[#121824] border border-white/[0.07] p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-base sm:text-lg font-semibold text-slate-100">
                {t.recentAndAchievements}
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('achievements')}
                className="text-xs text-amber-400 hover:text-amber-300 font-medium whitespace-nowrap"
              >
                {t.viewAllBadges}
              </button>
            </div>

            {unlockedAchievements.length > 0 && (
              <div className="pb-3 mb-3 border-b border-white/[0.06] space-y-2">
                {unlockedAchievements.slice(0, 2).map((badge) => (
                  <div
                    key={badge.id}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Award className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                      <span className="text-slate-200 font-medium truncate">
                        {badge.title}
                      </span>
                    </div>
                    <span className="font-tabular text-amber-400 shrink-0">
                      +{formatDigits(badge.xpBonus, lang)} XP
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2.5">
              {recentLogs.length === 0 ? (
                <p className="text-xs text-slate-400">{t.noRecentLogs}</p>
              ) : (
                recentLogs.map((log) => (
                  <div
                    key={log.dateKey}
                    className="flex items-center justify-between text-xs py-1 border-b last:border-b-0 border-white/[0.04]"
                  >
                    <span className="text-slate-300">
                      {formatLocalizedDate(log.dateKey, lang, false)}
                    </span>
                    <div className="flex items-center gap-2 font-tabular">
                      <span className="text-emerald-400">
                        {formatDigits(log.completionPct, lang)}%
                      </span>
                      <span className="text-slate-600" aria-hidden="true">·</span>
                      <span className="text-amber-400">
                        +{formatDigits(log.totalXpEarned, lang)} XP
                      </span>
                    </div>
                  </div>
                ))
              )}
              {allSortedLogs.length > recentCount && (
                <button
                  type="button"
                  onClick={() => setRecentCount((c) => c + 10)}
                  className="w-full min-h-[36px] mt-2 rounded-xl bg-[#0B0F17] border border-white/[0.08] hover:border-amber-400/40 text-xs font-medium text-amber-300 transition-colors"
                >
                  {t.loadMoreBtn}
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
