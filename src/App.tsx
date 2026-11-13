import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  BarChart3,
  CalendarDays,
  CheckSquare,
  Flag,
  LayoutDashboard,
  LogIn,
  Menu,
  Settings,
  Shield,
  Sparkles,
  Target,
  Trophy,
  User,
  UserPlus,
  Users,
  UsersRound,
  X,
} from 'lucide-react';
import { Language, NavPage } from './types/quest';
import { useLifeQuestStore } from './hooks/useLifeQuestStore';
import { DEFAULT_PRIVACY_SETTINGS } from './utils/defaults';
import { formatDigits, getDhakaLocalizedTimeLabel } from './utils/dhakaTime';
import { calculateAnalytics } from './utils/gamification';
import { DEVELOPER_CREDIT, NAV_COPY, UI_COPY } from './utils/i18n';
import { AvatarBadge } from './components/AvatarBadge';
import { DashboardView } from './components/DashboardView';
import { DailyQuestsView } from './components/DailyQuestsView';
import { CalendarView } from './components/CalendarView';
import { AnalyticsView } from './components/AnalyticsView';
import { AchievementsView } from './components/AchievementsView';
import { CustomGoalsView } from './components/CustomGoalsView';
import { ProfileView } from './components/ProfileView';
import { FriendsView } from './components/FriendsView';
import { LeaderboardsView } from './components/LeaderboardsView';
import { ChallengesView } from './components/ChallengesView';
import { PrivacySettingsView } from './components/PrivacySettingsView';
import { SettingsView } from './components/SettingsView';
import { OnboardingWizard } from './components/OnboardingWizard';
import { MyGroupsView } from './components/MyGroupsView';
import { CreateGroupView } from './components/CreateGroupView';
import { GroupDashboardView } from './components/GroupDashboardView';
import { GroupMembersView } from './components/GroupMembersView';
import { GroupChallengesView } from './components/GroupChallengesView';
import { GroupSettingsView } from './components/GroupSettingsView';

const NAV_ICONS: Record<NavPage, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  quests: CheckSquare,
  calendar: CalendarDays,
  analytics: BarChart3,
  achievements: Award,
  goals: Target,
  profile: User,
  friends: Users,
  groups: UsersRound,
  groupCreate: UserPlus,
  groupDashboard: LayoutDashboard,
  groupMembers: Users,
  groupChallenges: Flag,
  groupSettings: Settings,
  leaderboards: Trophy,
  challenges: Flag,
  privacy: Shield,
  settings: Settings,
};

const CORE_NAV_IDS: Set<NavPage> = new Set([
  'dashboard',
  'quests',
  'calendar',
  'analytics',
  'achievements',
  'goals',
]);

interface LanguageSwitcherProps {
  lang: Language;
  onChange: (lang: Language) => void;
  compact?: boolean;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  lang,
  onChange,
  compact = false,
}) => {
  return (
    <div
      role="group"
      aria-label="Language switcher"
      className={`inline-flex items-center rounded-xl bg-[#0B0F17] border border-white/[0.1] shrink-0 ${
        compact ? 'p-0.5' : 'p-1'
      }`}
    >
      <button
        type="button"
        onClick={() => onChange('en')}
        aria-pressed={lang === 'en'}
        className={`rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
          compact ? 'px-2.5 min-h-[32px]' : 'px-3 min-h-[34px]'
        } ${
          lang === 'en'
            ? 'bg-amber-500 text-slate-950'
            : 'text-slate-300 hover:text-white'
        }`}
      >
        EN
      </button>
      <span
        className={`text-slate-600 select-none ${compact ? 'px-0.5 text-[10px]' : 'px-1 text-xs'}`}
        aria-hidden="true"
      >
        |
      </span>
      <button
        type="button"
        onClick={() => onChange('bn')}
        aria-pressed={lang === 'bn'}
        className={`rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
          compact ? 'px-2.5 min-h-[32px]' : 'px-3 min-h-[34px]'
        } ${
          lang === 'bn'
            ? 'bg-amber-500 text-slate-950'
            : 'text-slate-300 hover:text-white'
        }`}
      >
        বাংলা
      </button>
    </div>
  );
};

export default function App() {
  const [activePage, setActivePage] = useState<NavPage>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const store = useLifeQuestStore();
  const lang = store.language;
  const t = UI_COPY[lang];
  const navItems = NAV_COPY[lang];
  const currentPageLabel = (() => {
    const found = navItems.find((n) => n.id === activePage);
    if (found) return found.label;
    if (activePage === 'groupCreate') return t.createGroupTitle;
    if (activePage === 'groupDashboard') return t.groupSubNav.dashboard;
    if (activePage === 'groupMembers') return t.groupSubNav.members;
    if (activePage === 'groupChallenges') return t.groupSubNav.challenges;
    if (activePage === 'groupSettings') return t.groupSubNav.settings;
    return navItems[0].label;
  })();

  const coreNavItems = navItems.filter((n) => CORE_NAV_IDS.has(n.id));
  const socialNavItems = navItems.filter((n) => !CORE_NAV_IDS.has(n.id));

  const religionEnabled = Boolean(store.profile.religionTrackingEnabled);
  const customCategories = store.profile.customCategories ?? [];
  const privacy = store.profile.privacy ?? DEFAULT_PRIVACY_SETTINGS;

  const pendingIncomingCount = useMemo(
    () =>
      store.friendRequests.filter(
        (r) => r.toUid === store.currentUid && r.status === 'pending'
      ).length,
    [store.currentUid, store.friendRequests]
  );

  const pendingGroupInvitesCount = useMemo(
    () =>
      store.groupInvitations.filter(
        (inv) => inv.toUid === store.currentUid && inv.status === 'pending'
      ).length,
    [store.currentUid, store.groupInvitations]
  );

  const comparisonStats = useMemo(() => {
    const weekly = calculateAnalytics(
      store.dailyLogs,
      store.visibleActivities,
      store.todayKey,
      7,
      religionEnabled,
      customCategories
    );
    const monthly = calculateAnalytics(
      store.dailyLogs,
      store.visibleActivities,
      store.todayKey,
      30,
      religionEnabled,
      customCategories
    );
    return {
      displayName: store.profile.displayName,
      avatarId: store.profile.avatarId,
      level: store.levelInfo.level,
      totalXp: store.xpTotals.totalXp,
      currentStreak: store.streakInfo.currentStreak,
      weeklyPct: weekly.avgCompletionPct,
      monthlyPct: monthly.avgCompletionPct,
    };
  }, [
    customCategories,
    religionEnabled,
    store.dailyLogs,
    store.levelInfo.level,
    store.profile.avatarId,
    store.profile.displayName,
    store.streakInfo.currentStreak,
    store.todayKey,
    store.visibleActivities,
    store.xpTotals.totalXp,
  ]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileMenuOpen]);

  const handleNavigate = (page: NavPage) => {
    setActivePage(page);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Primary 4 mobile bottom tabs + More menu keeps mobile sticky bar compact (<= 15% height)
  const mobilePrimaryTabs: NavPage[] = ['dashboard', 'quests', 'calendar', 'analytics'];

  const renderNavButton = (item: (typeof navItems)[number], compact = false) => {
    const Icon = NAV_ICONS[item.id];
    const isGroupPage =
      activePage === 'groups' ||
      activePage === 'groupCreate' ||
      activePage === 'groupDashboard' ||
      activePage === 'groupMembers' ||
      activePage === 'groupChallenges' ||
      activePage === 'groupSettings';
    const active = item.id === 'groups' ? isGroupPage : activePage === item.id;
    const badgeCount =
      item.id === 'friends'
        ? pendingIncomingCount
        : item.id === 'groups'
          ? pendingGroupInvitesCount
          : 0;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => handleNavigate(item.id)}
        className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl flex items-center justify-between gap-2 text-sm font-medium transition-colors whitespace-nowrap ${
          active
            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
            : compact
              ? 'text-slate-200 hover:bg-white/[0.04] border border-transparent'
              : 'text-slate-300 hover:bg-white/[0.04] hover:text-white border border-transparent'
        }`}
      >
        <span className="flex items-center gap-3 min-w-0">
          <Icon
            className={`w-4 h-4 shrink-0 ${active ? 'text-amber-400' : 'text-slate-400'}`}
            aria-hidden="true"
          />
          <span className="truncate">{item.label}</span>
        </span>
        {badgeCount > 0 && (
          <span className="px-1.5 py-0.5 rounded-md bg-amber-500 text-slate-950 text-[10px] font-bold font-tabular shrink-0">
            {formatDigits(badgeCount, lang)}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col lg:flex-row">
      {/* Desktop Sidebar (256px) */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-[#0F141F] border-r border-white/[0.07] z-30">
        <div className="p-5 border-b border-white/[0.07]">
          <button
            type="button"
            onClick={() => handleNavigate('dashboard')}
            className="flex items-center gap-2.5 text-left w-full focus:outline-none"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="font-display text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap">
                LIFE QUEST
              </div>
              <div className="text-[11px] text-slate-400 whitespace-nowrap">
                {t.brandTagline}
              </div>
            </div>
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-4 overflow-y-auto" aria-label={t.mainNavAria}>
          <div className="space-y-1">
            <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {t.navSectionCore}
            </div>
            {coreNavItems.map((item) => renderNavButton(item))}
          </div>

          <div className="space-y-1 pt-2 border-t border-white/[0.06]">
            <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {t.navSectionSocial}
            </div>
            {socialNavItems.map((item) => renderNavButton(item))}
          </div>
        </nav>

        <div className="p-4 border-t border-white/[0.07] space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">
              {t.level} {formatDigits(store.levelInfo.level, lang)}
            </span>
            <span className="font-tabular text-amber-400 font-semibold">
              {formatDigits(store.xpTotals.totalXp, lang)} XP
            </span>
          </div>
          {store.user ? (
            <button
              type="button"
              onClick={() => handleNavigate('profile')}
              className="w-full flex items-center gap-2 text-left text-xs text-slate-300 hover:text-white truncate"
            >
              <AvatarBadge avatarId={store.profile.avatarId} size="sm" />
              <span className="truncate">{store.user.displayName || store.user.email}</span>
            </button>
          ) : (
            store.isFirebaseConfigured && (
              <button
                type="button"
                onClick={store.handleSignIn}
                className="w-full min-h-[40px] px-3 rounded-xl bg-[#1A2233] border border-white/[0.08] hover:border-amber-400/40 text-xs font-medium text-slate-200 inline-flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <LogIn className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                <span>{t.cloudSignIn}</span>
              </button>
            )
          )}
        </div>
      </aside>

      {/* Mobile Compact Header (52px) */}
      <header className="lg:hidden sticky top-0 z-30 h-[52px] px-3 bg-[#0F141F]/90 backdrop-blur-md border-b border-white/[0.07] flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => handleNavigate('dashboard')}
          className="font-display text-sm font-bold text-slate-100 whitespace-nowrap shrink-0 flex items-center gap-1.5"
        >
          <Sparkles className="w-4 h-4 text-amber-400" aria-hidden="true" />
          <span>LIFE QUEST</span>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          <LanguageSwitcher lang={lang} onChange={store.setLanguage} compact />
          <button
            type="button"
            aria-label={t.openMenuAria}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="min-w-[40px] min-h-[40px] rounded-xl bg-[#1A2233] flex items-center justify-center text-slate-200 relative"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            {pendingIncomingCount + pendingGroupInvitesCount > 0 && !mobileMenuOpen && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400" />
            )}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 top-[52px] z-40 bg-black/75 backdrop-blur-sm p-4 overflow-y-auto pb-24">
          <nav
            className="rounded-2xl bg-[#121824] border border-white/[0.1] p-3 space-y-3 max-h-[calc(100vh-130px)] overflow-y-auto"
            aria-label={t.mobileDrawerAria}
          >
            <div className="space-y-1">
              <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {t.navSectionCore}
              </div>
              {coreNavItems.map((item) => renderNavButton(item, true))}
            </div>
            <div className="space-y-1 pt-2 border-t border-white/[0.07]">
              <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {t.navSectionSocial}
              </div>
              {socialNavItems.map((item) => renderNavButton(item, true))}
            </div>
          </nav>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 lg:pl-64 pb-20 lg:pb-10 flex flex-col min-h-screen">
        {/* Desktop Top Navigation Bar */}
        <header className="hidden lg:flex sticky top-0 z-20 h-14 px-8 bg-[#0B0F17]/90 backdrop-blur-md border-b border-white/[0.06] items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-display text-sm font-semibold text-slate-200 truncate">
              {currentPageLabel}
            </span>
            <span className="text-slate-600" aria-hidden="true">
              ·
            </span>
            <span className="text-xs text-slate-400 font-tabular whitespace-nowrap">
              {t.dhakaTimePrefix}: {getDhakaLocalizedTimeLabel(lang)}
            </span>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <span className="text-xs font-tabular text-amber-400 font-semibold whitespace-nowrap">
              {t.level} {formatDigits(store.levelInfo.level, lang)} ·{' '}
              {formatDigits(store.xpTotals.totalXp, lang)} XP
            </span>
            <LanguageSwitcher lang={lang} onChange={store.setLanguage} />
          </div>
        </header>

        <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 flex flex-col justify-between">
          <div>
            {!store.user && store.isFirebaseConfigured && !store.cloudLoading && (
              <div className="mb-4 px-4 py-2.5 rounded-xl bg-[#121824] border border-amber-500/25 text-xs text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <span>{t.guestPreviewBanner}</span>
                <button
                  type="button"
                  onClick={store.handleSignIn}
                  className="min-h-[34px] px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{t.cloudSignIn}</span>
                </button>
              </div>
            )}

            {store.errorMessage && (
              <div
                role="alert"
                className="mb-4 px-4 py-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs sm:text-sm text-rose-200 flex items-center justify-between gap-3"
              >
                <span>{store.errorMessage}</span>
                <button
                  type="button"
                  aria-label={t.closeAlertAria}
                  onClick={() => store.setErrorMessage(null)}
                  className="text-rose-300 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {store.cloudLoading ? (
              <div className="space-y-4">
                <div className="h-40 rounded-2xl bg-[#121824] animate-pulse border border-white/[0.06]" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-24 rounded-2xl bg-[#121824] animate-pulse border border-white/[0.06]"
                    />
                  ))}
                </div>
              </div>
            ) : (
              <>
                {activePage === 'dashboard' && (
                  <DashboardView
                    todayKey={store.todayKey}
                    displayName={store.profile.displayName}
                    avatarId={store.profile.avatarId}
                    religionEnabled={religionEnabled}
                    remindersEnabled={Boolean(store.profile.remindersEnabled)}
                    customCategories={customCategories}
                    activities={store.visibleActivities}
                    dailyLogs={store.dailyLogs}
                    todaySummary={store.todaySummary}
                    xpTotals={store.xpTotals}
                    levelInfo={store.levelInfo}
                    streakInfo={store.streakInfo}
                    achievements={store.achievements}
                    lang={lang}
                    onUpdateEntry={store.updateActivityEntry}
                    onNavigate={handleNavigate}
                    onOpenWizard={() => store.setShowOnboardingModal(true)}
                  />
                )}

                {activePage === 'quests' && (
                  <DailyQuestsView
                    todayKey={store.todayKey}
                    selectedDateKey={store.selectedDateKey}
                    onSelectDateKey={store.setSelectedDateKey}
                    activities={store.visibleActivities}
                    dailyLogs={store.dailyLogs}
                    levelConfig={store.profile.levelConfig}
                    customCategories={customCategories}
                    religionEnabled={religionEnabled}
                    lang={lang}
                    onUpdateEntry={store.updateActivityEntry}
                    onUpdateNote={store.updateDailyNote}
                    onNavigate={handleNavigate}
                    onTimerLogged={() => store.showToast(t.toastTimerLogged)}
                  />
                )}

                {activePage === 'calendar' && (
                  <CalendarView
                    todayKey={store.todayKey}
                    selectedDateKey={store.selectedDateKey}
                    onSelectDateKey={store.setSelectedDateKey}
                    activities={store.visibleActivities}
                    dailyLogs={store.dailyLogs}
                    customCategories={customCategories}
                    lang={lang}
                    onUpdateEntry={store.updateActivityEntry}
                    onNavigate={handleNavigate}
                  />
                )}

                {activePage === 'analytics' && (
                  <AnalyticsView
                    todayKey={store.todayKey}
                    activities={store.visibleActivities}
                    dailyLogs={store.dailyLogs}
                    religionEnabled={religionEnabled}
                    customCategories={customCategories}
                    lang={lang}
                  />
                )}

                {activePage === 'achievements' && (
                  <AchievementsView
                    achievements={store.achievements}
                    totalAchievementXp={store.xpTotals.achievementXp}
                    lang={lang}
                  />
                )}

                {activePage === 'goals' && (
                  <CustomGoalsView
                    activities={store.visibleActivities}
                    lang={lang}
                    customCategories={customCategories}
                    religionEnabled={religionEnabled}
                    onSaveActivity={store.saveActivityDefinition}
                    onDeleteActivity={store.deleteActivityDefinition}
                    onReorderActivity={store.reorderActivity}
                    onAddCustomCategory={store.addCustomCategory}
                  />
                )}

                {activePage === 'profile' && (
                  <ProfileView
                    profile={store.profile}
                    visibleActivities={store.visibleActivities}
                    dailyLogs={store.dailyLogs}
                    todayKey={store.todayKey}
                    lang={lang}
                    xpTotals={store.xpTotals}
                    levelInfo={store.levelInfo}
                    streakInfo={store.streakInfo}
                    achievements={store.achievements}
                    onSaveProfile={store.updatePersonalProfile}
                    onNavigate={handleNavigate}
                  />
                )}

                {activePage === 'friends' && (
                  <FriendsView
                    currentUid={store.currentUid}
                    lang={lang}
                    ownStats={comparisonStats}
                    friends={store.friends}
                    friendRequests={store.friendRequests}
                    customCategories={customCategories}
                    onSearchUsers={store.searchUsersByUsername}
                    onSendRequest={store.sendFriendRequest}
                    onRespondRequest={store.respondToFriendRequest}
                    onCancelRequest={store.cancelFriendRequest}
                    onRemoveFriend={store.removeFriend}
                    onFetchComparisonProfile={store.fetchSharedProfileForComparison}
                  />
                )}

                {activePage === 'groups' && (
                  <MyGroupsView
                    currentUid={store.currentUid}
                    lang={lang}
                    groups={store.groups}
                    groupInvitations={store.groupInvitations}
                    groupPrivacyByGroup={store.groupPrivacyByGroup}
                    onSelectGroup={store.setActiveGroupId}
                    onNavigate={handleNavigate}
                    onRespondInvitation={store.respondToGroupInvitation}
                    onJoinByCode={store.joinGroupByInviteCode}
                  />
                )}

                {activePage === 'groupCreate' && (
                  <CreateGroupView
                    lang={lang}
                    onCreateGroup={store.createGroup}
                    onNavigate={handleNavigate}
                  />
                )}

                {activePage === 'groupDashboard' && (
                  <GroupDashboardView
                    currentUid={store.currentUid}
                    lang={lang}
                    groups={store.groups}
                    activeGroup={store.activeGroup}
                    myRole={store.activeGroupRole}
                    myPrivacy={store.activeGroupPrivacy}
                    sharedProgressList={store.activeGroupSharedProgress}
                    challenges={store.activeGroupChallenges}
                    challengeParticipants={store.groupChallengeParticipants}
                    feed={store.activeGroupFeed}
                    customCategories={customCategories}
                    onSelectGroup={store.setActiveGroupId}
                    onNavigate={handleNavigate}
                    onPublishMilestone={store.publishGroupMilestone}
                  />
                )}

                {activePage === 'groupMembers' && (
                  <GroupMembersView
                    currentUid={store.currentUid}
                    lang={lang}
                    groups={store.groups}
                    activeGroup={store.activeGroup}
                    members={store.activeGroupMembers}
                    myRole={store.activeGroupRole}
                    myPrivacy={store.activeGroupPrivacy}
                    friends={store.friends}
                    groupInvitations={store.groupInvitations}
                    onSelectGroup={store.setActiveGroupId}
                    onNavigate={handleNavigate}
                    onSearchUsers={store.searchUsersByUsername}
                    onInviteUser={store.inviteFriendToGroup}
                    onCancelInvitation={store.cancelGroupInvitation}
                    onUpdateRole={store.updateMemberRole}
                    onRemoveOrLeave={store.removeOrLeaveGroup}
                    onRegenerateCode={store.regenerateGroupInviteCode}
                    onShowToast={store.showToast}
                  />
                )}

                {activePage === 'groupChallenges' && (
                  <GroupChallengesView
                    currentUid={store.currentUid}
                    lang={lang}
                    groups={store.groups}
                    activeGroup={store.activeGroup}
                    myRole={store.activeGroupRole}
                    myPrivacy={store.activeGroupPrivacy}
                    challenges={store.activeGroupChallenges}
                    challengeParticipants={store.groupChallengeParticipants}
                    visibleActivities={store.visibleActivities}
                    customCategories={customCategories}
                    onSelectGroup={store.setActiveGroupId}
                    onNavigate={handleNavigate}
                    onCreateChallenge={store.createGroupChallenge}
                    onJoinOrSync={store.joinOrSyncGroupChallenge}
                    onLeave={store.leaveGroupChallenge}
                  />
                )}

                {activePage === 'groupSettings' && (
                  <GroupSettingsView
                    lang={lang}
                    groups={store.groups}
                    activeGroup={store.activeGroup}
                    myRole={store.activeGroupRole}
                    myPrivacy={store.activeGroupPrivacy}
                    customCategories={customCategories}
                    onSelectGroup={store.setActiveGroupId}
                    onNavigate={handleNavigate}
                    onUpdateGroupPrivacy={store.updateGroupPrivacy}
                    onUpdateGroupDetails={store.updateGroupDetails}
                    onDeleteGroup={store.deleteGroup}
                  />
                )}

                {activePage === 'leaderboards' && (
                  <LeaderboardsView
                    currentUid={store.currentUid}
                    lang={lang}
                    privacy={privacy}
                    entries={store.leaderboardEntries}
                    friends={store.friends}
                    customCategories={customCategories}
                    onUpdatePrivacy={store.updatePrivacySettings}
                  />
                )}

                {activePage === 'challenges' && (
                  <ChallengesView
                    currentUid={store.currentUid}
                    lang={lang}
                    displayName={store.profile.displayName}
                    level={store.levelInfo.level}
                    totalXp={store.xpTotals.totalXp}
                    challenges={store.challenges}
                    challengeParticipants={store.challengeParticipants}
                    achievements={store.achievements}
                    customCategories={customCategories}
                    onJoinOrSync={store.joinOrUpdateChallenge}
                    onLeave={store.leaveChallenge}
                    onCreateChallenge={store.createChallenge}
                    onShowToast={store.showToast}
                  />
                )}

                {activePage === 'privacy' && (
                  <PrivacySettingsView
                    lang={lang}
                    privacy={privacy}
                    customCategories={customCategories}
                    onUpdatePrivacy={store.updatePrivacySettings}
                    onDeleteAccount={store.deleteAccountAndData}
                    onShowToast={store.showToast}
                  />
                )}

                {activePage === 'settings' && (
                  <SettingsView
                    profile={store.profile}
                    activities={store.activities}
                    dailyLogs={store.dailyLogs}
                    todayKey={store.todayKey}
                    groupChallengeBonusXp={store.xpTotals.groupChallengeXp}
                    user={store.user}
                    lang={lang}
                    isFirebaseConfigured={store.isFirebaseConfigured}
                    firebaseReachable={store.firebaseReachable}
                    onChangeLanguage={store.setLanguage}
                    onUpdateProfile={store.updateProfileSettings}
                    onToggleReligionTracking={store.toggleReligionTracking}
                    onOpenWizard={() => store.setShowOnboardingModal(true)}
                    onNavigate={handleNavigate}
                    onRestoreBackup={store.restoreFromBackup}
                    onResetAll={store.resetAllData}
                    onSignIn={store.handleSignIn}
                    onSignOut={store.handleSignOut}
                    onShowToast={store.showToast}
                  />
                )}
              </>
            )}
          </div>

          {/* Exact verbatim developer credit required on bottom of every main page */}
          <footer className="mt-10 pt-5 border-t border-white/[0.06] text-center text-xs text-slate-400">
            {DEVELOPER_CREDIT}
          </footer>
        </div>
      </main>

      {/* Mobile Bottom Tab Bar (56px, thumb-zone) */}
      <nav
        aria-label={t.mobileNavAria}
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 h-14 bg-[#0F141F]/95 backdrop-blur-md border-t border-white/[0.08] grid grid-cols-5 items-center"
      >
        {mobilePrimaryTabs.map((id) => {
          const item = navItems.find((n) => n.id === id)!;
          const Icon = NAV_ICONS[id];
          const active = activePage === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleNavigate(id)}
              className={`h-full flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
                active ? 'text-amber-400' : 'text-slate-400'
              }`}
            >
              <Icon className="w-5 h-5" aria-hidden="true" />
              <span className="truncate">{item.shortLabel}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileMenuOpen((v) => !v)}
          className={`h-full flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
            !mobilePrimaryTabs.includes(activePage)
              ? 'text-amber-400'
              : 'text-slate-400'
          }`}
        >
          <Target className="w-5 h-5" aria-hidden="true" />
          <span>{t.moreTab}</span>
        </button>
      </nav>

      {/* Setup / Onboarding Wizard Modal */}
      {store.showOnboardingModal && (
        <OnboardingWizard
          profile={store.profile}
          existingActivities={store.activities}
          lang={lang}
          onChangeLanguage={store.setLanguage}
          onComplete={store.completeOnboarding}
          onSkip={() => store.setShowOnboardingModal(false)}
        />
      )}

      {/* Non-intrusive Toast Notification */}
      {store.statusMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-16 lg:bottom-6 right-4 z-50 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-medium shadow-lg"
        >
          {store.statusMessage}
        </div>
      )}
    </div>
  );
}
