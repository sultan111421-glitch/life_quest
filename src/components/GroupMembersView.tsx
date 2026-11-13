import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  KeyRound,
  LogOut,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  FriendEdgeItem,
  FriendGroup,
  GroupInvitation,
  GroupMember,
  GroupPrivacySettings,
  GroupRole,
  Language,
  NavPage,
  UsernameSearchResult,
} from '../types/quest';
import {
  canAssignAdmin,
  canManageGroupMembers,
  canRemoveGroupMember,
} from '../utils/groupPrivacy';
import { formatDigits } from '../utils/dhakaTime';
import { getLocalizedDisplayName, UI_COPY } from '../utils/i18n';
import { AvatarBadge } from './AvatarBadge';
import { GroupSubNav } from './GroupSubNav';

interface GroupMembersViewProps {
  currentUid: string;
  lang: Language;
  groups: FriendGroup[];
  activeGroup: FriendGroup | null;
  members: GroupMember[];
  myRole?: GroupRole;
  myPrivacy: GroupPrivacySettings;
  friends: FriendEdgeItem[];
  groupInvitations: GroupInvitation[];
  onSelectGroup: (groupId: string) => void;
  onNavigate: (page: NavPage) => void;
  onSearchUsers: (q: string) => Promise<UsernameSearchResult[]>;
  onInviteUser: (group: FriendGroup, target: UsernameSearchResult) => Promise<void>;
  onCancelInvitation: (inviteId: string) => Promise<void>;
  onUpdateRole: (groupId: string, targetUid: string, nextRole: 'admin' | 'member') => Promise<void>;
  onRemoveOrLeave: (groupId: string, targetUid: string) => Promise<void>;
  onRegenerateCode: (groupId: string) => Promise<void>;
  onShowToast: (msg: string) => void;
}

export const GroupMembersView: React.FC<GroupMembersViewProps> = ({
  currentUid,
  lang,
  groups,
  activeGroup,
  members,
  myRole,
  myPrivacy,
  friends,
  groupInvitations,
  onSelectGroup,
  onNavigate,
  onSearchUsers,
  onInviteUser,
  onCancelInvitation,
  onUpdateRole,
  onRemoveOrLeave,
  onRegenerateCode,
  onShowToast,
}) => {
  const t = UI_COPY[lang];
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UsernameSearchResult[]>([]);
  const [searchedOnce, setSearchedOnce] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [confirmRemoveMember, setConfirmRemoveMember] = useState<GroupMember | null>(null);

  useEffect(() => {
    if (!confirmLeaveOpen && !confirmRemoveMember) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setConfirmLeaveOpen(false);
        setConfirmRemoveMember(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmLeaveOpen, confirmRemoveMember]);

  const memberUidSet = useMemo(() => new Set(members.map((m) => m.uid)), [members]);
  const pendingOutForGroup = useMemo(
    () =>
      activeGroup
        ? groupInvitations.filter((i) => i.groupId === activeGroup.id && i.status === 'pending')
        : [],
    [activeGroup, groupInvitations]
  );

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

  const canManage = canManageGroupMembers(myRole);
  const isCreator = canAssignAdmin(myRole);
  const selfMember = members.find((m) => m.uid === currentUid);
  const canSelfLeave = selfMember ? canRemoveGroupMember(myRole, selfMember.role, true) : false;

  const inviteUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/?groupInvite=${activeGroup.inviteCode}`
      : `?groupInvite=${activeGroup.inviteCode}`;

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      onShowToast(t.toastGroupInviteCopied);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onShowToast(activeGroup.inviteCode);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await onSearchUsers(searchQuery);
    setSearchResults(res);
    setSearchedOnce(true);
  };

  const invitableFriends = friends.filter((f) => !memberUidSet.has(f.friendUid));

  return (
    <div className="space-y-6">
      <GroupSubNav
        lang={lang}
        activePage="groupMembers"
        groups={groups}
        activeGroup={activeGroup}
        myRole={myRole}
        myPrivacy={myPrivacy}
        onSelectGroup={onSelectGroup}
        onNavigate={onNavigate}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-100">
            {t.groupMembersTitle}
          </h1>
          <p className="mt-1 text-sm text-slate-400">{t.groupMembersSubtitle}</p>
        </div>

        {canSelfLeave && (
          <button
            type="button"
            onClick={() => setConfirmLeaveOpen(true)}
            className="min-h-[40px] px-4 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-200 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t.leaveGroupBtn}</span>
          </button>
        )}
      </div>

      {/* Shareable Invitation Link & Code */}
      <section className="rounded-2xl bg-[#121824] border border-white/[0.08] p-5 space-y-3">
        <div className="flex items-center gap-2 text-slate-200">
          <KeyRound className="w-4 h-4 text-amber-400" aria-hidden="true" />
          <h2 className="font-display text-sm font-bold">{t.inviteLinkTitle}</h2>
        </div>

        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
          <div className="flex-1 min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0B0F17] border border-white/[0.08] flex items-center justify-between gap-2 overflow-hidden">
            <code className="text-xs text-amber-300 font-mono truncate">{inviteUrl}</code>
            <span className="px-2 py-0.5 rounded bg-white/[0.06] text-[11px] font-mono text-slate-200 shrink-0">
              {activeGroup.inviteCode}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyInvite}
              className="min-h-[42px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>{t.copyInviteLinkBtn}</span>
            </button>

            {canManage && (
              <button
                type="button"
                onClick={() => onRegenerateCode(activeGroup.id)}
                className="min-h-[42px] px-3.5 rounded-xl bg-[#0B0F17] hover:bg-[#1A2233] border border-white/[0.1] text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                <span>{t.regenerateCodeBtn}</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Invite Friends by @username or Quick Friends List (Creator / Admin) */}
      {canManage && (
        <section className="rounded-2xl bg-[#121824] border border-white/[0.08] p-5 space-y-4">
          <div className="flex items-center gap-2 text-slate-200">
            <UserPlus className="w-4 h-4 text-emerald-400" aria-hidden="true" />
            <h2 className="font-display text-base font-bold">{t.inviteByUsernameTitle}</h2>
          </div>

          {/* Quick-Invite existing Friends */}
          {invitableFriends.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {invitableFriends.map((fr) => {
                const alreadyInvited = pendingOutForGroup.some((i) => i.toUid === fr.friendUid);
                return (
                  <div
                    key={fr.friendUid}
                    className="flex items-center gap-2.5 pl-2.5 pr-2 py-1.5 rounded-xl bg-[#0B0F17] border border-white/[0.08]"
                  >
                    <AvatarBadge avatarId={fr.friendAvatarId} size="sm" />
                    <div className="text-xs">
                      <div className="font-semibold text-slate-100">{fr.friendDisplayName}</div>
                      <div className="text-slate-400">@{fr.friendUsername}</div>
                    </div>
                    <button
                      type="button"
                      disabled={alreadyInvited}
                      onClick={() =>
                        onInviteUser(activeGroup, {
                          uid: fr.friendUid,
                          username: fr.friendUsername,
                          displayName: fr.friendDisplayName,
                          avatarId: fr.friendAvatarId,
                          visibility: 'friends',
                        })
                      }
                      className="min-h-[32px] px-2.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500 hover:text-slate-950 border border-emerald-500/35 text-emerald-300 text-[11px] font-semibold disabled:opacity-50 whitespace-nowrap"
                    >
                      {alreadyInvited ? t.inviteSentLabel : t.inviteFriendBtn}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Username Search */}
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search
                className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchUsernamePlaceholder}
                aria-label={t.inviteByUsernameTitle}
                className="w-full min-h-[42px] pl-10 pr-3.5 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>
            <button
              type="submit"
              className="min-h-[42px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold whitespace-nowrap"
            >
              {t.searchBtn}
            </button>
          </form>
          <p className="text-[11px] text-slate-400">{t.searchPrivateNote}</p>

          {searchedOnce && (
            <div className="space-y-2">
              {searchResults.length === 0 ? (
                <p className="text-xs text-slate-400">{t.noSearchResults}</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {searchResults.map((res) => {
                    const isMember = memberUidSet.has(res.uid);
                    const isInvited = pendingOutForGroup.some((i) => i.toUid === res.uid);
                    return (
                      <div
                        key={res.uid}
                        className="rounded-xl bg-[#0B0F17] border border-white/[0.08] p-3 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <AvatarBadge avatarId={res.avatarId} size="sm" />
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-100 truncate">
                              {res.displayName}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              @{res.username}
                            </div>
                          </div>
                        </div>

                        {isMember ? (
                          <span className="px-2.5 py-1 rounded-lg bg-white/[0.06] text-[11px] text-slate-300 whitespace-nowrap">
                            {t.alreadyInGroupLabel}
                          </span>
                        ) : isInvited ? (
                          <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-[11px] text-amber-300 whitespace-nowrap">
                            {t.inviteSentLabel}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onInviteUser(activeGroup, res)}
                            className="min-h-[34px] px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold whitespace-nowrap"
                          >
                            {t.inviteFriendBtn}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Pending Sent Invitations */}
          {pendingOutForGroup.length > 0 && (
            <div className="pt-3 border-t border-white/[0.06] space-y-2">
              <div className="text-xs font-semibold text-slate-300">{t.outgoingRequestsTitle}</div>
              <div className="flex flex-wrap gap-2">
                {pendingOutForGroup.map((inv) => (
                  <div
                    key={inv.id}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0B0F17] border border-white/[0.08] text-xs text-slate-300"
                  >
                    <span>@{inv.toUsername}</span>
                    <button
                      type="button"
                      onClick={() => onCancelInvitation(inv.id)}
                      className="text-rose-300 hover:text-rose-200 text-[11px] font-semibold"
                    >
                      {t.cancelRequestBtn}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Member Roster */}
      <section className="rounded-2xl bg-[#121824] border border-white/[0.08] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-slate-100">
            {t.groupSubNav.members}
          </h2>
          <span className="font-tabular text-xs text-slate-400">
            {formatDigits(members.length, lang)}
          </span>
        </div>

        <div className="space-y-2.5">
          {members.map((member) => {
            const isSelf = member.uid === currentUid;
            const canToggleRole = isCreator && member.role !== 'creator';
            const canKick = !isSelf && canRemoveGroupMember(myRole, member.role, false);

            return (
              <div
                key={member.uid}
                className="rounded-xl bg-[#0B0F17] border border-white/[0.07] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <AvatarBadge avatarId={member.avatarId} size="md" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-100 truncate">
                        {getLocalizedDisplayName(member.displayName, lang)}
                      </span>
                      {isSelf && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-[10px] font-semibold text-amber-300">
                          {t.youLabel}
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold whitespace-nowrap ${
                          member.role === 'creator'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/35'
                            : member.role === 'admin'
                              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                              : 'bg-white/[0.05] text-slate-300 border border-white/[0.08]'
                        }`}
                      >
                        {t.roleLabels[member.role]}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 truncate">@{member.username}</div>
                  </div>
                </div>

                {(canToggleRole || canKick) && (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {canToggleRole && (
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateRole(
                            activeGroup.id,
                            member.uid,
                            member.role === 'admin' ? 'member' : 'admin'
                          )
                        }
                        className="min-h-[36px] px-3 rounded-lg bg-[#121824] hover:bg-[#1A2233] border border-white/[0.1] text-xs font-medium text-slate-200 inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        {member.role === 'admin' ? (
                          <>
                            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                            <span>{t.demoteMemberBtn}</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />
                            <span>{t.makeAdminBtn}</span>
                          </>
                        )}
                      </button>
                    )}

                    {canKick && (
                      <button
                        type="button"
                        onClick={() => setConfirmRemoveMember(member)}
                        className="min-h-[36px] px-3 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-xs font-medium text-rose-200 inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{t.removeMemberBtn}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Accessible In-App Leave Group Confirmation Modal */}
      {confirmLeaveOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-group-title"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#121824] border border-white/[0.12] p-6 space-y-4">
            <h3 id="leave-group-title" className="font-display text-lg font-bold text-slate-100">
              {t.leaveGroupConfirmTitle}
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">{t.leaveGroupConfirmBody}</p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmLeaveOpen(false)}
                className="min-h-[40px] px-4 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-xs font-semibold text-slate-300 hover:text-white"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={async () => {
                  setConfirmLeaveOpen(false);
                  await onRemoveOrLeave(activeGroup.id, currentUid);
                  onNavigate('groups');
                }}
                className="min-h-[40px] px-4 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 text-xs font-semibold"
              >
                {t.confirmLeaveBtn}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Confirmation Modal for Removing Member */}
      {confirmRemoveMember && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-member-title"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#121824] border border-white/[0.12] p-6 space-y-4">
            <h3 id="remove-member-title" className="font-display text-lg font-bold text-slate-100">
              {t.confirmRemoveMemberTitle}
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              {getLocalizedDisplayName(confirmRemoveMember.displayName, lang)} (@
              {confirmRemoveMember.username}) — {t.confirmRemoveMemberBody}
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmRemoveMember(null)}
                className="min-h-[40px] px-4 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-xs font-semibold text-slate-300 hover:text-white"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const targetUid = confirmRemoveMember.uid;
                  setConfirmRemoveMember(null);
                  await onRemoveOrLeave(activeGroup.id, targetUid);
                }}
                className="min-h-[40px] px-4 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 text-xs font-semibold"
              >
                {t.confirmRemoveMemberBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
