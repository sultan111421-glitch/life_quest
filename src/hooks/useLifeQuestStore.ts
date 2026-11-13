import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  DocumentReference,
  Firestore,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  ActivityDefinition,
  ActivityEntry,
  BackupPayload,
  ChallengeParticipant,
  CommunityChallenge,
  CustomCategoryDef,
  DailyLog,
  FriendEdgeItem,
  FriendGroup,
  FriendRequestItem,
  GroupChallenge,
  GroupChallengeFrequency,
  GroupChallengeParticipant,
  GroupFeedItem,
  GroupInvitation,
  GroupInviteLink,
  GroupMember,
  GroupPrivacySettings,
  GroupRole,
  GroupSharedProgress,
  Language,
  LeaderboardEntry,
  LevelConfig,
  PersonalGoalItem,
  PrivacySettings,
  PublicUserProfile,
  UserProfileData,
  UsernameSearchResult,
} from '../types/quest';
import {
  auth,
  db,
  handleFirestoreError,
  isFirebaseConfigured,
  OperationType,
  signInWithGooglePopup,
  signOutUser,
  testFirestoreConnection,
} from '../lib/firebase';
import { getDhakaTodayKey } from '../utils/dhakaTime';
import {
  buildSeedDailyLogs,
  DEFAULT_ACTIVITIES,
  DEFAULT_COMMUNITY_CHALLENGES,
  DEFAULT_LEVEL_CONFIG,
  DEFAULT_PRIVACY_SETTINGS,
  DEFAULT_PROFILE,
  SAMPLE_CHALLENGE_PARTICIPANTS,
  SAMPLE_COMMUNITY_PROFILES,
  SAMPLE_EXTRA_JOINABLE_GROUPS,
  SAMPLE_FRIEND_EDGES,
  SAMPLE_FRIEND_REQUESTS,
  SAMPLE_GROUP_CHALLENGE_PARTICIPANTS,
  SAMPLE_GROUP_CHALLENGES,
  SAMPLE_GROUP_FEED,
  SAMPLE_GROUP_INVITATIONS,
  SAMPLE_GROUP_INVITE_LINKS,
  SAMPLE_GROUP_MEMBERS,
  SAMPLE_GROUP_PRIVACY_MAP,
  SAMPLE_GROUP_SHARED_PROGRESS,
  SAMPLE_GROUPS,
  SAMPLE_LEADERBOARD_ENTRIES,
} from '../utils/defaults';
import {
  calculateDailySummary,
  calculateGentleStreak,
  calculateLevelInfo,
  calculateTotalXpWithAchievements,
  evaluateAchievements,
  getEntryNumericValue,
  getVisibleActivities,
} from '../utils/gamification';
import {
  filterProfileForViewer,
  getEffectivePrivacy,
  isValidUsername,
  NEVER_SHARE_CATEGORIES,
  normalizeUsername,
  sanitizeLeaderboardEntry,
  sanitizePublicProfile,
  searchVisibleUsernames,
} from '../utils/privacy';
import {
  calculateGroupChallengeRewards,
  canAssignAdmin,
  canEditOrDeleteGroup,
  canManageGroupMembers,
  canRemoveGroupMember,
  canViewerAccessGroup,
  computeGroupChallengeParticipantValue,
  DEFAULT_GROUP_PRIVACY_SETTINGS,
  filterGroupSharedProgressForViewer,
  generateInviteCode,
  isSafeGroupImageUrl,
  isValidInviteCode,
  sanitizeGroupPrivacySettings,
  sanitizeGroupSharedProgress,
} from '../utils/groupPrivacy';
import { UI_COPY } from '../utils/i18n';

const STORAGE_KEY = 'life_quest_local_state_v2';
const LEGACY_STORAGE_KEY = 'life_quest_local_state_v1';
const LANG_STORAGE_KEY = 'life_quest_lang_v1';

function loadSavedLanguage(): Language {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === 'en' || saved === 'bn') return saved;
  } catch {
    // ignore storage access issues
  }
  return 'en';
}

interface LocalSocialState {
  friends: FriendEdgeItem[];
  friendRequests: FriendRequestItem[];
  challenges: CommunityChallenge[];
  challengeParticipants: Record<string, ChallengeParticipant[]>;
}

interface LocalGroupState {
  groups: FriendGroup[];
  groupMembers: Record<string, GroupMember[]>;
  groupInvitations: GroupInvitation[];
  groupInviteLinks: Record<string, GroupInviteLink>;
  groupPrivacyByGroup: Record<string, GroupPrivacySettings>;
  groupSharedProgress: Record<string, GroupSharedProgress[]>;
  groupFeed: Record<string, GroupFeedItem[]>;
  groupChallenges: Record<string, GroupChallenge[]>;
  groupChallengeParticipants: Record<string, GroupChallengeParticipant[]>;
}

interface LocalStoreState {
  profile: UserProfileData;
  activities: ActivityDefinition[];
  dailyLogs: Record<string, DailyLog>;
  social: LocalSocialState;
  groupsState?: LocalGroupState;
}

function defaultLocalSocialState(): LocalSocialState {
  return {
    friends: SAMPLE_FRIEND_EDGES,
    friendRequests: SAMPLE_FRIEND_REQUESTS,
    challenges: DEFAULT_COMMUNITY_CHALLENGES,
    challengeParticipants: SAMPLE_CHALLENGE_PARTICIPANTS,
  };
}

function defaultLocalGroupState(): LocalGroupState {
  return {
    groups: SAMPLE_GROUPS,
    groupMembers: SAMPLE_GROUP_MEMBERS,
    groupInvitations: SAMPLE_GROUP_INVITATIONS,
    groupInviteLinks: SAMPLE_GROUP_INVITE_LINKS,
    groupPrivacyByGroup: SAMPLE_GROUP_PRIVACY_MAP,
    groupSharedProgress: SAMPLE_GROUP_SHARED_PROGRESS,
    groupFeed: SAMPLE_GROUP_FEED,
    groupChallenges: SAMPLE_GROUP_CHALLENGES,
    groupChallengeParticipants: SAMPLE_GROUP_CHALLENGE_PARTICIPANTS,
  };
}

function loadInitialLocalState(todayKey: string): LocalStoreState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LocalStoreState>;
      if (
        parsed &&
        Array.isArray(parsed.activities) &&
        parsed.activities.length > 0 &&
        parsed.dailyLogs &&
        typeof parsed.dailyLogs === 'object'
      ) {
        const mergedProfile: UserProfileData = {
          ...DEFAULT_PROFILE,
          ...(parsed.profile ?? {}),
          privacy: {
            ...DEFAULT_PRIVACY_SETTINGS,
            ...(parsed.profile?.privacy ?? {}),
          },
        };
        return {
          profile: mergedProfile,
          activities: parsed.activities,
          dailyLogs: parsed.dailyLogs,
          social: parsed.social ?? defaultLocalSocialState(),
          groupsState: parsed.groupsState ?? defaultLocalGroupState(),
        };
      }
    }
  } catch {
    // ignore corrupted local storage and re-seed cleanly
  }

  const seedLogs = buildSeedDailyLogs(
    todayKey,
    DEFAULT_ACTIVITIES,
    calculateDailySummary,
    DEFAULT_LEVEL_CONFIG
  );
  return {
    profile: DEFAULT_PROFILE,
    activities: DEFAULT_ACTIVITIES,
    dailyLogs: seedLogs,
    social: defaultLocalSocialState(),
    groupsState: defaultLocalGroupState(),
  };
}

function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
}

type BatchOp =
  | { type: 'set'; ref: DocumentReference; data: Record<string, unknown> }
  | { type: 'update'; ref: DocumentReference; data: Record<string, unknown> }
  | { type: 'delete'; ref: DocumentReference };

async function commitChunkedOps(
  firestore: Firestore,
  ops: BatchOp[],
  chunkSize: number = 400
): Promise<void> {
  for (let i = 0; i < ops.length; i += chunkSize) {
    const slice = ops.slice(i, i + chunkSize);
    if (slice.length === 0) continue;
    const batch = writeBatch(firestore);
    for (const op of slice) {
      if (op.type === 'set') {
        batch.set(op.ref, op.data);
      } else if (op.type === 'update') {
        batch.update(op.ref, op.data);
      } else {
        batch.delete(op.ref);
      }
    }
    await batch.commit();
  }
}

export function useLifeQuestStore() {
  const [todayKey, setTodayKey] = useState<string>(() => getDhakaTodayKey());
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => getDhakaTodayKey());

  const initialLocal = useMemo(() => loadInitialLocalState(todayKey), [todayKey]);

  const [profile, setProfile] = useState<UserProfileData>(initialLocal.profile);
  const [activities, setActivities] = useState<ActivityDefinition[]>(initialLocal.activities);
  const [dailyLogs, setDailyLogs] = useState<Record<string, DailyLog>>(initialLocal.dailyLogs);
  const [language, setLanguageState] = useState<Language>(() => loadSavedLanguage());
  const [showOnboardingModal, setShowOnboardingModal] = useState<boolean>(false);

  // Social & Community state (cloud-backed when signed in, deterministic preview when local)
  const [friends, setFriends] = useState<FriendEdgeItem[]>(initialLocal.social.friends);
  const [friendRequests, setFriendRequests] = useState<FriendRequestItem[]>(
    initialLocal.social.friendRequests
  );
  const [cloudLeaderboard, setCloudLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [challenges, setChallenges] = useState<CommunityChallenge[]>(
    initialLocal.social.challenges
  );
  const [challengeParticipants, setChallengeParticipants] = useState<
    Record<string, ChallengeParticipant[]>
  >(initialLocal.social.challengeParticipants);

  // Friends Group System state
  const initialGroupState = initialLocal.groupsState ?? defaultLocalGroupState();
  const [groups, setGroups] = useState<FriendGroup[]>(initialGroupState.groups);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(
    initialGroupState.groups[0]?.id ?? null
  );
  const [groupMembers, setGroupMembers] = useState<Record<string, GroupMember[]>>(
    initialGroupState.groupMembers
  );
  const [groupInvitations, setGroupInvitations] = useState<GroupInvitation[]>(
    initialGroupState.groupInvitations
  );
  const [groupInviteLinks, setGroupInviteLinks] = useState<Record<string, GroupInviteLink>>(
    initialGroupState.groupInviteLinks
  );
  const [groupPrivacyByGroup, setGroupPrivacyByGroup] = useState<
    Record<string, GroupPrivacySettings>
  >(initialGroupState.groupPrivacyByGroup);
  const [groupSharedProgress, setGroupSharedProgress] = useState<
    Record<string, GroupSharedProgress[]>
  >(initialGroupState.groupSharedProgress);
  const [groupFeed, setGroupFeed] = useState<Record<string, GroupFeedItem[]>>(
    initialGroupState.groupFeed
  );
  const [groupChallenges, setGroupChallenges] = useState<Record<string, GroupChallenge[]>>(
    initialGroupState.groupChallenges
  );
  const [groupChallengeParticipants, setGroupChallengeParticipants] = useState<
    Record<string, GroupChallengeParticipant[]>
  >(initialGroupState.groupChallengeParticipants);

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(!isFirebaseConfigured);
  const [cloudLoading, setCloudLoading] = useState<boolean>(false);
  const [firebaseReachable, setFirebaseReachable] = useState<boolean>(isFirebaseConfigured);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const existingLogKeysRef = useRef<Set<string>>(new Set());
  const lastUsernameRef = useRef<string | undefined>(initialLocal.profile.username);
  const isBootstrappingRef = useRef<boolean>(false);
  const inFlightKeysRef = useRef<Set<string>>(new Set());

  const currentUid = user?.uid ?? 'local_guest';

  const reportCloudError = useCallback(
    (err: unknown, operationType: OperationType, path: string | null) => {
      try {
        handleFirestoreError(err, operationType, path);
      } catch {
        // Logged via handleFirestoreError audit JSON; surface friendly UI banner without uncaught rejection
      }
      setErrorMessage(UI_COPY[language].errorCloudSync);
    },
    [language]
  );

  // Sync HTML lang attribute and document title immediately on language change
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = UI_COPY[language].pageTitle;
    try {
      localStorage.setItem(LANG_STORAGE_KEY, language);
    } catch {
      // ignore
    }
  }, [language]);

  // Automatically track Asia/Dhaka date change (midnight rollover preserves historical logs)
  useEffect(() => {
    const timer = setInterval(() => {
      const current = getDhakaTodayKey();
      setTodayKey((prev) => {
        if (prev !== current) {
          setSelectedDateKey((sel) => (sel === prev ? current : sel));
          return current;
        }
        return prev;
      });
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  // Persist local guest mode seamlessly
  useEffect(() => {
    if (!user) {
      try {
        const payload: LocalStoreState = {
          profile,
          activities,
          dailyLogs,
          social: {
            friends,
            friendRequests,
            challenges,
            challengeParticipants,
          },
          groupsState: {
            groups,
            groupMembers,
            groupInvitations,
            groupInviteLinks,
            groupPrivacyByGroup,
            groupSharedProgress,
            groupFeed,
            groupChallenges,
            groupChallengeParticipants,
          },
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch (err) {
        console.error('Failed to save to localStorage:', err);
      }
    }
  }, [
    user,
    profile,
    activities,
    dailyLogs,
    friends,
    friendRequests,
    challenges,
    challengeParticipants,
    groups,
    groupMembers,
    groupInvitations,
    groupInviteLinks,
    groupPrivacyByGroup,
    groupSharedProgress,
    groupFeed,
    groupChallenges,
    groupChallengeParticipants,
  ]);

  // Boot Firestore connection check
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    testFirestoreConnection().then((ok) => {
      setFirebaseReachable(ok);
    });
  }, []);

  // Derived Visible Activities (hides religious tracking when disabled)
  const religionEnabled = Boolean(profile.religionTrackingEnabled);
  const visibleActivities = useMemo(
    () => getVisibleActivities(activities, religionEnabled, profile.customCategories),
    [activities, profile.customCategories, religionEnabled]
  );

  // Derived Gamification State
  const achievements = useMemo(
    () =>
      evaluateAchievements(
        dailyLogs,
        visibleActivities,
        profile.levelConfig,
        todayKey,
        language,
        religionEnabled
      ),
    [visibleActivities, dailyLogs, language, profile.levelConfig, religionEnabled, todayKey]
  );

  const allGroupChallengesList = useMemo(
    () => Object.values(groupChallenges).flat(),
    [groupChallenges]
  );

  const groupChallengeRewards = useMemo(
    () =>
      calculateGroupChallengeRewards(
        allGroupChallengesList,
        groupChallengeParticipants,
        currentUid
      ),
    [allGroupChallengesList, currentUid, groupChallengeParticipants]
  );

  const xpTotals = useMemo(() => {
    const base = calculateTotalXpWithAchievements(dailyLogs, achievements);
    return {
      ...base,
      groupChallengeXp: groupChallengeRewards.totalBonusXp,
      totalXp: base.totalXp + groupChallengeRewards.totalBonusXp,
    };
  }, [achievements, dailyLogs, groupChallengeRewards.totalBonusXp]);

  const levelInfo = useMemo(
    () => calculateLevelInfo(xpTotals.totalXp, profile.levelConfig, language),
    [language, profile.levelConfig, xpTotals.totalXp]
  );

  const streakInfo = useMemo(
    () => calculateGentleStreak(dailyLogs, todayKey),
    [dailyLogs, todayKey]
  );

  const todaySummary = useMemo(() => {
    const todayLog = dailyLogs[todayKey];
    return calculateDailySummary(
      visibleActivities,
      todayLog?.entries ?? {},
      profile.levelConfig
    );
  }, [visibleActivities, dailyLogs, profile.levelConfig, todayKey]);

  // Auth listener & Firestore bootstrapping
  useEffect(() => {
    if (!auth || !db) {
      setAuthReady(true);
      return;
    }

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);

      if (!firebaseUser) {
        existingLogKeysRef.current.clear();
        const local = loadInitialLocalState(getDhakaTodayKey());
        const gs = local.groupsState ?? defaultLocalGroupState();
        setProfile(local.profile);
        setActivities(local.activities);
        setDailyLogs(local.dailyLogs);
        setFriends(local.social.friends);
        setFriendRequests(local.social.friendRequests);
        setChallenges(local.social.challenges);
        setChallengeParticipants(local.social.challengeParticipants);
        setGroups(gs.groups);
        setActiveGroupId(gs.groups[0]?.id ?? null);
        setGroupMembers(gs.groupMembers);
        setGroupInvitations(gs.groupInvitations);
        setGroupInviteLinks(gs.groupInviteLinks);
        setGroupPrivacyByGroup(gs.groupPrivacyByGroup);
        setGroupSharedProgress(gs.groupSharedProgress);
        setGroupFeed(gs.groupFeed);
        setGroupChallenges(gs.groupChallenges);
        setGroupChallengeParticipants(gs.groupChallengeParticipants);
        return;
      }

      // Reset local guest/sample state immediately when switching to an authenticated cloud account
      existingLogKeysRef.current.clear();
      setDailyLogs({});
      setFriends([]);
      setFriendRequests([]);
      setCloudLeaderboard([]);
      setChallenges(DEFAULT_COMMUNITY_CHALLENGES);
      setChallengeParticipants({});
      setGroups([]);
      setActiveGroupId(null);
      setGroupMembers({});
      setGroupInvitations([]);
      setGroupInviteLinks({});
      setGroupPrivacyByGroup({});
      setGroupSharedProgress({});
      setGroupFeed({});
      setGroupChallenges({});
      setGroupChallengeParticipants({});

      setCloudLoading(true);
      setErrorMessage(null);
      const userDocPath = `users/${firebaseUser.uid}`;
      isBootstrappingRef.current = true;

      try {
        const firestore = db!;
        const userRef = doc(firestore, 'users', firebaseUser.uid);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
          const preferredLang = loadSavedLanguage();
          const autoUsername = normalizeUsername(
            `${(firebaseUser.displayName || 'user').split(' ')[0]}_${firebaseUser.uid.slice(0, 4)}`
          )
            .padEnd(5, '0')
            .slice(0, 24);
          const skipWizardParam =
            typeof window !== 'undefined' &&
            new URLSearchParams(window.location.search).get('autostart') === '1';

          const newProfile: UserProfileData = {
            displayName: (firebaseUser.displayName || 'Adventurer').slice(0, 100),
            username: autoUsername,
            bio: '',
            avatarId: 'crest',
            email: (firebaseUser.email || '').slice(0, 254),
            language: preferredLang,
            levelConfig: DEFAULT_LEVEL_CONFIG,
            onboardingCompleted: skipWizardParam,
            religionTrackingEnabled: false,
            remindersEnabled: false,
            enabledCategories: ['learning', 'health', 'focus', 'personal'],
            customCategories: [],
            personalGoals: [],
            privacy: DEFAULT_PRIVACY_SETTINGS,
          };

          await setDoc(userRef, {
            uid: firebaseUser.uid,
            displayName: newProfile.displayName,
            username: autoUsername,
            bio: '',
            avatarId: 'crest',
            ...(newProfile.email ? { email: newProfile.email } : {}),
            language: preferredLang,
            baseXpPerLevel: DEFAULT_LEVEL_CONFIG.baseXpPerLevel,
            xpGrowthStep: DEFAULT_LEVEL_CONFIG.xpGrowthStep,
            dailyBonusXp: DEFAULT_LEVEL_CONFIG.dailyBonusXp,
            onboardingCompleted: skipWizardParam,
            religionTrackingEnabled: false,
            remindersEnabled: false,
            enabledCategories: newProfile.enabledCategories,
            customCategories: [],
            personalGoals: [],
            privacy: DEFAULT_PRIVACY_SETTINGS,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          const ops: BatchOp[] = [];
          for (const act of DEFAULT_ACTIVITIES) {
            const actRef = doc(firestore, 'users', firebaseUser.uid, 'activities', act.id);
            ops.push({
              type: 'set',
              ref: actRef,
              data: {
                id: act.id,
                uid: firebaseUser.uid,
                title: act.title.slice(0, 100),
                category: act.category,
                inputType: act.inputType,
                unitLabel: act.unitLabel.slice(0, 40),
                dailyTarget: act.dailyTarget,
                ...(act.weeklyTarget !== undefined ? { weeklyTarget: act.weeklyTarget } : {}),
                ...(act.monthlyTarget !== undefined ? { monthlyTarget: act.monthlyTarget } : {}),
                xpReward: act.xpReward,
                ...(act.priority ? { priority: act.priority } : {}),
                order: act.order,
                isCore: act.isCore,
                isActive: act.isActive,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              },
            });
          }

          // Initialize Private split-collection projection (visibility: private, zero PII)
          ops.push({
            type: 'set',
            ref: doc(firestore, 'publicProfiles', firebaseUser.uid),
            data: {
              uid: firebaseUser.uid,
              username: autoUsername,
              displayName: newProfile.displayName,
              bio: '',
              avatarId: 'crest',
              visibility: 'private',
              showXp: false,
              showLevel: false,
              showAchievements: false,
              showStreaks: false,
              showWeeklyProgress: false,
              showMonthlyStats: false,
              sharedCategories: [],
              totalXp: 0,
              level: 1,
              currentStreak: 0,
              longestStreak: 0,
              weeklyCompletionPct: 0,
              monthlyCompletionPct: 0,
              completedQuestsCount: 0,
              sharedBadges: [],
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
          });

          ops.push({
            type: 'set',
            ref: doc(firestore, 'usernames', autoUsername),
            data: {
              uid: firebaseUser.uid,
              username: autoUsername,
              displayName: newProfile.displayName,
              avatarId: 'crest',
              visibility: 'private',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
          });

          await commitChunkedOps(firestore, ops);
          if (!skipWizardParam) {
            setShowOnboardingModal(true);
          }
        }
      } catch (err) {
        setCloudLoading(false);
        reportCloudError(err, OperationType.WRITE, userDocPath);
      } finally {
        isBootstrappingRef.current = false;
      }
    });

    return () => unsubAuth();
  }, [reportCloudError]);

  // Real-time Firestore listeners when authenticated
  useEffect(() => {
    if (!user || !db) return;

    const firestore = db;
    const uid = user.uid;
    const userRef = doc(firestore, 'users', uid);
    const actsQuery = query(
      collection(firestore, 'users', uid, 'activities'),
      where('uid', '==', uid)
    );
    const logsQuery = query(
      collection(firestore, 'users', uid, 'dailyLogs'),
      where('uid', '==', uid)
    );
    const friendsQuery = query(
      collection(firestore, 'users', uid, 'friends'),
      where('uid', '==', uid)
    );
    const incomingReqQuery = query(
      collection(firestore, 'friendRequests'),
      where('toUid', '==', uid)
    );
    const outgoingReqQuery = query(
      collection(firestore, 'friendRequests'),
      where('fromUid', '==', uid)
    );
    const leaderboardQuery = query(
      collection(firestore, 'leaderboards'),
      where('optedIn', '==', true),
      limit(100)
    );
    const challengesQuery = query(
      collection(firestore, 'challenges'),
      where('durationDays', '>=', 1),
      limit(100)
    );

    const unsubProfile = onSnapshot(
      userRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const cloudLang: Language =
            data.language === 'bn' || data.language === 'en'
              ? data.language
              : loadSavedLanguage();
          setLanguageState(cloudLang);
          const nextUsername = data.username ? String(data.username) : undefined;
          lastUsernameRef.current = nextUsername;
          const nextProfile: UserProfileData = {
            displayName: String(data.displayName || 'Adventurer'),
            username: nextUsername,
            bio: data.bio ? String(data.bio) : '',
            avatarId: data.avatarId ? String(data.avatarId) : 'crest',
            email: data.email ? String(data.email) : undefined,
            language: cloudLang,
            levelConfig: {
              baseXpPerLevel: Number(data.baseXpPerLevel ?? DEFAULT_LEVEL_CONFIG.baseXpPerLevel),
              xpGrowthStep: Number(data.xpGrowthStep ?? DEFAULT_LEVEL_CONFIG.xpGrowthStep),
              dailyBonusXp: Number(data.dailyBonusXp ?? DEFAULT_LEVEL_CONFIG.dailyBonusXp),
            },
            onboardingCompleted:
              data.onboardingCompleted !== undefined ? Boolean(data.onboardingCompleted) : true,
            religionTrackingEnabled: Boolean(data.religionTrackingEnabled),
            remindersEnabled: Boolean(data.remindersEnabled),
            enabledCategories: Array.isArray(data.enabledCategories)
              ? data.enabledCategories
              : ['learning', 'health', 'focus', 'personal'],
            customCategories: Array.isArray(data.customCategories) ? data.customCategories : [],
            personalGoals: Array.isArray(data.personalGoals) ? data.personalGoals : [],
            privacy: {
              ...DEFAULT_PRIVACY_SETTINGS,
              ...(data.privacy ?? {}),
            },
          };
          setProfile(nextProfile);
          if (data.onboardingCompleted === false) {
            const skipWizardParam =
              typeof window !== 'undefined' &&
              new URLSearchParams(window.location.search).get('autostart') === '1';
            if (!skipWizardParam) {
              setShowOnboardingModal(true);
            }
          }
        }
        setCloudLoading(false);
      },
      (error) => {
        setCloudLoading(false);
        reportCloudError(error, OperationType.GET, `users/${uid}`);
      }
    );

    const unsubActs = onSnapshot(
      actsQuery,
      (snapshot) => {
        const list: ActivityDefinition[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          list.push({
            id: String(d.id),
            title: String(d.title),
            category: d.category,
            inputType: d.inputType,
            unitLabel: String(d.unitLabel ?? ''),
            dailyTarget: Number(d.dailyTarget ?? 1),
            weeklyTarget: d.weeklyTarget !== undefined ? Number(d.weeklyTarget) : undefined,
            monthlyTarget: d.monthlyTarget !== undefined ? Number(d.monthlyTarget) : undefined,
            xpReward: Number(d.xpReward ?? 10),
            priority: d.priority ?? 'medium',
            reminderEnabled: Boolean(d.reminderEnabled),
            reminderTime: d.reminderTime ? String(d.reminderTime) : undefined,
            order: Number(d.order ?? 0),
            isCore: Boolean(d.isCore),
            isActive: Boolean(d.isActive),
          });
        });
        list.sort((a, b) => a.order - b.order);
        if (!snapshot.empty || !isBootstrappingRef.current) {
          setActivities(list);
        }
      },
      (error) => reportCloudError(error, OperationType.LIST, `users/${uid}/activities`)
    );

    const unsubLogs = onSnapshot(
      logsQuery,
      (snapshot) => {
        const map: Record<string, DailyLog> = {};
        const keySet = new Set<string>();
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          const dateKey = String(d.dateKey);
          keySet.add(dateKey);
          map[dateKey] = {
            dateKey,
            entries: (d.entries ?? {}) as Record<string, ActivityEntry>,
            totalXpEarned: Number(d.totalXpEarned ?? 0),
            completionPct: Number(d.completionPct ?? 0),
            completedCount: Number(d.completedCount ?? 0),
            totalCount: Number(d.totalCount ?? 0),
            note: d.note ? String(d.note) : undefined,
          };
        });
        existingLogKeysRef.current = keySet;
        setDailyLogs(map);
      },
      (error) => reportCloudError(error, OperationType.LIST, `users/${uid}/dailyLogs`)
    );

    const unsubFriends = onSnapshot(
      friendsQuery,
      (snapshot) => {
        const list: FriendEdgeItem[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          list.push({
            uid: String(d.uid),
            friendUid: String(d.friendUid),
            requestId: String(d.requestId),
            friendUsername: String(d.friendUsername),
            friendDisplayName: String(d.friendDisplayName),
            friendAvatarId: d.friendAvatarId ? String(d.friendAvatarId) : 'crest',
          });
        });
        setFriends(list);
      },
      (error) => reportCloudError(error, OperationType.LIST, `users/${uid}/friends`)
    );

    let incomingReqs: FriendRequestItem[] = [];
    let outgoingReqs: FriendRequestItem[] = [];
    const syncReqs = () => {
      const merged = [...incomingReqs, ...outgoingReqs];
      const byId = new Map<string, FriendRequestItem>();
      merged.forEach((r) => byId.set(r.id, r));
      setFriendRequests(Array.from(byId.values()));
    };

    const unsubInReq = onSnapshot(
      incomingReqQuery,
      (snapshot) => {
        incomingReqs = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: String(data.id),
            fromUid: String(data.fromUid),
            toUid: String(data.toUid),
            fromUsername: String(data.fromUsername),
            fromDisplayName: String(data.fromDisplayName),
            toUsername: String(data.toUsername),
            status: data.status,
          };
        });
        syncReqs();
      },
      (error) => reportCloudError(error, OperationType.LIST, 'friendRequests')
    );

    const unsubOutReq = onSnapshot(
      outgoingReqQuery,
      (snapshot) => {
        outgoingReqs = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: String(data.id),
            fromUid: String(data.fromUid),
            toUid: String(data.toUid),
            fromUsername: String(data.fromUsername),
            fromDisplayName: String(data.fromDisplayName),
            toUsername: String(data.toUsername),
            status: data.status,
          };
        });
        syncReqs();
      },
      (error) => reportCloudError(error, OperationType.LIST, 'friendRequests')
    );

    const unsubLeaderboard = onSnapshot(
      leaderboardQuery,
      (snapshot) => {
        const list: LeaderboardEntry[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          list.push({
            uid: String(d.uid),
            optedIn: Boolean(d.optedIn),
            anonymous: Boolean(d.anonymous),
            displayLabel: String(d.displayLabel),
            avatarId: d.avatarId ? String(d.avatarId) : 'crest',
            totalXp: Number(d.totalXp ?? 0),
            level: Number(d.level ?? 1),
            weeklyXp: Number(d.weeklyXp ?? 0),
            monthlyXp: Number(d.monthlyXp ?? 0),
            weeklyCompletionPct: Number(d.weeklyCompletionPct ?? 0),
            monthlyCompletionPct: Number(d.monthlyCompletionPct ?? 0),
            currentStreak: Number(d.currentStreak ?? 0),
            categoryScores: (d.categoryScores ?? {}) as Record<string, number>,
          });
        });
        setCloudLeaderboard(list);
      },
      (error) => reportCloudError(error, OperationType.LIST, 'leaderboards')
    );

    const unsubChallenges = onSnapshot(
      challengesQuery,
      (snapshot) => {
        const list: CommunityChallenge[] = [...DEFAULT_COMMUNITY_CHALLENGES];
        const existingIds = new Set(list.map((c) => c.id));
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (!existingIds.has(String(d.id))) {
            list.push({
              id: String(d.id),
              creatorUid: String(d.creatorUid),
              title: String(d.title),
              description: String(d.description ?? ''),
              category: String(d.category),
              targetValue: Number(d.targetValue ?? 10),
              unitLabel: String(d.unitLabel ?? 'min'),
              durationDays: Number(d.durationDays ?? 7),
            });
          }
        });
        setChallenges(list);
      },
      (error) => reportCloudError(error, OperationType.LIST, 'challenges')
    );

    const groupsQuery = query(
      collection(firestore, 'groups'),
      where('memberUids', 'array-contains', uid)
    );
    const inGroupInvitesQuery = query(
      collection(firestore, 'groupInvitations'),
      where('toUid', '==', uid)
    );
    const outGroupInvitesQuery = query(
      collection(firestore, 'groupInvitations'),
      where('fromUid', '==', uid)
    );

    const unsubGroups = onSnapshot(
      groupsQuery,
      (snapshot) => {
        const list: FriendGroup[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          list.push({
            id: String(d.id),
            name: String(d.name),
            description: String(d.description ?? ''),
            avatarId: d.avatarId ? String(d.avatarId) : 'compass',
            imageUrl: d.imageUrl ? String(d.imageUrl) : undefined,
            creatorUid: String(d.creatorUid),
            isPrivate: Boolean(d.isPrivate),
            inviteCode: String(d.inviteCode),
            memberUids: Array.isArray(d.memberUids) ? d.memberUids.map(String) : [],
            memberCount: Number(d.memberCount ?? 1),
          });
        });
        setGroups(list);
        setActiveGroupId((prev) =>
          prev && list.some((g) => g.id === prev) ? prev : (list[0]?.id ?? null)
        );
      },
      (error) => reportCloudError(error, OperationType.LIST, 'groups')
    );

    let inGroupInvites: GroupInvitation[] = [];
    let outGroupInvites: GroupInvitation[] = [];
    const syncGroupInvites = () => {
      const merged = [...inGroupInvites, ...outGroupInvites];
      const byId = new Map<string, GroupInvitation>();
      merged.forEach((inv) => byId.set(inv.id, inv));
      setGroupInvitations(Array.from(byId.values()));
    };

    const unsubInGroupInv = onSnapshot(
      inGroupInvitesQuery,
      (snapshot) => {
        inGroupInvites = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: String(d.id),
            groupId: String(d.groupId),
            groupName: String(d.groupName),
            groupDescription: String(d.groupDescription ?? ''),
            fromUid: String(d.fromUid),
            fromUsername: String(d.fromUsername),
            fromDisplayName: String(d.fromDisplayName),
            toUid: String(d.toUid),
            toUsername: String(d.toUsername),
            status: d.status,
          };
        });
        syncGroupInvites();
      },
      (error) => reportCloudError(error, OperationType.LIST, 'groupInvitations')
    );

    const unsubOutGroupInv = onSnapshot(
      outGroupInvitesQuery,
      (snapshot) => {
        outGroupInvites = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: String(d.id),
            groupId: String(d.groupId),
            groupName: String(d.groupName),
            groupDescription: String(d.groupDescription ?? ''),
            fromUid: String(d.fromUid),
            fromUsername: String(d.fromUsername),
            fromDisplayName: String(d.fromDisplayName),
            toUid: String(d.toUid),
            toUsername: String(d.toUsername),
            status: d.status,
          };
        });
        syncGroupInvites();
      },
      (error) => reportCloudError(error, OperationType.LIST, 'groupInvitations')
    );

    return () => {
      unsubProfile();
      unsubActs();
      unsubLogs();
      unsubFriends();
      unsubInReq();
      unsubOutReq();
      unsubLeaderboard();
      unsubChallenges();
      unsubGroups();
      unsubInGroupInv();
      unsubOutGroupInv();
    };
  }, [reportCloudError, user]);

  // Real-time listeners for community challenge participants when signed in
  const challengeIdsKey = useMemo(
    () => challenges.map((c) => c.id).sort().join(','),
    [challenges]
  );

  useEffect(() => {
    if (!user || !db || !challengeIdsKey) return;
    const firestore = db;
    const ids = challengeIdsKey.split(',').filter(Boolean);
    const unsubs = ids.map((chId) =>
      onSnapshot(
        query(
          collection(firestore, 'challenges', chId, 'participants'),
          where('challengeId', '==', chId),
          limit(100)
        ),
        (snap) => {
          const list: ChallengeParticipant[] = snap.docs.map((d) => {
            const data = d.data();
            return {
              uid: String(data.uid),
              challengeId: String(data.challengeId),
              displayLabel: String(data.displayLabel),
              progressValue: Number(data.progressValue ?? 0),
            };
          });
          setChallengeParticipants((prev) => ({ ...prev, [chId]: list }));
        },
        (error) =>
          reportCloudError(error, OperationType.LIST, `challenges/${chId}/participants`)
      )
    );
    return () => {
      unsubs.forEach((u) => u());
    };
  }, [challengeIdsKey, reportCloudError, user]);

  // Real-time listeners for active group subcollections (membership-gated)
  const activeGroupMemberCheck = useMemo(
    () => Boolean(activeGroupId && groups.some((g) => g.id === activeGroupId)),
    [activeGroupId, groups]
  );

  useEffect(() => {
    if (!user || !db || !activeGroupId || !activeGroupMemberCheck) return;
    const firestore = db;
    const uid = user.uid;

    const unsubMembers = onSnapshot(
      collection(firestore, 'groups', activeGroupId, 'members'),
      (snap) => {
        const list: GroupMember[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            uid: String(data.uid),
            groupId: String(data.groupId),
            username: String(data.username),
            displayName: String(data.displayName),
            avatarId: data.avatarId ? String(data.avatarId) : 'crest',
            role: data.role as GroupRole,
          };
        });
        setGroupMembers((prev) => ({ ...prev, [activeGroupId]: list }));
      },
      (error) => reportCloudError(error, OperationType.LIST, `groups/${activeGroupId}/members`)
    );

    const sharedQuery = query(
      collection(firestore, 'groups', activeGroupId, 'sharedProgress'),
      where('sharingEnabled', '==', true)
    );
    const unsubShared = onSnapshot(
      sharedQuery,
      (snap) => {
        const list: GroupSharedProgress[] = snap.docs.map((d) => d.data() as GroupSharedProgress);
        setGroupSharedProgress((prev) => ({ ...prev, [activeGroupId]: list }));
      },
      (error) =>
        reportCloudError(error, OperationType.LIST, `groups/${activeGroupId}/sharedProgress`)
    );

    const unsubOwnPriv = onSnapshot(
      doc(firestore, 'groups', activeGroupId, 'sharedProgress', uid),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data() as GroupSharedProgress;
          setGroupPrivacyByGroup((prev) => ({
            ...prev,
            [activeGroupId]: sanitizeGroupPrivacySettings(d, profile.customCategories),
          }));
        } else {
          setGroupPrivacyByGroup((prev) => ({
            ...prev,
            [activeGroupId]: DEFAULT_GROUP_PRIVACY_SETTINGS,
          }));
        }
      },
      (error) =>
        reportCloudError(
          error,
          OperationType.GET,
          `groups/${activeGroupId}/sharedProgress/${uid}`
        )
    );

    const unsubFeed = onSnapshot(
      query(
        collection(firestore, 'groups', activeGroupId, 'feed'),
        orderBy('createdAt', 'desc'),
        limit(50)
      ),
      (snap) => {
        const list: GroupFeedItem[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: String(data.id),
            groupId: String(data.groupId),
            uid: String(data.uid),
            displayName: String(data.displayName),
            avatarId: data.avatarId ? String(data.avatarId) : 'crest',
            type: data.type,
            title: String(data.title),
            detail: String(data.detail ?? ''),
            createdAtIso:
              data.createdAt && typeof data.createdAt.toDate === 'function'
                ? data.createdAt.toDate().toISOString()
                : new Date().toISOString(),
          };
        });
        list.sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
        setGroupFeed((prev) => ({ ...prev, [activeGroupId]: list }));
      },
      (error) => reportCloudError(error, OperationType.LIST, `groups/${activeGroupId}/feed`)
    );

    const unsubGroupChallenges = onSnapshot(
      collection(firestore, 'groups', activeGroupId, 'challenges'),
      (snap) => {
        const list: GroupChallenge[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: String(data.id),
            groupId: String(data.groupId),
            creatorUid: String(data.creatorUid),
            title: String(data.title),
            description: String(data.description ?? ''),
            frequency: data.frequency as GroupChallengeFrequency,
            category: String(data.category),
            activityId: data.activityId ? String(data.activityId) : undefined,
            targetValue: Number(data.targetValue ?? 1),
            unitLabel: String(data.unitLabel ?? 'min'),
            durationDays: Number(data.durationDays ?? 7),
            xpReward: Number(data.xpReward ?? 50),
            badgeTitle: data.badgeTitle ? String(data.badgeTitle) : undefined,
          };
        });
        setGroupChallenges((prev) => ({ ...prev, [activeGroupId]: list }));
      },
      (error) =>
        reportCloudError(error, OperationType.LIST, `groups/${activeGroupId}/challenges`)
    );

    return () => {
      unsubMembers();
      unsubShared();
      unsubOwnPriv();
      unsubFeed();
      unsubGroupChallenges();
    };
  }, [activeGroupId, activeGroupMemberCheck, profile.customCategories, reportCloudError, user]);

  const activeGroupChallengeIdsKey = useMemo(
    () =>
      activeGroupId
        ? (groupChallenges[activeGroupId] ?? []).map((c) => c.id).sort().join(',')
        : '',
    [activeGroupId, groupChallenges]
  );

  useEffect(() => {
    if (!user || !db || !activeGroupId || !activeGroupMemberCheck || !activeGroupChallengeIdsKey) {
      return;
    }
    const firestore = db;
    const challengeIds = activeGroupChallengeIdsKey.split(',').filter(Boolean);
    const unsubs = challengeIds.map((chId) =>
      onSnapshot(
        collection(firestore, 'groups', activeGroupId, 'challenges', chId, 'participants'),
        (snap) => {
          const list: GroupChallengeParticipant[] = snap.docs.map((d) => {
            const data = d.data();
            return {
              uid: String(data.uid),
              groupId: String(data.groupId),
              challengeId: String(data.challengeId),
              displayName: String(data.displayName),
              avatarId: data.avatarId ? String(data.avatarId) : 'crest',
              progressValue: Number(data.progressValue ?? 0),
              completed: Boolean(data.completed),
              xpAwarded: Boolean(data.xpAwarded),
            };
          });
          setGroupChallengeParticipants((prev) => ({ ...prev, [chId]: list }));
        },
        (error) =>
          reportCloudError(
            error,
            OperationType.LIST,
            `groups/${activeGroupId}/challenges/${chId}/participants`
          )
      )
    );
    return () => {
      unsubs.forEach((u) => u());
    };
  }, [activeGroupChallengeIdsKey, activeGroupId, activeGroupMemberCheck, reportCloudError, user]);

  const showToast = useCallback((msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => {
      setStatusMessage((curr) => (curr === msg ? null : curr));
    }, 3500);
  }, []);

  // Sync sanitized projections to /publicProfiles, /usernames, and /leaderboards
  const syncSocialProjectionsToCloud = useCallback(
    async (
      nextProfile: UserProfileData,
      nextActivities: ActivityDefinition[] = activities,
      nextLogs: Record<string, DailyLog> = dailyLogs
    ) => {
      if (!user || !db) return;
      const firestore = db;
      const uid = user.uid;

      const ach = evaluateAchievements(
        nextLogs,
        getVisibleActivities(
          nextActivities,
          Boolean(nextProfile.religionTrackingEnabled),
          nextProfile.customCategories
        ),
        nextProfile.levelConfig,
        todayKey,
        language,
        Boolean(nextProfile.religionTrackingEnabled)
      );
      const totals = calculateTotalXpWithAchievements(nextLogs, ach);
      const totalXpWithGroups = totals.totalXp + groupChallengeRewards.totalBonusXp;
      const lv = calculateLevelInfo(totalXpWithGroups, nextProfile.levelConfig, language);
      const streak = calculateGentleStreak(nextLogs, todayKey);

      const pubProj = sanitizePublicProfile({
        uid,
        profile: nextProfile,
        activities: nextActivities,
        dailyLogs: nextLogs,
        achievements: ach,
        totalXp: totalXpWithGroups,
        level: lv.level,
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        todayKey,
      });

      try {
        const pubRef = doc(firestore, 'publicProfiles', uid);
        const pubSnap = await getDoc(pubRef);
        if (pubSnap.exists()) {
          await updateDoc(pubRef, {
            username: pubProj.username,
            displayName: pubProj.displayName,
            bio: pubProj.bio ?? '',
            avatarId: pubProj.avatarId ?? 'crest',
            visibility: pubProj.visibility,
            showXp: pubProj.showXp,
            showLevel: pubProj.showLevel,
            showAchievements: pubProj.showAchievements,
            showStreaks: pubProj.showStreaks,
            showWeeklyProgress: pubProj.showWeeklyProgress,
            showMonthlyStats: pubProj.showMonthlyStats,
            sharedCategories: pubProj.sharedCategories,
            totalXp: pubProj.totalXp ?? 0,
            level: pubProj.level ?? 1,
            currentStreak: pubProj.currentStreak ?? 0,
            longestStreak: pubProj.longestStreak ?? 0,
            weeklyCompletionPct: pubProj.weeklyCompletionPct ?? 0,
            monthlyCompletionPct: pubProj.monthlyCompletionPct ?? 0,
            completedQuestsCount: pubProj.completedQuestsCount ?? 0,
            sharedBadges: pubProj.sharedBadges ?? [],
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(pubRef, {
            ...pubProj,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        // Handle username registry & previous username cleanup
        const prevUsername = lastUsernameRef.current;
        if (prevUsername && prevUsername !== pubProj.username) {
          const oldRef = doc(firestore, 'usernames', prevUsername);
          const oldSnap = await getDoc(oldRef);
          if (oldSnap.exists() && oldSnap.data().uid === uid) {
            await deleteDoc(oldRef);
          }
        }
        const unameRef = doc(firestore, 'usernames', pubProj.username);
        const unameSnap = await getDoc(unameRef);
        if (unameSnap.exists()) {
          if (unameSnap.data().uid === uid) {
            await updateDoc(unameRef, {
              displayName: pubProj.displayName,
              avatarId: pubProj.avatarId ?? 'crest',
              visibility: pubProj.visibility,
              updatedAt: serverTimestamp(),
            });
          }
        } else {
          await setDoc(unameRef, {
            uid,
            username: pubProj.username,
            displayName: pubProj.displayName,
            avatarId: pubProj.avatarId ?? 'crest',
            visibility: pubProj.visibility,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        lastUsernameRef.current = pubProj.username;

        // Handle optional Leaderboard doc (delete immediately on opt-out!)
        const lbEntry = sanitizeLeaderboardEntry({
          uid,
          profile: nextProfile,
          activities: nextActivities,
          dailyLogs: nextLogs,
          totalXp: totalXpWithGroups,
          level: lv.level,
          currentStreak: streak.currentStreak,
          todayKey,
        });
        const lbRef = doc(firestore, 'leaderboards', uid);
        const lbSnap = await getDoc(lbRef);

        if (!lbEntry) {
          if (lbSnap.exists()) {
            await deleteDoc(lbRef);
          }
        } else if (lbSnap.exists()) {
          await updateDoc(lbRef, {
            optedIn: true,
            anonymous: lbEntry.anonymous,
            displayLabel: lbEntry.displayLabel,
            avatarId: lbEntry.avatarId ?? 'crest',
            totalXp: lbEntry.totalXp,
            level: lbEntry.level,
            weeklyXp: lbEntry.weeklyXp,
            monthlyXp: lbEntry.monthlyXp,
            weeklyCompletionPct: lbEntry.weeklyCompletionPct,
            monthlyCompletionPct: lbEntry.monthlyCompletionPct,
            currentStreak: lbEntry.currentStreak,
            categoryScores: lbEntry.categoryScores,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(lbRef, {
            ...lbEntry,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        reportCloudError(err, OperationType.WRITE, `publicProfiles/${uid}`);
      }
    },
    [activities, dailyLogs, groupChallengeRewards.totalBonusXp, language, reportCloudError, todayKey, user]
  );

  const persistDailyLog = useCallback(
    async (
      dateKey: string,
      nextEntries: Record<string, ActivityEntry>,
      nextNote?: string
    ) => {
      const summary = calculateDailySummary(
        visibleActivities,
        nextEntries,
        profile.levelConfig
      );
      const nextLog: DailyLog = {
        dateKey,
        entries: nextEntries,
        totalXpEarned: summary.totalXpEarned,
        completionPct: summary.completionPct,
        completedCount: summary.completedCount,
        totalCount: summary.totalCount,
        ...(nextNote !== undefined ? { note: nextNote.slice(0, 500) } : {}),
        updatedAtIso: new Date().toISOString(),
      };

      const nextLogs = {
        ...dailyLogs,
        [dateKey]: nextLog,
      };
      setDailyLogs(nextLogs);

      if (user && db) {
        const logPath = `users/${user.uid}/dailyLogs/${dateKey}`;
        const logRef = doc(db, 'users', user.uid, 'dailyLogs', dateKey);
        const alreadyExists = existingLogKeysRef.current.has(dateKey);
        try {
          if (alreadyExists) {
            await updateDoc(logRef, {
              entries: nextEntries,
              totalXpEarned: summary.totalXpEarned,
              completionPct: summary.completionPct,
              completedCount: summary.completedCount,
              totalCount: summary.totalCount,
              ...(nextNote !== undefined ? { note: nextNote.slice(0, 500) } : {}),
              updatedAt: serverTimestamp(),
            });
          } else {
            await setDoc(logRef, {
              uid: user.uid,
              dateKey,
              entries: nextEntries,
              totalXpEarned: summary.totalXpEarned,
              completionPct: summary.completionPct,
              completedCount: summary.completedCount,
              totalCount: summary.totalCount,
              ...(nextNote !== undefined ? { note: nextNote.slice(0, 500) } : {}),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            existingLogKeysRef.current.add(dateKey);
          }
          // Sync updated totals if user opted into social sharing or leaderboard
          const effPrivacy = getEffectivePrivacy(profile);
          if (effPrivacy.visibility !== 'private' || effPrivacy.leaderboardOptIn) {
            await syncSocialProjectionsToCloud(profile, activities, nextLogs);
          }
        } catch (err) {
          reportCloudError(err, OperationType.WRITE, logPath);
        }
      }
      if (syncEnabledGroupsRef.current) {
        await syncEnabledGroupsRef.current(nextLogs);
      }
    },
    [
      activities,
      dailyLogs,
      profile,
      reportCloudError,
      syncSocialProjectionsToCloud,
      user,
      visibleActivities,
    ]
  );

  const syncEnabledGroupsRef = useRef<((nextLogs: Record<string, DailyLog>) => Promise<void>) | null>(
    null
  );

  const updateActivityEntry = useCallback(
    async (dateKey: string, activityId: string, entry: ActivityEntry) => {
      const existingLog = dailyLogs[dateKey];
      const nextEntries: Record<string, ActivityEntry> = {
        ...(existingLog?.entries ?? {}),
        [activityId]: entry,
      };
      await persistDailyLog(dateKey, nextEntries, existingLog?.note);
    },
    [dailyLogs, persistDailyLog]
  );

  const updateDailyNote = useCallback(
    async (dateKey: string, note: string) => {
      const existingLog = dailyLogs[dateKey];
      await persistDailyLog(dateKey, existingLog?.entries ?? {}, note);
    },
    [dailyLogs, persistDailyLog]
  );

  const saveActivityDefinition = useCallback(
    async (activityInput: Omit<ActivityDefinition, 'order'> & { order?: number }) => {
      const id = sanitizeId(activityInput.id);
      const existingIdx = activities.findIndex((a) => a.id === id);
      const order =
        activityInput.order !== undefined
          ? activityInput.order
          : existingIdx >= 0
            ? activities[existingIdx].order
            : activities.length;

      const normalized: ActivityDefinition = {
        ...activityInput,
        id,
        title: activityInput.title.trim().slice(0, 100),
        category: String(activityInput.category || 'personal').trim().slice(0, 40),
        unitLabel: activityInput.unitLabel.trim().slice(0, 40),
        dailyTarget: Math.max(0, Math.min(100000, Number(activityInput.dailyTarget) || 0)),
        weeklyTarget:
          activityInput.weeklyTarget !== undefined
            ? Math.max(0, Math.min(1000000, Number(activityInput.weeklyTarget) || 0))
            : undefined,
        monthlyTarget:
          activityInput.monthlyTarget !== undefined
            ? Math.max(0, Math.min(10000000, Number(activityInput.monthlyTarget) || 0))
            : undefined,
        xpReward: Math.max(0, Math.min(5000, Number(activityInput.xpReward) || 0)),
        priority: activityInput.priority ?? 'medium',
        reminderEnabled: Boolean(activityInput.reminderEnabled),
        reminderTime: activityInput.reminderTime
          ? activityInput.reminderTime.slice(0, 10)
          : undefined,
        order,
      };

      const nextList =
        existingIdx >= 0
          ? activities.map((a) => (a.id === id ? normalized : a))
          : [...activities, normalized];

      setActivities(nextList.sort((a, b) => a.order - b.order));

      if (user && db) {
        const actPath = `users/${user.uid}/activities/${id}`;
        const actRef = doc(db, 'users', user.uid, 'activities', id);
        try {
          const optionalFields = {
            ...(normalized.weeklyTarget !== undefined
              ? { weeklyTarget: normalized.weeklyTarget }
              : {}),
            ...(normalized.monthlyTarget !== undefined
              ? { monthlyTarget: normalized.monthlyTarget }
              : {}),
            ...(normalized.priority ? { priority: normalized.priority } : {}),
            ...(normalized.reminderEnabled !== undefined
              ? { reminderEnabled: normalized.reminderEnabled }
              : {}),
            ...(normalized.reminderTime ? { reminderTime: normalized.reminderTime } : {}),
          };
          if (existingIdx >= 0) {
            await updateDoc(actRef, {
              title: normalized.title,
              category: normalized.category,
              inputType: normalized.inputType,
              unitLabel: normalized.unitLabel,
              dailyTarget: normalized.dailyTarget,
              xpReward: normalized.xpReward,
              order: normalized.order,
              isActive: normalized.isActive,
              ...optionalFields,
              updatedAt: serverTimestamp(),
            });
          } else {
            await setDoc(actRef, {
              id: normalized.id,
              uid: user.uid,
              title: normalized.title,
              category: normalized.category,
              inputType: normalized.inputType,
              unitLabel: normalized.unitLabel,
              dailyTarget: normalized.dailyTarget,
              xpReward: normalized.xpReward,
              order: normalized.order,
              isCore: normalized.isCore,
              isActive: normalized.isActive,
              ...optionalFields,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          reportCloudError(err, OperationType.WRITE, actPath);
        }
      }
      showToast(
        existingIdx >= 0
          ? UI_COPY[language].toastGoalUpdated
          : UI_COPY[language].toastGoalCreated
      );
    },
    [activities, language, reportCloudError, showToast, user]
  );

  const deleteActivityDefinition = useCallback(
    async (activityId: string) => {
      const filtered = activities
        .filter((a) => a.id !== activityId)
        .map((a, idx) => ({ ...a, order: idx }));
      setActivities(filtered);

      if (user && db) {
        const firestore = db;
        const path = `users/${user.uid}/activities/${activityId}`;
        try {
          await deleteDoc(doc(firestore, 'users', user.uid, 'activities', activityId));
          const batch = writeBatch(firestore);
          filtered.forEach((act) => {
            batch.update(doc(firestore, 'users', user.uid, 'activities', act.id), {
              order: act.order,
              updatedAt: serverTimestamp(),
            });
          });
          await batch.commit();
        } catch (err) {
          reportCloudError(err, OperationType.DELETE, path);
        }
      }
      showToast(UI_COPY[language].toastGoalDeleted);
    },
    [activities, language, reportCloudError, showToast, user]
  );

  const reorderActivity = useCallback(
    async (activityId: string, direction: 'up' | 'down') => {
      const sorted = [...activities].sort((a, b) => a.order - b.order);
      const index = sorted.findIndex((a) => a.id === activityId);
      if (index < 0) return;
      const swapIdx = direction === 'up' ? index - 1 : index + 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return;

      const copy = [...sorted];
      const temp = copy[index];
      copy[index] = copy[swapIdx];
      copy[swapIdx] = temp;

      const reindexed = copy.map((act, idx) => ({ ...act, order: idx }));
      setActivities(reindexed);

      if (user && db) {
        const firestore = db;
        try {
          const ops: BatchOp[] = reindexed.map((act) => ({
            type: 'update',
            ref: doc(firestore, 'users', user.uid, 'activities', act.id),
            data: {
              order: act.order,
              updatedAt: serverTimestamp(),
            },
          }));
          await commitChunkedOps(firestore, ops);
        } catch (err) {
          reportCloudError(
            err,
            OperationType.UPDATE,
            `users/${user.uid}/activities`
          );
        }
      }
    },
    [activities, reportCloudError, user]
  );

  const addCustomCategory = useCallback(
    async (name: string, isSpiritual: boolean = false): Promise<CustomCategoryDef | null> => {
      const cleanName = name.trim().slice(0, 40);
      if (!cleanName) return null;
      const id = `cat_${sanitizeId(cleanName.toLowerCase()).slice(0, 20)}_${Date.now().toString(36).slice(-4)}`;
      const nextCat: CustomCategoryDef = { id, name: cleanName, isSpiritual };
      const existing = profile.customCategories ?? [];
      if (existing.length >= 20) return null;
      const nextCustom = [...existing, nextCat];
      const nextEnabled = Array.from(new Set([...(profile.enabledCategories ?? []), id]));
      const nextProfile: UserProfileData = {
        ...profile,
        customCategories: nextCustom,
        enabledCategories: nextEnabled,
      };
      setProfile(nextProfile);

      if (user && db) {
        try {
          await updateDoc(doc(db, 'users', user.uid), {
            customCategories: nextCustom,
            enabledCategories: nextEnabled,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          reportCloudError(err, OperationType.UPDATE, `users/${user.uid}`);
        }
      }
      return nextCat;
    },
    [profile, reportCloudError, user]
  );

  const setLanguage = useCallback(
    async (nextLang: Language) => {
      if (nextLang === language) return;
      setLanguageState(nextLang);
      setProfile((prev) => ({ ...prev, language: nextLang }));
      try {
        localStorage.setItem(LANG_STORAGE_KEY, nextLang);
      } catch {
        // ignore
      }
      if (user && db) {
        const userRef = doc(db, 'users', user.uid);
        try {
          await updateDoc(userRef, {
            language: nextLang,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          reportCloudError(err, OperationType.UPDATE, `users/${user.uid}`);
        }
      }
      showToast(UI_COPY[nextLang].toastLangChanged);
    },
    [language, reportCloudError, showToast, user]
  );

  const updateProfileSettings = useCallback(
    async (nextDisplayName: string, nextConfig: LevelConfig) => {
      const cleanName = (nextDisplayName || 'Adventurer').trim().slice(0, 100);
      const cleanConfig: LevelConfig = {
        baseXpPerLevel: Math.max(50, Math.min(10000, Number(nextConfig.baseXpPerLevel) || 250)),
        xpGrowthStep: Math.max(0, Math.min(5000, Number(nextConfig.xpGrowthStep) || 100)),
        dailyBonusXp: Math.max(0, Math.min(1000, Number(nextConfig.dailyBonusXp) || 50)),
      };

      const nextProfile: UserProfileData = {
        ...profile,
        displayName: cleanName,
        language,
        levelConfig: cleanConfig,
      };
      setProfile(nextProfile);

      const updatedLogs: Record<string, DailyLog> = {};
      for (const [key, log] of Object.entries(dailyLogs)) {
        const summary = calculateDailySummary(visibleActivities, log.entries, cleanConfig);
        updatedLogs[key] = {
          ...log,
          totalXpEarned: summary.totalXpEarned,
          completionPct: summary.completionPct,
          completedCount: summary.completedCount,
          totalCount: summary.totalCount,
        };
      }
      setDailyLogs(updatedLogs);

      if (user && db) {
        const firestore = db;
        const userRef = doc(firestore, 'users', user.uid);
        try {
          const ops: BatchOp[] = [
            {
              type: 'update',
              ref: userRef,
              data: {
                displayName: cleanName,
                language,
                baseXpPerLevel: cleanConfig.baseXpPerLevel,
                xpGrowthStep: cleanConfig.xpGrowthStep,
                dailyBonusXp: cleanConfig.dailyBonusXp,
                updatedAt: serverTimestamp(),
              },
            },
          ];
          for (const [dateKey, updated] of Object.entries(updatedLogs)) {
            if (!existingLogKeysRef.current.has(dateKey)) continue;
            ops.push({
              type: 'update',
              ref: doc(firestore, 'users', user.uid, 'dailyLogs', dateKey),
              data: {
                totalXpEarned: updated.totalXpEarned,
                completionPct: updated.completionPct,
                completedCount: updated.completedCount,
                totalCount: updated.totalCount,
                updatedAt: serverTimestamp(),
              },
            });
          }
          await commitChunkedOps(firestore, ops);
          await syncSocialProjectionsToCloud(nextProfile, activities, updatedLogs);
        } catch (err) {
          reportCloudError(err, OperationType.UPDATE, `users/${user.uid}`);
        }
      }
      showToast(UI_COPY[language].toastSettingsSaved);
    },
    [
      activities,
      dailyLogs,
      language,
      profile,
      reportCloudError,
      showToast,
      syncSocialProjectionsToCloud,
      user,
      visibleActivities,
    ]
  );

  const updatePersonalProfile = useCallback(
    async (updates: {
      displayName: string;
      username: string;
      bio: string;
      avatarId: string;
      personalGoals: PersonalGoalItem[];
    }) => {
      const cleanName = (updates.displayName || 'Adventurer').trim().slice(0, 100);
      const cleanUsername = normalizeUsername(updates.username);
      if (!isValidUsername(cleanUsername)) {
        setErrorMessage(UI_COPY[language].usernameInvalidError);
        return false;
      }
      const cleanBio = updates.bio.trim().slice(0, 240);
      const cleanAvatar = updates.avatarId.slice(0, 40) || 'crest';
      const cleanGoals = updates.personalGoals.slice(0, 10);

      if (user && db && cleanUsername !== profile.username) {
        try {
          const unameSnap = await getDoc(doc(db, 'usernames', cleanUsername));
          if (unameSnap.exists() && unameSnap.data().uid !== user.uid) {
            setErrorMessage(UI_COPY[language].errorUsernameTaken);
            return false;
          }
        } catch (err) {
          reportCloudError(err, OperationType.GET, `usernames/${cleanUsername}`);
          return false;
        }
      }

      const nextProfile: UserProfileData = {
        ...profile,
        displayName: cleanName,
        username: cleanUsername,
        bio: cleanBio,
        avatarId: cleanAvatar,
        personalGoals: cleanGoals,
      };
      setProfile(nextProfile);

      if (user && db) {
        try {
          await updateDoc(doc(db, 'users', user.uid), {
            displayName: cleanName,
            username: cleanUsername,
            bio: cleanBio,
            avatarId: cleanAvatar,
            personalGoals: cleanGoals,
            updatedAt: serverTimestamp(),
          });
          await syncSocialProjectionsToCloud(nextProfile);
        } catch (err) {
          reportCloudError(err, OperationType.UPDATE, `users/${user.uid}`);
          return false;
        }
      }
      showToast(UI_COPY[language].toastProfileUpdated);
      return true;
    },
    [language, profile, reportCloudError, showToast, syncSocialProjectionsToCloud, user]
  );

  const updatePrivacySettings = useCallback(
    async (nextPrivacy: PrivacySettings) => {
      const sanitized: PrivacySettings = {
        ...DEFAULT_PRIVACY_SETTINGS,
        ...nextPrivacy,
        sharedCategories: (nextPrivacy.sharedCategories ?? []).filter(
          (c) => !NEVER_SHARE_CATEGORIES.has(c)
        ),
      };
      const nextProfile: UserProfileData = {
        ...profile,
        privacy: sanitized,
      };
      setProfile(nextProfile);

      if (user && db) {
        try {
          await updateDoc(doc(db, 'users', user.uid), {
            privacy: sanitized,
            updatedAt: serverTimestamp(),
          });
          await syncSocialProjectionsToCloud(nextProfile);
        } catch (err) {
          reportCloudError(err, OperationType.UPDATE, `users/${user.uid}`);
        }
      }

      if (sanitized.visibility === 'private' && !sanitized.leaderboardOptIn) {
        showToast(UI_COPY[language].toastPrivacySaved);
      } else {
        showToast(UI_COPY[language].toastPrivacySaved);
      }
    },
    [language, profile, reportCloudError, showToast, syncSocialProjectionsToCloud, user]
  );

  const toggleReligionTracking = useCallback(
    async (enabled: boolean, templateActsToAdd: ActivityDefinition[] = []) => {
      let nextActs = activities;
      if (enabled && templateActsToAdd.length > 0) {
        const existingIds = new Set(activities.map((a) => a.id));
        const additions = templateActsToAdd
          .filter((t) => !existingIds.has(t.id))
          .map((t, idx) => ({ ...t, order: activities.length + idx, isActive: true }));
        nextActs = [...activities, ...additions];
      }
      setActivities(nextActs);

      const nextProfile: UserProfileData = {
        ...profile,
        religionTrackingEnabled: enabled,
      };
      setProfile(nextProfile);

      if (user && db) {
        const firestore = db;
        try {
          const batch = writeBatch(firestore);
          batch.update(doc(firestore, 'users', user.uid), {
            religionTrackingEnabled: enabled,
            updatedAt: serverTimestamp(),
          });
          for (const act of nextActs) {
            if (!activities.some((a) => a.id === act.id)) {
              batch.set(doc(firestore, 'users', user.uid, 'activities', act.id), {
                id: act.id,
                uid: user.uid,
                title: act.title.slice(0, 100),
                category: act.category,
                inputType: act.inputType,
                unitLabel: act.unitLabel.slice(0, 40),
                dailyTarget: act.dailyTarget,
                ...(act.weeklyTarget !== undefined ? { weeklyTarget: act.weeklyTarget } : {}),
                ...(act.monthlyTarget !== undefined ? { monthlyTarget: act.monthlyTarget } : {}),
                xpReward: act.xpReward,
                priority: act.priority ?? 'medium',
                order: act.order,
                isCore: act.isCore,
                isActive: act.isActive,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            }
          }
          await batch.commit();
        } catch (err) {
          reportCloudError(err, OperationType.WRITE, `users/${user.uid}`);
        }
      }
      showToast(UI_COPY[language].toastSettingsSaved);
    },
    [activities, language, profile, reportCloudError, showToast, user]
  );

  const completeOnboarding = useCallback(
    async (payload: {
      displayName: string;
      language: Language;
      religionTrackingEnabled: boolean;
      remindersEnabled: boolean;
      enabledCategories: string[];
      customCategories: CustomCategoryDef[];
      selectedActivities: ActivityDefinition[];
      privacy: PrivacySettings;
    }) => {
      setLanguageState(payload.language);
      const selectedNormalized = payload.selectedActivities.map((a) => ({
        ...a,
        id: sanitizeId(a.id),
      }));
      const selectedIdSet = new Set(selectedNormalized.map((a) => a.id));
      // Preserve user's custom activities non-destructively (mark unselected non-core custom ones inactive or keep them)
      const preservedCustom = activities.filter(
        (a) => !a.isCore && !selectedIdSet.has(a.id)
      );
      const indexedActs = [...selectedNormalized, ...preservedCustom].map((a, idx) => ({
        ...a,
        id: sanitizeId(a.id),
        order: idx,
      }));
      const finalIdSet = new Set(indexedActs.map((a) => a.id));
      setActivities(indexedActs);

      const nextProfile: UserProfileData = {
        ...profile,
        displayName: payload.displayName.trim().slice(0, 100) || 'Adventurer',
        language: payload.language,
        onboardingCompleted: true,
        religionTrackingEnabled: payload.religionTrackingEnabled,
        remindersEnabled: payload.remindersEnabled,
        enabledCategories: payload.enabledCategories,
        customCategories: payload.customCategories,
        privacy: payload.privacy,
      };
      setProfile(nextProfile);
      setShowOnboardingModal(false);

      if (user && db) {
        const firestore = db;
        try {
          const existingActs = await getDocs(
            query(collection(firestore, 'users', user.uid, 'activities'), where('uid', '==', user.uid))
          );
          const ops: BatchOp[] = [];
          existingActs.forEach((d) => {
            if (!finalIdSet.has(d.id)) {
              ops.push({ type: 'delete', ref: d.ref });
            }
          });

          ops.push({
            type: 'update',
            ref: doc(firestore, 'users', user.uid),
            data: {
              displayName: nextProfile.displayName,
              language: payload.language,
              onboardingCompleted: true,
              religionTrackingEnabled: payload.religionTrackingEnabled,
              remindersEnabled: payload.remindersEnabled,
              enabledCategories: payload.enabledCategories,
              customCategories: payload.customCategories,
              privacy: payload.privacy,
              updatedAt: serverTimestamp(),
            },
          });

          for (const act of indexedActs) {
            ops.push({
              type: 'set',
              ref: doc(firestore, 'users', user.uid, 'activities', act.id),
              data: {
                id: act.id,
                uid: user.uid,
                title: act.title.slice(0, 100),
                category: act.category.slice(0, 40),
                inputType: act.inputType,
                unitLabel: act.unitLabel.slice(0, 40),
                dailyTarget: act.dailyTarget,
                ...(act.weeklyTarget !== undefined ? { weeklyTarget: act.weeklyTarget } : {}),
                ...(act.monthlyTarget !== undefined ? { monthlyTarget: act.monthlyTarget } : {}),
                xpReward: act.xpReward,
                priority: act.priority ?? 'medium',
                reminderEnabled: Boolean(act.reminderEnabled),
                ...(act.reminderTime ? { reminderTime: act.reminderTime.slice(0, 10) } : {}),
                order: act.order,
                isCore: act.isCore,
                isActive: act.isActive,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              },
            });
          }
          await commitChunkedOps(firestore, ops);
          await syncSocialProjectionsToCloud(nextProfile, indexedActs, dailyLogs);
        } catch (err) {
          reportCloudError(err, OperationType.WRITE, `users/${user.uid}`);
        }
      }
      showToast(UI_COPY[payload.language].toastOnboardingDone);
    },
    [activities, dailyLogs, profile, reportCloudError, showToast, syncSocialProjectionsToCloud, user]
  );

  // Social: Search Users by Username (Private accounts strictly excluded)
  const searchUsersByUsername = useCallback(
    async (queryStr: string): Promise<UsernameSearchResult[]> => {
      const clean = queryStr.trim().toLowerCase().replace(/^@/, '');
      if (!clean) return [];

      if (user && db) {
        try {
          const firestore = db;
          const q = query(
            collection(firestore, 'usernames'),
            where('visibility', 'in', ['public', 'friends']),
            limit(100)
          );
          const snap = await getDocs(q);
          const matches: UsernameSearchResult[] = [];
          snap.forEach((docSnap) => {
            const d = docSnap.data();
            if (d.uid === user.uid) return;
            const uname = String(d.username || '');
            const dname = String(d.displayName || '');
            if (uname.toLowerCase().includes(clean) || dname.toLowerCase().includes(clean)) {
              matches.push({
                uid: String(d.uid),
                username: uname,
                displayName: dname,
                avatarId: d.avatarId ? String(d.avatarId) : 'crest',
                visibility: d.visibility,
              });
            }
          });
          return matches;
        } catch (err) {
          reportCloudError(err, OperationType.LIST, 'usernames');
          return [];
        }
      }

      return searchVisibleUsernames(SAMPLE_COMMUNITY_PROFILES, clean, currentUid);
    },
    [currentUid, reportCloudError, user]
  );

  const sendFriendRequest = useCallback(
    async (target: UsernameSearchResult) => {
      if (target.uid === currentUid) return;
      const reqId = `${currentUid}_${target.uid}`;
      const myUsername = profile.username || normalizeUsername(currentUid);

      if (
        friendRequests.some(
          (r) =>
            (r.fromUid === currentUid && r.toUid === target.uid && r.status === 'pending') ||
            (r.fromUid === target.uid && r.toUid === currentUid && r.status === 'pending')
        )
      ) {
        return;
      }

      const newReq: FriendRequestItem = {
        id: reqId,
        fromUid: currentUid,
        toUid: target.uid,
        fromUsername: myUsername,
        fromDisplayName: profile.displayName || 'Adventurer',
        toUsername: target.username,
        status: 'pending',
        createdAtIso: new Date().toISOString(),
      };

      if (!user || !db) {
        setFriendRequests((prev) => [...prev.filter((r) => r.id !== reqId), newReq]);
        showToast(UI_COPY[language].toastFriendSent);
        return;
      }

      try {
        await setDoc(doc(db, 'friendRequests', reqId), {
          id: reqId,
          fromUid: currentUid,
          toUid: target.uid,
          fromUsername: myUsername,
          fromDisplayName: (profile.displayName || 'Adventurer').slice(0, 100),
          toUsername: target.username,
          status: 'pending',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showToast(UI_COPY[language].toastFriendSent);
      } catch (err) {
        reportCloudError(err, OperationType.WRITE, `friendRequests/${reqId}`);
      }
    },
    [
      currentUid,
      friendRequests,
      language,
      profile.displayName,
      profile.username,
      reportCloudError,
      showToast,
      user,
    ]
  );

  const respondToFriendRequest = useCallback(
    async (req: FriendRequestItem, decision: 'accepted' | 'declined') => {
      if (!user || !db) {
        setFriendRequests((prev) =>
          prev.map((r) => (r.id === req.id ? { ...r, status: decision } : r))
        );
        if (decision === 'accepted') {
          setFriends((prev) => {
            if (prev.some((f) => f.friendUid === req.fromUid)) return prev;
            const communityMatch = SAMPLE_COMMUNITY_PROFILES.find(
              (p) => p.uid === req.fromUid
            );
            return [
              ...prev,
              {
                uid: currentUid,
                friendUid: req.fromUid,
                requestId: req.id,
                friendUsername: req.fromUsername,
                friendDisplayName: req.fromDisplayName,
                friendAvatarId: communityMatch?.avatarId ?? 'crest',
              },
            ];
          });
        }
        showToast(
          decision === 'accepted'
            ? UI_COPY[language].toastFriendAccepted
            : UI_COPY[language].toastFriendDeclined
        );
        return;
      }

      try {
        const firestore = db;
        const batch = writeBatch(firestore);
        batch.update(doc(firestore, 'friendRequests', req.id), {
          status: decision,
          updatedAt: serverTimestamp(),
        });

        if (decision === 'accepted') {
          const myUsername = profile.username || normalizeUsername(currentUid);
          batch.set(doc(firestore, 'users', currentUid, 'friends', req.fromUid), {
            uid: currentUid,
            friendUid: req.fromUid,
            requestId: req.id,
            friendUsername: req.fromUsername,
            friendDisplayName: req.fromDisplayName,
            friendAvatarId: 'crest',
            createdAt: serverTimestamp(),
          });
          batch.set(doc(firestore, 'users', req.fromUid, 'friends', currentUid), {
            uid: req.fromUid,
            friendUid: currentUid,
            requestId: req.id,
            friendUsername: myUsername,
            friendDisplayName: (profile.displayName || 'Adventurer').slice(0, 100),
            friendAvatarId: profile.avatarId || 'crest',
            createdAt: serverTimestamp(),
          });
        }
        await batch.commit();
        showToast(
          decision === 'accepted'
            ? UI_COPY[language].toastFriendAccepted
            : UI_COPY[language].toastFriendDeclined
        );
      } catch (err) {
        reportCloudError(err, OperationType.WRITE, `friendRequests/${req.id}`);
      }
    },
    [
      currentUid,
      language,
      profile.avatarId,
      profile.displayName,
      profile.username,
      reportCloudError,
      showToast,
      user,
    ]
  );

  const cancelFriendRequest = useCallback(
    async (requestId: string) => {
      if (!user || !db) {
        setFriendRequests((prev) => prev.filter((r) => r.id !== requestId));
        return;
      }
      try {
        await deleteDoc(doc(db, 'friendRequests', requestId));
      } catch (err) {
        reportCloudError(err, OperationType.DELETE, `friendRequests/${requestId}`);
      }
    },
    [reportCloudError, user]
  );

  const removeFriend = useCallback(
    async (friendUid: string) => {
      if (!user || !db) {
        setFriends((prev) => prev.filter((f) => f.friendUid !== friendUid));
        showToast(UI_COPY[language].toastFriendRemoved);
        return;
      }
      try {
        const firestore = db;
        const batch = writeBatch(firestore);
        batch.delete(doc(firestore, 'users', currentUid, 'friends', friendUid));
        batch.delete(doc(firestore, 'users', friendUid, 'friends', currentUid));
        await batch.commit();
        showToast(UI_COPY[language].toastFriendRemoved);
      } catch (err) {
        reportCloudError(err, OperationType.DELETE, `users/${currentUid}/friends/${friendUid}`);
      }
    },
    [currentUid, language, reportCloudError, showToast, user]
  );

  const fetchSharedProfileForComparison = useCallback(
    async (targetUid: string): Promise<PublicUserProfile | null> => {
      const isFriend = friends.some((f) => f.friendUid === targetUid);
      if (user && db) {
        try {
          const snap = await getDoc(doc(db, 'publicProfiles', targetUid));
          if (!snap.exists()) return null;
          const raw = snap.data() as PublicUserProfile;
          return filterProfileForViewer(raw, currentUid, isFriend);
        } catch {
          return null;
        }
      }
      const persona = SAMPLE_COMMUNITY_PROFILES.find((p) => p.uid === targetUid);
      if (!persona) return null;
      return filterProfileForViewer(persona, currentUid, isFriend);
    },
    [currentUid, friends, user]
  );

  // Leaderboard computed list (respecting opt-in & anonymous flags)
  const leaderboardEntries = useMemo(() => {
    const ownEntry = sanitizeLeaderboardEntry({
      uid: currentUid,
      profile,
      activities,
      dailyLogs,
      totalXp: xpTotals.totalXp,
      level: levelInfo.level,
      currentStreak: streakInfo.currentStreak,
      todayKey,
    });

    if (user && db) {
      const others = cloudLeaderboard.filter((e) => e.uid !== currentUid && e.optedIn);
      return ownEntry ? [ownEntry, ...others] : others;
    }

    const sampleOthers = SAMPLE_LEADERBOARD_ENTRIES.filter((e) => e.uid !== currentUid);
    return ownEntry ? [ownEntry, ...sampleOthers] : sampleOthers;
  }, [
    activities,
    cloudLeaderboard,
    currentUid,
    dailyLogs,
    levelInfo.level,
    profile,
    streakInfo.currentStreak,
    todayKey,
    user,
    xpTotals.totalXp,
  ]);

  // Community Challenges actions
  const joinOrUpdateChallenge = useCallback(
    async (challenge: CommunityChallenge) => {
      const effPrivacy = getEffectivePrivacy(profile);
      const label = effPrivacy.leaderboardAnonymous
        ? `Anonymous Explorer #${currentUid.slice(-3).toUpperCase()}`
        : (profile.displayName || 'Adventurer').slice(0, 100);

      // Compute progress purely from non-religious, non-health activities in matching category
      const matchingActs = visibleActivities.filter(
        (a) => a.category === challenge.category && !NEVER_SHARE_CATEGORIES.has(a.category)
      );
      let computedProgress = 0;
      for (const log of Object.values(dailyLogs)) {
        for (const act of matchingActs) {
          computedProgress += getEntryNumericValue(act, log.entries?.[act.id]);
        }
      }
      const progressValue = Math.max(0, Math.round(computedProgress));

      const participant: ChallengeParticipant = {
        uid: currentUid,
        challengeId: challenge.id,
        displayLabel: label,
        progressValue,
      };

      setChallengeParticipants((prev) => {
        const currentList = prev[challenge.id] ?? [];
        const filtered = currentList.filter((p) => p.uid !== currentUid);
        return {
          ...prev,
          [challenge.id]: [participant, ...filtered],
        };
      });

      if (user && db) {
        try {
          const chRef = doc(db, 'challenges', challenge.id);
          const chSnap = await getDoc(chRef);
          if (!chSnap.exists()) {
            // Ensure built-in challenge exists in cloud before creating participant subdoc
            await setDoc(chRef, {
              id: challenge.id,
              creatorUid: currentUid,
              title: challenge.title.slice(0, 100),
              description: challenge.description.slice(0, 300),
              category: challenge.category.slice(0, 40),
              targetValue: challenge.targetValue,
              unitLabel: challenge.unitLabel.slice(0, 40),
              durationDays: challenge.durationDays,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
          const partRef = doc(db, 'challenges', challenge.id, 'participants', currentUid);
          const partSnap = await getDoc(partRef);
          if (partSnap.exists()) {
            await updateDoc(partRef, {
              displayLabel: label,
              progressValue,
              updatedAt: serverTimestamp(),
            });
          } else {
            await setDoc(partRef, {
              uid: currentUid,
              challengeId: challenge.id,
              displayLabel: label,
              progressValue,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          reportCloudError(err, OperationType.WRITE, `challenges/${challenge.id}/participants/${currentUid}`);
        }
      }
      showToast(UI_COPY[language].toastChallengeJoined);
    },
    [currentUid, dailyLogs, language, profile, reportCloudError, showToast, user, visibleActivities]
  );

  const leaveChallenge = useCallback(
    async (challengeId: string) => {
      setChallengeParticipants((prev) => ({
        ...prev,
        [challengeId]: (prev[challengeId] ?? []).filter((p) => p.uid !== currentUid),
      }));

      if (user && db) {
        try {
          await deleteDoc(doc(db, 'challenges', challengeId, 'participants', currentUid));
        } catch (err) {
          reportCloudError(err, OperationType.DELETE, `challenges/${challengeId}/participants/${currentUid}`);
        }
      }
      showToast(UI_COPY[language].toastChallengeLeft);
    },
    [currentUid, language, reportCloudError, showToast, user]
  );

  const createChallenge = useCallback(
    async (input: {
      title: string;
      description: string;
      category: string;
      targetValue: number;
      unitLabel: string;
      durationDays: number;
    }) => {
      const safeCat = NEVER_SHARE_CATEGORIES.has(input.category)
        ? 'learning'
        : input.category.trim().slice(0, 40) || 'learning';
      const id = `challenge_${Date.now()}`;
      const nextChallenge: CommunityChallenge = {
        id,
        creatorUid: currentUid,
        title: input.title.trim().slice(0, 100),
        description: input.description.trim().slice(0, 300),
        category: safeCat,
        targetValue: Math.max(1, Math.min(1000000, Number(input.targetValue) || 10)),
        unitLabel: input.unitLabel.trim().slice(0, 40) || 'min',
        durationDays: Math.max(1, Math.min(365, Number(input.durationDays) || 7)),
      };
      setChallenges((prev) => [nextChallenge, ...prev]);

      if (user && db) {
        try {
          await setDoc(doc(db, 'challenges', id), {
            ...nextChallenge,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          reportCloudError(err, OperationType.WRITE, `challenges/${id}`);
        }
      }
      showToast(UI_COPY[language].toastChallengeCreated);
    },
    [currentUid, language, reportCloudError, showToast, user]
  );

  const restoreFromBackup = useCallback(
    async (payload: BackupPayload) => {
      const opKey = 'restoreFromBackup';
      if (inFlightKeysRef.current.has(opKey)) return;
      inFlightKeysRef.current.add(opKey);
      try {
        const cleanActs = payload.activities.map((a, idx) => ({
          ...a,
          id: sanitizeId(a.id),
          order: idx,
        }));
        const restoredActIds = new Set(cleanActs.map((a) => a.id));
        const restoredLogKeys = new Set(
          Object.keys(payload.dailyLogs).filter((k) => /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(k))
        );
        const restoredLang: Language =
          payload.profile.language === 'bn' || payload.profile.language === 'en'
            ? payload.profile.language
            : language;
        const mergedProfile: UserProfileData = {
          ...DEFAULT_PROFILE,
          ...payload.profile,
          language: restoredLang,
          privacy: {
            ...DEFAULT_PRIVACY_SETTINGS,
            ...(payload.profile.privacy ?? {}),
          },
        };
        setLanguageState(restoredLang);
        setProfile(mergedProfile);
        setActivities(cleanActs);
        setDailyLogs(payload.dailyLogs);

        if (user && db) {
          const firestore = db;
          try {
            const existingActs = await getDocs(
              query(collection(firestore, 'users', user.uid, 'activities'), where('uid', '==', user.uid))
            );
            const existingLogs = await getDocs(
              query(collection(firestore, 'users', user.uid, 'dailyLogs'), where('uid', '==', user.uid))
            );

            const ops: BatchOp[] = [];
            existingActs.forEach((d) => {
              if (!restoredActIds.has(d.id)) {
                ops.push({ type: 'delete', ref: d.ref });
              }
            });
            existingLogs.forEach((d) => {
              if (!restoredLogKeys.has(d.id)) {
                ops.push({ type: 'delete', ref: d.ref });
              }
            });

            ops.push({
              type: 'update',
              ref: doc(firestore, 'users', user.uid),
              data: {
                displayName: mergedProfile.displayName.slice(0, 100),
                language: restoredLang,
                baseXpPerLevel: mergedProfile.levelConfig.baseXpPerLevel,
                xpGrowthStep: mergedProfile.levelConfig.xpGrowthStep,
                dailyBonusXp: mergedProfile.levelConfig.dailyBonusXp,
                religionTrackingEnabled: Boolean(mergedProfile.religionTrackingEnabled),
                remindersEnabled: Boolean(mergedProfile.remindersEnabled),
                enabledCategories: mergedProfile.enabledCategories ?? [],
                customCategories: mergedProfile.customCategories ?? [],
                personalGoals: mergedProfile.personalGoals ?? [],
                privacy: mergedProfile.privacy,
                updatedAt: serverTimestamp(),
              },
            });

            for (const act of cleanActs) {
              ops.push({
                type: 'set',
                ref: doc(firestore, 'users', user.uid, 'activities', act.id),
                data: {
                  id: act.id,
                  uid: user.uid,
                  title: act.title.slice(0, 100),
                  category: act.category.slice(0, 40),
                  inputType: act.inputType,
                  unitLabel: act.unitLabel.slice(0, 40),
                  dailyTarget: act.dailyTarget,
                  ...(act.weeklyTarget !== undefined ? { weeklyTarget: act.weeklyTarget } : {}),
                  ...(act.monthlyTarget !== undefined ? { monthlyTarget: act.monthlyTarget } : {}),
                  xpReward: act.xpReward,
                  priority: act.priority ?? 'medium',
                  reminderEnabled: Boolean(act.reminderEnabled),
                  ...(act.reminderTime ? { reminderTime: act.reminderTime.slice(0, 10) } : {}),
                  order: act.order,
                  isCore: act.isCore,
                  isActive: act.isActive,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                },
              });
            }

            for (const [dateKey, log] of Object.entries(payload.dailyLogs)) {
              if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(dateKey)) continue;
              ops.push({
                type: 'set',
                ref: doc(firestore, 'users', user.uid, 'dailyLogs', dateKey),
                data: {
                  uid: user.uid,
                  dateKey,
                  entries: log.entries ?? {},
                  totalXpEarned: Number(log.totalXpEarned ?? 0),
                  completionPct: Number(log.completionPct ?? 0),
                  completedCount: Number(log.completedCount ?? 0),
                  totalCount: Number(log.totalCount ?? 0),
                  ...(log.note ? { note: log.note.slice(0, 500) } : {}),
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                },
              });
            }

            await commitChunkedOps(firestore, ops);
            existingLogKeysRef.current = restoredLogKeys;
            await syncSocialProjectionsToCloud(mergedProfile, cleanActs, payload.dailyLogs);
          } catch (err) {
            reportCloudError(err, OperationType.WRITE, `users/${user.uid}`);
          }
        }
        showToast(UI_COPY[restoredLang].toastBackupRestored);
      } finally {
        inFlightKeysRef.current.delete(opKey);
      }
    },
    [language, reportCloudError, showToast, syncSocialProjectionsToCloud, user]
  );

  const resetAllData = useCallback(
    async (withDemoSeed: boolean) => {
      const opKey = 'resetAllData';
      if (inFlightKeysRef.current.has(opKey)) return;
      inFlightKeysRef.current.add(opKey);
      try {
        const freshLogs = withDemoSeed
          ? buildSeedDailyLogs(
              todayKey,
              DEFAULT_ACTIVITIES,
              calculateDailySummary,
              DEFAULT_LEVEL_CONFIG
            )
          : {};
        const nextProfile: UserProfileData = {
          ...DEFAULT_PROFILE,
          language,
          religionTrackingEnabled: false,
          privacy: DEFAULT_PRIVACY_SETTINGS,
        };
        setProfile(nextProfile);
        setActivities(DEFAULT_ACTIVITIES);
        setDailyLogs(freshLogs);

        if (user && db) {
          const firestore = db;
          try {
            const existingActs = await getDocs(
              query(collection(firestore, 'users', user.uid, 'activities'), where('uid', '==', user.uid))
            );
            const existingLogs = await getDocs(
              query(collection(firestore, 'users', user.uid, 'dailyLogs'), where('uid', '==', user.uid))
            );

            const ops: BatchOp[] = [];
            existingActs.forEach((d) => ops.push({ type: 'delete', ref: d.ref }));
            existingLogs.forEach((d) => ops.push({ type: 'delete', ref: d.ref }));

            for (const act of DEFAULT_ACTIVITIES) {
              ops.push({
                type: 'set',
                ref: doc(firestore, 'users', user.uid, 'activities', act.id),
                data: {
                  id: act.id,
                  uid: user.uid,
                  title: act.title,
                  category: act.category,
                  inputType: act.inputType,
                  unitLabel: act.unitLabel,
                  dailyTarget: act.dailyTarget,
                  ...(act.weeklyTarget !== undefined ? { weeklyTarget: act.weeklyTarget } : {}),
                  ...(act.monthlyTarget !== undefined ? { monthlyTarget: act.monthlyTarget } : {}),
                  xpReward: act.xpReward,
                  order: act.order,
                  isCore: act.isCore,
                  isActive: act.isActive,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                },
              });
            }

            for (const [dateKey, log] of Object.entries(freshLogs)) {
              ops.push({
                type: 'set',
                ref: doc(firestore, 'users', user.uid, 'dailyLogs', dateKey),
                data: {
                  uid: user.uid,
                  dateKey,
                  entries: log.entries,
                  totalXpEarned: log.totalXpEarned,
                  completionPct: log.completionPct,
                  completedCount: log.completedCount,
                  totalCount: log.totalCount,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                },
              });
            }

            await commitChunkedOps(firestore, ops);
            existingLogKeysRef.current = new Set(Object.keys(freshLogs));
          } catch (err) {
            reportCloudError(err, OperationType.WRITE, `users/${user.uid}`);
          }
        }
        showToast(
          withDemoSeed
            ? UI_COPY[language].toastResetDemo
            : UI_COPY[language].toastResetEmpty
        );
      } finally {
        inFlightKeysRef.current.delete(opKey);
      }
    },
    [language, reportCloudError, showToast, todayKey, user]
  );

  const deleteAccountAndData = useCallback(async () => {
    const opKey = 'deleteAccountAndData';
    if (inFlightKeysRef.current.has(opKey)) return;
    inFlightKeysRef.current.add(opKey);
    try {
      if (user && db) {
        const firestore = db;
        const uid = user.uid;
        try {
          const [
            existingActs,
            existingLogs,
            existingFriends,
            outReqs,
            inReqs,
            outGroupInvs,
            inGroupInvs,
          ] = await Promise.all([
            getDocs(query(collection(firestore, 'users', uid, 'activities'), where('uid', '==', uid))),
            getDocs(query(collection(firestore, 'users', uid, 'dailyLogs'), where('uid', '==', uid))),
            getDocs(query(collection(firestore, 'users', uid, 'friends'), where('uid', '==', uid))),
            getDocs(query(collection(firestore, 'friendRequests'), where('fromUid', '==', uid))),
            getDocs(query(collection(firestore, 'friendRequests'), where('toUid', '==', uid))),
            getDocs(query(collection(firestore, 'groupInvitations'), where('fromUid', '==', uid))),
            getDocs(query(collection(firestore, 'groupInvitations'), where('toUid', '==', uid))),
          ]);

          const ops: BatchOp[] = [];
          existingActs.forEach((d) => ops.push({ type: 'delete', ref: d.ref }));
          existingLogs.forEach((d) => ops.push({ type: 'delete', ref: d.ref }));
          existingFriends.forEach((d) => ops.push({ type: 'delete', ref: d.ref }));
          const seenReqIds = new Set<string>();
          [...outReqs.docs, ...inReqs.docs].forEach((d) => {
            if (!seenReqIds.has(d.id)) {
              seenReqIds.add(d.id);
              ops.push({ type: 'delete', ref: d.ref });
            }
          });
          const seenInvIds = new Set<string>();
          [...outGroupInvs.docs, ...inGroupInvs.docs].forEach((d) => {
            if (!seenInvIds.has(d.id)) {
              seenInvIds.add(d.id);
              ops.push({ type: 'delete', ref: d.ref });
            }
          });

          ops.push({ type: 'delete', ref: doc(firestore, 'publicProfiles', uid) });
          ops.push({ type: 'delete', ref: doc(firestore, 'leaderboards', uid) });
          if (profile.username) {
            ops.push({ type: 'delete', ref: doc(firestore, 'usernames', profile.username) });
          }
          ops.push({ type: 'delete', ref: doc(firestore, 'users', uid) });
          await commitChunkedOps(firestore, ops);
          await signOutUser();
        } catch (err) {
          reportCloudError(err, OperationType.DELETE, `users/${uid}`);
        }
      }

      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch {
        // ignore
      }

      setProfile({ ...DEFAULT_PROFILE, language, privacy: DEFAULT_PRIVACY_SETTINGS });
      setActivities(DEFAULT_ACTIVITIES);
      setDailyLogs({});
      setFriends([]);
      setFriendRequests([]);
      setChallengeParticipants({});
      setGroups([]);
      setActiveGroupId(null);
      setGroupMembers({});
      setGroupInvitations([]);
      setGroupPrivacyByGroup({});
      setGroupSharedProgress({});
      setGroupFeed({});
      setGroupChallenges({});
      setGroupChallengeParticipants({});
      showToast(UI_COPY[language].toastAccountDeleted);
    } finally {
      inFlightKeysRef.current.delete(opKey);
    }
  }, [language, profile.username, reportCloudError, showToast, user]);

  const handleSignIn = useCallback(async () => {
    setErrorMessage(null);
    try {
      await signInWithGooglePopup();
      showToast(UI_COPY[language].toastSignedIn);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (!msg.includes('popup-closed-by-user')) {
        setErrorMessage(UI_COPY[language].errorSignInFailed);
      }
    }
  }, [language, showToast]);

  const handleSignOut = useCallback(async () => {
    await signOutUser();
    showToast(UI_COPY[language].toastSignedOut);
  }, [language, showToast]);

  // Friends Group System Helpers & Actions
  const syncGroupSharedProgressDoc = useCallback(
    async (
      groupId: string,
      nextGroupPrivacy: GroupPrivacySettings,
      nextLogs: Record<string, DailyLog> = dailyLogs
    ) => {
      const sanitizedPriv = sanitizeGroupPrivacySettings(
        nextGroupPrivacy,
        profile.customCategories
      );
      const baseAch = evaluateAchievements(
        nextLogs,
        visibleActivities,
        profile.levelConfig,
        todayKey,
        language,
        religionEnabled
      );
      const baseTotals = calculateTotalXpWithAchievements(nextLogs, baseAch);
      const totalWithGroups = baseTotals.totalXp + groupChallengeRewards.totalBonusXp;
      const lv = calculateLevelInfo(totalWithGroups, profile.levelConfig, language);
      const streak = calculateGentleStreak(nextLogs, todayKey);

      const shareDoc = sanitizeGroupSharedProgress({
        uid: currentUid,
        groupId,
        username: profile.username,
        displayName: profile.displayName || 'Adventurer',
        avatarId: profile.avatarId,
        groupPrivacy: sanitizedPriv,
        activities,
        customCategories: profile.customCategories,
        dailyLogs: nextLogs,
        achievements: baseAch,
        totalXp: totalWithGroups,
        level: lv.level,
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        todayKey,
      });

      setGroupPrivacyByGroup((prev) => ({ ...prev, [groupId]: sanitizedPriv }));
      setGroupSharedProgress((prev) => {
        const others = (prev[groupId] ?? []).filter((s) => s.uid !== currentUid);
        return { ...prev, [groupId]: [...others, shareDoc] };
      });

      if (user && db) {
        try {
          const shareRef = doc(db, 'groups', groupId, 'sharedProgress', user.uid);
          const snap = await getDoc(shareRef);
          const payload = {
            uid: user.uid,
            groupId,
            username: shareDoc.username,
            displayName: shareDoc.displayName,
            avatarId: shareDoc.avatarId ?? 'crest',
            sharingEnabled: shareDoc.sharingEnabled,
            showXp: shareDoc.showXp,
            showLevel: shareDoc.showLevel,
            showStreaks: shareDoc.showStreaks,
            showAchievements: shareDoc.showAchievements,
            showWeeklySummary: shareDoc.showWeeklySummary,
            showMonthlySummary: shareDoc.showMonthlySummary,
            sharedCategories: shareDoc.sharedCategories,
            dailyCompletionPct: shareDoc.dailyCompletionPct ?? 0,
            weeklyCompletionPct: shareDoc.weeklyCompletionPct ?? 0,
            monthlyCompletionPct: shareDoc.monthlyCompletionPct ?? 0,
            totalXp: shareDoc.totalXp ?? 0,
            level: shareDoc.level ?? 1,
            currentStreak: shareDoc.currentStreak ?? 0,
            longestStreak: shareDoc.longestStreak ?? 0,
            sharedBadges: shareDoc.sharedBadges ?? [],
            categorySummaries: shareDoc.categorySummaries ?? {},
            updatedAt: serverTimestamp(),
          };
          if (snap.exists()) {
            await updateDoc(shareRef, payload);
          } else {
            await setDoc(shareRef, {
              ...payload,
              createdAt: serverTimestamp(),
            });
          }
        } catch (err) {
          reportCloudError(
            err,
            OperationType.WRITE,
            `groups/${groupId}/sharedProgress/${user.uid}`
          );
        }
      }
    },
    [
      activities,
      currentUid,
      dailyLogs,
      groupChallengeRewards.totalBonusXp,
      language,
      profile.avatarId,
      profile.customCategories,
      profile.displayName,
      profile.levelConfig,
      profile.username,
      religionEnabled,
      reportCloudError,
      todayKey,
      user,
      visibleActivities,
    ]
  );

  useEffect(() => {
    syncEnabledGroupsRef.current = async (nextLogs: Record<string, DailyLog>) => {
      const enabledGroupIds = Object.entries(groupPrivacyByGroup)
        .filter(([, gp]) => gp.sharingEnabled)
        .map(([gid]) => gid);
      for (const gid of enabledGroupIds) {
        const priv = groupPrivacyByGroup[gid];
        if (priv) {
          await syncGroupSharedProgressDoc(gid, priv, nextLogs);
        }
      }
    };
  }, [groupPrivacyByGroup, syncGroupSharedProgressDoc]);

  const createGroup = useCallback(
    async (input: {
      name: string;
      description: string;
      avatarId?: string;
      imageUrl?: string;
      isPrivate?: boolean;
    }): Promise<string | null> => {
      const opKey = 'createGroup';
      if (inFlightKeysRef.current.has(opKey)) return null;
      inFlightKeysRef.current.add(opKey);
      try {
        const cleanName = input.name.trim().slice(0, 80);
        if (!cleanName) {
          setErrorMessage(UI_COPY[language].groupNameRequiredError);
          return null;
        }
        if (!isSafeGroupImageUrl(input.imageUrl)) {
          setErrorMessage(UI_COPY[language].errorGroupImageTooLarge);
          return null;
        }

        const groupId = `grp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        const inviteCode = generateInviteCode(cleanName + currentUid);
        const myUsername = isValidUsername(profile.username ?? '')
          ? profile.username!
          : normalizeUsername(currentUid).padEnd(3, '0').slice(0, 24);
        const cleanDesc = input.description.trim().slice(0, 300);
        const cleanAvatar = (input.avatarId || 'compass').slice(0, 40);
        const isPrivate = input.isPrivate ?? true;

        const newGroup: FriendGroup = {
          id: groupId,
          name: cleanName,
          description: cleanDesc,
          avatarId: cleanAvatar,
          ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
          creatorUid: currentUid,
          isPrivate,
          inviteCode,
          memberUids: [currentUid],
          memberCount: 1,
          createdAtIso: new Date().toISOString(),
        };

        const creatorMember: GroupMember = {
          uid: currentUid,
          groupId,
          username: myUsername,
          displayName: (profile.displayName || 'Adventurer').slice(0, 100),
          avatarId: profile.avatarId || 'crest',
          role: 'creator',
          joinedAtIso: new Date().toISOString(),
        };

        const linkDoc: GroupInviteLink = {
          code: inviteCode,
          groupId,
          groupName: cleanName,
          creatorUid: currentUid,
          active: true,
          createdAtIso: new Date().toISOString(),
        };

        // Strict default: group sharing starts OFF
        setGroups((prev) => [newGroup, ...prev]);
        setGroupMembers((prev) => ({ ...prev, [groupId]: [creatorMember] }));
        setGroupInviteLinks((prev) => ({ ...prev, [inviteCode]: linkDoc }));
        setGroupPrivacyByGroup((prev) => ({
          ...prev,
          [groupId]: { ...DEFAULT_GROUP_PRIVACY_SETTINGS },
        }));
        setGroupSharedProgress((prev) => ({ ...prev, [groupId]: [] }));
        setGroupFeed((prev) => ({ ...prev, [groupId]: [] }));
        setGroupChallenges((prev) => ({ ...prev, [groupId]: [] }));
        setActiveGroupId(groupId);

        if (user && db) {
          const firestore = db;
          try {
            const batch = writeBatch(firestore);
            batch.set(doc(firestore, 'groups', groupId), {
              id: groupId,
              name: cleanName,
              description: cleanDesc,
              avatarId: cleanAvatar,
              ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
              creatorUid: user.uid,
              isPrivate,
              inviteCode,
              memberUids: [user.uid],
              memberCount: 1,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            batch.set(doc(firestore, 'groups', groupId, 'members', user.uid), {
              uid: user.uid,
              groupId,
              username: myUsername,
              displayName: (profile.displayName || 'Adventurer').slice(0, 100),
              avatarId: profile.avatarId || 'crest',
              role: 'creator',
              joinedAt: serverTimestamp(),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            batch.set(doc(firestore, 'groupInviteLinks', inviteCode), {
              code: inviteCode,
              groupId,
              groupName: cleanName,
              creatorUid: user.uid,
              active: true,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            await batch.commit();

            // Write private sharedProgress AFTER group doc commits (isGroupMember uses get())
            await setDoc(doc(firestore, 'groups', groupId, 'sharedProgress', user.uid), {
              uid: user.uid,
              groupId,
              username: myUsername,
              displayName: (profile.displayName || 'Adventurer').slice(0, 100),
              avatarId: profile.avatarId || 'crest',
              ...DEFAULT_GROUP_PRIVACY_SETTINGS,
              sharedBadges: [],
              categorySummaries: {},
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            reportCloudError(err, OperationType.WRITE, `groups/${groupId}`);
          }
        }

        showToast(UI_COPY[language].toastGroupCreated);
        return groupId;
      } finally {
        inFlightKeysRef.current.delete(opKey);
      }
    },
    [
      currentUid,
      language,
      profile.avatarId,
      profile.displayName,
      profile.username,
      reportCloudError,
      showToast,
      user,
    ]
  );

  const updateGroupDetails = useCallback(
    async (
      groupId: string,
      updates: {
        name: string;
        description: string;
        avatarId?: string;
        imageUrl?: string;
        isPrivate: boolean;
      }
    ) => {
      const members = groupMembers[groupId] ?? [];
      const myRole = members.find((m) => m.uid === currentUid)?.role;
      if (!canEditOrDeleteGroup(myRole)) return;

      const cleanName = updates.name.trim().slice(0, 80);
      if (!cleanName) {
        setErrorMessage(UI_COPY[language].groupNameRequiredError);
        return;
      }
      if (!isSafeGroupImageUrl(updates.imageUrl)) {
        setErrorMessage(UI_COPY[language].errorGroupImageTooLarge);
        return;
      }
      const cleanDesc = updates.description.trim().slice(0, 300);
      const cleanAvatar = (updates.avatarId || 'compass').slice(0, 40);

      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? {
                ...g,
                name: cleanName,
                description: cleanDesc,
                avatarId: cleanAvatar,
                imageUrl: updates.imageUrl || undefined,
                isPrivate: updates.isPrivate,
              }
            : g
        )
      );

      if (user && db) {
        try {
          await updateDoc(doc(db, 'groups', groupId), {
            name: cleanName,
            description: cleanDesc,
            avatarId: cleanAvatar,
            imageUrl: updates.imageUrl || '',
            isPrivate: updates.isPrivate,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          reportCloudError(err, OperationType.UPDATE, `groups/${groupId}`);
        }
      }
      showToast(UI_COPY[language].toastGroupUpdated);
    },
    [currentUid, groupMembers, language, reportCloudError, showToast, user]
  );

  const deleteGroup = useCallback(
    async (groupId: string) => {
      const opKey = `deleteGroup:${groupId}`;
      if (inFlightKeysRef.current.has(opKey)) return;
      inFlightKeysRef.current.add(opKey);
      try {
        const members = groupMembers[groupId] ?? [];
        const myRole = members.find((m) => m.uid === currentUid)?.role;
        if (!canEditOrDeleteGroup(myRole)) return;

        const targetGroup = groups.find((g) => g.id === groupId);
        setGroups((prev) => {
          const next = prev.filter((g) => g.id !== groupId);
          setActiveGroupId((curr) => (curr === groupId ? (next[0]?.id ?? null) : curr));
          return next;
        });
        setGroupMembers((prev) => {
          const next = { ...prev };
          delete next[groupId];
          return next;
        });

        if (user && db) {
          const firestore = db;
          try {
            // Delete subcollections & invite link FIRST while groups/{groupId} still exists for isGroupAdminOrCreator()
            const ops: BatchOp[] = [];
            const [membersSnap, sharedSnap, feedSnap, chSnap] = await Promise.all([
              getDocs(collection(firestore, 'groups', groupId, 'members')),
              getDocs(collection(firestore, 'groups', groupId, 'sharedProgress')),
              getDocs(collection(firestore, 'groups', groupId, 'feed')),
              getDocs(collection(firestore, 'groups', groupId, 'challenges')),
            ]);

            membersSnap.forEach((d) => {
              if (d.data().role !== 'creator') {
                ops.push({ type: 'delete', ref: d.ref });
              }
            });
            sharedSnap.forEach((d) => ops.push({ type: 'delete', ref: d.ref }));
            feedSnap.forEach((d) => ops.push({ type: 'delete', ref: d.ref }));

            for (const chDoc of chSnap.docs) {
              const partSnap = await getDocs(
                collection(firestore, 'groups', groupId, 'challenges', chDoc.id, 'participants')
              );
              partSnap.forEach((p) => ops.push({ type: 'delete', ref: p.ref }));
              ops.push({ type: 'delete', ref: chDoc.ref });
            }

            if (targetGroup?.inviteCode) {
              ops.push({
                type: 'delete',
                ref: doc(firestore, 'groupInviteLinks', targetGroup.inviteCode),
              });
            }

            await commitChunkedOps(firestore, ops);
            // Delete parent group document LAST
            await deleteDoc(doc(firestore, 'groups', groupId));
          } catch (err) {
            reportCloudError(err, OperationType.DELETE, `groups/${groupId}`);
          }
        }
        showToast(UI_COPY[language].toastGroupDeleted);
      } finally {
        inFlightKeysRef.current.delete(opKey);
      }
    },
    [currentUid, groupMembers, groups, language, reportCloudError, showToast, user]
  );

  const inviteFriendToGroup = useCallback(
    async (group: FriendGroup, target: UsernameSearchResult) => {
      const members = groupMembers[group.id] ?? [];
      const myRole = members.find((m) => m.uid === currentUid)?.role;
      if (!canManageGroupMembers(myRole)) return;
      if (target.uid === currentUid || group.memberUids.includes(target.uid)) return;

      const inviteId = `${group.id}_${target.uid}`;
      if (groupInvitations.some((i) => i.id === inviteId && i.status === 'pending')) return;

      const myUsername = isValidUsername(profile.username ?? '')
        ? profile.username!
        : normalizeUsername(currentUid).padEnd(3, '0').slice(0, 24);

      const newInvite: GroupInvitation = {
        id: inviteId,
        groupId: group.id,
        groupName: group.name,
        groupDescription: group.description,
        fromUid: currentUid,
        fromUsername: myUsername,
        fromDisplayName: (profile.displayName || 'Adventurer').slice(0, 100),
        toUid: target.uid,
        toUsername: target.username,
        status: 'pending',
        createdAtIso: new Date().toISOString(),
      };

      if (!user || !db) {
        setGroupInvitations((prev) => [...prev.filter((i) => i.id !== inviteId), newInvite]);
        showToast(UI_COPY[language].toastGroupInviteSent);
        return;
      }

      try {
        await setDoc(doc(db, 'groupInvitations', inviteId), {
          id: inviteId,
          groupId: group.id,
          groupName: group.name.slice(0, 80),
          groupDescription: group.description.slice(0, 300),
          fromUid: user.uid,
          fromUsername: myUsername,
          fromDisplayName: (profile.displayName || 'Adventurer').slice(0, 100),
          toUid: target.uid,
          toUsername: target.username,
          status: 'pending',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showToast(UI_COPY[language].toastGroupInviteSent);
      } catch (err) {
        reportCloudError(err, OperationType.WRITE, `groupInvitations/${inviteId}`);
      }
    },
    [
      currentUid,
      groupInvitations,
      groupMembers,
      language,
      profile.displayName,
      profile.username,
      reportCloudError,
      showToast,
      user,
    ]
  );

  const joinGroupLocalHelper = useCallback(
    (groupId: string, fallbackGroup?: FriendGroup) => {
      const sampleBundle = SAMPLE_EXTRA_JOINABLE_GROUPS[groupId];
      const baseGroup =
        groups.find((g) => g.id === groupId) ?? sampleBundle?.group ?? fallbackGroup;
      if (!baseGroup) return;

      const myUsername = isValidUsername(profile.username ?? '')
        ? profile.username!
        : normalizeUsername(currentUid).padEnd(3, '0').slice(0, 24);

      const nextUids = baseGroup.memberUids.includes(currentUid)
        ? baseGroup.memberUids
        : [...baseGroup.memberUids, currentUid];
      const updatedGroup: FriendGroup = {
        ...baseGroup,
        memberUids: nextUids,
        memberCount: nextUids.length,
      };

      setGroups((prev) => {
        const exists = prev.some((g) => g.id === groupId);
        return exists ? prev.map((g) => (g.id === groupId ? updatedGroup : g)) : [updatedGroup, ...prev];
      });

      const myMember: GroupMember = {
        uid: currentUid,
        groupId,
        username: myUsername,
        displayName: (profile.displayName || 'Adventurer').slice(0, 100),
        avatarId: profile.avatarId || 'crest',
        role: 'member',
        joinedAtIso: new Date().toISOString(),
      };

      setGroupMembers((prev) => {
        const existing = prev[groupId] ?? sampleBundle?.members ?? [];
        if (existing.some((m) => m.uid === currentUid)) return prev;
        return { ...prev, [groupId]: [...existing, myMember] };
      });

      setGroupPrivacyByGroup((prev) => ({
        ...prev,
        [groupId]: prev[groupId] ?? { ...DEFAULT_GROUP_PRIVACY_SETTINGS },
      }));

      if (sampleBundle) {
        setGroupSharedProgress((prev) => ({
          ...prev,
          [groupId]: prev[groupId] ?? sampleBundle.sharedProgress,
        }));
        setGroupChallenges((prev) => ({
          ...prev,
          [groupId]: prev[groupId] ?? sampleBundle.challenges,
        }));
        setGroupFeed((prev) => ({
          ...prev,
          [groupId]: prev[groupId] ?? sampleBundle.feed,
        }));
      }

      setActiveGroupId(groupId);
    },
    [currentUid, groups, profile.avatarId, profile.displayName, profile.username]
  );

  const respondToGroupInvitation = useCallback(
    async (invite: GroupInvitation, decision: 'accepted' | 'declined') => {
      const opKey = `respondGroupInvite:${invite.id}`;
      if (inFlightKeysRef.current.has(opKey)) return;
      inFlightKeysRef.current.add(opKey);
      try {
        if (!user || !db) {
          setGroupInvitations((prev) =>
            prev.map((i) => (i.id === invite.id ? { ...i, status: decision } : i))
          );
          if (decision === 'accepted') {
            joinGroupLocalHelper(invite.groupId, {
              id: invite.groupId,
              name: invite.groupName,
              description: invite.groupDescription ?? '',
              avatarId: 'flame',
              creatorUid: invite.fromUid,
              isPrivate: true,
              inviteCode: generateInviteCode(invite.groupId),
              memberUids: [invite.fromUid, currentUid],
              memberCount: 2,
            });
          }
          showToast(
            decision === 'accepted'
              ? UI_COPY[language].toastGroupInviteAccepted
              : UI_COPY[language].toastGroupInviteDeclined
          );
          return;
        }

        const firestore = db;
        const myUsername = isValidUsername(profile.username ?? '')
          ? profile.username!
          : normalizeUsername(user.uid).padEnd(3, '0').slice(0, 24);
        const myDisplayName = (profile.displayName || 'Adventurer').slice(0, 100);
        const myAvatar = profile.avatarId || 'crest';

        try {
          let joined = false;
          await runTransaction(firestore, async (tx) => {
            const invRef = doc(firestore, 'groupInvitations', invite.id);
            const grpRef = doc(firestore, 'groups', invite.groupId);
            const grpSnap = await tx.get(grpRef);

            tx.update(invRef, {
              status: decision,
              updatedAt: serverTimestamp(),
            });

            if (decision === 'accepted' && grpSnap.exists()) {
              const grpData = grpSnap.data();
              const existingUids: string[] = Array.isArray(grpData.memberUids)
                ? grpData.memberUids.map(String)
                : [];
              if (!existingUids.includes(user.uid)) {
                const nextUids = [...existingUids, user.uid];
                tx.update(grpRef, {
                  memberUids: nextUids,
                  memberCount: nextUids.length,
                  updatedAt: serverTimestamp(),
                });
                tx.set(doc(firestore, 'groups', invite.groupId, 'members', user.uid), {
                  uid: user.uid,
                  groupId: invite.groupId,
                  username: myUsername,
                  displayName: myDisplayName,
                  avatarId: myAvatar,
                  role: 'member',
                  joinedAt: serverTimestamp(),
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
              }
              joined = true;
            }
          });

          if (joined) {
            setActiveGroupId(invite.groupId);
            await setDoc(doc(firestore, 'groups', invite.groupId, 'sharedProgress', user.uid), {
              uid: user.uid,
              groupId: invite.groupId,
              username: myUsername,
              displayName: myDisplayName,
              avatarId: myAvatar,
              ...DEFAULT_GROUP_PRIVACY_SETTINGS,
              sharedBadges: [],
              categorySummaries: {},
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }

          showToast(
            decision === 'accepted'
              ? UI_COPY[language].toastGroupInviteAccepted
              : UI_COPY[language].toastGroupInviteDeclined
          );
        } catch (err) {
          reportCloudError(err, OperationType.WRITE, `groupInvitations/${invite.id}`);
        }
      } finally {
        inFlightKeysRef.current.delete(opKey);
      }
    },
    [
      currentUid,
      joinGroupLocalHelper,
      language,
      profile.avatarId,
      profile.displayName,
      profile.username,
      reportCloudError,
      showToast,
      user,
    ]
  );

  const cancelGroupInvitation = useCallback(
    async (inviteId: string) => {
      setGroupInvitations((prev) => prev.filter((i) => i.id !== inviteId));
      if (user && db) {
        try {
          await deleteDoc(doc(db, 'groupInvitations', inviteId));
        } catch (err) {
          reportCloudError(err, OperationType.DELETE, `groupInvitations/${inviteId}`);
        }
      }
    },
    [reportCloudError, user]
  );

  const joinGroupByInviteCode = useCallback(
    async (rawInput: string): Promise<boolean> => {
      let code = rawInput.trim();
      if (code.includes('groupInvite=')) {
        try {
          const parsedUrl = new URL(code, window.location.origin);
          code = parsedUrl.searchParams.get('groupInvite') ?? code;
        } catch {
          const match = code.match(/groupInvite=([a-zA-Z0-9_-]+)/);
          if (match) code = match[1];
        }
      }
      code = code.trim();
      if (!isValidInviteCode(code)) {
        setErrorMessage(UI_COPY[language].errorInvalidGroupCode);
        return false;
      }

      const opKey = `joinGroup:${code}`;
      if (inFlightKeysRef.current.has(opKey)) return false;
      inFlightKeysRef.current.add(opKey);

      try {
        if (!user || !db) {
          const link = groupInviteLinks[code] ?? SAMPLE_GROUP_INVITE_LINKS[code];
          if (!link || !link.active) {
            setErrorMessage(UI_COPY[language].errorInvalidGroupCode);
            return false;
          }
          joinGroupLocalHelper(link.groupId);
          setGroupInvitations((prev) =>
            prev.map((i) =>
              i.groupId === link.groupId && i.toUid === currentUid ? { ...i, status: 'accepted' } : i
            )
          );
          showToast(UI_COPY[language].toastGroupJoined);
          return true;
        }

        const firestore = db;
        try {
          const linkSnap = await getDoc(doc(firestore, 'groupInviteLinks', code));
          if (!linkSnap.exists() || !linkSnap.data().active) {
            setErrorMessage(UI_COPY[language].errorInvalidGroupCode);
            return false;
          }
          const targetGroupId = String(linkSnap.data().groupId);
          const myUsername = isValidUsername(profile.username ?? '')
            ? profile.username!
            : normalizeUsername(user.uid).padEnd(3, '0').slice(0, 24);
          const myDisplayName = (profile.displayName || 'Adventurer').slice(0, 100);
          const myAvatar = profile.avatarId || 'crest';

          let alreadyMember = false;
          let groupMissing = false;

          await runTransaction(firestore, async (tx) => {
            const grpRef = doc(firestore, 'groups', targetGroupId);
            const grpSnap = await tx.get(grpRef);
            if (!grpSnap.exists()) {
              groupMissing = true;
              return;
            }
            const grpData = grpSnap.data();
            const existingUids: string[] = Array.isArray(grpData.memberUids)
              ? grpData.memberUids.map(String)
              : [];
            if (existingUids.includes(user.uid)) {
              alreadyMember = true;
              return;
            }
            const nextUids = [...existingUids, user.uid];
            tx.update(grpRef, {
              memberUids: nextUids,
              memberCount: nextUids.length,
              updatedAt: serverTimestamp(),
            });
            tx.set(doc(firestore, 'groups', targetGroupId, 'members', user.uid), {
              uid: user.uid,
              groupId: targetGroupId,
              username: myUsername,
              displayName: myDisplayName,
              avatarId: myAvatar,
              role: 'member',
              joinedAt: serverTimestamp(),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          });

          if (groupMissing) {
            setErrorMessage(UI_COPY[language].errorInvalidGroupCode);
            return false;
          }
          if (!alreadyMember) {
            await setDoc(doc(firestore, 'groups', targetGroupId, 'sharedProgress', user.uid), {
              uid: user.uid,
              groupId: targetGroupId,
              username: myUsername,
              displayName: myDisplayName,
              avatarId: myAvatar,
              ...DEFAULT_GROUP_PRIVACY_SETTINGS,
              sharedBadges: [],
              categorySummaries: {},
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }

          setActiveGroupId(targetGroupId);
          showToast(UI_COPY[language].toastGroupJoined);
          return true;
        } catch (err) {
          reportCloudError(err, OperationType.WRITE, `groupInviteLinks/${code}`);
          return false;
        }
      } finally {
        inFlightKeysRef.current.delete(opKey);
      }
    },
    [
      currentUid,
      groupInviteLinks,
      joinGroupLocalHelper,
      language,
      profile.avatarId,
      profile.displayName,
      profile.username,
      reportCloudError,
      showToast,
      user,
    ]
  );

  // Check URL query for ?groupInvite=CODE on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const code = new URLSearchParams(window.location.search).get('groupInvite');
    if (code && isValidInviteCode(code)) {
      joinGroupByInviteCode(code);
      try {
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.delete('groupInvite');
        window.history.replaceState({}, '', nextUrl.toString());
      } catch {
        // ignore history error
      }
    }
  }, [joinGroupByInviteCode]);

  const regenerateGroupInviteCode = useCallback(
    async (groupId: string) => {
      const members = groupMembers[groupId] ?? [];
      const myRole = members.find((m) => m.uid === currentUid)?.role;
      if (!canManageGroupMembers(myRole)) return;

      const target = groups.find((g) => g.id === groupId);
      if (!target) return;
      const nextCode = generateInviteCode(target.name + Date.now().toString(36));

      setGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, inviteCode: nextCode } : g))
      );
      setGroupInviteLinks((prev) => {
        const next = { ...prev };
        if (target.inviteCode && next[target.inviteCode]) {
          next[target.inviteCode] = { ...next[target.inviteCode], active: false };
        }
        next[nextCode] = {
          code: nextCode,
          groupId,
          groupName: target.name,
          creatorUid: currentUid,
          active: true,
          createdAtIso: new Date().toISOString(),
        };
        return next;
      });

      if (user && db) {
        const firestore = db;
        try {
          const batch = writeBatch(firestore);
          if (target.inviteCode) {
            batch.update(doc(firestore, 'groupInviteLinks', target.inviteCode), {
              active: false,
              updatedAt: serverTimestamp(),
            });
          }
          batch.set(doc(firestore, 'groupInviteLinks', nextCode), {
            code: nextCode,
            groupId,
            groupName: target.name.slice(0, 80),
            creatorUid: user.uid,
            active: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          batch.update(doc(firestore, 'groups', groupId), {
            inviteCode: nextCode,
            updatedAt: serverTimestamp(),
          });
          await batch.commit();
        } catch (err) {
          reportCloudError(err, OperationType.WRITE, `groups/${groupId}`);
        }
      }
      showToast(UI_COPY[language].toastGroupCodeRegenerated);
    },
    [currentUid, groupMembers, groups, language, reportCloudError, showToast, user]
  );

  const updateMemberRole = useCallback(
    async (groupId: string, targetUid: string, nextRole: 'admin' | 'member') => {
      const members = groupMembers[groupId] ?? [];
      const myRole = members.find((m) => m.uid === currentUid)?.role;
      const target = members.find((m) => m.uid === targetUid);
      if (!canAssignAdmin(myRole) || !target || target.role === 'creator') return;

      setGroupMembers((prev) => ({
        ...prev,
        [groupId]: (prev[groupId] ?? []).map((m) =>
          m.uid === targetUid ? { ...m, role: nextRole } : m
        ),
      }));

      if (user && db) {
        try {
          await updateDoc(doc(db, 'groups', groupId, 'members', targetUid), {
            role: nextRole,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          reportCloudError(
            err,
            OperationType.UPDATE,
            `groups/${groupId}/members/${targetUid}`
          );
        }
      }
      showToast(UI_COPY[language].toastMemberRoleUpdated);
    },
    [currentUid, groupMembers, language, reportCloudError, showToast, user]
  );

  const removeOrLeaveGroup = useCallback(
    async (groupId: string, targetUid: string) => {
      const members = groupMembers[groupId] ?? [];
      const myRole = members.find((m) => m.uid === currentUid)?.role;
      const target = members.find((m) => m.uid === targetUid);
      if (!target) return;
      const isSelf = targetUid === currentUid;
      if (!canRemoveGroupMember(myRole, target.role, isSelf)) return;

      setGroupMembers((prev) => ({
        ...prev,
        [groupId]: (prev[groupId] ?? []).filter((m) => m.uid !== targetUid),
      }));
      setGroupSharedProgress((prev) => ({
        ...prev,
        [groupId]: (prev[groupId] ?? []).filter((s) => s.uid !== targetUid),
      }));

      if (isSelf) {
        setGroups((prev) => {
          const next = prev.filter((g) => g.id !== groupId);
          setActiveGroupId((curr) => (curr === groupId ? (next[0]?.id ?? null) : curr));
          return next;
        });
      } else {
        setGroups((prev) =>
          prev.map((g) => {
            if (g.id !== groupId) return g;
            const nextUids = g.memberUids.filter((u) => u !== targetUid);
            return { ...g, memberUids: nextUids, memberCount: nextUids.length };
          })
        );
      }

      if (user && db) {
        const firestore = db;
        try {
          const grpSnap = await getDoc(doc(firestore, 'groups', groupId));
          const batch = writeBatch(firestore);
          batch.delete(doc(firestore, 'groups', groupId, 'members', targetUid));
          // Admins/creators can now delete kicked member's sharedProgress doc cleanly
          batch.delete(doc(firestore, 'groups', groupId, 'sharedProgress', targetUid));
          if (grpSnap.exists()) {
            const existingUids: string[] = Array.isArray(grpSnap.data().memberUids)
              ? grpSnap.data().memberUids.map(String)
              : [];
            const nextUids = existingUids.filter((u) => u !== targetUid);
            batch.update(doc(firestore, 'groups', groupId), {
              memberUids: nextUids,
              memberCount: nextUids.length,
              updatedAt: serverTimestamp(),
            });
          }
          await batch.commit();
        } catch (err) {
          reportCloudError(err, OperationType.DELETE, `groups/${groupId}/members/${targetUid}`);
        }
      }
      showToast(isSelf ? UI_COPY[language].toastGroupLeft : UI_COPY[language].toastMemberRemoved);
    },
    [currentUid, groupMembers, language, reportCloudError, showToast, user]
  );

  const updateGroupPrivacy = useCallback(
    async (groupId: string, nextPrivacy: GroupPrivacySettings) => {
      await syncGroupSharedProgressDoc(groupId, nextPrivacy);
      showToast(
        nextPrivacy.sharingEnabled
          ? UI_COPY[language].toastGroupPrivacySaved
          : UI_COPY[language].toastGroupSharingRevoked
      );
    },
    [language, showToast, syncGroupSharedProgressDoc]
  );

  const publishGroupMilestone = useCallback(
    async (
      groupId: string,
      title: string,
      detail: string,
      type: 'achievement' | 'milestone' | 'challenge' = 'milestone'
    ) => {
      const cleanTitle = title.trim().slice(0, 100);
      if (!cleanTitle) return;
      const cleanDetail = detail.trim().slice(0, 300);
      const feedId = `feed_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;

      const item: GroupFeedItem = {
        id: feedId,
        groupId,
        uid: currentUid,
        displayName: (profile.displayName || 'Adventurer').slice(0, 100),
        avatarId: profile.avatarId || 'crest',
        type,
        title: cleanTitle,
        detail: cleanDetail,
        createdAtIso: new Date().toISOString(),
      };

      setGroupFeed((prev) => ({
        ...prev,
        [groupId]: [item, ...(prev[groupId] ?? [])],
      }));

      if (user && db) {
        try {
          await setDoc(doc(db, 'groups', groupId, 'feed', feedId), {
            id: feedId,
            groupId,
            uid: user.uid,
            displayName: item.displayName,
            avatarId: item.avatarId,
            type: item.type,
            title: item.title,
            detail: item.detail,
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          reportCloudError(err, OperationType.WRITE, `groups/${groupId}/feed/${feedId}`);
        }
      }
      showToast(UI_COPY[language].toastGroupMilestoneShared);
    },
    [currentUid, language, profile.avatarId, profile.displayName, reportCloudError, showToast, user]
  );

  const createGroupChallenge = useCallback(
    async (
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
    ) => {
      const cleanTitle = input.title.trim().slice(0, 100);
      if (!cleanTitle) return;

      const safeCategory = NEVER_SHARE_CATEGORIES.has(input.category)
        ? 'custom'
        : input.category.trim().slice(0, 40) || 'custom';
      const id = `gch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
      const nextCh: GroupChallenge = {
        id,
        groupId,
        creatorUid: currentUid,
        title: cleanTitle,
        description: input.description.trim().slice(0, 300),
        frequency: input.frequency,
        category: safeCategory,
        activityId: input.activityId?.trim().slice(0, 64) || 'custom',
        targetValue: Math.max(1, Math.min(1000000, Number(input.targetValue) || 10)),
        unitLabel: input.unitLabel.trim().slice(0, 40) || 'min',
        durationDays: Math.max(1, Math.min(365, Number(input.durationDays) || 7)),
        xpReward: Math.max(0, Math.min(5000, Number(input.xpReward) || 50)),
        ...(input.badgeTitle?.trim()
          ? { badgeTitle: input.badgeTitle.trim().slice(0, 60) }
          : {}),
        createdAtIso: new Date().toISOString(),
      };

      setGroupChallenges((prev) => ({
        ...prev,
        [groupId]: [nextCh, ...(prev[groupId] ?? [])],
      }));

      if (user && db) {
        try {
          await setDoc(doc(db, 'groups', groupId, 'challenges', id), {
            id: nextCh.id,
            groupId: nextCh.groupId,
            creatorUid: user.uid,
            title: nextCh.title,
            description: nextCh.description,
            frequency: nextCh.frequency,
            category: nextCh.category,
            activityId: nextCh.activityId,
            targetValue: nextCh.targetValue,
            unitLabel: nextCh.unitLabel,
            durationDays: nextCh.durationDays,
            xpReward: nextCh.xpReward,
            ...(nextCh.badgeTitle ? { badgeTitle: nextCh.badgeTitle } : {}),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          reportCloudError(err, OperationType.WRITE, `groups/${groupId}/challenges/${id}`);
        }
      }
      showToast(UI_COPY[language].toastGroupChallengeCreated);
    },
    [currentUid, language, reportCloudError, showToast, user]
  );

  const joinOrSyncGroupChallenge = useCallback(
    async (groupId: string, challenge: GroupChallenge, manualValue?: number) => {
      const existing = (groupChallengeParticipants[challenge.id] ?? []).find(
        (p) => p.uid === currentUid
      );
      const progressValue = computeGroupChallengeParticipantValue({
        challenge,
        activities,
        customCategories: profile.customCategories,
        dailyLogs,
        todayKey,
        manualValue: manualValue ?? existing?.progressValue ?? 0,
      });
      const completed = progressValue >= challenge.targetValue;
      const participant: GroupChallengeParticipant = {
        uid: currentUid,
        groupId,
        challengeId: challenge.id,
        displayName: (profile.displayName || 'Adventurer').slice(0, 100),
        avatarId: profile.avatarId || 'crest',
        progressValue,
        completed,
        xpAwarded: completed,
        updatedAtIso: new Date().toISOString(),
      };

      setGroupChallengeParticipants((prev) => {
        const others = (prev[challenge.id] ?? []).filter((p) => p.uid !== currentUid);
        return { ...prev, [challenge.id]: [participant, ...others] };
      });

      if (user && db) {
        try {
          const partRef = doc(
            db,
            'groups',
            groupId,
            'challenges',
            challenge.id,
            'participants',
            user.uid
          );
          const snap = await getDoc(partRef);
          if (snap.exists()) {
            await updateDoc(partRef, {
              displayName: participant.displayName,
              avatarId: participant.avatarId,
              progressValue: participant.progressValue,
              completed: participant.completed,
              xpAwarded: participant.xpAwarded,
              updatedAt: serverTimestamp(),
            });
          } else {
            await setDoc(partRef, {
              uid: user.uid,
              groupId,
              challengeId: challenge.id,
              displayName: participant.displayName,
              avatarId: participant.avatarId,
              progressValue: participant.progressValue,
              completed: participant.completed,
              xpAwarded: participant.xpAwarded,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          reportCloudError(
            err,
            OperationType.WRITE,
            `groups/${groupId}/challenges/${challenge.id}/participants/${user.uid}`
          );
        }
      }
      showToast(
        existing
          ? UI_COPY[language].toastGroupChallengeUpdated
          : UI_COPY[language].toastGroupChallengeJoined
      );
    },
    [
      activities,
      currentUid,
      dailyLogs,
      groupChallengeParticipants,
      language,
      profile.avatarId,
      profile.customCategories,
      profile.displayName,
      reportCloudError,
      showToast,
      todayKey,
      user,
    ]
  );

  const leaveGroupChallenge = useCallback(
    async (groupId: string, challengeId: string) => {
      setGroupChallengeParticipants((prev) => ({
        ...prev,
        [challengeId]: (prev[challengeId] ?? []).filter((p) => p.uid !== currentUid),
      }));
      if (user && db) {
        try {
          await deleteDoc(
            doc(db, 'groups', groupId, 'challenges', challengeId, 'participants', user.uid)
          );
        } catch (err) {
          reportCloudError(
            err,
            OperationType.DELETE,
            `groups/${groupId}/challenges/${challengeId}/participants/${user.uid}`
          );
        }
      }
      showToast(UI_COPY[language].toastGroupChallengeLeft);
    },
    [currentUid, language, reportCloudError, showToast, user]
  );

  // Derived active group slices
  const activeGroup = useMemo(
    () => groups.find((g) => g.id === activeGroupId) ?? null,
    [activeGroupId, groups]
  );
  const activeGroupMembers = useMemo(
    () => (activeGroupId ? (groupMembers[activeGroupId] ?? []) : []),
    [activeGroupId, groupMembers]
  );
  const activeGroupRole = useMemo(
    () => activeGroupMembers.find((m) => m.uid === currentUid)?.role,
    [activeGroupMembers, currentUid]
  );
  const activeGroupPrivacy = useMemo(
    () =>
      activeGroupId
        ? sanitizeGroupPrivacySettings(
            groupPrivacyByGroup[activeGroupId],
            profile.customCategories
          )
        : DEFAULT_GROUP_PRIVACY_SETTINGS,
    [activeGroupId, groupPrivacyByGroup, profile.customCategories]
  );
  const activeGroupSharedProgress = useMemo(() => {
    if (!activeGroup) return [];
    const viewerIsMember = canViewerAccessGroup(activeGroup, activeGroupMembers, currentUid);
    if (!viewerIsMember) return [];
    const raw = groupSharedProgress[activeGroup.id] ?? [];
    return raw
      .map((s) => filterGroupSharedProgressForViewer(s, viewerIsMember))
      .filter((s): s is GroupSharedProgress => Boolean(s));
  }, [activeGroup, activeGroupMembers, currentUid, groupSharedProgress]);

  const activeGroupFeed = useMemo(
    () => (activeGroupId ? (groupFeed[activeGroupId] ?? []) : []),
    [activeGroupId, groupFeed]
  );
  const activeGroupChallenges = useMemo(
    () => (activeGroupId ? (groupChallenges[activeGroupId] ?? []) : []),
    [activeGroupId, groupChallenges]
  );

  const selectedLog = dailyLogs[selectedDateKey];

  return {
    todayKey,
    selectedDateKey,
    setSelectedDateKey,
    language,
    setLanguage,
    currentUid,
    profile,
    activities,
    visibleActivities,
    dailyLogs,
    selectedLog,
    todaySummary,
    achievements,
    xpTotals,
    levelInfo,
    streakInfo,
    friends,
    friendRequests,
    leaderboardEntries,
    challenges,
    challengeParticipants,
    groups,
    activeGroupId,
    setActiveGroupId,
    activeGroup,
    activeGroupMembers,
    activeGroupRole,
    activeGroupPrivacy,
    activeGroupSharedProgress,
    activeGroupFeed,
    activeGroupChallenges,
    groupPrivacyByGroup,
    groupInvitations,
    groupChallengeParticipants,
    groupChallengeRewards,
    showOnboardingModal,
    setShowOnboardingModal,
    user,
    authReady,
    cloudLoading,
    isFirebaseConfigured,
    firebaseReachable,
    statusMessage,
    errorMessage,
    setErrorMessage,
    updateActivityEntry,
    updateDailyNote,
    saveActivityDefinition,
    deleteActivityDefinition,
    reorderActivity,
    addCustomCategory,
    updateProfileSettings,
    updatePersonalProfile,
    updatePrivacySettings,
    toggleReligionTracking,
    completeOnboarding,
    searchUsersByUsername,
    sendFriendRequest,
    respondToFriendRequest,
    cancelFriendRequest,
    removeFriend,
    fetchSharedProfileForComparison,
    joinOrUpdateChallenge,
    leaveChallenge,
    createChallenge,
    createGroup,
    updateGroupDetails,
    deleteGroup,
    inviteFriendToGroup,
    respondToGroupInvitation,
    cancelGroupInvitation,
    joinGroupByInviteCode,
    regenerateGroupInviteCode,
    updateMemberRole,
    removeOrLeaveGroup,
    updateGroupPrivacy,
    publishGroupMilestone,
    createGroupChallenge,
    joinOrSyncGroupChallenge,
    leaveGroupChallenge,
    restoreFromBackup,
    resetAllData,
    deleteAccountAndData,
    handleSignIn,
    handleSignOut,
    showToast,
  };
}
