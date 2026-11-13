import React, { useState } from 'react';
import { AlertTriangle, Lock, Shield, ShieldCheck, Trash2 } from 'lucide-react';
import {
  AccountVisibility,
  CustomCategoryDef,
  Language,
  PrivacySettings,
} from '../types/quest';
import { DEFAULT_PRIVACY_SETTINGS } from '../utils/defaults';
import { getLocalizedCategoryLabel, UI_COPY } from '../utils/i18n';
import { NEVER_SHARE_CATEGORIES } from '../utils/privacy';

interface PrivacySettingsViewProps {
  lang: Language;
  privacy: PrivacySettings;
  customCategories: CustomCategoryDef[];
  onUpdatePrivacy: (nextPrivacy: PrivacySettings) => Promise<void>;
  onDeleteAccount: () => Promise<void>;
  onShowToast: (msg: string) => void;
}

export const PrivacySettingsView: React.FC<PrivacySettingsViewProps> = ({
  lang,
  privacy,
  customCategories,
  onUpdatePrivacy,
  onDeleteAccount,
  onShowToast,
}) => {
  const t = UI_COPY[lang];
  const [confirmPublicOpen, setConfirmPublicOpen] = useState(false);
  const [confirmLeaderboardOpen, setConfirmLeaderboardOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const shareableCategories = [
    'learning',
    'focus',
    'personal',
    'career',
    'creative',
    ...customCategories
      .filter((c) => !c.isSpiritual && !NEVER_SHARE_CATEGORIES.has(c.id))
      .map((c) => c.id),
  ];

  const handleSelectVisibility = async (vis: AccountVisibility) => {
    if (vis === 'public' && privacy.visibility !== 'public') {
      setConfirmPublicOpen(true);
      return;
    }
    if (vis === 'private') {
      await onUpdatePrivacy({
        ...privacy,
        visibility: 'private',
      });
      return;
    }
    await onUpdatePrivacy({
      ...privacy,
      visibility: vis,
    });
  };

  const toggleSharedCategory = async (cat: string) => {
    const exists = privacy.sharedCategories.includes(cat);
    const next = exists
      ? privacy.sharedCategories.filter((c) => c !== cat)
      : [...privacy.sharedCategories, cat];
    await onUpdatePrivacy({
      ...privacy,
      sharedCategories: next,
    });
  };

  const handleRevokeAll = async () => {
    await onUpdatePrivacy(DEFAULT_PRIVACY_SETTINGS);
    onShowToast(t.toastConsentRevoked);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-100">{t.privacyTitle}</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">{t.privacySubtitle}</p>
        </div>

        <button
          type="button"
          onClick={handleRevokeAll}
          className="min-h-[42px] px-4 rounded-xl bg-[#1A2233] border border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-300 text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap self-start sm:self-auto"
        >
          <Lock className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{t.withdrawAllConsentBtn}</span>
        </button>
      </div>

      {/* Account Visibility */}
      <section className="rounded-2xl bg-[#121824] border border-white/[0.08] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-400" aria-hidden="true" />
          <h2 className="font-display text-lg font-semibold text-slate-100">
            {t.visibilityTitle}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(['private', 'friends', 'public'] as const).map((vis) => {
            const active = privacy.visibility === vis;
            const opt = t.visibilityOptions[vis];
            return (
              <button
                key={vis}
                type="button"
                aria-pressed={active}
                onClick={() => handleSelectVisibility(vis)}
                className={`p-4 rounded-xl border text-left transition-colors ${
                  active
                    ? vis === 'private'
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200'
                      : 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                    : 'bg-[#0B0F17] border-white/[0.08] text-slate-300 hover:border-white/20'
                }`}
              >
                <div className="text-sm font-semibold">{opt.title}</div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{opt.desc}</p>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Granular Permissions */}
        <section className="rounded-2xl bg-[#121824] border border-white/[0.08] p-5 space-y-4">
          <h2 className="font-display text-lg font-semibold text-slate-100">
            {t.granularPermissionsTitle}
          </h2>

          <div className="space-y-2.5">
            {(
              [
                ['showXp', t.permShowXp],
                ['showLevel', t.permShowLevel],
                ['showAchievements', t.permShowAchievements],
                ['showStreaks', t.permShowStreaks],
                ['showWeeklyProgress', t.permShowWeekly],
                ['showMonthlyStats', t.permShowMonthly],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#0B0F17] border border-white/[0.06] cursor-pointer text-sm text-slate-200"
              >
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={privacy[key]}
                  onChange={(e) =>
                    onUpdatePrivacy({
                      ...privacy,
                      [key]: e.target.checked,
                    })
                  }
                  className="w-4 h-4 accent-amber-500 rounded"
                />
              </label>
            ))}
          </div>

          <div className="pt-3 border-t border-white/[0.06] space-y-2.5">
            <div className="text-xs font-semibold text-slate-200">{t.sharedCategoriesTitle}</div>
            <p className="text-xs text-slate-400">{t.sharedCategoriesNote}</p>
            <div className="flex flex-wrap gap-2">
              {shareableCategories.map((cat) => {
                const checked = privacy.sharedCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    aria-pressed={checked}
                    onClick={() => toggleSharedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors ${
                      checked
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-200'
                        : 'bg-[#0B0F17] border-white/[0.08] text-slate-400'
                    }`}
                  >
                    {getLocalizedCategoryLabel(cat, lang, customCategories)}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Leaderboard Consent + Protected Private Data */}
        <div className="space-y-6">
          <section className="rounded-2xl bg-[#121824] border border-white/[0.08] p-5 space-y-3">
            <h2 className="font-display text-lg font-semibold text-slate-100">
              {t.leaderboardConsentTitle}
            </h2>

            <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#0B0F17] border border-white/[0.06] cursor-pointer text-sm text-slate-200">
              <span>{t.leaderboardOptInBtn}</span>
              <input
                type="checkbox"
                checked={privacy.leaderboardOptIn}
                onChange={(e) => {
                  if (e.target.checked) {
                    setConfirmLeaderboardOpen(true);
                  } else {
                    onUpdatePrivacy({ ...privacy, leaderboardOptIn: false });
                  }
                }}
                className="w-4 h-4 accent-amber-500 rounded"
              />
            </label>

            <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#0B0F17] border border-white/[0.06] cursor-pointer text-sm text-slate-200">
              <span>{t.leaderboardAnonymousToggle}</span>
              <input
                type="checkbox"
                checked={privacy.leaderboardAnonymous}
                onChange={(e) =>
                  onUpdatePrivacy({ ...privacy, leaderboardAnonymous: e.target.checked })
                }
                className="w-4 h-4 accent-amber-500 rounded"
              />
            </label>

            <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#0B0F17] border border-white/[0.06] cursor-pointer text-sm text-slate-200">
              <span>{t.leaderboardShareXp}</span>
              <input
                type="checkbox"
                checked={privacy.shareXpOnLeaderboard}
                onChange={(e) =>
                  onUpdatePrivacy({ ...privacy, shareXpOnLeaderboard: e.target.checked })
                }
                className="w-4 h-4 accent-amber-500 rounded"
              />
            </label>

            <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#0B0F17] border border-white/[0.06] cursor-pointer text-sm text-slate-200">
              <span>{t.leaderboardShareStreak}</span>
              <input
                type="checkbox"
                checked={privacy.shareStreakOnLeaderboard}
                onChange={(e) =>
                  onUpdatePrivacy({ ...privacy, shareStreakOnLeaderboard: e.target.checked })
                }
                className="w-4 h-4 accent-amber-500 rounded"
              />
            </label>
          </section>

          <section className="rounded-2xl bg-[#121824] border border-emerald-500/25 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" aria-hidden="true" />
              <h2 className="font-display text-base font-semibold text-slate-100">
                {t.neverExposedTitle}
              </h2>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-300">
              {t.neverExposedItems.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {/* Account & Data Deletion */}
      <section className="rounded-2xl bg-[#121824] border border-rose-500/30 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h2 className="font-display text-base font-bold text-rose-200">
              {t.deleteAccountSectionTitle}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              {t.deleteAccountSectionDesc}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setConfirmDeleteOpen(true)}
          className="min-h-[44px] px-4 rounded-xl bg-rose-950/60 border border-rose-500/40 hover:bg-rose-900/60 text-rose-200 text-xs font-bold inline-flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
          <span>{t.deleteAccountBtn}</span>
        </button>
      </section>

      {/* Public Visibility Confirmation Dialog */}
      {confirmPublicOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="public-confirm-title"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="max-w-md w-full rounded-2xl bg-[#121824] border border-white/[0.12] p-6 space-y-4">
            <h3 id="public-confirm-title" className="font-display text-lg font-bold text-slate-100">
              {t.publicConfirmTitle}
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">{t.publicConfirmBody}</p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmPublicOpen(false)}
                className="min-h-[42px] px-4 rounded-xl bg-[#1A2233] text-xs font-medium text-slate-200"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={async () => {
                  setConfirmPublicOpen(false);
                  await onUpdatePrivacy({ ...privacy, visibility: 'public' });
                }}
                className="min-h-[42px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold"
              >
                {t.confirmPublicBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Opt-in Confirmation Dialog */}
      {confirmLeaderboardOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="priv-lb-confirm-title"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="max-w-md w-full rounded-2xl bg-[#121824] border border-white/[0.12] p-6 space-y-4">
            <h3 id="priv-lb-confirm-title" className="font-display text-lg font-bold text-slate-100">
              {t.leaderboardConfirmTitle}
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">{t.leaderboardConfirmBody}</p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmLeaderboardOpen(false)}
                className="min-h-[42px] px-4 rounded-xl bg-[#1A2233] text-xs font-medium text-slate-200"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={async () => {
                  setConfirmLeaderboardOpen(false);
                  await onUpdatePrivacy({ ...privacy, leaderboardOptIn: true });
                }}
                className="min-h-[42px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold"
              >
                {t.confirmJoinBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Deletion Double Confirmation Dialog */}
      {confirmDeleteOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="del-account-title"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="max-w-md w-full rounded-2xl bg-[#121824] border border-rose-500/30 p-6 space-y-4">
            <h3 id="del-account-title" className="font-display text-lg font-bold text-rose-200">
              {t.deleteAccountConfirmTitle}
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">{t.deleteAccountConfirmBody}</p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(false)}
                className="min-h-[42px] px-4 rounded-xl bg-[#1A2233] text-xs font-medium text-slate-200"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={async () => {
                  setConfirmDeleteOpen(false);
                  await onDeleteAccount();
                }}
                className="min-h-[42px] px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
              >
                {t.deleteAccountConfirmBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
