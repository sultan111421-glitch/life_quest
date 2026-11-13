import React, { useMemo, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Flag,
  Flame,
  Lock,
  MessageSquarePlus,
  Settings,
  Shield,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import {
  CustomCategoryDef,
  FriendGroup,
  GroupChallenge,
  GroupChallengeParticipant,
  GroupFeedItem,
  GroupPrivacySettings,
  GroupRole,
  GroupSharedProgress,
  Language,
  NavPage,
} from '../types/quest';
import { formatDigits } from '../utils/dhakaTime';
import { computeGroupChallengeAggregate } from '../utils/groupPrivacy';
import { getLocalizedCategoryLabel, getLocalizedDisplayName, UI_COPY } from '../utils/i18n';
import { AvatarBadge } from './AvatarBadge';
import { GroupSubNav } from './GroupSubNav';

interface GroupDashboardViewProps {
  currentUid: string;
  lang: Language;
  groups: FriendGroup[];
  activeGroup: FriendGroup | null;
  myRole?: GroupRole;
  myPrivacy: GroupPrivacySettings;
  sharedProgressList: GroupSharedProgress[];
  challenges: GroupChallenge[];
  challengeParticipants: Record<string, GroupChallengeParticipant[]>;
  feed: GroupFeedItem[];
  customCategories: CustomCategoryDef[];
  onSelectGroup: (groupId: string) => void;
  onNavigate: (page: NavPage) => void;
  onPublishMilestone: (
    groupId: string,
    title: string,
    detail: string,
    type?: 'achievement' | 'milestone' | 'challenge'
  ) => Promise<void>;
}

export const GroupDashboardView: React.FC<GroupDashboardViewProps> = ({
  currentUid,
  lang,
  groups,
  activeGroup,
  myRole,
  myPrivacy,
  sharedProgressList,
  challenges,
  challengeParticipants,
  feed,
  customCategories,
  onSelectGroup,
  onNavigate,
  onPublishMilestone,
}) => {
  const t = UI_COPY[lang];
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneDetail, setMilestoneDetail] = useState('');
  const [posting, setPosting] = useState(false);
  const [feedLimit, setFeedLimit] = useState(10);

  const kpis = useMemo(() => {
    const sharingCount = sharedProgressList.length;
    const dailyValues = sharedProgressList
      .map((s) => s.dailyCompletionPct)
      .filter((v): v is number => typeof v === 'number');
    const weeklyValues = sharedProgressList
      .map((s) => s.weeklyCompletionPct)
      .filter((v): v is number => typeof v === 'number');

    const avgDaily =
      dailyValues.length > 0
        ? Math.round(dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length)
        : 0;
    const avgWeekly =
      weeklyValues.length > 0
        ? Math.round(weeklyValues.reduce((a, b) => a + b, 0) / weeklyValues.length)
        : 0;

    return {
      sharingCount,
      hasDaily: dailyValues.length > 0,
      hasWeekly: weeklyValues.length > 0,
      avgDaily,
      avgWeekly,
    };
  }, [sharedProgressList]);

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

  const handlePostMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!milestoneTitle.trim()) return;
    setPosting(true);
    await onPublishMilestone(activeGroup.id, milestoneTitle, milestoneDetail, 'milestone');
    setMilestoneTitle('');
    setMilestoneDetail('');
    setPosting(false);
  };

  return (
    <div className="space-y-6">
      <GroupSubNav
        lang={lang}
        activePage="groupDashboard"
        groups={groups}
        activeGroup={activeGroup}
        myRole={myRole}
        myPrivacy={myPrivacy}
        onSelectGroup={onSelectGroup}
        onNavigate={onNavigate}
      />

      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-100">
          {t.groupSubNav.dashboard}
        </h1>
        <p className="mt-1 text-sm text-slate-400">{t.groupDashboardSubtitle}</p>
      </div>

      {/* Zero-Trust Notice if user's sharing in this group is OFF */}
      {!myPrivacy.sharingEnabled && (
        <div className="rounded-2xl bg-[#121824] border border-amber-500/35 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" aria-hidden="true" />
            </div>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              {t.groupSharingStatusOffBanner}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('groupSettings')}
            className="min-h-[40px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Settings className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t.configureMySharingBtn}</span>
          </button>
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-[#121824] border border-white/[0.08] p-4">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
            <span>{t.groupKpiMembersSharing}</span>
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-slate-100 font-tabular">
            {formatDigits(kpis.sharingCount, lang)} / {formatDigits(activeGroup.memberCount, lang)}
          </div>
        </div>

        <div className="rounded-2xl bg-[#121824] border border-white/[0.08] p-4">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Flag className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
            <span>{t.groupKpiActiveChallenges}</span>
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-slate-100 font-tabular">
            {formatDigits(challenges.length, lang)}
          </div>
        </div>

        <div className="rounded-2xl bg-[#121824] border border-white/[0.08] p-4">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />
            <span>{t.groupKpiSharedAvgDaily}</span>
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-slate-100 font-tabular">
            {kpis.hasDaily ? `${formatDigits(kpis.avgDaily, lang)}%` : '—'}
          </div>
        </div>

        <div className="rounded-2xl bg-[#121824] border border-white/[0.08] p-4">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" aria-hidden="true" />
            <span>{t.groupKpiSharedAvgWeekly}</span>
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-slate-100 font-tabular">
            {kpis.hasWeekly ? `${formatDigits(kpis.avgWeekly, lang)}%` : '—'}
          </div>
        </div>
      </div>

      {/* Shared Member Progress Grid */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-slate-100">
            {t.groupMemberProgressTitle}
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('groupSettings')}
            className="text-xs font-semibold text-amber-400 hover:text-amber-300"
          >
            {t.configureMySharingBtn}
          </button>
        </div>

        {sharedProgressList.length === 0 ? (
          <div className="rounded-2xl bg-[#121824] border border-white/[0.08] p-6 text-center text-sm text-slate-400">
            {t.noMembersSharingYet}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sharedProgressList.map((memberShare) => {
              const isSelf = memberShare.uid === currentUid;
              return (
                <article
                  key={memberShare.uid}
                  className="rounded-2xl bg-[#121824] border border-white/[0.08] p-5 space-y-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <AvatarBadge avatarId={memberShare.avatarId} size="md" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm text-slate-100 truncate">
                            {getLocalizedDisplayName(memberShare.displayName, lang)}
                          </h3>
                          {isSelf && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-[10px] font-semibold text-amber-300">
                              {t.youLabel}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          @{memberShare.username}
                        </div>
                      </div>
                    </div>

                    {memberShare.showLevel && memberShare.level !== undefined && (
                      <span className="px-2.5 py-1 rounded-lg bg-[#0B0F17] border border-white/[0.08] text-xs font-semibold text-amber-300 font-tabular whitespace-nowrap">
                        {t.level} {formatDigits(memberShare.level, lang)}
                      </span>
                    )}
                  </div>

                  {/* Opted-in Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <div className="rounded-xl bg-[#0B0F17] border border-white/[0.06] p-2.5">
                      <div className="text-[11px] text-slate-400">{t.xpCol}</div>
                      <div className="mt-0.5 text-sm font-bold text-slate-100 font-tabular">
                        {memberShare.showXp && memberShare.totalXp !== undefined
                          ? `${formatDigits(memberShare.totalXp, lang)} XP`
                          : t.hiddenFieldLabel}
                      </div>
                    </div>

                    <div className="rounded-xl bg-[#0B0F17] border border-white/[0.06] p-2.5">
                      <div className="text-[11px] text-slate-400">{t.streakCol}</div>
                      <div className="mt-0.5 text-sm font-bold text-slate-100 font-tabular inline-flex items-center gap-1">
                        {memberShare.showStreaks && memberShare.currentStreak !== undefined ? (
                          <>
                            <Flame className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                            <span>
                              {formatDigits(memberShare.currentStreak, lang)} {t.daysUnit}
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-500 font-normal">{t.hiddenFieldLabel}</span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl bg-[#0B0F17] border border-white/[0.06] p-2.5 col-span-2 sm:col-span-1">
                      <div className="text-[11px] text-slate-400">{t.dailyLabelShort}</div>
                      <div className="mt-0.5 text-sm font-bold text-emerald-300 font-tabular">
                        {memberShare.dailyCompletionPct !== undefined
                          ? `${formatDigits(memberShare.dailyCompletionPct, lang)}%`
                          : t.hiddenFieldLabel}
                      </div>
                    </div>
                  </div>

                  {/* Weekly / Monthly Summaries (Only if opted in) */}
                  {(memberShare.showWeeklySummary || memberShare.showMonthlySummary) && (
                    <div className="space-y-2">
                      {memberShare.showWeeklySummary &&
                        memberShare.weeklyCompletionPct !== undefined && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-slate-300">
                              <span>{t.weeklyLabelShort}</span>
                              <span className="font-tabular font-semibold">
                                {formatDigits(memberShare.weeklyCompletionPct, lang)}%
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-[#0B0F17] overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{
                                  width: `${Math.min(100, Math.max(0, memberShare.weeklyCompletionPct))}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}

                      {memberShare.showMonthlySummary &&
                        memberShare.monthlyCompletionPct !== undefined && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-slate-300">
                              <span>{t.monthlyLabelShort}</span>
                              <span className="font-tabular font-semibold">
                                {formatDigits(memberShare.monthlyCompletionPct, lang)}%
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-[#0B0F17] overflow-hidden">
                              <div
                                className="h-full bg-cyan-500 rounded-full"
                                style={{
                                  width: `${Math.min(100, Math.max(0, memberShare.monthlyCompletionPct))}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}
                    </div>
                  )}

                  {/* Opted-in Safe Category Contributions */}
                  {memberShare.sharedCategories.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {memberShare.sharedCategories.map((cat) => {
                        const catXp = memberShare.categorySummaries?.[cat];
                        return (
                          <span
                            key={cat}
                            className="px-2.5 py-1 rounded-lg bg-[#0B0F17] border border-white/[0.08] text-[11px] text-slate-300"
                          >
                            {getLocalizedCategoryLabel(cat, lang, customCategories)}
                            {catXp !== undefined ? ` · ${formatDigits(catXp, lang)} XP` : ''}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Opted-in Non-Spiritual Badges */}
                  {memberShare.showAchievements &&
                    memberShare.sharedBadges &&
                    memberShare.sharedBadges.length > 0 && (
                      <div className="pt-2 border-t border-white/[0.06] flex flex-wrap gap-1.5">
                        {memberShare.sharedBadges.slice(0, 4).map((badge) => (
                          <span
                            key={badge.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-200"
                          >
                            <Award className="w-3 h-3 text-amber-400" aria-hidden="true" />
                            <span>{badge.title}</span>
                          </span>
                        ))}
                      </div>
                    )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Group Challenge Progress Summary */}
      <section className="rounded-2xl bg-[#121824] border border-white/[0.08] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" aria-hidden="true" />
            <h2 className="font-display text-base font-bold text-slate-100">
              {t.groupChallengeOverviewTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('groupChallenges')}
            className="text-xs font-semibold text-amber-400 hover:text-amber-300 whitespace-nowrap"
          >
            {t.viewAllGroupChallengesBtn}
          </button>
        </div>

        {challenges.length === 0 ? (
          <p className="text-xs sm:text-sm text-slate-400">{t.groupChallengesSubtitle}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {challenges.slice(0, 4).map((ch) => {
              const parts = challengeParticipants[ch.id] ?? [];
              const agg = computeGroupChallengeAggregate(ch, parts);
              return (
                <div
                  key={ch.id}
                  className="rounded-xl bg-[#0B0F17] border border-white/[0.08] p-4 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-sm text-slate-100">{ch.title}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {t.challengeFrequencies[ch.frequency]} · +{formatDigits(ch.xpReward, lang)} XP
                      </div>
                    </div>
                    <span className="text-xs font-tabular font-semibold text-amber-300">
                      {formatDigits(agg.completionPct, lang)}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[#121824] overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{ width: `${agg.completionPct}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-slate-400 font-tabular">
                    {t.completedMembersSummary(agg.completedMembersCount, agg.totalParticipants)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Voluntary Group Activity & Milestone Feed */}
      <section className="rounded-2xl bg-[#121824] border border-white/[0.08] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <MessageSquarePlus className="w-4 h-4 text-emerald-400" aria-hidden="true" />
          <h2 className="font-display text-base font-bold text-slate-100">{t.groupFeedTitle}</h2>
        </div>

        <form onSubmit={handlePostMilestone} className="space-y-2.5">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              maxLength={100}
              value={milestoneTitle}
              onChange={(e) => setMilestoneTitle(e.target.value)}
              placeholder={t.shareMilestonePlaceholder}
              aria-label={t.shareMilestoneBtn}
              className="flex-1 min-h-[42px] px-3.5 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              disabled={posting || !milestoneTitle.trim()}
              className="min-h-[42px] px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold disabled:opacity-50 whitespace-nowrap"
            >
              {t.publishMilestoneBtn}
            </button>
          </div>
          {milestoneTitle.trim().length > 0 && (
            <input
              type="text"
              maxLength={240}
              value={milestoneDetail}
              onChange={(e) => setMilestoneDetail(e.target.value)}
              placeholder={t.challengeDescLabel}
              className="w-full min-h-[38px] px-3.5 rounded-xl bg-[#0B0F17] border border-white/[0.08] text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
            />
          )}
        </form>

        {feed.length === 0 ? (
          <p className="text-xs sm:text-sm text-slate-400">{t.noGroupFeedYet}</p>
        ) : (
          <div className="space-y-2.5">
            {feed.slice(0, feedLimit).map((item) => (
              <div
                key={item.id}
                className="rounded-xl bg-[#0B0F17] border border-white/[0.07] p-3.5 flex items-start gap-3"
              >
                <AvatarBadge avatarId={item.avatarId} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-200">
                      {getLocalizedDisplayName(item.displayName, lang)}
                    </span>
                    <span className="text-[11px] text-slate-500 font-tabular">
                      {item.createdAtIso.slice(0, 10)}
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-medium text-amber-200">{item.title}</div>
                  {item.detail && <p className="mt-0.5 text-xs text-slate-400">{item.detail}</p>}
                </div>
              </div>
            ))}
            {feed.length > feedLimit && (
              <button
                type="button"
                onClick={() => setFeedLimit((l) => l + 10)}
                className="w-full min-h-[38px] rounded-xl bg-[#0B0F17] border border-white/[0.08] hover:border-amber-400/40 text-xs font-medium text-amber-300 transition-colors"
              >
                {t.loadMoreBtn}
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
