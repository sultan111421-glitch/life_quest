import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ActivityDefinition,
  DailyLog,
  FriendGroup,
  GroupChallenge,
  GroupChallengeParticipant,
  GroupMember,
} from '../types/quest';
import {
  calculateGroupChallengeRewards,
  canAssignAdmin,
  canEditOrDeleteGroup,
  canRemoveGroupMember,
  canViewerAccessGroup,
  computeGroupChallengeAggregate,
  computeGroupChallengeParticipantValue,
  DEFAULT_GROUP_PRIVACY_SETTINGS,
  filterGroupSharedProgressForViewer,
  generateInviteCode,
  isValidInviteCode,
  sanitizeGroupSharedProgress,
} from './groupPrivacy';

const sampleActivities: ActivityDefinition[] = [
  {
    id: 'study',
    title: 'Study',
    category: 'learning',
    inputType: 'time',
    unitLabel: 'min',
    dailyTarget: 120,
    xpReward: 60,
    order: 0,
    isCore: true,
    isActive: true,
  },
  {
    id: 'sleep',
    title: 'Quality Sleep',
    category: 'health',
    inputType: 'number',
    unitLabel: 'hrs',
    dailyTarget: 8,
    xpReward: 35,
    order: 1,
    isCore: true,
    isActive: true,
  },
  {
    id: 'prayer',
    title: 'Five Daily Prayers',
    category: 'spiritual',
    inputType: 'prayer',
    unitLabel: 'waqt',
    dailyTarget: 5,
    xpReward: 100,
    order: 2,
    isCore: false,
    isActive: true,
  },
];

const sampleLogs: Record<string, DailyLog> = {
  '2026-11-13': {
    dateKey: '2026-11-13',
    entries: {
      study: { hours: 2, minutes: 0 },
      sleep: { value: 8 },
      prayer: {
        prayers: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true },
      },
    },
    totalXpEarned: 195,
    completionPct: 100,
    completedCount: 3,
    totalCount: 3,
    note: 'Strictly private personal diary note',
  },
};

test('group privacy defaults to sharing OFF and blocks non-members from private groups', () => {
  assert.equal(DEFAULT_GROUP_PRIVACY_SETTINGS.sharingEnabled, false);
  assert.equal(DEFAULT_GROUP_PRIVACY_SETTINGS.showXp, false);
  assert.equal(DEFAULT_GROUP_PRIVACY_SETTINGS.showLevel, false);
  assert.equal(DEFAULT_GROUP_PRIVACY_SETTINGS.showStreaks, false);
  assert.equal(DEFAULT_GROUP_PRIVACY_SETTINGS.showAchievements, false);
  assert.equal(DEFAULT_GROUP_PRIVACY_SETTINGS.showWeeklySummary, false);
  assert.equal(DEFAULT_GROUP_PRIVACY_SETTINGS.showMonthlySummary, false);
  assert.deepEqual(DEFAULT_GROUP_PRIVACY_SETTINGS.sharedCategories, []);

  const group: FriendGroup = {
    id: 'grp_1',
    name: 'Study Guild',
    description: 'Private accountability group',
    creatorUid: 'u1',
    isPrivate: true,
    inviteCode: 'STUDY99',
    memberUids: ['u1', 'u2'],
    memberCount: 2,
  };
  const members: GroupMember[] = [
    { uid: 'u1', groupId: 'grp_1', username: 'alice', displayName: 'Alice', role: 'creator' },
    { uid: 'u2', groupId: 'grp_1', username: 'bob', displayName: 'Bob', role: 'member' },
  ];

  assert.equal(canViewerAccessGroup(group, members, 'u1'), true);
  assert.equal(canViewerAccessGroup(group, members, 'u2'), true);
  assert.equal(canViewerAccessGroup(group, members, 'stranger_99'), false);
  assert.equal(canViewerAccessGroup(group, members, null), false);
});

test('invite code generator produces valid rules-compliant alphanumeric codes', () => {
  const code = generateInviteCode('seed_test');
  assert.equal(isValidInviteCode(code), true);
  assert.equal(isValidInviteCode('bad$code!'), false);
  assert.equal(isValidInviteCode('abc'), false);
});

test('RBAC guards enforce creator-only admin assignment and prevent removing creator', () => {
  assert.equal(canAssignAdmin('creator'), true);
  assert.equal(canAssignAdmin('admin'), false);
  assert.equal(canAssignAdmin('member'), false);

  assert.equal(canEditOrDeleteGroup('creator'), true);
  assert.equal(canEditOrDeleteGroup('admin'), true);
  assert.equal(canEditOrDeleteGroup('member'), false);

  // Admin cannot remove creator or another admin, can remove regular member
  assert.equal(canRemoveGroupMember('admin', 'creator', false), false);
  assert.equal(canRemoveGroupMember('admin', 'admin', false), false);
  assert.equal(canRemoveGroupMember('admin', 'member', false), true);

  // Creator can remove admin/member, member can leave, creator cannot leave without deleting/transferring
  assert.equal(canRemoveGroupMember('creator', 'admin', false), true);
  assert.equal(canRemoveGroupMember('member', 'member', true), true);
  assert.equal(canRemoveGroupMember('creator', 'creator', true), false);
});

test('sanitizeGroupSharedProgress strips spiritual, health, notes, daily logs and respects instant revocation', () => {
  // 1. Selective sharing ON for learning + XP + streaks only
  const shared = sanitizeGroupSharedProgress({
    uid: 'u1',
    groupId: 'grp_1',
    username: 'alice',
    displayName: 'Alice',
    groupPrivacy: {
      sharingEnabled: true,
      showXp: true,
      showLevel: false,
      showStreaks: true,
      showAchievements: false,
      showWeeklySummary: true,
      showMonthlySummary: false,
      sharedCategories: ['learning', 'spiritual', 'health'], // attempts to share private categories
    },
    activities: sampleActivities,
    dailyLogs: sampleLogs,
    achievements: [
      {
        id: 'study_600',
        title: 'Deep Scholar',
        description: '',
        category: 'Study',
        xpBonus: 120,
        unlocked: true,
        progress: 600,
        target: 600,
        tier: 'silver',
      },
      {
        id: 'prayer_5',
        title: 'Devoted in Prayer',
        description: '',
        category: 'Spiritual',
        xpBonus: 150,
        unlocked: true,
        progress: 5,
        target: 5,
        tier: 'gold',
        isSpiritual: true,
      },
    ],
    totalXp: 1500,
    level: 5,
    currentStreak: 9,
    longestStreak: 12,
    todayKey: '2026-11-13',
  });

  // Never includes spiritual or health
  assert.deepEqual(shared.sharedCategories, ['learning']);
  assert.equal(shared.categorySummaries?.spiritual, undefined);
  assert.equal(shared.categorySummaries?.health, undefined);
  assert.equal(shared.categorySummaries?.learning, 60);
  // Respects field toggles
  assert.equal(shared.totalXp, 1500);
  assert.equal(shared.level, undefined);
  assert.equal(shared.currentStreak, 9);
  assert.equal(shared.weeklyCompletionPct, 100);
  assert.equal(shared.monthlyCompletionPct, undefined);
  assert.deepEqual(shared.sharedBadges, []);

  // Viewer check hides non-shared fields and blocks non-members
  const viewerView = filterGroupSharedProgressForViewer(shared, true);
  assert.ok(viewerView);
  assert.equal(viewerView.totalXp, 1500);
  assert.equal(viewerView.level, undefined);
  assert.equal(filterGroupSharedProgressForViewer(shared, false), null);

  // 2. Revoking sharing immediately removes access for all group members
  const revoked = sanitizeGroupSharedProgress({
    uid: 'u1',
    groupId: 'grp_1',
    username: 'alice',
    displayName: 'Alice',
    groupPrivacy: DEFAULT_GROUP_PRIVACY_SETTINGS,
    activities: sampleActivities,
    dailyLogs: sampleLogs,
    achievements: [],
    totalXp: 1500,
    level: 5,
    currentStreak: 9,
    longestStreak: 12,
    todayKey: '2026-11-13',
  });

  assert.equal(revoked.sharingEnabled, false);
  assert.equal(revoked.totalXp, undefined);
  assert.equal(filterGroupSharedProgressForViewer(revoked, true), null);
});

test('group challenges support activity-linked & custom challenges, aggregate progress, and non-duplicate rewards', () => {
  const linkedChallenge: GroupChallenge = {
    id: 'gc_study',
    groupId: 'grp_1',
    creatorUid: 'u1',
    title: 'Daily 100m Study',
    description: 'Study 100 minutes today',
    frequency: 'daily',
    category: 'learning',
    activityId: 'study',
    targetValue: 100,
    unitLabel: 'min',
    durationDays: 1,
    xpReward: 75,
    badgeTitle: 'Study Sprinter',
  };

  const customChallenge: GroupChallenge = {
    id: 'gc_custom',
    groupId: 'grp_1',
    creatorUid: 'u2',
    title: 'Mock Exam Problems',
    description: 'Solve 20 physics problems',
    frequency: 'custom',
    category: 'custom',
    activityId: 'custom',
    targetValue: 20,
    unitLabel: 'problems',
    durationDays: 7,
    xpReward: 100,
    badgeTitle: 'Problem Solver',
  };

  const linkedVal = computeGroupChallengeParticipantValue({
    challenge: linkedChallenge,
    activities: sampleActivities,
    dailyLogs: sampleLogs,
    todayKey: '2026-11-13',
  });
  assert.equal(linkedVal, 120);

  const customVal = computeGroupChallengeParticipantValue({
    challenge: customChallenge,
    activities: sampleActivities,
    dailyLogs: sampleLogs,
    todayKey: '2026-11-13',
    manualValue: 20,
  });
  assert.equal(customVal, 20);

  const participants: GroupChallengeParticipant[] = [
    {
      uid: 'u1',
      groupId: 'grp_1',
      challengeId: 'gc_study',
      displayName: 'Alice',
      progressValue: 120,
      completed: true,
      xpAwarded: true,
    },
    {
      uid: 'u2',
      groupId: 'grp_1',
      challengeId: 'gc_study',
      displayName: 'Bob',
      progressValue: 80,
      completed: false,
      xpAwarded: false,
    },
  ];

  const agg = computeGroupChallengeAggregate(linkedChallenge, participants);
  assert.equal(agg.totalProgress, 200);
  assert.equal(agg.targetTotal, 200);
  assert.equal(agg.completionPct, 100);
  assert.equal(agg.completedMembersCount, 1);

  // Rewards never double-count even if challenge list has duplicates
  const rewards = calculateGroupChallengeRewards(
    [linkedChallenge, linkedChallenge, customChallenge],
    {
      gc_study: participants,
      gc_custom: [
        {
          uid: 'u1',
          groupId: 'grp_1',
          challengeId: 'gc_custom',
          displayName: 'Alice',
          progressValue: 20,
          completed: true,
          xpAwarded: true,
        },
      ],
    },
    'u1'
  );
  assert.equal(rewards.totalBonusXp, 175);
  assert.equal(rewards.earnedBadges.length, 2);
});
