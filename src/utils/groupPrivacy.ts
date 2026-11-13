import {
  AchievementItem,
  ActivityDefinition,
  CustomCategoryDef,
  DailyLog,
  FriendGroup,
  GroupChallenge,
  GroupChallengeParticipant,
  GroupMember,
  GroupPrivacySettings,
  GroupRole,
  GroupSharedProgress,
} from '../types/quest';
import { getLastNDaysKeys } from './dhakaTime';
import { calculateActivityProgress, getEntryNumericValue, isSpiritualActivity } from './gamification';
import { isValidUsername, NEVER_SHARE_CATEGORIES, normalizeUsername, sanitizeSharedCategories } from './privacy';

// Strict zero-trust default: sharing is OFF by default for every group
export const DEFAULT_GROUP_PRIVACY_SETTINGS: GroupPrivacySettings = {
  sharingEnabled: false,
  showXp: false,
  showLevel: false,
  showStreaks: false,
  showAchievements: false,
  showWeeklySummary: false,
  showMonthlySummary: false,
  sharedCategories: [],
};

export function generateInviteCode(seed?: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const randomBytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(randomBytes);
  } else {
    for (let i = 0; i < randomBytes.length; i++) {
      const charCode = seed ? seed.charCodeAt(i % seed.length) : i * 37;
      randomBytes[i] = (Date.now() + charCode + i * 19) % 256;
    }
  }
  for (let i = 0; i < randomBytes.length; i++) {
    out += chars[randomBytes[i] % chars.length];
  }
  return out;
}

export function isValidInviteCode(code: string): boolean {
  return /^[a-zA-Z0-9_-]{6,32}$/.test(code.trim());
}

export function isSafeGroupImageUrl(url?: string): boolean {
  if (!url) return true;
  const trimmed = url.trim();
  if (!trimmed) return true;
  // Allow only compact inline SVG/PNG/JPEG/WebP data URLs or local bundled assets; never arbitrary external trackers
  return (
    (trimmed.startsWith('data:image/png;base64,') ||
      trimmed.startsWith('data:image/jpeg;base64,') ||
      trimmed.startsWith('data:image/webp;base64,')) &&
    trimmed.length <= 200_000
  );
}

// RBAC Guards
export function canManageGroupMembers(role?: GroupRole): boolean {
  return role === 'creator' || role === 'admin';
}

export function canAssignAdmin(role?: GroupRole): boolean {
  return role === 'creator';
}

export function canEditOrDeleteGroup(role?: GroupRole): boolean {
  return role === 'creator' || role === 'admin';
}

export function canRemoveGroupMember(
  actorRole: GroupRole | undefined,
  targetRole: GroupRole,
  isSelf: boolean
): boolean {
  if (isSelf) {
    // Creators cannot just leave while orphaned — they transfer/delete group
    return targetRole !== 'creator';
  }
  if (actorRole === 'creator') {
    return targetRole !== 'creator';
  }
  if (actorRole === 'admin') {
    return targetRole === 'member';
  }
  return false;
}

export function canViewerAccessGroup(
  group: FriendGroup,
  members: GroupMember[],
  viewerUid: string | null
): boolean {
  if (!viewerUid) return false;
  if (!group.isPrivate) return true;
  return (
    group.memberUids.includes(viewerUid) ||
    members.some((m) => m.groupId === group.id && m.uid === viewerUid)
  );
}

export function sanitizeGroupPrivacySettings(
  settings?: Partial<GroupPrivacySettings>,
  customCategories: CustomCategoryDef[] = []
): GroupPrivacySettings {
  const merged = {
    ...DEFAULT_GROUP_PRIVACY_SETTINGS,
    ...(settings ?? {}),
  };
  return {
    sharingEnabled: Boolean(merged.sharingEnabled),
    showXp: Boolean(merged.showXp),
    showLevel: Boolean(merged.showLevel),
    showStreaks: Boolean(merged.showStreaks),
    showAchievements: Boolean(merged.showAchievements),
    showWeeklySummary: Boolean(merged.showWeeklySummary),
    showMonthlySummary: Boolean(merged.showMonthlySummary),
    sharedCategories: sanitizeSharedCategories(merged.sharedCategories ?? [], customCategories),
  };
}

export function sanitizeGroupSharedProgress(input: {
  uid: string;
  groupId: string;
  username?: string;
  displayName: string;
  avatarId?: string;
  groupPrivacy?: GroupPrivacySettings;
  activities: ActivityDefinition[];
  customCategories?: CustomCategoryDef[];
  dailyLogs: Record<string, DailyLog>;
  achievements: AchievementItem[];
  totalXp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  todayKey: string;
}): GroupSharedProgress {
  const customCats = input.customCategories ?? [];
  const priv = sanitizeGroupPrivacySettings(input.groupPrivacy, customCats);
  const safeUsername = isValidUsername(input.username ?? '')
    ? input.username!
    : normalizeUsername(input.uid || 'adventurer').padEnd(3, '0').slice(0, 24);

  // Instant revocation / sharing OFF returns zero shared stats
  if (!priv.sharingEnabled) {
    return {
      uid: input.uid,
      groupId: input.groupId,
      username: safeUsername,
      displayName: (input.displayName || 'Adventurer').slice(0, 100),
      avatarId: (input.avatarId || 'crest').slice(0, 40),
      sharingEnabled: false,
      showXp: false,
      showLevel: false,
      showStreaks: false,
      showAchievements: false,
      showWeeklySummary: false,
      showMonthlySummary: false,
      sharedCategories: [],
      sharedBadges: [],
      categorySummaries: {},
      updatedAtIso: new Date().toISOString(),
    };
  }

  const allowedCategorySet = new Set(priv.sharedCategories);
  const shareableActs = input.activities.filter(
    (a) =>
      a.isActive &&
      allowedCategorySet.has(a.category) &&
      !NEVER_SHARE_CATEGORIES.has(a.category) &&
      !isSpiritualActivity(a, customCats)
  );

  // Compute daily/weekly completion strictly ONLY from explicitly shared safe categories
  const computeCategoryFilteredCompletion = (dateKeys: string[]): number => {
    if (shareableActs.length === 0 || dateKeys.length === 0) return 0;
    let sum = 0;
    let countedDays = 0;
    for (const key of dateKeys) {
      const log = input.dailyLogs[key];
      if (!log) continue;
      let ratioSum = 0;
      for (const act of shareableActs) {
        ratioSum += calculateActivityProgress(act, log.entries?.[act.id]).ratio;
      }
      sum += Math.round((ratioSum / shareableActs.length) * 100);
      countedDays += 1;
    }
    return countedDays > 0 ? Math.round(sum / countedDays) : 0;
  };

  const last7Keys = getLastNDaysKeys(input.todayKey, 7);
  const last30Keys = getLastNDaysKeys(input.todayKey, 30);

  const categorySummaries: Record<string, number> = {};
  for (const key of last7Keys) {
    const log = input.dailyLogs[key];
    if (!log) continue;
    for (const act of shareableActs) {
      const res = calculateActivityProgress(act, log.entries?.[act.id]);
      if (res.earnedXp > 0) {
        categorySummaries[act.category] = (categorySummaries[act.category] ?? 0) + res.earnedXp;
      }
    }
  }

  const sharedBadges = priv.showAchievements
    ? input.achievements
        .filter((a) => a.unlocked && !a.isSpiritual)
        .slice(0, 20)
        .map((a) => ({ id: a.id, title: a.title, tier: a.tier }))
    : [];

  return {
    uid: input.uid,
    groupId: input.groupId,
    username: safeUsername,
    displayName: (input.displayName || 'Adventurer').slice(0, 100),
    avatarId: (input.avatarId || 'crest').slice(0, 40),
    sharingEnabled: true,
    showXp: priv.showXp,
    showLevel: priv.showLevel,
    showStreaks: priv.showStreaks,
    showAchievements: priv.showAchievements,
    showWeeklySummary: priv.showWeeklySummary,
    showMonthlySummary: priv.showMonthlySummary,
    sharedCategories: priv.sharedCategories,
    dailyCompletionPct:
      priv.sharedCategories.length > 0
        ? computeCategoryFilteredCompletion([input.todayKey])
        : undefined,
    weeklyCompletionPct: priv.showWeeklySummary
      ? computeCategoryFilteredCompletion(last7Keys)
      : undefined,
    monthlyCompletionPct: priv.showMonthlySummary
      ? computeCategoryFilteredCompletion(last30Keys)
      : undefined,
    totalXp: priv.showXp ? Math.max(0, input.totalXp) : undefined,
    level: priv.showLevel ? Math.max(1, input.level) : undefined,
    currentStreak: priv.showStreaks ? Math.max(0, input.currentStreak) : undefined,
    longestStreak: priv.showStreaks ? Math.max(0, input.longestStreak) : undefined,
    sharedBadges,
    categorySummaries,
    updatedAtIso: new Date().toISOString(),
  };
}

// Read-time enforcement: guarantees unshared fields or revoked members are NEVER visible
export function filterGroupSharedProgressForViewer(
  share: GroupSharedProgress,
  viewerIsMember: boolean
): GroupSharedProgress | null {
  if (!viewerIsMember || !share.sharingEnabled) {
    return null;
  }
  const safeCats = (share.sharedCategories ?? []).filter(
    (c) => !NEVER_SHARE_CATEGORIES.has(c)
  );
  const safeCatSummaries: Record<string, number> = {};
  for (const cat of safeCats) {
    if (share.categorySummaries && share.categorySummaries[cat] !== undefined) {
      safeCatSummaries[cat] = share.categorySummaries[cat];
    }
  }
  return {
    uid: share.uid,
    groupId: share.groupId,
    username: share.username,
    displayName: share.displayName,
    avatarId: share.avatarId,
    sharingEnabled: true,
    showXp: share.showXp,
    showLevel: share.showLevel,
    showStreaks: share.showStreaks,
    showAchievements: share.showAchievements,
    showWeeklySummary: share.showWeeklySummary,
    showMonthlySummary: share.showMonthlySummary,
    sharedCategories: safeCats,
    dailyCompletionPct: safeCats.length > 0 ? share.dailyCompletionPct : undefined,
    weeklyCompletionPct: share.showWeeklySummary ? share.weeklyCompletionPct : undefined,
    monthlyCompletionPct: share.showMonthlySummary ? share.monthlyCompletionPct : undefined,
    totalXp: share.showXp ? share.totalXp : undefined,
    level: share.showLevel ? share.level : undefined,
    currentStreak: share.showStreaks ? share.currentStreak : undefined,
    longestStreak: share.showStreaks ? share.longestStreak : undefined,
    sharedBadges: share.showAchievements ? share.sharedBadges ?? [] : undefined,
    categorySummaries: safeCatSummaries,
    updatedAtIso: share.updatedAtIso,
  };
}

export function computeGroupChallengeParticipantValue(input: {
  challenge: GroupChallenge;
  activities: ActivityDefinition[];
  customCategories?: CustomCategoryDef[];
  dailyLogs: Record<string, DailyLog>;
  todayKey: string;
  manualValue?: number;
}): number {
  const { challenge } = input;
  // Custom challenges not tied to predefined activities use user's logged manual progress
  if (challenge.category === 'custom' || challenge.activityId === 'custom') {
    return Math.max(0, Math.round(input.manualValue ?? 0));
  }

  const customCats = input.customCategories ?? [];
  const windowDays =
    challenge.frequency === 'daily'
      ? 1
      : challenge.frequency === 'weekly'
        ? 7
        : challenge.frequency === 'monthly'
          ? 30
          : Math.max(1, challenge.durationDays);

  const keys = getLastNDaysKeys(input.todayKey, windowDays);
  const matchingActs = input.activities.filter((a) => {
    if (NEVER_SHARE_CATEGORIES.has(a.category) || isSpiritualActivity(a, customCats)) {
      return false;
    }
    if (challenge.activityId && challenge.activityId !== 'any') {
      return a.id === challenge.activityId;
    }
    return a.category === challenge.category;
  });

  let sum = 0;
  for (const key of keys) {
    const log = input.dailyLogs[key];
    if (!log) continue;
    for (const act of matchingActs) {
      sum += getEntryNumericValue(act, log.entries?.[act.id]);
    }
  }
  return Math.max(0, Math.round(sum));
}

export function computeGroupChallengeAggregate(
  challenge: GroupChallenge,
  participants: GroupChallengeParticipant[]
): {
  totalProgress: number;
  targetTotal: number;
  completionPct: number;
  completedMembersCount: number;
  totalParticipants: number;
} {
  const totalParticipants = participants.length;
  if (totalParticipants === 0) {
    return {
      totalProgress: 0,
      targetTotal: challenge.targetValue,
      completionPct: 0,
      completedMembersCount: 0,
      totalParticipants: 0,
    };
  }
  const totalProgress = participants.reduce((acc, p) => acc + Math.max(0, p.progressValue), 0);
  const targetTotal = Math.max(1, challenge.targetValue * totalParticipants);
  const completionPct = Math.min(100, Math.round((totalProgress / targetTotal) * 100));
  const completedMembersCount = participants.filter(
    (p) => p.progressValue >= challenge.targetValue || p.completed
  ).length;
  return {
    totalProgress,
    targetTotal,
    completionPct,
    completedMembersCount,
    totalParticipants,
  };
}

// Deterministic non-duplicating XP & badge calculation for completed group challenges
export function calculateGroupChallengeRewards(
  challenges: GroupChallenge[],
  participantsByChallenge: Record<string, GroupChallengeParticipant[]>,
  currentUid: string
): {
  totalBonusXp: number;
  earnedBadges: { challengeId: string; title: string; xpReward: number }[];
} {
  const seen = new Set<string>();
  let totalBonusXp = 0;
  const earnedBadges: { challengeId: string; title: string; xpReward: number }[] = [];

  for (const ch of challenges) {
    if (seen.has(ch.id)) continue;
    const part = (participantsByChallenge[ch.id] ?? []).find((p) => p.uid === currentUid);
    if (!part) continue;
    const isCompleted = part.completed || part.progressValue >= ch.targetValue;
    if (!isCompleted) continue;

    seen.add(ch.id);
    const reward = Math.max(0, ch.xpReward || 0);
    totalBonusXp += reward;
    if (ch.badgeTitle && ch.badgeTitle.trim()) {
      earnedBadges.push({
        challengeId: ch.id,
        title: ch.badgeTitle.trim(),
        xpReward: reward,
      });
    }
  }

  return { totalBonusXp, earnedBadges };
}
