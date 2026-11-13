import React, { useState } from 'react';
import {
  ArrowLeft,
  Flag,
  LayoutDashboard,
  Lock,
  Plus,
  Settings,
  Shield,
  Users,
} from 'lucide-react';
import { FriendGroup, GroupPrivacySettings, GroupRole, Language, NavPage } from '../types/quest';
import { formatDigits } from '../utils/dhakaTime';
import { UI_COPY } from '../utils/i18n';
import { AvatarBadge } from './AvatarBadge';

interface GroupAvatarProps {
  imageUrl?: string;
  avatarId?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}

export const GroupAvatar: React.FC<GroupAvatarProps> = ({
  imageUrl,
  avatarId = 'compass',
  name,
  size = 'md',
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  const dims =
    size === 'sm'
      ? 'w-9 h-9 rounded-xl'
      : size === 'lg'
        ? 'w-14 h-14 rounded-2xl'
        : 'w-11 h-11 rounded-xl';

  if (imageUrl && !imgFailed) {
    return (
      <img
        src={imageUrl}
        alt={name}
        onError={() => setImgFailed(true)}
        className={`${dims} object-cover border border-white/[0.12] shrink-0 bg-[#0B0F17]`}
      />
    );
  }

  return <AvatarBadge avatarId={avatarId} size={size === 'lg' ? 'md' : size} />;
};

interface GroupSubNavProps {
  lang: Language;
  activePage: NavPage;
  groups: FriendGroup[];
  activeGroup: FriendGroup | null;
  myRole?: GroupRole;
  myPrivacy?: GroupPrivacySettings;
  onSelectGroup: (groupId: string) => void;
  onNavigate: (page: NavPage) => void;
}

export const GroupSubNav: React.FC<GroupSubNavProps> = ({
  lang,
  activePage,
  groups,
  activeGroup,
  myRole,
  myPrivacy,
  onSelectGroup,
  onNavigate,
}) => {
  const t = UI_COPY[lang];

  const tabs: {
    id: NavPage;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'groupDashboard', label: t.groupSubNav.dashboard, icon: LayoutDashboard },
    { id: 'groupMembers', label: t.groupSubNav.members, icon: Users },
    { id: 'groupChallenges', label: t.groupSubNav.challenges, icon: Flag },
    { id: 'groupSettings', label: t.groupSubNav.settings, icon: Settings },
  ];

  return (
    <div className="rounded-2xl bg-[#121824] border border-white/[0.08] p-4 sm:p-5 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => onNavigate('groups')}
            aria-label={t.groupSubNav.myGroups}
            className="min-w-[40px] min-h-[40px] rounded-xl bg-[#0B0F17] border border-white/[0.08] hover:border-amber-500/40 text-slate-300 hover:text-white flex items-center justify-center shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {activeGroup && (
            <>
              <GroupAvatar
                imageUrl={activeGroup.imageUrl}
                avatarId={activeGroup.avatarId}
                name={activeGroup.name}
                size="md"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-lg sm:text-xl font-bold text-slate-100 truncate">
                    {activeGroup.name}
                  </h2>
                  {activeGroup.isPrivate && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#0B0F17] border border-white/[0.08] text-[11px] font-medium text-slate-300 whitespace-nowrap">
                      <Lock className="w-3 h-3 text-amber-400" aria-hidden="true" />
                      {t.privateGroupBadge}
                    </span>
                  )}
                  {myRole && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-[11px] font-semibold text-amber-300 whitespace-nowrap">
                      {t.roleLabels[myRole]}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  <span className="font-tabular">
                    {formatDigits(activeGroup.memberCount, lang)} {t.membersCountWord}
                  </span>
                  <span className="text-slate-600" aria-hidden="true">
                    ·
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 font-medium ${
                      myPrivacy?.sharingEnabled ? 'text-emerald-400' : 'text-slate-400'
                    }`}
                  >
                    <Shield className="w-3 h-3" aria-hidden="true" />
                    {myPrivacy?.sharingEnabled ? t.sharingOnTag : t.sharingOffTag}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {groups.length > 1 && activeGroup && (
            <select
              aria-label={t.myGroupsHeading}
              value={activeGroup.id}
              onChange={(e) => onSelectGroup(e.target.value)}
              className="min-h-[40px] px-3 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-xs font-medium text-slate-200 focus:outline-none focus:border-amber-400"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => onNavigate('groupCreate')}
            className="min-h-[40px] px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>{t.createGroupBtn}</span>
          </button>
        </div>
      </div>

      {/* Contextual Group Sub-Navigation Tabs */}
      {activeGroup && (
        <div
          role="tablist"
          aria-label={t.groupsTitle}
          className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-white/[0.06]"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activePage === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onNavigate(tab.id)}
                className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/35'
                    : 'bg-[#0B0F17] text-slate-300 border border-white/[0.07] hover:text-white hover:border-white/[0.16]'
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 ${active ? 'text-amber-400' : 'text-slate-400'}`}
                  aria-hidden="true"
                />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
