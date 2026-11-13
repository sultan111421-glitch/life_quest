import React, { useMemo, useState } from 'react';
import { Award, Check, Edit2, Flame, Lock, Plus, Shield, Trash2 } from 'lucide-react';
import {
  AchievementItem,
  ActivityDefinition,
  DailyLog,
  Language,
  NavPage,
  PersonalGoalItem,
  UserProfileData,
} from '../types/quest';
import { AVATAR_PRESETS } from '../utils/defaults';
import { formatDigits, getLastNDaysKeys } from '../utils/dhakaTime';
import {
  calculateActivityPeriodProgress,
  calculateActivityProgress,
  calculateAnalytics,
} from '../utils/gamification';
import {
  getLocalizedActivityTitle,
  getLocalizedDisplayName,
  getLocalizedUnitLabel,
  UI_COPY,
} from '../utils/i18n';
import { AvatarBadge } from './AvatarBadge';
import { ProgressBarChart } from './charts/QuestCharts';

interface ProfileViewProps {
  profile: UserProfileData;
  visibleActivities: ActivityDefinition[];
  dailyLogs: Record<string, DailyLog>;
  todayKey: string;
  lang: Language;
  xpTotals: { totalXp: number; achievementXp: number };
  levelInfo: { level: number; rankTitle: string };
  streakInfo: { currentStreak: number; longestStreak: number };
  achievements: AchievementItem[];
  onSaveProfile: (updates: {
    displayName: string;
    username: string;
    bio: string;
    avatarId: string;
    personalGoals: PersonalGoalItem[];
  }) => Promise<boolean>;
  onNavigate: (page: NavPage) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  profile,
  visibleActivities,
  dailyLogs,
  todayKey,
  lang,
  xpTotals,
  levelInfo,
  streakInfo,
  achievements,
  onSaveProfile,
  onNavigate,
}) => {
  const t = UI_COPY[lang];
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [username, setUsername] = useState(profile.username || 'adventurer_01');
  const [bio, setBio] = useState(profile.bio || '');
  const [avatarId, setAvatarId] = useState(profile.avatarId || 'crest');
  const [newGoalTitle, setNewGoalTitle] = useState('');

  const personalGoals = profile.personalGoals ?? [];
  const unlockedBadges = achievements.filter((a) => a.unlocked);

  const completedQuestsCount = useMemo(() => {
    let count = 0;
    for (const log of Object.values(dailyLogs)) {
      for (const act of visibleActivities) {
        if (calculateActivityProgress(act, log.entries?.[act.id], lang).completed) {
          count += 1;
        }
      }
    }
    return count;
  }, [dailyLogs, lang, visibleActivities]);

  const weeklyPct = useMemo(() => {
    const keys = getLastNDaysKeys(todayKey, 7);
    const logs = keys.map((k) => dailyLogs[k]).filter(Boolean);
    if (logs.length === 0) return 0;
    return Math.round(logs.reduce((s, l) => s + l.completionPct, 0) / logs.length);
  }, [dailyLogs, todayKey]);

  const monthlyPct = useMemo(() => {
    const keys = getLastNDaysKeys(todayKey, 30);
    const logs = keys.map((k) => dailyLogs[k]).filter(Boolean);
    if (logs.length === 0) return 0;
    return Math.round(logs.reduce((s, l) => s + l.completionPct, 0) / logs.length);
  }, [dailyLogs, todayKey]);

  const historyAnalytics = useMemo(
    () =>
      calculateAnalytics(
        dailyLogs,
        visibleActivities,
        todayKey,
        14,
        Boolean(profile.religionTrackingEnabled),
        profile.customCategories
      ),
    [dailyLogs, profile.customCategories, profile.religionTrackingEnabled, todayKey, visibleActivities]
  );

  const handleSubmitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await onSaveProfile({
      displayName,
      username,
      bio,
      avatarId,
      personalGoals,
    });
    if (ok) {
      setEditing(false);
    }
  };

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newGoalTitle.trim().slice(0, 120);
    if (!clean) return;
    const nextGoals: PersonalGoalItem[] = [
      ...personalGoals,
      { id: `pg_${Date.now()}`, title: clean, completed: false },
    ];
    await onSaveProfile({
      displayName: profile.displayName,
      username: profile.username || 'adventurer_01',
      bio: profile.bio || '',
      avatarId: profile.avatarId || 'crest',
      personalGoals: nextGoals,
    });
    setNewGoalTitle('');
  };

  const handleToggleGoal = async (goalId: string) => {
    const nextGoals = personalGoals.map((g) =>
      g.id === goalId ? { ...g, completed: !g.completed } : g
    );
    await onSaveProfile({
      displayName: profile.displayName,
      username: profile.username || 'adventurer_01',
      bio: profile.bio || '',
      avatarId: profile.avatarId || 'crest',
      personalGoals: nextGoals,
    });
  };

  const handleDeleteGoal = async (goalId: string) => {
    const nextGoals = personalGoals.filter((g) => g.id !== goalId);
    await onSaveProfile({
      displayName: profile.displayName,
      username: profile.username || 'adventurer_01',
      bio: profile.bio || '',
      avatarId: profile.avatarId || 'crest',
      personalGoals: nextGoals,
    });
  };

  const visibilityLabel =
    t.visibilityOptions[profile.privacy?.visibility ?? 'private'].title;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-100">{t.profileTitle}</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">{t.profileSubtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('privacy')}
            className="min-h-[42px] px-3.5 rounded-xl bg-[#1A2233] border border-white/[0.08] hover:border-emerald-400/40 text-xs font-semibold text-emerald-300 inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Shield className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t.managePrivacyLink}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setDisplayName(profile.displayName);
              setUsername(profile.username || 'adventurer_01');
              setBio(profile.bio || '');
              setAvatarId(profile.avatarId || 'crest');
              setEditing((v) => !v);
            }}
            className="min-h-[42px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{editing ? t.cancel : t.editProfileBtn}</span>
          </button>
        </div>
      </div>

      {/* Identity Card */}
      <section className="rounded-2xl bg-[#121824] border border-white/[0.08] p-5 sm:p-6">
        {editing ? (
          <form onSubmit={handleSubmitProfile} className="space-y-4">
            <div>
              <div className="text-xs text-slate-300 mb-2">{t.chooseAvatarLabel}</div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                {AVATAR_PRESETS.map((preset) => {
                  const selected = avatarId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setAvatarId(preset.id)}
                      className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition-colors ${
                        selected
                          ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                          : 'bg-[#0B0F17] border-white/[0.07] text-slate-400 hover:text-white'
                      }`}
                    >
                      <AvatarBadge avatarId={preset.id} size="sm" />
                      <span className="text-[11px] font-medium truncate w-full text-center">
                        {lang === 'bn' ? preset.labelBn : preset.labelEn}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="profile-display-name" className="block text-xs text-slate-300 mb-1.5">
                  {t.yourNameLabel}
                </label>
                <input
                  id="profile-display-name"
                  type="text"
                  maxLength={100}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label htmlFor="profile-username" className="block text-xs text-slate-300 mb-1.5">
                  {t.usernameLabel}
                </label>
                <input
                  id="profile-username"
                  type="text"
                  maxLength={24}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#0B0F17] border border-white/[0.1] font-mono text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                />
                <p className="text-[11px] text-slate-500 mt-1">{t.usernameHint}</p>
              </div>
            </div>

            <div>
              <label htmlFor="profile-bio" className="block text-xs text-slate-300 mb-1.5">
                {t.bioLabel}
              </label>
              <textarea
                id="profile-bio"
                rows={2}
                maxLength={240}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder={t.bioPlaceholder}
                className="w-full rounded-xl bg-[#0B0F17] border border-white/[0.1] p-3 text-sm text-slate-100 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="min-h-[42px] px-4 rounded-xl bg-[#1A2233] text-xs font-medium text-slate-200"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                className="min-h-[42px] px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold"
              >
                {t.saveProfileBtn}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex items-start sm:items-center gap-4">
              <AvatarBadge avatarId={profile.avatarId} size="lg" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-100">
                    {getLocalizedDisplayName(profile.displayName, lang)}
                  </h2>
                  <span className="font-mono text-xs text-slate-400">
                    @{profile.username || 'adventurer_01'}
                  </span>
                </div>
                <div className="text-sm text-amber-400 font-medium mt-1">
                  {t.level} {formatDigits(levelInfo.level, lang)} · {levelInfo.rankTitle}
                </div>
                <p className="text-xs sm:text-sm text-slate-300 mt-1.5 max-w-2xl">
                  {profile.bio || t.bioPlaceholder}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start md:items-end gap-1.5 text-xs shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-white/[0.06]">
              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                {visibilityLabel}
              </span>
              <span className="font-tabular text-slate-400">
                {t.weeklyCol}: {formatDigits(weeklyPct, lang)}% · {t.monthlyCol}:{' '}
                {formatDigits(monthlyPct, lang)}%
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl bg-[#121824] border border-white/[0.07] p-4">
          <div className="text-xs text-slate-400">{t.xpCol}</div>
          <div className="font-tabular text-2xl font-bold text-amber-400 mt-1.5">
            {formatDigits(xpTotals.totalXp, lang)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {t.level} {formatDigits(levelInfo.level, lang)}
          </div>
        </div>
        <div className="rounded-2xl bg-[#121824] border border-white/[0.07] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t.currentStreak}</span>
            <Flame className="w-4 h-4 text-amber-400" aria-hidden="true" />
          </div>
          <div className="font-tabular text-2xl font-bold text-slate-100 mt-1.5">
            {formatDigits(streakInfo.currentStreak, lang)} {t.daysUnit}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {t.bestPrefix} {formatDigits(streakInfo.longestStreak, lang)} {t.daysUnit}
          </div>
        </div>
        <div className="rounded-2xl bg-[#121824] border border-white/[0.07] p-4">
          <div className="text-xs text-slate-400">{t.completedQuestsTotal}</div>
          <div className="font-tabular text-2xl font-bold text-emerald-400 mt-1.5">
            {formatDigits(completedQuestsCount, lang)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {formatDigits(visibleActivities.filter((a) => a.isActive).length, lang)} {t.activeSuffix}
          </div>
        </div>
        <div className="rounded-2xl bg-[#121824] border border-white/[0.07] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t.unlockedBadges}</span>
            <Award className="w-4 h-4 text-amber-400" aria-hidden="true" />
          </div>
          <div className="font-tabular text-2xl font-bold text-slate-100 mt-1.5">
            {formatDigits(unlockedBadges.length, lang)} / {formatDigits(achievements.length, lang)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            +{formatDigits(xpTotals.achievementXp, lang)} XP
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Personal Milestones & Goals */}
        <section className="xl:col-span-5 rounded-2xl bg-[#121824] border border-white/[0.08] p-5 space-y-4">
          <h2 className="font-display text-lg font-semibold text-slate-100">
            {t.personalGoalsTitle}
          </h2>

          <form onSubmit={handleAddGoal} className="flex gap-2">
            <input
              type="text"
              maxLength={120}
              value={newGoalTitle}
              onChange={(e) => setNewGoalTitle(e.target.value)}
              placeholder={t.addPersonalGoalPlaceholder}
              className="flex-1 min-h-[42px] px-3 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              className="min-h-[42px] px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t.addPersonalGoalBtn}</span>
            </button>
          </form>

          <div className="divide-y divide-white/[0.05]">
            {personalGoals.map((goal) => (
              <div
                key={goal.id}
                className="py-2.5 flex items-center justify-between gap-2 text-sm"
              >
                <button
                  type="button"
                  onClick={() => handleToggleGoal(goal.id)}
                  className="flex items-center gap-2.5 text-left min-w-0 flex-1"
                >
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      goal.completed
                        ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                        : 'border-slate-500'
                    }`}
                  >
                    {goal.completed && <Check className="w-3 h-3 stroke-[3]" />}
                  </span>
                  <span
                    className={`truncate ${
                      goal.completed ? 'line-through text-slate-500' : 'text-slate-200'
                    }`}
                  >
                    {goal.title}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={t.deleteAria}
                  onClick={() => handleDeleteGoal(goal.id)}
                  className="text-slate-500 hover:text-rose-400 p-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Activity-Wise Weekly & Monthly Targets Progress */}
        <section className="xl:col-span-7 rounded-2xl bg-[#121824] border border-white/[0.08] p-5 space-y-4">
          <h2 className="font-display text-lg font-semibold text-slate-100">
            {t.activityProgressOverview}
          </h2>
          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
            {visibleActivities
              .filter((a) => a.isActive)
              .map((act) => {
                const wk = calculateActivityPeriodProgress(act, dailyLogs, todayKey, 7);
                const mo = calculateActivityPeriodProgress(act, dailyLogs, todayKey, 30);
                const unit = getLocalizedUnitLabel(act.unitLabel, lang);
                return (
                  <div
                    key={act.id}
                    className="p-3 rounded-xl bg-[#0B0F17] border border-white/[0.06] space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs sm:text-sm">
                      <span className="font-medium text-slate-100 truncate">
                        {getLocalizedActivityTitle(act, lang)}
                      </span>
                      <span className="font-tabular text-xs text-amber-400 shrink-0">
                        {t.weeklyProgressShort}: {formatDigits(wk.accumulated, lang)}/
                        {formatDigits(wk.target, lang)} {unit} ({formatDigits(wk.pct, lang)}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-500"
                        style={{ width: `${wk.pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-tabular">
                      <span>
                        {t.monthlyProgressShort}: {formatDigits(mo.accumulated, lang)} /{' '}
                        {formatDigits(mo.target, lang)} {unit}
                      </span>
                      <span className="text-emerald-400">{formatDigits(mo.pct, lang)}%</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      </div>

      {/* Historical Performance Chart */}
      <section className="rounded-2xl bg-[#121824] border border-white/[0.08] p-5">
        <h2 className="font-display text-lg font-semibold text-slate-100 mb-3">
          {t.performanceHistoryChart}
        </h2>
        <ProgressBarChart
          series={historyAnalytics.series}
          metric="completionPct"
          lang={lang}
        />
      </section>
    </div>
  );
};
