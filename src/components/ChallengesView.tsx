import React, { useState } from 'react';
import { Award, Check, Copy, Flag, Plus, RefreshCw, Users } from 'lucide-react';
import {
  AchievementItem,
  ChallengeParticipant,
  CommunityChallenge,
  CustomCategoryDef,
  Language,
} from '../types/quest';
import { formatDigits } from '../utils/dhakaTime';
import { getLocalizedCategoryLabel, UI_COPY } from '../utils/i18n';
import { NEVER_SHARE_CATEGORIES } from '../utils/privacy';

interface ChallengesViewProps {
  currentUid: string;
  lang: Language;
  displayName: string;
  level: number;
  totalXp: number;
  challenges: CommunityChallenge[];
  challengeParticipants: Record<string, ChallengeParticipant[]>;
  achievements: AchievementItem[];
  customCategories: CustomCategoryDef[];
  onJoinOrSync: (challenge: CommunityChallenge) => Promise<void>;
  onLeave: (challengeId: string) => Promise<void>;
  onCreateChallenge: (input: {
    title: string;
    description: string;
    category: string;
    targetValue: number;
    unitLabel: string;
    durationDays: number;
  }) => Promise<void>;
  onShowToast: (msg: string) => void;
}

export const ChallengesView: React.FC<ChallengesViewProps> = ({
  currentUid,
  lang,
  displayName,
  level,
  totalXp,
  challenges,
  challengeParticipants,
  achievements,
  customCategories,
  onJoinOrSync,
  onLeave,
  onCreateChallenge,
  onShowToast,
}) => {
  const t = UI_COPY[lang];
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('learning');
  const [targetValue, setTargetValue] = useState(300);
  const [unitLabel, setUnitLabel] = useState('min');
  const [durationDays, setDurationDays] = useState(7);

  const safeCategories = [
    'learning',
    'focus',
    'personal',
    'career',
    'creative',
    ...customCategories
      .filter((c) => !c.isSpiritual && !NEVER_SHARE_CATEGORIES.has(c.id))
      .map((c) => c.id),
  ];

  // Filter strictly to non-spiritual unlocked achievements for safe sharing
  const shareableBadges = achievements.filter((a) => a.unlocked && !a.isSpiritual);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await onCreateChallenge({
      title,
      description,
      category,
      targetValue,
      unitLabel,
      durationDays,
    });
    setTitle('');
    setDescription('');
  };

  const handleCopyShareCard = async () => {
    const badgeLine =
      shareableBadges.length > 0
        ? shareableBadges
            .map((b) => `• ${b.title} (+${formatDigits(b.xpBonus, lang)} XP)`)
            .join('\n')
        : t.shareSummaryNoBadges;
    const summaryText = `${t.shareSummaryHeading} — ${displayName}\n${t.level} ${formatDigits(level, lang)} · ${formatDigits(totalXp, lang)} XP\n${t.shareSummaryBadgesLabel}\n${badgeLine}\n${t.brandTagline}`;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(summaryText);
      } else {
        const el = document.createElement('textarea');
        el.value = summaryText;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      onShowToast(t.toastCopiedShare);
    } catch {
      onShowToast(t.toastCopiedShare);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-100">{t.challengesTitle}</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">{t.challengesSubtitle}</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Challenges List */}
        <section className="xl:col-span-7 space-y-4">
          {challenges.map((ch) => {
            const parts = challengeParticipants[ch.id] ?? [];
            const myPart = parts.find((p) => p.uid === currentUid);
            const myPct = myPart
              ? Math.min(100, Math.round((myPart.progressValue / Math.max(1, ch.targetValue)) * 100))
              : 0;

            return (
              <div
                key={ch.id}
                className="rounded-2xl bg-[#121824] border border-white/[0.08] p-5 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>{getLocalizedCategoryLabel(ch.category, lang, customCategories)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-tabular">
                        {formatDigits(ch.durationDays, lang)} {t.daysUnit}
                      </span>
                      {myPart && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-emerald-400 font-medium inline-flex items-center gap-1">
                            <Check className="w-3 h-3" aria-hidden="true" />
                            {t.joinedBadge}
                          </span>
                        </>
                      )}
                    </div>
                    <h2 className="font-display text-lg font-bold text-slate-100 mt-1">
                      {ch.title}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1">{ch.description}</p>
                  </div>

                  <div className="text-left sm:text-right shrink-0">
                    <div className="font-tabular text-sm font-bold text-amber-400">
                      {formatDigits(ch.targetValue, lang)} {ch.unitLabel}
                    </div>
                    <div className="text-xs text-slate-400 inline-flex items-center gap-1 mt-0.5">
                      <Users className="w-3.5 h-3.5" aria-hidden="true" />
                      <span className="font-tabular">
                        {formatDigits(parts.length, lang)} {t.participantsLabel}
                      </span>
                    </div>
                  </div>
                </div>

                {myPart && (
                  <div className="pt-1">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-300">
                        {t.youLabel}: {formatDigits(myPart.progressValue, lang)} /{' '}
                        {formatDigits(ch.targetValue, lang)} {ch.unitLabel}
                      </span>
                      <span className="font-tabular text-emerald-400 font-semibold">
                        {formatDigits(myPct, lang)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[#0B0F17] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-400"
                        style={{ width: `${myPct}%` }}
                      />
                    </div>
                  </div>
                )}

                {parts.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
                    {parts.slice(0, 4).map((p) => (
                      <div
                        key={p.uid}
                        className="flex items-center justify-between text-xs text-slate-300"
                      >
                        <span className="truncate">{p.displayLabel}</span>
                        <span className="font-tabular text-slate-400">
                          {formatDigits(p.progressValue, lang)} /{' '}
                          {formatDigits(ch.targetValue, lang)} {ch.unitLabel}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  {myPart ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onJoinOrSync(ch)}
                        className="min-h-[40px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{t.syncProgressBtn}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onLeave(ch.id)}
                        className="min-h-[40px] px-4 rounded-xl bg-[#1A2233] text-slate-300 hover:text-rose-300 text-xs font-medium"
                      >
                        {t.leaveChallengeBtn}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onJoinOrSync(ch)}
                      className="min-h-[40px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5"
                    >
                      <Flag className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{t.joinChallengeBtn}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        {/* Right Column: Create Challenge + Share Non-Spiritual Achievements */}
        <div className="xl:col-span-5 space-y-6">
          <section className="rounded-2xl bg-[#121824] border border-white/[0.08] p-5">
            <h2 className="font-display text-lg font-semibold text-slate-100 mb-4">
              {t.createChallengeHeading}
            </h2>
            <form onSubmit={handleCreate} className="space-y-3.5">
              <div>
                <label htmlFor="ch-title" className="block text-xs text-slate-300 mb-1">
                  {t.challengeTitleLabel}
                </label>
                <input
                  id="ch-title"
                  type="text"
                  maxLength={100}
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label htmlFor="ch-desc" className="block text-xs text-slate-300 mb-1">
                  {t.challengeDescLabel}
                </label>
                <input
                  id="ch-desc"
                  type="text"
                  maxLength={300}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="ch-cat" className="block text-xs text-slate-300 mb-1">
                    {t.categoryLabel}
                  </label>
                  <select
                    id="ch-cat"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full min-h-[42px] px-2.5 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-xs text-slate-100"
                  >
                    {safeCategories.map((c) => (
                      <option key={c} value={c}>
                        {getLocalizedCategoryLabel(c, lang, customCategories)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="ch-days" className="block text-xs text-slate-300 mb-1">
                    {t.challengeDaysLabel}
                  </label>
                  <input
                    id="ch-days"
                    type="number"
                    min={1}
                    max={365}
                    value={durationDays}
                    onChange={(e) => setDurationDays(Number(e.target.value) || 7)}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0F17] border border-white/[0.1] font-tabular text-sm text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="ch-target" className="block text-xs text-slate-300 mb-1">
                    {t.challengeTargetLabel}
                  </label>
                  <input
                    id="ch-target"
                    type="number"
                    min={1}
                    max={1000000}
                    value={targetValue}
                    onChange={(e) => setTargetValue(Number(e.target.value) || 1)}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0F17] border border-white/[0.1] font-tabular text-sm text-slate-100"
                  />
                </div>

                <div>
                  <label htmlFor="ch-unit" className="block text-xs text-slate-300 mb-1">
                    {t.unitLabel}
                  </label>
                  <input
                    id="ch-unit"
                    type="text"
                    maxLength={30}
                    value={unitLabel}
                    onChange={(e) => setUnitLabel(e.target.value)}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-sm text-slate-100"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full min-h-[44px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold inline-flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>{t.createChallengeBtn}</span>
              </button>
            </form>
          </section>

          {/* Share Unlocked Achievements */}
          <section className="rounded-2xl bg-[#121824] border border-white/[0.08] p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold text-slate-100">
                  {t.shareBadgeTitle}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">{t.shareBadgeSub}</p>
              </div>
              <button
                type="button"
                onClick={handleCopyShareCard}
                className="min-h-[38px] px-3 rounded-xl bg-[#1A2233] border border-white/[0.08] hover:border-amber-400/40 text-xs font-semibold text-amber-300 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t.copySummaryBtn}</span>
              </button>
            </div>

            <div className="space-y-2">
              {shareableBadges.map((b) => (
                <div
                  key={b.id}
                  className="p-2.5 rounded-xl bg-[#0B0F17] border border-amber-500/20 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Award className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                    <span className="text-slate-100 font-medium truncate">{b.title}</span>
                  </div>
                  <span className="font-tabular text-amber-400 shrink-0">
                    +{formatDigits(b.xpBonus, lang)} XP
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
