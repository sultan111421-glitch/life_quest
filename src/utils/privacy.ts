import {
  AchievementItem,
  ActivityDefinition,
  DailyLog,
  LeaderboardEntry,
  PrivacySettings,
  PublicUserProfile,
  UserProfileData,
  UsernameSearchResult,
} from '../types/quest';
import { DEFAULT_PRIVACY_SETTINGS } from './defaults';
import { getLastNDaysKeys } from './dhakaTime';
import { calculateActivityProgress, getVisibleActivities } from './gamification';

// Categories NEVER allowed to appear in public profiles, leaderboards, or community stats
export const NEVER_SHARE_CATEGORIES = new Set(['spiritual', 'health']);

export function normalizeUsername(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 24);
}

export function isValidUsername(username: string): boolean {
  return /^[a-z0-9_]{3,24}$/.test(username);
}

export function sanitizeSharedCategories(
  categories: string[],
  customCategories: { id: string; isSpiritual?: boolean }[] = []
): string[] {
  const spiritualCustomIds = new Set(
    customCategories.filter((c) => c.isSpiritual).map((c) => c.id)
  );
  return categories
    .filter((c) => !NEVER_SHARE_CATEGORIES.has(c) && !spiritualCustomIds.has(c))
    .slice(0, 20);
}

export function getEffectivePrivacy(profile: UserProfileData): PrivacySettings {
  const p = profile.privacy ?? DEFAULT_PRIVACY_SETTINGS;
  return {
    ...DEFAULT_PRIVACY_SETTINGS,
    ...p,
    sharedCategories: sanitizeSharedCategories(
      p.sharedCategories ?? [],
      profile.customCategories
    ),
  };
}

export function sanitizePublicProfile(input: {
  uid: string;
  profile: UserProfileData;
  activities: ActivityDefinition[];
  dailyLogs: Record<string, DailyLog>;
  achievements: AchievementItem[];
  totalXp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  todayKey: string;
}): PublicUserProfile {
  const privacy = getEffectivePrivacy(input.profile);
  const username = isValidUsername(input.profile.username ?? '')
    ? input.profile.username!
    : normalizeUsername(input.uid || 'adventurer_01').padEnd(3, '0').slice(0, 24);

  const visibleActs = getVisibleActivities(
    input.activities,
    input.profile.religionTrackingEnabled ?? false,
    input.profile.customCategories
  ).filter((a) => !NEVER_SHARE_CATEGORIES.has(a.category));

  const last7Keys = getLastNDaysKeys(input.todayKey, 7);
  const last30Keys = getLastNDaysKeys(input.todayKey, 30);

  const avgForKeys = (keys: string[]): number => {
    const logs = keys.map((k) => input.dailyLogs[k]).filter(Boolean);
    if (logs.length === 0) return 0;
    return Math.round(
      logs.reduce((acc, log) => acc + (log.completionPct || 0), 0) / logs.length
    );
  };

  let completedQuestsCount = 0;
  for (const log of Object.values(input.dailyLogs)) {
    for (const act of visibleActs) {
      const res = calculateActivityProgress(act, log.entries?.[act.id]);
      if (res.completed) completedQuestsCount += 1;
    }
  }

  // Strictly omit private fields (email, dailyLogs, notes, spiritual/health, private stats)
  const sharedBadges = privacy.showAchievements
    ? input.achievements
        .filter((a) => a.unlocked && !a.isSpiritual)
        .slice(0, 20)
        .map((a) => ({ id: a.id, title: a.title, tier: a.tier }))
    : [];

  return {
    uid: input.uid,
    username,
    displayName: (input.profile.displayName || 'Adventurer').slice(0, 100),
    bio: privacy.visibility === 'private' ? '' : (input.profile.bio || '').slice(0, 240),
    avatarId: (input.profile.avatarId || 'crest').slice(0, 40),
    visibility: privacy.visibility,
    showXp: privacy.showXp,
    showLevel: privacy.showLevel,
    showAchievements: privacy.showAchievements,
    showStreaks: privacy.showStreaks,
    showWeeklyProgress: privacy.showWeeklyProgress,
    showMonthlyStats: privacy.showMonthlyStats,
    sharedCategories:
      privacy.visibility === 'private' ? [] : privacy.sharedCategories,
    totalXp: privacy.visibility !== 'private' && privacy.showXp ? Math.max(0, input.totalXp) : 0,
    level: privacy.visibility !== 'private' && privacy.showLevel ? Math.max(1, input.level) : 1,
    currentStreak:
      privacy.visibility !== 'private' && privacy.showStreaks
        ? Math.max(0, input.currentStreak)
        : 0,
    longestStreak:
      privacy.visibility !== 'private' && privacy.showStreaks
        ? Math.max(0, input.longestStreak)
        : 0,
    weeklyCompletionPct:
      privacy.visibility !== 'private' && privacy.showWeeklyProgress
        ? avgForKeys(last7Keys)
        : 0,
    monthlyCompletionPct:
      privacy.visibility !== 'private' && privacy.showMonthlyStats
        ? avgForKeys(last30Keys)
        : 0,
    completedQuestsCount:
      privacy.visibility !== 'private' ? completedQuestsCount : 0,
    sharedBadges: privacy.visibility !== 'private' ? sharedBadges : [],
  };
}

export function sanitizeLeaderboardEntry(input: {
  uid: string;
  profile: UserProfileData;
  activities: ActivityDefinition[];
  dailyLogs: Record<string, DailyLog>;
  totalXp: number;
  level: number;
  currentStreak: number;
  todayKey: string;
}): LeaderboardEntry | null {
  const privacy = getEffectivePrivacy(input.profile);
  if (!privacy.leaderboardOptIn) {
    return null;
  }

  const spiritualCustomIds = new Set(
    (input.profile.customCategories ?? [])
      .filter((c) => c.isSpiritual)
      .map((c) => c.id)
  );

  const safeActivities = input.activities.filter(
    (a) =>
      a.isActive &&
      !NEVER_SHARE_CATEGORIES.has(a.category) &&
      !spiritualCustomIds.has(a.category)
  );

  const last7Keys = getLastNDaysKeys(input.todayKey, 7);
  const last30Keys = getLastNDaysKeys(input.todayKey, 30);

  const sumXpForKeys = (keys: string[]) =>
    keys.reduce((sum, k) => sum + (input.dailyLogs[k]?.totalXpEarned ?? 0), 0);

  const avgPctForKeys = (keys: string[]) => {
    const logs = keys.map((k) => input.dailyLogs[k]).filter(Boolean);
    if (logs.length === 0) return 0;
    return Math.round(
      logs.reduce((sum, l) => sum + (l.completionPct || 0), 0) / logs.length
    );
  };

  // Category scores strictly exclude spiritual & health
  const categoryScores: Record<string, number> = {};
  for (const log of Object.values(input.dailyLogs)) {
    for (const act of safeActivities) {
      if (NEVER_SHARE_CATEGORIES.has(act.category)) continue;
      const res = calculateActivityProgress(act, log.entries?.[act.id]);
      if (res.earnedXp > 0) {
        categoryScores[act.category] =
          (categoryScores[act.category] ?? 0) + res.earnedXp;
      }
    }
  }

  const aliasSuffix = input.uid.slice(-3).toUpperCase() || '01';
  const displayLabel = privacy.leaderboardAnonymous
    ? `Anonymous Explorer #${aliasSuffix}`
    : (input.profile.displayName || 'Adventurer').slice(0, 100);

  return {
    uid: input.uid,
    optedIn: true,
    anonymous: privacy.leaderboardAnonymous,
    displayLabel,
    avatarId: privacy.leaderboardAnonymous
      ? 'shield'
      : (input.profile.avatarId || 'crest').slice(0, 40),
    totalXp: privacy.shareXpOnLeaderboard ? Math.max(0, input.totalXp) : 0,
    level: privacy.shareXpOnLeaderboard ? Math.max(1, input.level) : 1,
    weeklyXp: privacy.shareXpOnLeaderboard ? sumXpForKeys(last7Keys) : 0,
    monthlyXp: privacy.shareXpOnLeaderboard ? sumXpForKeys(last30Keys) : 0,
    weeklyCompletionPct: privacy.shareWeeklyOnLeaderboard
      ? avgPctForKeys(last7Keys)
      : 0,
    monthlyCompletionPct: privacy.shareWeeklyOnLeaderboard
      ? avgPctForKeys(last30Keys)
      : 0,
    currentStreak: privacy.shareStreakOnLeaderboard
      ? Math.max(0, input.currentStreak)
      : 0,
    categoryScores,
  };
}

export function canViewerAccessProfile(
  target: PublicUserProfile,
  viewerUid: string | null,
  isAcceptedFriend: boolean
): boolean {
  if (!viewerUid) return false;
  if (target.uid === viewerUid) return true;
  if (target.visibility === 'public') return true;
  if (target.visibility === 'friends' && isAcceptedFriend) return true;
  return false;
}

export function filterProfileForViewer(
  target: PublicUserProfile,
  viewerUid: string | null,
  isAcceptedFriend: boolean
): PublicUserProfile | null {
  if (!canViewerAccessProfile(target, viewerUid, isAcceptedFriend)) {
    return null;
  }
  const isOwner = target.uid === viewerUid;
  return {
    uid: target.uid,
    username: target.username,
    displayName: target.displayName,
    bio: target.bio,
    avatarId: target.avatarId,
    visibility: target.visibility,
    showXp: target.showXp,
    showLevel: target.showLevel,
    showAchievements: target.showAchievements,
    showStreaks: target.showStreaks,
    showWeeklyProgress: target.showWeeklyProgress,
    showMonthlyStats: target.showMonthlyStats,
    sharedCategories: (target.sharedCategories ?? []).filter(
      (c) => !NEVER_SHARE_CATEGORIES.has(c)
    ),
    totalXp: isOwner || target.showXp ? target.totalXp : undefined,
    level: isOwner || target.showLevel ? target.level : undefined,
    currentStreak: isOwner || target.showStreaks ? target.currentStreak : undefined,
    longestStreak: isOwner || target.showStreaks ? target.longestStreak : undefined,
    weeklyCompletionPct:
      isOwner || target.showWeeklyProgress ? target.weeklyCompletionPct : undefined,
    monthlyCompletionPct:
      isOwner || target.showMonthlyStats ? target.monthlyCompletionPct : undefined,
    completedQuestsCount: target.completedQuestsCount,
    sharedBadges:
      isOwner || target.showAchievements ? target.sharedBadges : undefined,
  };
}

export function searchVisibleUsernames(
  pool: PublicUserProfile[],
  queryStr: string,
  viewerUid: string | null
): UsernameSearchResult[] {
  const clean = queryStr.trim().toLowerCase().replace(/^@/, '');
  if (!clean) return [];
  return pool
    .filter((p) => {
      if (p.uid === viewerUid) return false;
      // Strict privacy gate: Private accounts are NEVER returned in search
      if (p.visibility === 'private') return false;
      return (
        p.username.toLowerCase().includes(clean) ||
        p.displayName.toLowerCase().includes(clean)
      );
    })
    .map((p) => ({
      uid: p.uid,
      username: p.username,
      displayName: p.displayName,
      avatarId: p.avatarId,
      visibility: p.visibility,
    }));
}
