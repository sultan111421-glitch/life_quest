import React, { useState } from 'react';
import { Award, CheckCircle2, Lock } from 'lucide-react';
import { AchievementItem, Language } from '../types/quest';
import { formatDigits } from '../utils/dhakaTime';
import { UI_COPY } from '../utils/i18n';

interface AchievementsViewProps {
  achievements: AchievementItem[];
  totalAchievementXp: number;
  lang: Language;
}

export const AchievementsView: React.FC<AchievementsViewProps> = ({
  achievements,
  totalAchievementXp,
  lang,
}) => {
  const t = UI_COPY[lang];
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const filtered = achievements.filter((a) => {
    if (filter === 'unlocked') return a.unlocked;
    if (filter === 'locked') return !a.unlocked;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-100">
            {t.achievementsTitle}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5 font-tabular">
            {t.unlockedSummary} {formatDigits(unlockedCount, lang)} /{' '}
            {formatDigits(achievements.length, lang)} {t.badgesWord} · {t.bonusXpWord} +
            {formatDigits(totalAchievementXp, lang)}
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#121824] border border-white/[0.08] self-start">
          {(
            [
              ['all', t.filterAll],
              ['unlocked', t.filterUnlocked],
              ['locked', t.filterLocked],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                filter === key
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((item) => {
          const pct = Math.min(
            100,
            Math.round((item.progress / Math.max(1, item.target)) * 100)
          );
          return (
            <div
              key={item.id}
              className={`rounded-2xl border p-5 transition-colors ${
                item.unlocked
                  ? 'bg-[#131D2B] border-amber-500/40'
                  : 'bg-[#121824] border-white/[0.07]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                      item.unlocked
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-slate-800/80 text-slate-500'
                    }`}
                  >
                    {item.unlocked ? (
                      <Award className="w-5 h-5" aria-hidden="true" />
                    ) : (
                      <Lock className="w-5 h-5" aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] text-slate-400">
                      {item.category} · {t.tiers[item.tier]}
                    </div>
                    <h2 className="font-display text-base font-bold text-slate-100 truncate">
                      {item.title}
                    </h2>
                  </div>
                </div>

                <span className="font-tabular text-xs font-semibold text-amber-400 shrink-0">
                  +{formatDigits(item.xpBonus, lang)} XP
                </span>
              </div>

              <p className="text-xs text-slate-300 mt-3 leading-relaxed">
                {item.description}
              </p>

              <div className="mt-4">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-tabular text-slate-400">
                    {t.progressLabel}{' '}
                    {formatDigits(Math.min(item.progress, item.target), lang)} /{' '}
                    {formatDigits(item.target, lang)}
                  </span>
                  {item.unlocked ? (
                    <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      {t.unlockedBadgeStatus}
                    </span>
                  ) : (
                    <span className="font-tabular text-slate-400">
                      {formatDigits(pct, lang)}%
                    </span>
                  )}
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#0B0F17] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      item.unlocked ? 'bg-emerald-400' : 'bg-amber-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
