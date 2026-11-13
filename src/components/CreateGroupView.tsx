import React, { useRef, useState } from 'react';
import { ArrowLeft, ImagePlus, Lock, ShieldCheck, Trash2 } from 'lucide-react';
import { Language, NavPage } from '../types/quest';
import { AVATAR_PRESETS } from '../utils/defaults';
import { UI_COPY } from '../utils/i18n';
import { AvatarBadge } from './AvatarBadge';
import { GroupAvatar } from './GroupSubNav';

interface CreateGroupViewProps {
  lang: Language;
  onCreateGroup: (input: {
    name: string;
    description: string;
    avatarId?: string;
    imageUrl?: string;
    isPrivate?: boolean;
  }) => Promise<string | null>;
  onNavigate: (page: NavPage) => void;
}

export async function resizeImageFileToDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 192;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/webp', 0.82);
        if (dataUrl.length <= 190_000) {
          resolve(dataUrl);
          return;
        }
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = () => resolve(null);
      img.src = String(reader.result || '');
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

export const CreateGroupView: React.FC<CreateGroupViewProps> = ({
  lang,
  onCreateGroup,
  onNavigate,
}) => {
  const t = UI_COPY[lang];
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarId, setAvatarId] = useState<string>('compass');
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [isPrivate, setIsPrivate] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLocalError(null);
    const dataUrl = await resizeImageFileToDataUrl(file);
    if (!dataUrl || dataUrl.length > 200_000) {
      setLocalError(t.errorGroupImageTooLarge);
      return;
    }
    setImageUrl(dataUrl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setLocalError(t.groupNameRequiredError);
      return;
    }
    setSubmitting(true);
    setLocalError(null);
    const createdId = await onCreateGroup({
      name,
      description,
      avatarId,
      imageUrl,
      isPrivate,
    });
    setSubmitting(false);
    if (createdId) {
      onNavigate('groupDashboard');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onNavigate('groups')}
          aria-label={t.backToMyGroupsBtn}
          className="min-w-[42px] min-h-[42px] rounded-xl bg-[#121824] border border-white/[0.08] hover:border-amber-500/40 text-slate-300 hover:text-white flex items-center justify-center shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-100">
            {t.createGroupTitle}
          </h1>
          <p className="mt-1 text-sm text-slate-400">{t.createGroupSubtitle}</p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-[#121824] border border-white/[0.08] p-5 sm:p-6 space-y-5"
      >
        {localError && (
          <div className="px-4 py-2.5 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs text-rose-200">
            {localError}
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="group-name-input" className="block text-xs font-semibold text-slate-300">
            {t.groupNameLabel}
          </label>
          <input
            id="group-name-input"
            type="text"
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.groupNamePlaceholder}
            className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="group-desc-input" className="block text-xs font-semibold text-slate-300">
            {t.groupDescLabel}
          </label>
          <textarea
            id="group-desc-input"
            rows={3}
            maxLength={300}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t.groupDescPlaceholder}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
          />
        </div>

        {/* Emblem & Optional Photo */}
        <div className="space-y-3 pt-1">
          <div className="text-xs font-semibold text-slate-300">{t.groupAvatarLabel}</div>
          <div className="flex flex-wrap items-center gap-4">
            <GroupAvatar
              imageUrl={imageUrl}
              avatarId={avatarId}
              name={name || 'Group'}
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
                className="min-h-[40px] px-3.5 rounded-xl bg-[#0B0F17] hover:bg-[#1A2233] border border-white/[0.1] text-xs font-medium text-slate-200 inline-flex items-center gap-2 whitespace-nowrap"
              >
                <ImagePlus className="w-4 h-4 text-amber-400" aria-hidden="true" />
                <span>{t.uploadGroupImageBtn}</span>
              </button>
              {imageUrl && (
                <button
                  type="button"
                  onClick={() => setImageUrl(undefined)}
                  className="min-h-[40px] px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-xs font-medium text-rose-200 inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{t.removeGroupImageBtn}</span>
                </button>
              )}
            </div>
          </div>
          <p className="text-[11px] text-slate-400">{t.groupImageHelp}</p>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 pt-1">
            {AVATAR_PRESETS.map((preset) => {
              const selected = avatarId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setAvatarId(preset.id)}
                  className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition-colors ${
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

        {/* Private Toggle */}
        <label className="flex items-start gap-3 p-4 rounded-xl bg-[#0B0F17] border border-white/[0.08] cursor-pointer">
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            className="mt-1 h-4 w-4 rounded accent-amber-500 shrink-0"
          />
          <div>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-100">
              <Lock className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
              <span>{t.groupPrivateToggleLabel}</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">{t.groupPrivateToggleDesc}</p>
          </div>
        </label>

        {/* Zero-Trust Notice */}
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-2.5 text-xs text-emerald-200">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{t.groupSharingStatusOffBanner}</span>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={() => onNavigate('groups')}
            className="min-h-[42px] px-4 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-xs font-semibold text-slate-300 hover:text-white whitespace-nowrap"
          >
            {t.cancel}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="min-h-[42px] px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-semibold disabled:opacity-50 whitespace-nowrap"
          >
            {t.createGroupSubmitBtn}
          </button>
        </div>
      </form>
    </div>
  );
};
