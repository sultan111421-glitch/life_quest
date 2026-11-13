export type BuiltInCategory =
  | 'spiritual'
  | 'learning'
  | 'health'
  | 'focus'
  | 'personal'
  | 'career'
  | 'creative';

// Flexible category key: built-in slugs or custom category IDs
export type ActivityCategory = BuiltInCategory | (string & {});

export type InputType = 'prayer' | 'checkbox' | 'number' | 'time' | 'text';

export type PriorityLevel = 'high' | 'medium' | 'low';

export type PrayerKey = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

export interface PrayerState {
  fajr: boolean;
  dhuhr: boolean;
  asr: boolean;
  maghrib: boolean;
  isha: boolean;
}

export interface ActivityEntry {
  completed?: boolean;
  value?: number;
  hours?: number;
  minutes?: number;
  textValue?: string;
  prayers?: PrayerState;
}

export interface ActivityDefinition {
  id: string;
  title: string;
  category: ActivityCategory;
  inputType: InputType;
  unitLabel: string;
  dailyTarget: number;
  weeklyTarget?: number;
  monthlyTarget?: number;
  xpReward: number;
  priority?: PriorityLevel;
  reminderEnabled?: boolean;
  reminderTime?: string;
  order: number;
  isCore: boolean;
  isActive: boolean;
}

export interface CustomCategoryDef {
  id: string;
  name: string;
  isSpiritual?: boolean;
}

export interface PersonalGoalItem {
  id: string;
  title: string;
  targetLabel?: string;
  completed: boolean;
}

export type AccountVisibility = 'private' | 'friends' | 'public';

export interface PrivacySettings {
  visibility: AccountVisibility;
  showXp: boolean;
  showLevel: boolean;
  showAchievements: boolean;
  showStreaks: boolean;
  showWeeklyProgress: boolean;
  showMonthlyStats: boolean;
  sharedCategories: string[];
  leaderboardOptIn: boolean;
  leaderboardAnonymous: boolean;
  shareXpOnLeaderboard: boolean;
  shareStreakOnLeaderboard: boolean;
  shareWeeklyOnLeaderboard: boolean;
}

export interface DailyLog {
  dateKey: string; // YYYY-MM-DD in Asia/Dhaka
  entries: Record<string, ActivityEntry>;
  totalXpEarned: number;
  completionPct: number;
  completedCount: number;
  totalCount: number;
  note?: string;
  updatedAtIso?: string;
}

export type Language = 'en' | 'bn';

export interface LevelConfig {
  baseXpPerLevel: number;
  xpGrowthStep: number;
  dailyBonusXp: number;
}

export interface UserProfileData {
  displayName: string;
  username?: string;
  bio?: string;
  avatarId?: string;
  email?: string;
  language?: Language;
  levelConfig: LevelConfig;
  onboardingCompleted?: boolean;
  religionTrackingEnabled?: boolean;
  remindersEnabled?: boolean;
  enabledCategories?: string[];
  customCategories?: CustomCategoryDef[];
  personalGoals?: PersonalGoalItem[];
  privacy?: PrivacySettings;
}

export type NavPage =
  | 'dashboard'
  | 'quests'
  | 'calendar'
  | 'analytics'
  | 'achievements'
  | 'goals'
  | 'profile'
  | 'friends'
  | 'groups'
  | 'groupCreate'
  | 'groupDashboard'
  | 'groupMembers'
  | 'groupChallenges'
  | 'groupSettings'
  | 'leaderboards'
  | 'challenges'
  | 'privacy'
  | 'settings';

export interface AchievementItem {
  id: string;
  title: string;
  description: string;
  category: string;
  xpBonus: number;
  unlocked: boolean;
  progress: number;
  target: number;
  tier: 'bronze' | 'silver' | 'gold' | 'legendary';
  isSpiritual?: boolean;
}

export interface AnalyticsSnapshot {
  totalXp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  weeklyAvgCompletionPct: number;
  monthlyAvgCompletionPct: number;
  avgProductiveMinutes: number;
  avgWastedMinutes: number;
  avgNecessaryOrRestMinutes: number;
  totalLoggedDays: number;
}

export interface BackupPayload {
  version: number;
  exportedAt: string;
  profile: UserProfileData;
  activities: ActivityDefinition[];
  dailyLogs: Record<string, DailyLog>;
  analyticsSnapshot?: AnalyticsSnapshot;
}

// Sanitized Social Projection (ZERO PII, ZERO dailyLogs, ZERO spiritual/health records)
export interface SharedBadgeSummary {
  id: string;
  title: string;
  tier: 'bronze' | 'silver' | 'gold' | 'legendary';
}

export interface PublicUserProfile {
  uid: string;
  username: string;
  displayName: string;
  bio?: string;
  avatarId?: string;
  visibility: AccountVisibility;
  showXp: boolean;
  showLevel: boolean;
  showAchievements: boolean;
  showStreaks: boolean;
  showWeeklyProgress: boolean;
  showMonthlyStats: boolean;
  sharedCategories: string[];
  totalXp?: number;
  level?: number;
  currentStreak?: number;
  longestStreak?: number;
  weeklyCompletionPct?: number;
  monthlyCompletionPct?: number;
  completedQuestsCount?: number;
  sharedBadges?: SharedBadgeSummary[];
}

export interface UsernameSearchResult {
  uid: string;
  username: string;
  displayName: string;
  avatarId?: string;
  visibility: AccountVisibility;
}

export interface FriendRequestItem {
  id: string;
  fromUid: string;
  toUid: string;
  fromUsername: string;
  fromDisplayName: string;
  toUsername: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAtIso?: string;
}

export interface FriendEdgeItem {
  uid: string;
  friendUid: string;
  requestId: string;
  friendUsername: string;
  friendDisplayName: string;
  friendAvatarId?: string;
}

export interface LeaderboardEntry {
  uid: string;
  optedIn: boolean;
  anonymous: boolean;
  displayLabel: string;
  avatarId?: string;
  totalXp: number;
  level: number;
  weeklyXp: number;
  monthlyXp: number;
  weeklyCompletionPct: number;
  monthlyCompletionPct: number;
  currentStreak: number;
  categoryScores: Record<string, number>;
}

export interface CommunityChallenge {
  id: string;
  creatorUid: string;
  title: string;
  description: string;
  category: string;
  targetValue: number;
  unitLabel: string;
  durationDays: number;
  isBuiltIn?: boolean;
}

export interface ChallengeParticipant {
  uid: string;
  challengeId: string;
  displayLabel: string;
  progressValue: number;
}

// Friends Group System
export type GroupRole = 'creator' | 'admin' | 'member';

export interface FriendGroup {
  id: string;
  name: string;
  description: string;
  avatarId?: string;
  imageUrl?: string;
  creatorUid: string;
  isPrivate: boolean;
  inviteCode: string;
  memberUids: string[];
  memberCount: number;
  createdAtIso?: string;
}

export interface GroupMember {
  uid: string;
  groupId: string;
  username: string;
  displayName: string;
  avatarId?: string;
  role: GroupRole;
  joinedAtIso?: string;
}

export interface GroupInvitation {
  id: string;
  groupId: string;
  groupName: string;
  groupDescription: string;
  fromUid: string;
  fromUsername: string;
  fromDisplayName: string;
  toUid: string;
  toUsername: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAtIso?: string;
}

export interface GroupInviteLink {
  code: string;
  groupId: string;
  groupName: string;
  creatorUid: string;
  active: boolean;
  createdAtIso?: string;
}

export interface GroupPrivacySettings {
  sharingEnabled: boolean;
  showXp: boolean;
  showLevel: boolean;
  showStreaks: boolean;
  showAchievements: boolean;
  showWeeklySummary: boolean;
  showMonthlySummary: boolean;
  sharedCategories: string[];
}

export interface GroupSharedProgress {
  uid: string;
  groupId: string;
  username: string;
  displayName: string;
  avatarId?: string;
  sharingEnabled: boolean;
  showXp: boolean;
  showLevel: boolean;
  showStreaks: boolean;
  showAchievements: boolean;
  showWeeklySummary: boolean;
  showMonthlySummary: boolean;
  sharedCategories: string[];
  dailyCompletionPct?: number;
  weeklyCompletionPct?: number;
  monthlyCompletionPct?: number;
  totalXp?: number;
  level?: number;
  currentStreak?: number;
  longestStreak?: number;
  sharedBadges?: SharedBadgeSummary[];
  categorySummaries?: Record<string, number>;
  updatedAtIso?: string;
}

export interface GroupFeedItem {
  id: string;
  groupId: string;
  uid: string;
  displayName: string;
  avatarId?: string;
  type: 'achievement' | 'milestone' | 'challenge';
  title: string;
  detail: string;
  createdAtIso: string;
}

export type GroupChallengeFrequency = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface GroupChallenge {
  id: string;
  groupId: string;
  creatorUid: string;
  title: string;
  description: string;
  frequency: GroupChallengeFrequency;
  category: string; // 'custom' or safe non-private category slug
  activityId?: string; // optional link to predefined activity or 'custom'
  targetValue: number;
  unitLabel: string;
  durationDays: number;
  xpReward: number;
  badgeTitle?: string;
  createdAtIso?: string;
}

export interface GroupChallengeParticipant {
  uid: string;
  groupId: string;
  challengeId: string;
  displayName: string;
  avatarId?: string;
  progressValue: number;
  completed: boolean;
  xpAwarded: boolean;
  updatedAtIso?: string;
}

