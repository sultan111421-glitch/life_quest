import React, { useMemo, useState } from 'react';
import { EyeOff, Shield, Trophy } from 'lucide-react';
import {
  CustomCategoryDef,
  FriendEdgeItem,
  Language,
  LeaderboardEntry,
  PrivacySettings,
} from '../types/quest';
import { formatDigits } from '../utils/dhakaTime';
import { getLocalizedCategoryLabel, UI_COPY } from '../utils/i18n';
import { NEVER_SHARE_CATEGORIES } from '../utils/privacy';
import { AvatarBadge } from './AvatarBadge';

interface LeaderboardsViewProps {
  currentUid: string;
  lang: Language;
  privacy: PrivacySettings;
  entries: LeaderboardEntry[];
  friends: FriendEdgeItem[];
  customCategories: CustomCategoryDef[];
  onUpdatePrivacy: (nextPrivacy: PrivacySettings) => Promise<void>;
}

type BoardTab = 'global' | 'friends' | 'weekly' | 'monthly' | 'category';

export const LeaderboardsView: React.FC<LeaderboardsViewProps> = ({
  currentUid,
  lang,
  privacy,
  entries,
  friends,
  customCategories,
  onUpdatePrivacy,
}) => {
  const t = UI_COPY[lang];
  const [tab, setTab] = useState<BoardTab>('global');
  const [selectedCategory, setSelectedCategory] = useState<string>('learning');
  const [showOptInConfirm, setShowOptInConfirm] = useState(false);

  const safeCategories = useMemo(() => {
    const builtInSafe = ['learning', 'focus', 'personal', 'career', 'creative'];
    const customSafe = customCategories
      .filter((c) => !c.isSpiritual && !NEVER_SHARE_CATEGORIES.has(c.id))
      .map((c) => c.id);
    return [...builtInSafe, ...customSafe];
  }, [customCategories]);

  const friendUids = useMemo(
    () => new Set([currentUid, ...friends.map((f) => f.friendUid)]),
    [currentUid, friends]
  );

  const rankedEntries = useMemo(() => {
    let pool = [...entries];
    if (tab === 'friends') {
      pool = pool.filter((e) => friendUids.has(e.uid));
    }

    const getSortVal = (e: LeaderboardEntry) => {
      if (tab === 'weekly') return e.weeklyXp * 100 + e.weeklyCompletionPct;
      if (tab === 'monthly') return e.monthlyXp * 100 + e.monthlyCompletionPct;
      if (tab === 'category') return e.categoryScores[selectedCategory] ?? 0;
      return e.totalXp;
    };

    return pool.sort((a, b) => getSortVal(b) - getSortVal(a));
  }, [entries, friendUids, selectedCategory, tab]);

  const handleConfirmJoin = async () => {
    setShowOptInConfirm(false);
    await onUpdatePrivacy({
      ...privacy,
      leaderboardOptIn: true,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-100">
          {t.leaderboardsTitle}
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">{t.leaderboardsSubtitle}</p>
      </div>

      {/* Participation Control Banner */}
      {!privacy.leaderboardOptIn ? (
        <section className="rounded-2xl bg-[#121824] border border-amber-500/30 p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-display text-base sm:text-lg font-bold text-slate-100">
                  {t.leaderboardOffBannerTitle}
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  {t.leaderboardOffBannerDesc}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowOptInConfirm(true)}
              className="min-h-[44px] px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold whitespace-nowrap shrink-0"
            >
              {t.leaderboardOptInBtn}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-white/[0.06] text-xs text-slate-300">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={privacy.leaderboardAnonymous}
                onChange={(e) =>
                  onUpdatePrivacy({
                    ...privacy,
                    leaderboardAnonymous: e.target.checked,
                  })
                }
                className="w-4 h-4 accent-amber-500 rounded"
              />
              <span>{t.leaderboardAnonymousToggle}</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={privacy.shareXpOnLeaderboard}
                onChange={(e) =>
                  onUpdatePrivacy({
                    ...privacy,
                    shareXpOnLeaderboard: e.target.checked,
                  })
                }
                className="w-4 h-4 accent-amber-500 rounded"
              />
              <span>{t.leaderboardShareXp}</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={privacy.shareStreakOnLeaderboard}
                onChange={(e) =>
                  onUpdatePrivacy({
                    ...privacy,
                    shareStreakOnLeaderboard: e.target.checked,
                  })
                }
                className="w-4 h-4 accent-amber-500 rounded"
              />
              <span>{t.leaderboardShareStreak}</span>
            </label>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl bg-[#121824] border border-emerald-500/30 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm">
            <label className="inline-flex items-center gap-2 cursor-pointer text-slate-200">
              <input
                type="checkbox"
                checked={privacy.leaderboardAnonymous}
                onChange={(e) =>
                  onUpdatePrivacy({
                    ...privacy,
                    leaderboardAnonymous: e.target.checked,
                  })
                }
                className="w-4 h-4 accent-amber-500 rounded"
              />
              <EyeOff className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
              <span>{t.leaderboardAnonymousToggle}</span>
            </label>
          </div>

          <button
            type="button"
            onClick={() =>
              onUpdatePrivacy({
                ...privacy,
                leaderboardOptIn: false,
              })
            }
            className="min-h-[40px] px-4 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs font-semibold whitespace-nowrap shrink-0"
          >
            {t.leaderboardOptOutBtn}
          </button>
        </section>
      )}

      {/* Tabs & Category Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#121824] border border-white/[0.08] self-start">
          {(['global', 'friends', 'weekly', 'monthly', 'category'] as const).map((tabId) => (
            <button
              key={tabId}
              type="button"
              onClick={() => setTab(tabId)}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                tab === tabId
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {t.leaderboardTabs[tabId]}
            </button>
          ))}
        </div>

        {tab === 'category' && (
          <select
            aria-label={t.categoryLabel}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="min-h-[42px] px-3.5 rounded-xl bg-[#121824] border border-white/[0.1] text-xs font-medium text-slate-100 focus:outline-none focus:border-amber-400 self-start sm:self-auto"
          >
            {safeCategories.map((cat) => (
              <option key={cat} value={cat}>
                {getLocalizedCategoryLabel(cat, lang, customCategories)}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Leaderboard Table */}
      <section className="rounded-2xl bg-[#121824] border border-white/[0.08] p-5 overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[580px]">
          <thead>
            <tr className="border-b border-white/[0.08] text-xs text-slate-400">
              <th className="py-2.5 pr-3 font-medium">{t.rankCol}</th>
              <th className="py-2.5 px-3 font-medium">{t.adventurerCol}</th>
              <th className="py-2.5 px-3 font-medium text-right">{t.levelCol}</th>
              <th className="py-2.5 px-3 font-medium text-right">
                {tab === 'category'
                  ? getLocalizedCategoryLabel(selectedCategory, lang, customCategories)
                  : tab === 'weekly'
                    ? t.weeklyCol
                    : tab === 'monthly'
                      ? t.monthlyCol
                      : t.xpCol}
              </th>
              <th className="py-2.5 px-3 font-medium text-right">{t.streakCol}</th>
              <th className="py-2.5 pl-3 font-medium text-right">{t.weeklyCol}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05] text-sm">
            {rankedEntries.map((entry, idx) => {
              const isSelf = entry.uid === currentUid;
              const primaryMetric =
                tab === 'weekly'
                  ? `${formatDigits(entry.weeklyXp, lang)} XP`
                  : tab === 'monthly'
                    ? `${formatDigits(entry.monthlyXp, lang)} XP`
                    : tab === 'category'
                      ? `${formatDigits(entry.categoryScores[selectedCategory] ?? 0, lang)} XP`
                      : `${formatDigits(entry.totalXp, lang)} XP`;

              return (
                <tr
                  key={entry.uid}
                  className={isSelf ? 'bg-amber-500/10' : 'hover:bg-white/[0.02]'}
                >
                  <td className="py-3 pr-3 font-tabular font-bold text-slate-300">
                    {idx === 0 ? (
                      <span className="inline-flex items-center gap-1 text-amber-400">
                        <Trophy className="w-4 h-4" aria-hidden="true" />
                        {formatDigits(1, lang)}
                      </span>
                    ) : (
                      `#${formatDigits(idx + 1, lang)}`
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2.5">
                      <AvatarBadge avatarId={entry.avatarId} size="sm" />
                      <div className="min-w-0">
                        <div className="font-medium text-slate-100 truncate">
                          {entry.displayLabel} {isSelf ? `(${t.youLabel})` : ''}
                        </div>
                        {entry.anonymous && (
                          <div className="text-[11px] text-slate-400">{t.anonymousTag}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-tabular text-slate-300">
                    {formatDigits(entry.level, lang)}
                  </td>
                  <td className="py-3 px-3 text-right font-tabular font-semibold text-amber-400">
                    {primaryMetric}
                  </td>
                  <td className="py-3 px-3 text-right font-tabular text-slate-300">
                    {formatDigits(entry.currentStreak, lang)} {t.daysUnit}
                  </td>
                  <td className="py-3 pl-3 text-right font-tabular text-emerald-400">
                    {formatDigits(entry.weeklyCompletionPct, lang)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Explicit Confirmation Modal before Opting Into Leaderboard */}
      {showOptInConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="lb-confirm-title"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="max-w-md w-full rounded-2xl bg-[#121824] border border-white/[0.12] p-6 space-y-4">
            <h3 id="lb-confirm-title" className="font-display text-lg font-bold text-slate-100">
              {t.leaderboardConfirmTitle}
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">{t.leaderboardConfirmBody}</p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowOptInConfirm(false)}
                className="min-h-[42px] px-4 rounded-xl bg-[#1A2233] text-xs font-medium text-slate-200"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleConfirmJoin}
                className="min-h-[42px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold"
              >
                {t.confirmJoinBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
