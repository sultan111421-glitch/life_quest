import React, { useEffect, useState } from 'react';
import {
  Award,
  Check,
  Lock,
  Search,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  FriendEdgeItem,
  FriendRequestItem,
  Language,
  PublicUserProfile,
  UsernameSearchResult,
} from '../types/quest';
import { formatDigits } from '../utils/dhakaTime';
import { getLocalizedCategoryLabel, UI_COPY } from '../utils/i18n';
import { AvatarBadge } from './AvatarBadge';

interface FriendsViewProps {
  currentUid: string;
  lang: Language;
  ownStats: {
    displayName: string;
    avatarId?: string;
    level: number;
    totalXp: number;
    currentStreak: number;
    weeklyPct: number;
    monthlyPct: number;
  };
  friends: FriendEdgeItem[];
  friendRequests: FriendRequestItem[];
  customCategories: { id: string; name: string }[];
  onSearchUsers: (query: string) => Promise<UsernameSearchResult[]>;
  onSendRequest: (target: UsernameSearchResult) => Promise<void>;
  onRespondRequest: (
    req: FriendRequestItem,
    decision: 'accepted' | 'declined'
  ) => Promise<void>;
  onCancelRequest: (requestId: string) => Promise<void>;
  onRemoveFriend: (friendUid: string) => Promise<void>;
  onFetchComparisonProfile: (targetUid: string) => Promise<PublicUserProfile | null>;
}

export const FriendsView: React.FC<FriendsViewProps> = ({
  currentUid,
  lang,
  ownStats,
  friends,
  friendRequests,
  customCategories,
  onSearchUsers,
  onSendRequest,
  onRespondRequest,
  onCancelRequest,
  onRemoveFriend,
  onFetchComparisonProfile,
}) => {
  const t = UI_COPY[lang];
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UsernameSearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [comparingProfile, setComparingProfile] = useState<PublicUserProfile | null>(null);
  const [comparisonClosedMsg, setComparisonClosedMsg] = useState(false);
  const [confirmRemoveFriendUid, setConfirmRemoveFriendUid] = useState<string | null>(null);

  useEffect(() => {
    if (!comparingProfile && !confirmRemoveFriendUid) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setComparingProfile(null);
        setConfirmRemoveFriendUid(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [comparingProfile, confirmRemoveFriendUid]);

  const incomingRequests = friendRequests.filter(
    (r) => r.toUid === currentUid && r.status === 'pending'
  );
  const outgoingRequests = friendRequests.filter(
    (r) => r.fromUid === currentUid && r.status === 'pending'
  );

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await onSearchUsers(searchQuery);
    setSearchResults(res);
    setHasSearched(true);
  };

  const handleCompare = async (uid: string) => {
    setComparisonClosedMsg(false);
    const prof = await onFetchComparisonProfile(uid);
    if (!prof) {
      setComparisonClosedMsg(true);
      return;
    }
    setComparingProfile(prof);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-100">{t.friendsTitle}</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">{t.friendsSubtitle}</p>
      </div>

      {/* Username Search Section */}
      <section className="rounded-2xl bg-[#121824] border border-white/[0.08] p-5 space-y-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchUsernamePlaceholder}
              className="w-full min-h-[44px] pl-10 pr-4 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>
          <button
            type="submit"
            className="min-h-[44px] px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold whitespace-nowrap"
          >
            {t.searchBtn}
          </button>
        </form>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
          <span>{t.searchPrivateNote}</span>
        </div>

        {hasSearched && (
          <div className="pt-2 border-t border-white/[0.06] space-y-2.5">
            {searchResults.length === 0 ? (
              <p className="text-xs text-slate-400">{t.noSearchResults}</p>
            ) : (
              searchResults.map((res) => {
                const isFriend = friends.some((f) => f.friendUid === res.uid);
                const isSent = outgoingRequests.some((r) => r.toUid === res.uid);
                return (
                  <div
                    key={res.uid}
                    className="p-3.5 rounded-xl bg-[#0B0F17] border border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <AvatarBadge avatarId={res.avatarId} size="sm" />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-100 truncate">
                          {res.displayName}
                        </div>
                        <div className="font-mono text-xs text-slate-400">
                          @{res.username} · {t.visibilityOptions[res.visibility].title}
                        </div>
                      </div>
                    </div>

                    {isFriend ? (
                      <span className="text-xs font-semibold text-emerald-400 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                        {t.alreadyFriendLabel}
                      </span>
                    ) : isSent ? (
                      <span className="text-xs font-medium text-amber-300 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
                        {t.requestSentLabel}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSendRequest(res)}
                        className="min-h-[40px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                      >
                        <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{t.sendFriendRequestBtn}</span>
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </section>

      {/* Incoming & Outgoing Friend Requests */}
      {(incomingRequests.length > 0 || outgoingRequests.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {incomingRequests.length > 0 && (
            <section className="rounded-2xl bg-[#121824] border border-white/[0.08] p-5 space-y-3">
              <h2 className="font-display text-base font-semibold text-slate-100">
                {t.incomingRequestsTitle} ({formatDigits(incomingRequests.length, lang)})
              </h2>
              {incomingRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-3.5 rounded-xl bg-[#0B0F17] border border-white/[0.06] flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-100 truncate">
                      {req.fromDisplayName}
                    </div>
                    <div className="font-mono text-xs text-slate-400">@{req.fromUsername}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onRespondRequest(req, 'accepted')}
                      className="min-h-[38px] px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{t.acceptBtn}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRespondRequest(req, 'declined')}
                      className="min-h-[38px] px-3 rounded-xl bg-[#1A2233] text-slate-300 hover:text-white text-xs font-medium"
                    >
                      {t.declineBtn}
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}

          {outgoingRequests.length > 0 && (
            <section className="rounded-2xl bg-[#121824] border border-white/[0.08] p-5 space-y-3">
              <h2 className="font-display text-base font-semibold text-slate-100">
                {t.outgoingRequestsTitle} ({formatDigits(outgoingRequests.length, lang)})
              </h2>
              {outgoingRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-3.5 rounded-xl bg-[#0B0F17] border border-white/[0.06] flex items-center justify-between gap-3"
                >
                  <div className="font-mono text-xs text-slate-300">@{req.toUsername}</div>
                  <button
                    type="button"
                    onClick={() => onCancelRequest(req.id)}
                    className="min-h-[38px] px-3 rounded-xl bg-[#1A2233] text-rose-300 text-xs font-medium"
                  >
                    {t.cancelRequestBtn}
                  </button>
                </div>
              ))}
            </section>
          )}
        </div>
      )}

      {/* Accepted Friends List */}
      <section className="rounded-2xl bg-[#121824] border border-white/[0.08] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-amber-400" aria-hidden="true" />
          <h2 className="font-display text-lg font-semibold text-slate-100">
            {t.myFriendsTitle} ({formatDigits(friends.length, lang)})
          </h2>
        </div>

        {comparisonClosedMsg && (
          <p className="text-xs text-amber-300" role="status">
            {t.hiddenByPrivacyLabel}
          </p>
        )}

        {friends.length === 0 ? (
          <p className="text-sm text-slate-400">{t.noFriendsYet}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {friends.map((friend) => (
              <div
                key={friend.friendUid}
                className="p-4 rounded-xl bg-[#0B0F17] border border-white/[0.06] flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <AvatarBadge avatarId={friend.friendAvatarId} size="md" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-100 truncate">
                      {friend.friendDisplayName}
                    </div>
                    <div className="font-mono text-xs text-slate-400">
                      @{friend.friendUsername}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCompare(friend.friendUid)}
                    className="min-h-[40px] px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold whitespace-nowrap"
                  >
                    {t.compareBtn}
                  </button>
                  <button
                    type="button"
                    aria-label={`${t.removeFriendBtn} ${friend.friendDisplayName}`}
                    onClick={() => setConfirmRemoveFriendUid(friend.friendUid)}
                    className="min-w-[40px] min-h-[40px] rounded-xl bg-[#1A2233] border border-white/[0.07] text-rose-400 hover:border-rose-400/40 flex items-center justify-center"
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Shared Profile Comparison Modal */}
      {comparingProfile && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="friend-compare-title"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="max-w-xl w-full rounded-2xl bg-[#121824] border border-white/[0.12] p-5 sm:p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-white/[0.07]">
              <div className="flex items-center gap-3">
                <AvatarBadge avatarId={comparingProfile.avatarId} size="md" />
                <div>
                  <h3
                    id="friend-compare-title"
                    className="font-display text-lg font-bold text-slate-100"
                  >
                    {comparingProfile.displayName}
                  </h3>
                  <div className="font-mono text-xs text-slate-400">
                    @{comparingProfile.username} · {t.comparisonModalTitle}
                  </div>
                </div>
              </div>
              <button
                type="button"
                aria-label={t.cancel}
                onClick={() => setComparingProfile(null)}
                className="min-w-[38px] min-h-[38px] rounded-xl bg-[#1A2233] text-slate-300 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {comparingProfile.bio && (
              <p className="text-xs sm:text-sm text-slate-300">{comparingProfile.bio}</p>
            )}

            <div className="space-y-2.5">
              {(
                [
                  {
                    label: t.levelCol,
                    yours: `${t.level} ${formatDigits(ownStats.level, lang)}`,
                    theirs:
                      comparingProfile.level !== undefined
                        ? `${t.level} ${formatDigits(comparingProfile.level, lang)}`
                        : null,
                  },
                  {
                    label: t.xpCol,
                    yours: `${formatDigits(ownStats.totalXp, lang)} XP`,
                    theirs:
                      comparingProfile.totalXp !== undefined
                        ? `${formatDigits(comparingProfile.totalXp, lang)} XP`
                        : null,
                  },
                  {
                    label: t.streakCol,
                    yours: `${formatDigits(ownStats.currentStreak, lang)} ${t.daysUnit}`,
                    theirs:
                      comparingProfile.currentStreak !== undefined
                        ? `${formatDigits(comparingProfile.currentStreak, lang)} ${t.daysUnit}`
                        : null,
                  },
                  {
                    label: t.weeklyCol,
                    yours: `${formatDigits(ownStats.weeklyPct, lang)}%`,
                    theirs:
                      comparingProfile.weeklyCompletionPct !== undefined
                        ? `${formatDigits(comparingProfile.weeklyCompletionPct, lang)}%`
                        : null,
                  },
                  {
                    label: t.monthlyCol,
                    yours: `${formatDigits(ownStats.monthlyPct, lang)}%`,
                    theirs:
                      comparingProfile.monthlyCompletionPct !== undefined
                        ? `${formatDigits(comparingProfile.monthlyCompletionPct, lang)}%`
                        : null,
                  },
                ] as const
              ).map((row) => (
                <div
                  key={row.label}
                  className="p-3 rounded-xl bg-[#0B0F17] border border-white/[0.06] grid grid-cols-3 items-center gap-2 text-xs sm:text-sm"
                >
                  <span className="text-slate-400 font-medium">{row.label}</span>
                  <span className="font-tabular text-amber-400 text-center">
                    {t.youLabel}: {row.yours}
                  </span>
                  <span
                    className={`font-tabular text-right ${
                      row.theirs !== null ? 'text-emerald-400' : 'text-slate-500 text-xs'
                    }`}
                  >
                    {row.theirs !== null ? row.theirs : t.hiddenByPrivacyLabel}
                  </span>
                </div>
              ))}
            </div>

            {comparingProfile.sharedCategories.length > 0 && (
              <div>
                <div className="text-xs text-slate-400 mb-2">{t.sharedCategoriesTitle}</div>
                <div className="flex flex-wrap gap-2">
                  {comparingProfile.sharedCategories.map((c) => (
                    <span
                      key={c}
                      className="text-xs text-slate-200 px-2.5 py-1 rounded-lg bg-[#0B0F17] border border-white/[0.08]"
                    >
                      {getLocalizedCategoryLabel(c, lang, customCategories)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {comparingProfile.sharedBadges && comparingProfile.sharedBadges.length > 0 && (
              <div>
                <div className="text-xs text-slate-400 mb-2">{t.unlockedBadges}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {comparingProfile.sharedBadges.map((b) => (
                    <div
                      key={b.id}
                      className="p-2.5 rounded-xl bg-[#0B0F17] border border-amber-500/25 flex items-center gap-2 text-xs text-amber-200"
                    >
                      <Award className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                      <span className="truncate">{b.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Confirmation Modal for Removing Friend */}
      {confirmRemoveFriendUid && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-friend-title"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#121824] border border-white/[0.12] p-6 space-y-4">
            <h3 id="remove-friend-title" className="font-display text-lg font-bold text-slate-100">
              {t.confirmRemoveFriendTitle}
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">{t.confirmRemoveFriendBody}</p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmRemoveFriendUid(null)}
                className="min-h-[40px] px-4 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-xs font-semibold text-slate-300 hover:text-white"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const targetUid = confirmRemoveFriendUid;
                  setConfirmRemoveFriendUid(null);
                  await onRemoveFriend(targetUid);
                }}
                className="min-h-[40px] px-4 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 text-xs font-semibold"
              >
                {t.confirmRemoveFriendBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
