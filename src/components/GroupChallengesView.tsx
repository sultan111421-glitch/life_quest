import React, { useMemo, useState } from 'react';
import { Award, CheckCircle2, Flag, Plus, RefreshCw, Trophy, Users } from 'lucide-react';
import {
  ActivityDefinition,
  CustomCategoryDef,
  FriendGroup,
  GroupChallenge,
  GroupChallengeFrequency,
  GroupChallengeParticipant,
  GroupPrivacySettings,
  GroupRole,
  Language,
  NavPage,
} from '../types/quest';
import { formatDigits } from '../utils/dhakaTime';
import { isSpiritualActivity } from '../utils/gamification';
import { computeGroupChallengeAggregate } from '../utils/groupPrivacy';
import {
  getLocalizedActivityTitle,
  getLocalizedCategoryLabel,
  getLocalizedDisplayName,
  getLocalizedUnitLabel,
  UI_COPY,
} from '../utils/i18n';
import { NEVER_SHARE_CATEGORIES } from '../utils/privacy';
import { AvatarBadge } from './AvatarBadge';
import { GroupSubNav } from './GroupSubNav';

interface GroupChallengesViewProps {
  currentUid: string;
  lang: Language;
  groups: FriendGroup[];
  activeGroup: FriendGroup | null;
  myRole?: GroupRole;
  myPrivacy: GroupPrivacySettings;
  challenges: GroupChallenge[];
  challengeParticipants: Record<string, GroupChallengeParticipant[]>;
  visibleActivities: ActivityDefinition[];
  customCategories: CustomCategoryDef[];
  onSelectGroup: (groupId: string) => void;
  onNavigate: (page: NavPage) => void;
  onCreateChallenge: (
    groupId: string,
    input: {
      title: string;
      description: string;
      frequency: GroupChallengeFrequency;
      category: string;
      activityId?: string;
      targetValue: number;
      unitLabel: string;
      durationDays: number;
      xpReward: number;
      badgeTitle?: string;
    }
  ) => Promise<void>;
  onJoinOrSync: (
    groupId: string,
    challenge: GroupChallenge,
    manualValue?: number
  ) => Promise<void>;
  onLeave: (groupId: string, challengeId: string) => Promise<void>;
}

export const GroupChallengesView: React.FC<GroupChallengesViewProps> = ({
  currentUid,
  lang,
  groups,
  activeGroup,
  myRole,
  myPrivacy,
  challenges,
  challengeParticipants,
  visibleActivities,
  customCategories,
  onSelectGroup,
  onNavigate,
  onCreateChallenge,
  onJoinOrSync,
  onLeave,
}) => {
  const t = UI_COPY[lang];

  // Safe activities only (never expose spiritual/religious or health/sleep)
  const safeActivities = useMemo(
    () =>
      visibleActivities.filter(
        (a) => !NEVER_SHARE_CATEGORIES.has(a.category) && !isSpiritualActivity(a, customCategories)
      ),
    [customCategories, visibleActivities]
  );

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState<GroupChallengeFrequency>('weekly');
  const [sourceKey, setSourceKey] = useState<string>('custom');
  const [targetValue, setTargetValue] = useState(5);
  const [unitLabel, setUnitLabel] = useState(lang === 'bn' ? 'সেশন' : 'sessions');
  const [durationDays, setDurationDays] = useState(7);
  const [xpReward, setXpReward] = useState(120);
  const [badgeTitle, setBadgeTitle] = useState('');
  const [manualInputs, setManualInputs] = useState<Record<string, number>>({});

  if (!activeGroup) {
    return (
      <div className="rounded-2xl bg-[#121824] border border-white/[0.08] p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
          <Users className="w-6 h-6" aria-hidden="true" />
        </div>
        <h1 className="font-display text-xl font-bold text-slate-100">{t.noActiveGroupTitle}</h1>
        <p className="text-sm text-slate-400 max-w-md mx-auto">{t.noActiveGroupDesc}</p>
        <button
          type="button"
          onClick={() => onNavigate('groups')}
          className="min-h-[42px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-semibold whitespace-nowrap"
        >
          {t.backToMyGroupsBtn}
        </button>
      </div>
    );
  }

  const handleSourceChange = (nextKey: string) => {
    setSourceKey(nextKey);
    if (nextKey !== 'custom') {
      const act = safeActivities.find((a) => a.id === nextKey);
      if (act) {
        setUnitLabel(getLocalizedUnitLabel(act.unitLabel, lang));
      }
    }
  };

  const handleFrequencyChange = (nextFreq: GroupChallengeFrequency) => {
    setFrequency(nextFreq);
    if (nextFreq === 'daily') setDurationDays(1);
    else if (nextFreq === 'weekly') setDurationDays(7);
    else if (nextFreq === 'monthly') setDurationDays(30);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const matchedAct =
      sourceKey === 'custom' ? undefined : safeActivities.find((a) => a.id === sourceKey);
    await onCreateChallenge(activeGroup.id, {
      title,
      description,
      frequency,
      category: matchedAct ? matchedAct.category : 'custom',
      activityId: matchedAct ? matchedAct.id : 'custom',
      targetValue,
      unitLabel,
      durationDays,
      xpReward,
      badgeTitle: badgeTitle.trim() || undefined,
    });
    setTitle('');
    setDescription('');
    setBadgeTitle('');
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      <GroupSubNav
        lang={lang}
        activePage="groupChallenges"
        groups={groups}
        activeGroup={activeGroup}
        myRole={myRole}
        myPrivacy={myPrivacy}
        onSelectGroup={onSelectGroup}
        onNavigate={onNavigate}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-100">
            {t.groupChallengesTitle}
          </h1>
          <p className="mt-1 text-sm text-slate-400">{t.groupChallengesSubtitle}</p>
        </div>

        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="min-h-[42px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>{t.createGroupChallengeTitle}</span>
        </button>
      </div>

      {/* Create Challenge Form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-2xl bg-[#121824] border border-amber-500/30 p-5 sm:p-6 space-y-4"
        >
          <h2 className="font-display text-base font-bold text-slate-100">
            {t.createGroupChallengeTitle}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="gch-title"
                className="block text-xs font-semibold text-slate-300"
              >
                {t.challengeTitleLabel}
              </label>
              <input
                id="gch-title"
                type="text"
                required
                maxLength={100}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-sm text-slate-100 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="gch-freq"
                className="block text-xs font-semibold text-slate-300"
              >
                {t.challengeFrequencyLabel}
              </label>
              <select
                id="gch-freq"
                value={frequency}
                onChange={(e) => handleFrequencyChange(e.target.value as GroupChallengeFrequency)}
                className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-sm text-slate-100 focus:outline-none focus:border-amber-400"
              >
                {(['daily', 'weekly', 'monthly', 'custom'] as GroupChallengeFrequency[]).map(
                  (freq) => (
                    <option key={freq} value={freq}>
                      {t.challengeFrequencies[freq]}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="gch-desc" className="block text-xs font-semibold text-slate-300">
              {t.challengeDescLabel}
            </label>
            <input
              id="gch-desc"
              type="text"
              maxLength={300}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-sm text-slate-100 focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="gch-source"
                className="block text-xs font-semibold text-slate-300"
              >
                {t.challengeActivitySourceLabel}
              </label>
              <select
                id="gch-source"
                value={sourceKey}
                onChange={(e) => handleSourceChange(e.target.value)}
                className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-sm text-slate-100 focus:outline-none focus:border-amber-400"
              >
                <option value="custom">{t.customStandaloneOption}</option>
                {safeActivities.map((act) => (
                  <option key={act.id} value={act.id}>
                    {getLocalizedActivityTitle(act, lang)} (
                    {getLocalizedCategoryLabel(act.category, lang, customCategories)})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="gch-badge"
                className="block text-xs font-semibold text-slate-300"
              >
                {t.challengeBadgeTitleLabel}
              </label>
              <input
                id="gch-badge"
                type="text"
                maxLength={60}
                value={badgeTitle}
                onChange={(e) => setBadgeTitle(e.target.value)}
                placeholder={t.challengeBadgePlaceholder}
                className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="gch-target" className="block text-xs font-semibold text-slate-300">
                {t.challengeTargetLabel}
              </label>
              <input
                id="gch-target"
                type="number"
                min={1}
                value={targetValue}
                onChange={(e) => setTargetValue(Math.max(1, Number(e.target.value) || 1))}
                className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-sm text-slate-100 font-tabular"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="gch-unit" className="block text-xs font-semibold text-slate-300">
                {t.unitLabel}
              </label>
              <input
                id="gch-unit"
                type="text"
                maxLength={40}
                value={unitLabel}
                onChange={(e) => setUnitLabel(e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-sm text-slate-100"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="gch-days" className="block text-xs font-semibold text-slate-300">
                {t.challengeDaysLabel}
              </label>
              <input
                id="gch-days"
                type="number"
                min={1}
                max={365}
                value={durationDays}
                onChange={(e) => setDurationDays(Math.max(1, Number(e.target.value) || 1))}
                className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-sm text-slate-100 font-tabular"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="gch-xp" className="block text-xs font-semibold text-slate-300">
                {t.challengeXpRewardLabel}
              </label>
              <input
                id="gch-xp"
                type="number"
                min={0}
                max={5000}
                value={xpReward}
                onChange={(e) => setXpReward(Math.max(0, Number(e.target.value) || 0))}
                className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-sm text-slate-100 font-tabular"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="min-h-[40px] px-4 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-xs font-semibold text-slate-300"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              className="min-h-[40px] px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold"
            >
              {t.createChallengeBtn}
            </button>
          </div>
        </form>
      )}

      {/* Group Challenges List */}
      {challenges.length === 0 ? (
        <div className="rounded-2xl bg-[#121824] border border-white/[0.08] p-8 text-center space-y-3">
          <Trophy className="w-8 h-8 text-amber-400 mx-auto" aria-hidden="true" />
          <p className="text-sm text-slate-400">{t.groupChallengesSubtitle}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {challenges.map((ch) => {
            const participants = challengeParticipants[ch.id] ?? [];
            const myEntry = participants.find((p) => p.uid === currentUid);
            const agg = computeGroupChallengeAggregate(ch, participants);
            const isCustomMode = ch.category === 'custom' || ch.activityId === 'custom';
            const inputVal =
              manualInputs[ch.id] !== undefined
                ? manualInputs[ch.id]
                : (myEntry?.progressValue ?? 0);

            return (
              <article
                key={ch.id}
                className="rounded-2xl bg-[#121824] border border-white/[0.08] p-5 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-[11px] font-semibold text-amber-300">
                        {t.challengeFrequencies[ch.frequency]}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-[#0B0F17] border border-white/[0.08] text-[11px] text-slate-300">
                        {ch.category === 'custom'
                          ? t.challengeFrequencies.custom
                          : getLocalizedCategoryLabel(ch.category, lang, customCategories)}
                      </span>
                      {myEntry && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-semibold text-emerald-300">
                          <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                          <span>{myEntry.completed ? t.completedBadgeTag : t.joinedBadge}</span>
                        </span>
                      )}
                    </div>

                    <h2 className="font-display text-lg font-bold text-slate-100">{ch.title}</h2>
                    {ch.description && <p className="text-xs sm:text-sm text-slate-400">{ch.description}</p>}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-xs font-bold text-amber-300 font-tabular">
                      +{formatDigits(ch.xpReward, lang)} XP
                    </span>
                    {ch.badgeTitle && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-500/15 border border-violet-500/30 text-xs font-semibold text-violet-200">
                        <Award className="w-3.5 h-3.5 text-violet-300" aria-hidden="true" />
                        <span>{ch.badgeTitle}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Combined Group Progress Bar */}
                <div className="rounded-xl bg-[#0B0F17] border border-white/[0.06] p-3.5 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-200">{t.groupProgressBarLabel}</span>
                    <span className="font-tabular text-amber-300 font-semibold">
                      {formatDigits(agg.totalProgress, lang)} / {formatDigits(agg.targetTotal, lang)}{' '}
                      {getLocalizedUnitLabel(ch.unitLabel, lang)} ({formatDigits(agg.completionPct, lang)}%)
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-[#121824] overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all"
                      style={{ width: `${agg.completionPct}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 font-tabular">
                    <span>
                      {t.participantsLabel}: {formatDigits(agg.totalParticipants, lang)}
                    </span>
                    <span>
                      {t.completedMembersSummary(agg.completedMembersCount, agg.totalParticipants)}
                    </span>
                  </div>
                </div>

                {/* Individual Progress & Join/Log Controls */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
                  {myEntry ? (
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-xs text-slate-300 font-tabular">
                        {t.yourChallengeProgressLabel}:{' '}
                        <strong className="text-emerald-300">
                          {formatDigits(myEntry.progressValue, lang)} /{' '}
                          {formatDigits(ch.targetValue, lang)}{' '}
                          {getLocalizedUnitLabel(ch.unitLabel, lang)}
                        </strong>
                      </span>

                      {isCustomMode ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            aria-label={t.logCustomProgressLabel}
                            value={inputVal}
                            onChange={(e) =>
                              setManualInputs((prev) => ({
                                ...prev,
                                [ch.id]: Math.max(0, Number(e.target.value) || 0),
                              }))
                            }
                            className="w-24 min-h-[36px] px-2.5 rounded-lg bg-[#0B0F17] border border-white/[0.12] text-xs text-slate-100 font-tabular"
                          />
                          <button
                            type="button"
                            onClick={() => onJoinOrSync(activeGroup.id, ch, inputVal)}
                            className="min-h-[36px] px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold whitespace-nowrap"
                          >
                            {t.updateProgressBtn}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onJoinOrSync(activeGroup.id, ch)}
                          className="min-h-[36px] px-3 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-300 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{t.syncProgressBtn}</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 font-tabular">
                      {t.targetLabel} {formatDigits(ch.targetValue, lang)}{' '}
                      {getLocalizedUnitLabel(ch.unitLabel, lang)} ·{' '}
                      {formatDigits(ch.durationDays, lang)} {t.daysUnit}
                    </div>
                  )}

                  <div className="flex items-center gap-2 shrink-0">
                    {!myEntry ? (
                      <button
                        type="button"
                        onClick={() => onJoinOrSync(activeGroup.id, ch, 0)}
                        className="min-h-[38px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Flag className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{t.joinChallengeBtn}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onLeave(activeGroup.id, ch.id)}
                        className="min-h-[38px] px-3.5 rounded-xl bg-[#0B0F17] hover:bg-rose-500/15 border border-white/[0.08] hover:border-rose-500/35 text-slate-300 hover:text-rose-200 text-xs font-semibold whitespace-nowrap"
                      >
                        {t.leaveChallengeBtn}
                      </button>
                    )}
                  </div>
                </div>

                {/* Participants Summary */}
                {participants.length > 0 && (
                  <div className="pt-3 border-t border-white/[0.06] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {participants.map((p) => {
                      const pct = Math.min(
                        100,
                        Math.round((p.progressValue / Math.max(1, ch.targetValue)) * 100)
                      );
                      return (
                        <div
                          key={p.uid}
                          className="rounded-xl bg-[#0B0F17] border border-white/[0.06] px-3 py-2 flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <AvatarBadge avatarId={p.avatarId} size="sm" />
                            <span className="text-xs text-slate-200 truncate">
                              {getLocalizedDisplayName(p.displayName, lang)}
                            </span>
                          </div>
                          <span className="text-xs font-tabular font-semibold text-amber-300 shrink-0">
                            {formatDigits(p.progressValue, lang)} ({formatDigits(pct, lang)}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
