import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PRIVACY_SETTINGS,
  DEFAULT_PROFILE,
  OPTIONAL_SPIRITUAL_TEMPLATES,
  CORE_PRODUCTIVITY_ACTIVITIES,
  SAMPLE_COMMUNITY_PROFILES,
} from './defaults';
import {
  filterProfileForViewer,
  isValidUsername,
  sanitizeLeaderboardEntry,
  sanitizePublicProfile,
  searchVisibleUsernames,
} from './privacy';
import { DailyLog, UserProfileData } from '../types/quest';

test('default privacy settings enforce Private visibility and Leaderboard OFF', () => {
  assert.equal(DEFAULT_PRIVACY_SETTINGS.visibility, 'private');
  assert.equal(DEFAULT_PRIVACY_SETTINGS.leaderboardOptIn, false);
  assert.equal(DEFAULT_PROFILE.religionTrackingEnabled, false);
});

test('3-persona privacy rules strictly isolate Private, Friends-only, and Public profiles', () => {
  const privatePersona = SAMPLE_COMMUNITY_PROFILES.find((p) => p.uid === 'persona_private_1')!;
  const friendsPersona = SAMPLE_COMMUNITY_PROFILES.find((p) => p.uid === 'persona_friends_2')!;
  const publicPersona = SAMPLE_COMMUNITY_PROFILES.find((p) => p.uid === 'persona_public_3')!;

  // 1. Private persona: blocked from strangers AND friends; hidden from username search
  assert.equal(filterProfileForViewer(privatePersona, 'viewer_1', false), null);
  assert.equal(filterProfileForViewer(privatePersona, 'viewer_1', true), null);
  assert.notEqual(filterProfileForViewer(privatePersona, 'persona_private_1', false), null);
  assert.equal(searchVisibleUsernames(SAMPLE_COMMUNITY_PROFILES, 'silent_owl', 'viewer_1').length, 0);

  // 2. Friends-only persona: blocked from non-friends, selectively shared to accepted friends
  assert.equal(filterProfileForViewer(friendsPersona, 'viewer_stranger', false), null);
  const friendView = filterProfileForViewer(friendsPersona, 'viewer_friend', true);
  assert.ok(friendView);
  assert.equal(friendView?.totalXp, friendsPersona.totalXp);
  // Owner disabled showMonthlyStats -> MUST remain undefined to friends
  assert.equal(friendView?.monthlyCompletionPct, undefined);

  // 3. Public persona: visible to signed-in viewers, discoverable in search
  const publicView = filterProfileForViewer(publicPersona, 'viewer_stranger', false);
  assert.ok(publicView);
  assert.equal(publicView?.totalXp, publicPersona.totalXp);
  const searchResults = searchVisibleUsernames(SAMPLE_COMMUNITY_PROFILES, 'tania', 'viewer_stranger');
  assert.equal(searchResults.length, 1);
  assert.equal(searchResults[0].username, 'tania_quests');
});

test('sanitizePublicProfile and sanitizeLeaderboardEntry never leak PII, daily logs, spiritual or health data', () => {
  const combinedActs = [...CORE_PRODUCTIVITY_ACTIVITIES, ...OPTIONAL_SPIRITUAL_TEMPLATES];
  const logs: Record<string, DailyLog> = {
    '2026-11-13': {
      dateKey: '2026-11-13',
      entries: {
        prayer: { prayers: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true } },
        quran: { value: 30 },
        sleep: { value: 8 },
        study: { hours: 2, minutes: 0 },
      },
      totalXpEarned: 235,
      completionPct: 90,
      completedCount: 4,
      totalCount: 10,
      note: 'Secret personal reflection note',
    },
  };

  const privateOwnerProfile: UserProfileData = {
    ...DEFAULT_PROFILE,
    displayName: 'Test Explorer',
    username: 'test_explorer',
    email: 'secret@example.com',
    religionTrackingEnabled: true,
    customCategories: [{ id: 'custom_faith', name: 'My Faith', isSpiritual: true }],
    privacy: {
      ...DEFAULT_PRIVACY_SETTINGS,
      visibility: 'public',
      showXp: true,
      showLevel: true,
      showAchievements: true,
      sharedCategories: ['learning', 'spiritual', 'health', 'custom_faith'],
      leaderboardOptIn: false,
      leaderboardAnonymous: true,
    },
  };

  const publicProj = sanitizePublicProfile({
    uid: 'user_abc',
    profile: privateOwnerProfile,
    activities: combinedActs,
    dailyLogs: logs,
    achievements: [
      {
        id: 'prayer_5',
        title: 'Devoted in Prayer',
        description: 'Private',
        category: 'Spiritual',
        xpBonus: 150,
        unlocked: true,
        progress: 5,
        target: 5,
        tier: 'silver',
        isSpiritual: true,
      },
      {
        id: 'study_600',
        title: 'Deep Scholar',
        description: 'Study',
        category: 'Study',
        xpBonus: 160,
        unlocked: true,
        progress: 600,
        target: 600,
        tier: 'silver',
      },
    ],
    totalXp: 1500,
    level: 4,
    currentStreak: 5,
    longestStreak: 7,
    todayKey: '2026-11-13',
  });

  // Never expose email, dailyLogs, notes, spiritual/health categories, or spiritual badges
  assert.equal('email' in publicProj, false);
  assert.equal('dailyLogs' in publicProj, false);
  assert.equal('note' in publicProj, false);
  assert.deepEqual(publicProj.sharedCategories, ['learning']);
  assert.equal(publicProj.sharedBadges?.some((b) => b.id === 'prayer_5'), false);
  assert.equal(publicProj.sharedBadges?.some((b) => b.id === 'study_600'), true);

  // Leaderboard OFF by default returns null
  assert.equal(
    sanitizeLeaderboardEntry({
      uid: 'user_abc',
      profile: privateOwnerProfile,
      activities: combinedActs,
      dailyLogs: logs,
      totalXp: 1500,
      level: 4,
      currentStreak: 5,
      todayKey: '2026-11-13',
    }),
    null
  );

  // Opted-in with anonymous mode masks real displayName and strips spiritual/health categoryScores
  const optedInProfile: UserProfileData = {
    ...privateOwnerProfile,
    privacy: {
      ...privateOwnerProfile.privacy!,
      leaderboardOptIn: true,
      leaderboardAnonymous: true,
    },
  };
  const lb = sanitizeLeaderboardEntry({
    uid: 'user_abc',
    profile: optedInProfile,
    activities: combinedActs,
    dailyLogs: logs,
    totalXp: 1500,
    level: 4,
    currentStreak: 5,
    todayKey: '2026-11-13',
  });
  assert.ok(lb);
  assert.ok(lb!.displayLabel.startsWith('Anonymous Explorer'));
  assert.equal('spiritual' in lb!.categoryScores, false);
  assert.equal('health' in lb!.categoryScores, false);
  assert.ok((lb!.categoryScores.learning ?? 0) > 0);
});

test('isValidUsername enforces lowercase handle bounds', () => {
  assert.equal(isValidUsername('shohag_me23'), true);
  assert.equal(isValidUsername('ab'), false);
  assert.equal(isValidUsername('BadHandle!'), false);
});
