import React, { useState } from 'react';
import {
  Check,
  ChevronRight,
  Flag,
  KeyRound,
  Lock,
  Mail,
  Plus,
  Settings,
  Shield,
  Users,
  X,
} from 'lucide-react';
import {
  FriendGroup,
  GroupInvitation,
  GroupPrivacySettings,
  Language,
  NavPage,
} from '../types/quest';
import { formatDigits } from '../utils/dhakaTime';
import { UI_COPY } from '../utils/i18n';
import { GroupAvatar } from './GroupSubNav';

interface MyGroupsViewProps {
  currentUid: string;
  lang: Language;
  groups: FriendGroup[];
  groupInvitations: GroupInvitation[];
  groupPrivacyByGroup: Record<string, GroupPrivacySettings>;
  onSelectGroup: (groupId: string) => void;
  onNavigate: (page: NavPage) => void;
  onRespondInvitation: (invite: GroupInvitation, decision: 'accepted' | 'declined') => void;
  onJoinByCode: (codeOrLink: string) => Promise<boolean>;
}

export const MyGroupsView: React.FC<MyGroupsViewProps> = ({
  currentUid,
  lang,
  groups,
  groupInvitations,
  groupPrivacyByGroup,
  onSelectGroup,
  onNavigate,
  onRespondInvitation,
  onJoinByCode,
}) => {
  const t = UI_COPY[lang];
  const [inviteInput, setInviteInput] = useState('');
  const [joining, setJoining] = useState(false);

  const pendingIncoming = groupInvitations.filter(
    (inv) => inv.toUid === currentUid && inv.status === 'pending'
  );

  const handleOpenGroup = (groupId: string, targetPage: NavPage = 'groupDashboard') => {
    onSelectGroup(groupId);
    onNavigate(targetPage);
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteInput.trim()) return;
    setJoining(true);
    const ok = await onJoinByCode(inviteInput);
    setJoining(false);
    if (ok) {
      setInviteInput('');
      onNavigate('groupDashboard');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-100">
            {t.groupsTitle}
          </h1>
          <p className="mt-1 text-sm text-slate-400">{t.groupsSubtitle}</p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('groupCreate')}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>{t.createGroupBtn}</span>
        </button>
      </div>

      {/* Pending Group Invitations */}
      {pendingIncoming.length > 0 && (
        <section className="rounded-2xl bg-[#121824] border border-amber-500/30 p-5 space-y-4">
          <div className="flex items-center gap-2 text-amber-300">
            <Mail className="w-4 h-4" aria-hidden="true" />
            <h2 className="font-display text-base font-bold">{t.pendingGroupInvitesTitle}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingIncoming.map((inv) => (
              <div
                key={inv.id}
                className="rounded-xl bg-[#0B0F17] border border-white/[0.08] p-4 flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-sm text-slate-100">{inv.groupName}</div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#121824] border border-white/[0.08] text-[11px] text-slate-300 whitespace-nowrap">
                      <Lock className="w-3 h-3 text-amber-400" aria-hidden="true" />
                      {t.privateGroupBadge}
                    </span>
                  </div>
                  {inv.groupDescription && (
                    <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                      {inv.groupDescription}
                    </p>
                  )}
                  <div className="mt-2 text-xs text-slate-400">
                    {t.invitedByLabel}:{' '}
                    <span className="text-slate-200 font-medium">{inv.fromDisplayName}</span>{' '}
                    <span className="text-slate-500">(@{inv.fromUsername})</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onRespondInvitation(inv, 'accepted')}
                    className="flex-1 min-h-[40px] px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <Check className="w-4 h-4" aria-hidden="true" />
                    <span>{t.acceptBtn}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRespondInvitation(inv, 'declined')}
                    className="min-h-[40px] px-3 rounded-xl bg-[#1A2233] hover:bg-rose-500/20 border border-white/[0.08] hover:border-rose-500/40 text-slate-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                    <span>{t.declineBtn}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Join by Invite Code or Link */}
      <section className="rounded-2xl bg-[#121824] border border-white/[0.08] p-5">
        <form onSubmit={handleJoinSubmit} className="space-y-3">
          <div className="flex items-center gap-2 text-slate-200">
            <KeyRound className="w-4 h-4 text-amber-400" aria-hidden="true" />
            <h2 className="font-display text-sm font-semibold">{t.joinByCodeTitle}</h2>
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              value={inviteInput}
              onChange={(e) => setInviteInput(e.target.value)}
              placeholder={t.joinByCodePlaceholder}
              aria-label={t.joinByCodeTitle}
              className="flex-1 min-h-[44px] px-3.5 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              disabled={joining || !inviteInput.trim()}
              className="min-h-[44px] px-5 rounded-xl bg-[#1A2233] hover:bg-amber-500 hover:text-slate-950 border border-amber-500/35 text-amber-300 text-sm font-semibold transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {t.joinByCodeBtn}
            </button>
          </div>
        </form>
      </section>

      {/* Joined Groups List */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-slate-100">{t.myGroupsHeading}</h2>
          <span className="text-xs font-tabular text-slate-400">
            {formatDigits(groups.length, lang)}
          </span>
        </div>

        {groups.length === 0 ? (
          <div className="rounded-2xl bg-[#121824] border border-white/[0.08] p-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" aria-hidden="true" />
            </div>
            <p className="text-sm text-slate-400 max-w-md mx-auto">{t.noGroupsYet}</p>
            <button
              type="button"
              onClick={() => onNavigate('groupCreate')}
              className="min-h-[42px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>{t.createGroupBtn}</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.map((grp) => {
              const sharingActive = Boolean(groupPrivacyByGroup[grp.id]?.sharingEnabled);
              return (
                <article
                  key={grp.id}
                  className="rounded-2xl bg-[#121824] border border-white/[0.08] hover:border-white/[0.16] p-5 flex flex-col justify-between gap-4 transition-colors"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <GroupAvatar
                          imageUrl={grp.imageUrl}
                          avatarId={grp.avatarId}
                          name={grp.name}
                          size="lg"
                        />
                        <div className="min-w-0">
                          <h3 className="font-display text-lg font-bold text-slate-100 truncate">
                            {grp.name}
                          </h3>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                            <span className="inline-flex items-center gap-1 text-slate-400 font-tabular">
                              <Users className="w-3.5 h-3.5" aria-hidden="true" />
                              {formatDigits(grp.memberCount, lang)} {t.membersCountWord}
                            </span>
                            <span className="text-slate-600" aria-hidden="true">
                              ·
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 font-medium ${
                                sharingActive ? 'text-emerald-400' : 'text-slate-400'
                              }`}
                            >
                              <Shield className="w-3.5 h-3.5" aria-hidden="true" />
                              {sharingActive ? t.sharingOnTag : t.sharingOffTag}
                            </span>
                          </div>
                        </div>
                      </div>

                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#0B0F17] border border-white/[0.08] text-[11px] font-medium text-slate-300 whitespace-nowrap shrink-0">
                        <Lock className="w-3 h-3 text-amber-400" aria-hidden="true" />
                        {grp.isPrivate ? t.privateGroupBadge : t.publicGroupBadge}
                      </span>
                    </div>

                    {grp.description && (
                      <p className="text-xs sm:text-sm text-slate-400 line-clamp-2">
                        {grp.description}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/[0.06]">
                    <button
                      type="button"
                      onClick={() => handleOpenGroup(grp.id, 'groupDashboard')}
                      className="flex-1 min-h-[40px] px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                    >
                      <span>{t.openGroupBtn}</span>
                      <ChevronRight className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenGroup(grp.id, 'groupMembers')}
                      aria-label={t.groupSubNav.members}
                      className="min-h-[40px] px-3 rounded-xl bg-[#0B0F17] hover:bg-[#1A2233] border border-white/[0.08] text-slate-300 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Users className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{t.groupSubNav.members}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenGroup(grp.id, 'groupChallenges')}
                      aria-label={t.groupSubNav.challenges}
                      className="min-h-[40px] px-3 rounded-xl bg-[#0B0F17] hover:bg-[#1A2233] border border-white/[0.08] text-slate-300 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Flag className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{t.groupSubNav.challenges}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenGroup(grp.id, 'groupSettings')}
                      aria-label={t.groupSubNav.settings}
                      className="min-w-[40px] min-h-[40px] rounded-xl bg-[#0B0F17] hover:bg-[#1A2233] border border-white/[0.08] text-slate-300 flex items-center justify-center shrink-0"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
