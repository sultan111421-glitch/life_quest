import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ImagePlus,
  Lock,
  Shield,
  ShieldOff,
  Trash2,
  Users,
} from 'lucide-react';
import {
  CustomCategoryDef,
  FriendGroup,
  GroupPrivacySettings,
  GroupRole,
  Language,
  NavPage,
} from '../types/quest';
import { AVATAR_PRESETS } from '../utils/defaults';
import { canEditOrDeleteGroup, sanitizeGroupPrivacySettings } from '../utils/groupPrivacy';
import { getLocalizedCategoryLabel, UI_COPY } from '../utils/i18n';
import { NEVER_SHARE_CATEGORIES } from '../utils/privacy';
import { AvatarBadge } from './AvatarBadge';
import { resizeImageFileToDataUrl } from './CreateGroupView';
import { GroupAvatar, GroupSubNav } from './GroupSubNav';

interface GroupSettingsViewProps {
  lang: Language;
  groups: FriendGroup[];
  activeGroup: FriendGroup | null;
  myRole?: GroupRole;
  myPrivacy: GroupPrivacySettings;
  customCategories: CustomCategoryDef[];
  onSelectGroup: (groupId: string) => void;
  onNavigate: (page: NavPage) => void;
  onUpdateGroupPrivacy: (groupId: string, nextPrivacy: GroupPrivacySettings) => Promise<void>;
  onUpdateGroupDetails: (
    groupId: string,
    updates: {
      name: string;
      description: string;
      avatarId?: string;
      imageUrl?: string;
      isPrivate: boolean;
    }
  ) => Promise<void>;
  onDeleteGroup: (groupId: string) => Promise<void>;
}

const SHAREABLE_BUILT_IN_CATEGORIES = [
  'learning',
  'focus',
  'personal',
  'career',
  'creative',
];

export const GroupSettingsView: React.FC<GroupSettingsViewProps> = ({
  lang,
  groups,
  activeGroup,
  myRole,
  myPrivacy,
  customCategories,
  onSelectGroup,
  onNavigate,
  onUpdateGroupPrivacy,
  onUpdateGroupDetails,
  onDeleteGroup,
}) => {
  const t = UI_COPY[lang];
  const fileRef = useRef<HTMLInputElement>(null);

  const [draftPrivacy, setDraftPrivacy] = useState<GroupPrivacySettings>(myPrivacy);
  const [groupName, setGroupName] = useState(activeGroup?.name ?? '');
  const [groupDesc, setGroupDesc] = useState(activeGroup?.description ?? '');
  const [groupAvatarId, setGroupAvatarId] = useState(activeGroup?.avatarId ?? 'compass');
  const [groupImageUrl, setGroupImageUrl] = useState<string | undefined>(activeGroup?.imageUrl);
  const [isPrivate, setIsPrivate] = useState(activeGroup?.isPrivate ?? true);
  const [localError, setLocalError] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    setDraftPrivacy(myPrivacy);
  }, [myPrivacy, activeGroup?.id]);

  useEffect(() => {
    if (activeGroup) {
      setGroupName(activeGroup.name);
      setGroupDesc(activeGroup.description);
      setGroupAvatarId(activeGroup.avatarId ?? 'compass');
      setGroupImageUrl(activeGroup.imageUrl);
      setIsPrivate(activeGroup.isPrivate);
      setLocalError(null);
    }
  }, [activeGroup]);

  // Shareable categories strictly exclude spiritual/health and any custom spiritual category
  const shareableCategories = useMemo(() => {
    const safeCustom = customCategories
      .filter((c) => !c.isSpiritual && !NEVER_SHARE_CATEGORIES.has(c.id))
      .map((c) => c.id);
    return Array.from(new Set([...SHAREABLE_BUILT_IN_CATEGORIES, ...safeCustom]));
  }, [customCategories]);

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

  const canAdmin = canEditOrDeleteGroup(myRole);

  const handleToggleCategory = (catId: string) => {
    setDraftPrivacy((prev) => {
      const exists = prev.sharedCategories.includes(catId);
      const nextCats = exists
        ? prev.sharedCategories.filter((c) => c !== catId)
        : [...prev.sharedCategories, catId];
      return { ...prev, sharedCategories: nextCats };
    });
  };

  const handleSavePrivacy = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = sanitizeGroupPrivacySettings(draftPrivacy, customCategories);
    await onUpdateGroupPrivacy(activeGroup.id, clean);
  };

  const handleStopSharingImmediately = async () => {
    const off: GroupPrivacySettings = {
      sharingEnabled: false,
      showXp: false,
      showLevel: false,
      showStreaks: false,
      showAchievements: false,
      showWeeklySummary: false,
      showMonthlySummary: false,
      sharedCategories: [],
    };
    setDraftPrivacy(off);
    await onUpdateGroupPrivacy(activeGroup.id, off);
  };

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLocalError(null);
    const dataUrl = await resizeImageFileToDataUrl(file);
    if (!dataUrl || dataUrl.length > 200_000) {
      setLocalError(t.errorGroupImageTooLarge);
      return;
    }
    setGroupImageUrl(dataUrl);
  };

  const handleSaveGroupDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) {
      setLocalError(t.groupNameRequiredError);
      return;
    }
    setLocalError(null);
    await onUpdateGroupDetails(activeGroup.id, {
      name: groupName,
      description: groupDesc,
      avatarId: groupAvatarId,
      imageUrl: groupImageUrl,
      isPrivate,
    });
  };

  return (
    <div className="space-y-6">
      <GroupSubNav
        lang={lang}
        activePage="groupSettings"
        groups={groups}
        activeGroup={activeGroup}
        myRole={myRole}
        myPrivacy={myPrivacy}
        onSelectGroup={onSelectGroup}
        onNavigate={onNavigate}
      />

      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-100">
          {t.groupSettingsTitle}
        </h1>
        <p className="mt-1 text-sm text-slate-400">{t.groupSettingsSubtitle}</p>
      </div>

      {/* Per-Group Member Privacy Controls (Sharing is OFF by default) */}
      <form
        onSubmit={handleSavePrivacy}
        className="rounded-2xl bg-[#121824] border border-white/[0.08] p-5 sm:p-6 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400" aria-hidden="true" />
            <h2 className="font-display text-lg font-bold text-slate-100">
              {t.myGroupPrivacyCardTitle}
            </h2>
          </div>

          <button
            type="button"
            onClick={handleStopSharingImmediately}
            className="min-h-[38px] px-3.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-200 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <ShieldOff className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t.stopSharingImmediatelyBtn}</span>
          </button>
        </div>

        {/* Master Switch */}
        <label className="flex items-start gap-3 p-4 rounded-xl bg-[#0B0F17] border border-white/[0.08] cursor-pointer">
          <input
            type="checkbox"
            checked={draftPrivacy.sharingEnabled}
            onChange={(e) =>
              setDraftPrivacy((prev) => ({ ...prev, sharingEnabled: e.target.checked }))
            }
            className="mt-1 h-4 w-4 accent-emerald-500 shrink-0"
          />
          <div>
            <div className="text-sm font-semibold text-slate-100">{t.masterGroupShareLabel}</div>
            <p className="mt-1 text-xs text-slate-400">{t.masterGroupShareDesc}</p>
          </div>
        </label>

        {/* Granular Field Toggles */}
        <div
          className={`space-y-4 transition-opacity ${
            draftPrivacy.sharingEnabled ? 'opacity-100' : 'opacity-50'
          }`}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(
              [
                { key: 'showXp', label: t.permShowXp },
                { key: 'showLevel', label: t.permShowLevel },
                { key: 'showStreaks', label: t.permShowStreaks },
                { key: 'showAchievements', label: t.permShowAchievements },
                { key: 'showWeeklySummary', label: t.groupPermWeekly },
                { key: 'showMonthlySummary', label: t.groupPermMonthly },
              ] as const
            ).map((toggle) => (
              <label
                key={toggle.key}
                className="flex items-center gap-3 p-3.5 rounded-xl bg-[#0B0F17] border border-white/[0.08] cursor-pointer"
              >
                <input
                  type="checkbox"
                  disabled={!draftPrivacy.sharingEnabled}
                  checked={draftPrivacy[toggle.key]}
                  onChange={(e) =>
                    setDraftPrivacy((prev) => ({ ...prev, [toggle.key]: e.target.checked }))
                  }
                  className="h-4 w-4 accent-amber-500 shrink-0"
                />
                <span className="text-xs sm:text-sm text-slate-200">{toggle.label}</span>
              </label>
            ))}
          </div>

          {/* Safe Categories Selection */}
          <div className="space-y-2.5">
            <div className="text-xs font-semibold text-slate-200">{t.groupPermCategoriesTitle}</div>
            <p className="text-[11px] text-slate-400">{t.groupPermCategoriesNote}</p>
            <div className="flex flex-wrap gap-2">
              {shareableCategories.map((catId) => {
                const selected = draftPrivacy.sharedCategories.includes(catId);
                return (
                  <button
                    key={catId}
                    type="button"
                    disabled={!draftPrivacy.sharingEnabled}
                    onClick={() => handleToggleCategory(catId)}
                    aria-pressed={selected}
                    className={`min-h-[36px] px-3 rounded-xl text-xs font-semibold border transition-colors ${
                      selected
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-[#0B0F17] border-white/[0.08] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {getLocalizedCategoryLabel(catId, lang, customCategories)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-white/[0.06]">
          <button
            type="submit"
            className="min-h-[42px] px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-semibold whitespace-nowrap"
          >
            {t.saveChangesBtn}
          </button>
        </div>
      </form>

      {/* Zero-Trust Notice for Admins */}
      <div className="rounded-2xl bg-[#121824] border border-white/[0.08] p-4 flex items-start gap-3 text-xs text-slate-300">
        <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
        <span>{t.adminPrivacyNotice}</span>
      </div>

      {/* Group Details & Delete Group (Creator / Admin Only) */}
      {canAdmin && (
        <section className="rounded-2xl bg-[#121824] border border-white/[0.08] p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-slate-100">
              {t.adminDetailsCardTitle}
            </h2>
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              className="min-h-[38px] px-3.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-200 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t.deleteGroupBtn}</span>
            </button>
          </div>

          {localError && (
            <div className="px-4 py-2.5 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs text-rose-200">
              {localError}
            </div>
          )}

          <form onSubmit={handleSaveGroupDetails} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="edit-group-name"
                className="block text-xs font-semibold text-slate-300"
              >
                {t.groupNameLabel}
              </label>
              <input
                id="edit-group-name"
                type="text"
                maxLength={80}
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-sm text-slate-100 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="edit-group-desc"
                className="block text-xs font-semibold text-slate-300"
              >
                {t.groupDescLabel}
              </label>
              <textarea
                id="edit-group-desc"
                rows={3}
                maxLength={300}
                value={groupDesc}
                onChange={(e) => setGroupDesc(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-sm text-slate-100 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="space-y-3">
              <div className="text-xs font-semibold text-slate-300">{t.groupAvatarLabel}</div>
              <div className="flex flex-wrap items-center gap-4">
                <GroupAvatar
                  imageUrl={groupImageUrl}
                  avatarId={groupAvatarId}
                  name={groupName || activeGroup.name}
                  size="lg"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleImagePick}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="min-h-[38px] px-3.5 rounded-xl bg-[#0B0F17] hover:bg-[#1A2233] border border-white/[0.1] text-xs font-medium text-slate-200 inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    <ImagePlus className="w-4 h-4 text-amber-400" aria-hidden="true" />
                    <span>{t.uploadGroupImageBtn}</span>
                  </button>
                  {groupImageUrl && (
                    <button
                      type="button"
                      onClick={() => setGroupImageUrl(undefined)}
                      className="min-h-[38px] px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-xs font-medium text-rose-200 whitespace-nowrap"
                    >
                      {t.removeGroupImageBtn}
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                {AVATAR_PRESETS.map((preset) => {
                  const selected = groupAvatarId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setGroupAvatarId(preset.id)}
                      className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-colors ${
                        selected
                          ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                          : 'bg-[#0B0F17] border-white/[0.08] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <AvatarBadge avatarId={preset.id} size="sm" />
                      <span className="text-[11px] font-medium truncate w-full text-center">
                        {lang === 'bn' ? preset.labelBn : preset.labelEn}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="flex items-start gap-3 p-3.5 rounded-xl bg-[#0B0F17] border border-white/[0.08] cursor-pointer">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="mt-1 h-4 w-4 accent-amber-500 shrink-0"
              />
              <div>
                <div className="text-xs sm:text-sm font-semibold text-slate-100">
                  {t.groupPrivateToggleLabel}
                </div>
                <p className="mt-0.5 text-xs text-slate-400">{t.groupPrivateToggleDesc}</p>
              </div>
            </label>

            <div className="flex justify-end pt-2 border-t border-white/[0.06]">
              <button
                type="submit"
                className="min-h-[42px] px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-semibold whitespace-nowrap"
              >
                {t.saveGroupDetailsBtn}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Accessible Delete Group Confirmation Modal */}
      {confirmDeleteOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-group-title"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#121824] border border-white/[0.12] p-6 space-y-4">
            <h3 id="delete-group-title" className="font-display text-lg font-bold text-slate-100">
              {t.deleteGroupConfirmTitle}
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">{t.deleteGroupConfirmBody}</p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(false)}
                className="min-h-[40px] px-4 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-xs font-semibold text-slate-300 hover:text-white"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={async () => {
                  setConfirmDeleteOpen(false);
                  await onDeleteGroup(activeGroup.id);
                  onNavigate('groups');
                }}
                className="min-h-[40px] px-4 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 text-xs font-semibold"
              >
                {t.confirmDeleteGroupBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
