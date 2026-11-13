import React, { useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  Check,
  Cloud,
  Download,
  Globe,
  LogIn,
  LogOut,
  RotateCcw,
  Save,
  Shield,
  Sliders,
  Sparkles,
  Upload,
} from 'lucide-react';
import {
  ActivityDefinition,
  BackupPayload,
  DailyLog,
  Language,
  LevelConfig,
  NavPage,
  UserProfileData,
} from '../types/quest';
import { OPTIONAL_SPIRITUAL_TEMPLATES } from '../utils/defaults';
import { formatDigits } from '../utils/dhakaTime';
import {
  buildBackupAnalyticsSnapshot,
  exportLogsToCsv,
  parseBackupJson,
} from '../utils/gamification';
import {
  getLocalizedActivityTitle,
  getLocalizedDisplayName,
  UI_COPY,
} from '../utils/i18n';

interface SettingsViewProps {
  profile: UserProfileData;
  activities: ActivityDefinition[];
  dailyLogs: Record<string, DailyLog>;
  todayKey: string;
  groupChallengeBonusXp?: number;
  user: User | null;
  lang: Language;
  isFirebaseConfigured: boolean;
  firebaseReachable: boolean;
  onChangeLanguage: (lang: Language) => Promise<void>;
  onUpdateProfile: (displayName: string, config: LevelConfig) => Promise<void>;
  onToggleReligionTracking: (
    enabled: boolean,
    templateActsToAdd?: ActivityDefinition[]
  ) => Promise<void>;
  onOpenWizard: () => void;
  onNavigate: (page: NavPage) => void;
  onRestoreBackup: (payload: BackupPayload) => Promise<void>;
  onResetAll: (withDemoSeed: boolean) => Promise<void>;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onShowToast: (msg: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  profile,
  activities,
  dailyLogs,
  todayKey,
  groupChallengeBonusXp = 0,
  user,
  lang,
  isFirebaseConfigured,
  firebaseReachable,
  onChangeLanguage,
  onUpdateProfile,
  onToggleReligionTracking,
  onOpenWizard,
  onNavigate,
  onRestoreBackup,
  onResetAll,
  onSignIn,
  onSignOut,
  onShowToast,
}) => {
  const t = UI_COPY[lang];
  const [displayName, setDisplayName] = useState(
    getLocalizedDisplayName(profile.displayName, lang)
  );
  const [baseXp, setBaseXp] = useState(profile.levelConfig.baseXpPerLevel);
  const [stepXp, setStepXp] = useState(profile.levelConfig.xpGrowthStep);
  const [bonusXp, setBonusXp] = useState(profile.levelConfig.dailyBonusXp);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([
    'prayer',
    'quran',
    'meditation',
  ]);
  const [resetMode, setResetMode] = useState<null | 'empty' | 'demo'>(null);
  const [pendingBackup, setPendingBackup] = useState<BackupPayload | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplayName(getLocalizedDisplayName(profile.displayName, lang));
    setBaseXp(profile.levelConfig.baseXpPerLevel);
    setStepXp(profile.levelConfig.xpGrowthStep);
    setBonusXp(profile.levelConfig.dailyBonusXp);
  }, [profile, lang]);

  useEffect(() => {
    if (!resetMode && !pendingBackup) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setResetMode(null);
        setPendingBackup(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pendingBackup, resetMode]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateProfile(displayName, {
      baseXpPerLevel: baseXp,
      xpGrowthStep: stepXp,
      dailyBonusXp: bonusXp,
    });
  };

  const triggerDownload = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    const csv = exportLogsToCsv(dailyLogs, activities, lang);
    triggerDownload(
      csv,
      `life-quest-records-${new Date().toISOString().slice(0, 10)}.csv`,
      'text/csv;charset=utf-8;'
    );
    onShowToast(t.toastCsvDownloaded);
  };

  const handleExportJson = () => {
    const analyticsSnapshot = buildBackupAnalyticsSnapshot(
      dailyLogs,
      activities,
      todayKey,
      profile,
      groupChallengeBonusXp
    );
    const payload: BackupPayload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      profile,
      activities,
      dailyLogs,
      analyticsSnapshot,
    };
    triggerDownload(
      JSON.stringify(payload, null, 2),
      `life-quest-backup-${new Date().toISOString().slice(0, 10)}.json`,
      'application/json'
    );
    onShowToast(t.toastJsonDownloaded);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setRestoreError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseBackupJson(text, lang);
      if (!parsed.valid || !parsed.data) {
        setRestoreError(parsed.error || t.errorInvalidJson);
        return;
      }
      setPendingBackup(parsed.data);
    } catch {
      setRestoreError(t.errorReadFile);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const logsCount = Object.keys(dailyLogs).length;
  const actsCount = activities.length;
  const religionEnabled = Boolean(profile.religionTrackingEnabled);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-100">
          {t.settingsTitle}
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">{t.settingsSubtitle}</p>
      </div>

      {/* Personalization Setup Wizard & Privacy Shortcuts */}
      <section className="rounded-2xl bg-[#121824] border border-white/[0.08] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
            <Sliders className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-100">
              {t.onboardingBannerTitle}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">{t.onboardingBannerSub}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenWizard}
            className="min-h-[42px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold whitespace-nowrap"
          >
            {t.onboardingLaunchBtn}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('privacy')}
            className="min-h-[42px] px-4 rounded-xl bg-[#1A2233] border border-white/[0.1] hover:border-emerald-400/40 text-emerald-300 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Shield className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t.managePrivacyLink}</span>
          </button>
        </div>
      </section>

      {/* Optional Spiritual & Religious Tracking Toggle */}
      <section className="rounded-2xl bg-[#121824] border border-white/[0.08] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-100">
                {t.religionToggleTitle}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">{t.religionToggleDesc}</p>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={religionEnabled}
            onClick={() => {
              const next = !religionEnabled;
              const toAdd = next
                ? OPTIONAL_SPIRITUAL_TEMPLATES.filter((tpl) =>
                    selectedTemplates.includes(tpl.id)
                  )
                : [];
              onToggleReligionTracking(next, toAdd);
            }}
            className={`min-h-[42px] px-4 rounded-xl border text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
              religionEnabled
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                : 'bg-[#1A2233] border-white/[0.1] text-slate-300'
            }`}
          >
            {religionEnabled ? t.religionEnabledLabel : t.religionDisabledLabel}
          </button>
        </div>

        {religionEnabled && (
          <div className="pt-3 border-t border-white/[0.06] space-y-2.5">
            <div className="text-xs font-semibold text-slate-300">
              {t.spiritualTemplatesHeading}
            </div>
            <div className="flex flex-wrap gap-2">
              {OPTIONAL_SPIRITUAL_TEMPLATES.map((tpl) => {
                const alreadyExists = activities.some((a) => a.id === tpl.id);
                const selected = alreadyExists || selectedTemplates.includes(tpl.id);
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => {
                      if (!alreadyExists) {
                        setSelectedTemplates((prev) =>
                          prev.includes(tpl.id)
                            ? prev.filter((id) => id !== tpl.id)
                            : [...prev, tpl.id]
                        );
                        onToggleReligionTracking(true, [tpl]);
                      }
                    }}
                    className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 ${
                      selected
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                        : 'bg-[#0B0F17] border-white/[0.08] text-slate-300'
                    }`}
                  >
                    {selected && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                    <span>{getLocalizedActivityTitle(tpl, lang)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Language Selection Card */}
      <section className="rounded-2xl bg-[#121824] border border-white/[0.08] p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-100">
                {t.languageCardTitle}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">{t.languageCardSub}</p>
            </div>
          </div>

          <div
            role="group"
            aria-label={t.languageCardTitle}
            className="inline-flex items-center p-1 rounded-xl bg-[#0B0F17] border border-white/[0.1] self-start sm:self-center shrink-0"
          >
            <button
              type="button"
              onClick={() => onChangeLanguage('en')}
              aria-pressed={lang === 'en'}
              className={`min-h-[40px] px-4 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                lang === 'en'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              EN
            </button>
            <span className="px-1.5 text-slate-600 select-none" aria-hidden="true">
              |
            </span>
            <button
              type="button"
              onClick={() => onChangeLanguage('bn')}
              aria-pressed={lang === 'bn'}
              className={`min-h-[40px] px-4 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                lang === 'bn'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              বাংলা
            </button>
          </div>
        </div>
      </section>

      {/* Cloud Sync & Account */}
      <section className="rounded-2xl bg-[#121824] border border-white/[0.08] p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
              <Cloud className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-100">
                {t.cloudSyncTitle}
              </h2>
              {user ? (
                <p className="text-xs sm:text-sm text-emerald-400 mt-0.5">
                  {t.cloudConnectedPrefix} {user.displayName || user.email} ·{' '}
                  {t.cloudConnectedSuffix}
                </p>
              ) : isFirebaseConfigured ? (
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  {t.cloudOfflinePreview}
                </p>
              ) : (
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  {t.cloudNotConfigured}
                </p>
              )}
              {isFirebaseConfigured && !firebaseReachable && (
                <p className="text-xs text-amber-400 mt-1">{t.cloudNetworkWarn}</p>
              )}
            </div>
          </div>

          {isFirebaseConfigured && (
            <div className="shrink-0">
              {user ? (
                <button
                  type="button"
                  onClick={onSignOut}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#1A2233] border border-white/[0.1] hover:border-rose-400/50 text-slate-200 text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap"
                >
                  <LogOut className="w-4 h-4" aria-hidden="true" />
                  <span>{t.signOut}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSignIn}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap"
                >
                  <LogIn className="w-4 h-4" aria-hidden="true" />
                  <span>{t.signInGoogle}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile & Level Formula Configuration */}
        <section className="rounded-2xl bg-[#121824] border border-white/[0.08] p-5">
          <h2 className="font-display text-lg font-semibold text-slate-100 mb-4">
            {t.profileCurveTitle}
          </h2>
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <label htmlFor="settings-name" className="block text-xs text-slate-300 mb-1.5">
                {t.yourNameLabel}
              </label>
              <input
                id="settings-name"
                type="text"
                maxLength={100}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-sm text-slate-100 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="settings-base-xp" className="block text-xs text-slate-300 mb-1.5">
                  {t.baseXpLabel}
                </label>
                <input
                  id="settings-base-xp"
                  type="number"
                  min={50}
                  max={10000}
                  value={baseXp}
                  onChange={(e) => setBaseXp(Number(e.target.value))}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-[#0B0F17] border border-white/[0.1] font-tabular text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label htmlFor="settings-step-xp" className="block text-xs text-slate-300 mb-1.5">
                  {t.stepXpLabel}
                </label>
                <input
                  id="settings-step-xp"
                  type="number"
                  min={0}
                  max={5000}
                  value={stepXp}
                  onChange={(e) => setStepXp(Number(e.target.value))}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-[#0B0F17] border border-white/[0.1] font-tabular text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label htmlFor="settings-bonus-xp" className="block text-xs text-slate-300 mb-1.5">
                  {t.dailyBonusLabel}
                </label>
                <input
                  id="settings-bonus-xp"
                  type="number"
                  min={0}
                  max={1000}
                  value={bonusXp}
                  onChange={(e) => setBonusXp(Number(e.target.value))}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-[#0B0F17] border border-white/[0.1] font-tabular text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <button
              type="submit"
              className="min-h-[44px] px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm inline-flex items-center gap-2 transition-colors"
            >
              <Save className="w-4 h-4" aria-hidden="true" />
              <span>{t.saveSettingsBtn}</span>
            </button>
          </form>
        </section>

        {/* Export, Backup, Restore & Reset */}
        <section className="rounded-2xl bg-[#121824] border border-white/[0.08] p-5 space-y-5">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-100">
              {t.exportBackupTitle}
            </h2>
            <p className="text-xs text-slate-400 mt-1 font-tabular">
              {lang === 'bn'
                ? `মোট ${formatDigits(logsCount, lang)} দিনের রেকর্ড ও ${formatDigits(
                    actsCount,
                    lang
                  )}টি লক্ষ্য সংরক্ষিত আছে`
                : t.exportStatsLine(logsCount, actsCount)}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">{t.backupIncludesAnalytics}</p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={handleExportCsv}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#1A2233] border border-white/[0.08] hover:border-amber-400/40 text-slate-100 text-xs font-semibold inline-flex items-center gap-2"
            >
              <Download className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              <span>{t.exportCsvBtn}</span>
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#1A2233] border border-white/[0.08] hover:border-amber-400/40 text-slate-100 text-xs font-semibold inline-flex items-center gap-2"
            >
              <Download className="w-4 h-4 text-amber-400" aria-hidden="true" />
              <span>{t.exportJsonBtn}</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#1A2233] border border-white/[0.08] hover:border-sky-400/40 text-slate-100 text-xs font-semibold inline-flex items-center gap-2"
            >
              <Upload className="w-4 h-4 text-sky-400" aria-hidden="true" />
              <span>{t.restoreJsonBtn}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
              aria-label={t.chooseBackupAria}
            />
          </div>

          {restoreError && (
            <p className="text-xs text-rose-400" role="alert">
              {restoreError}
            </p>
          )}

          <div className="pt-4 border-t border-white/[0.06]">
            <h3 className="text-sm font-semibold text-slate-200 mb-2">
              {t.resetSectionTitle}
            </h3>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => setResetMode('demo')}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#1A2233] border border-white/[0.08] hover:border-amber-400/40 text-slate-200 text-xs font-medium inline-flex items-center gap-2"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                <span>{t.resetWithDemoBtn}</span>
              </button>
              <button
                type="button"
                onClick={() => setResetMode('empty')}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-950/40 border border-rose-500/30 hover:border-rose-400/60 text-rose-200 text-xs font-medium inline-flex items-center gap-2"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t.resetEmptyBtn}</span>
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Confirmation Dialog for Reset */}
      {resetMode && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-dialog-title"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="max-w-md w-full rounded-2xl bg-[#121824] border border-white/[0.12] p-6 space-y-4">
            <h3 id="reset-dialog-title" className="font-display text-lg font-bold text-slate-100">
              {t.resetDialogTitle}
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              {resetMode === 'empty' ? t.resetDialogEmptyMsg : t.resetDialogDemoMsg}
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setResetMode(null)}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#1A2233] text-slate-200 text-sm font-medium"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const withDemo = resetMode === 'demo';
                  setResetMode(null);
                  await onResetAll(withDemo);
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold"
              >
                {t.resetConfirmBtn}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Confirmation Dialog for Backup Restore */}
      {pendingBackup && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="restore-dialog-title"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="max-w-md w-full rounded-2xl bg-[#121824] border border-white/[0.12] p-6 space-y-4">
            <h3 id="restore-dialog-title" className="font-display text-lg font-bold text-slate-100">
              {t.confirmRestoreTitle}
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              {t.confirmRestoreBody(
                Object.keys(pendingBackup.dailyLogs).length,
                pendingBackup.activities.length
              )}
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPendingBackup(null)}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#1A2233] text-slate-200 text-sm font-medium"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const data = pendingBackup;
                  setPendingBackup(null);
                  await onRestoreBackup(data);
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-semibold"
              >
                {t.confirmRestoreBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
