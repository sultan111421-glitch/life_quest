import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Check, ChevronLeft, ChevronRight, Plus, Shield, Sparkles, X } from 'lucide-react';
import {
  ActivityDefinition,
  CustomCategoryDef,
  Language,
  PriorityLevel,
  PrivacySettings,
  UserProfileData,
} from '../types/quest';
import {
  CORE_PRODUCTIVITY_ACTIVITIES,
  DEFAULT_PRIVACY_SETTINGS,
  EXTRA_ONBOARDING_TEMPLATES,
  ONBOARDING_DEFAULT_CATEGORIES,
  OPTIONAL_SPIRITUAL_TEMPLATES,
} from '../utils/defaults';
import { formatDigits } from '../utils/dhakaTime';
import {
  getLocalizedActivityTitle,
  getLocalizedCategoryLabel,
  getLocalizedUnitLabel,
  UI_COPY,
} from '../utils/i18n';

interface OnboardingWizardProps {
  profile: UserProfileData;
  existingActivities: ActivityDefinition[];
  lang: Language;
  onChangeLanguage: (lang: Language) => Promise<void>;
  onComplete: (payload: {
    displayName: string;
    language: Language;
    religionTrackingEnabled: boolean;
    remindersEnabled: boolean;
    enabledCategories: string[];
    customCategories: CustomCategoryDef[];
    selectedActivities: ActivityDefinition[];
    privacy: PrivacySettings;
  }) => Promise<void>;
  onSkip: () => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  profile,
  existingActivities,
  lang,
  onChangeLanguage,
  onComplete,
  onSkip,
}) => {
  const t = UI_COPY[lang];
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [displayName, setDisplayName] = useState(profile.displayName || 'Adventurer');
  const [selectedLang, setSelectedLang] = useState<Language>(lang);
  const [enabledCategories, setEnabledCategories] = useState<string[]>(
    profile.enabledCategories?.length
      ? profile.enabledCategories
      : ['learning', 'focus', 'health', 'personal']
  );
  const [customCategories, setCustomCategories] = useState<CustomCategoryDef[]>(
    profile.customCategories ?? []
  );
  const [newCatName, setNewCatName] = useState('');
  const [religionEnabled, setReligionEnabled] = useState<boolean>(
    Boolean(profile.religionTrackingEnabled)
  );
  const [remindersEnabled, setRemindersEnabled] = useState<boolean>(
    Boolean(profile.remindersEnabled)
  );
  const [privacy, setPrivacy] = useState<PrivacySettings>(
    profile.privacy ?? DEFAULT_PRIVACY_SETTINGS
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onSkip]);

  // Build candidate templates while preserving existing user-created custom activities
  const candidateTemplates = useMemo(() => {
    const merged = [...CORE_PRODUCTIVITY_ACTIVITIES, ...EXTRA_ONBOARDING_TEMPLATES];
    if (religionEnabled) {
      merged.push(...OPTIONAL_SPIRITUAL_TEMPLATES);
    }
    const existingMap = new Map(existingActivities.map((a) => [a.id, a]));
    const mergedIds = new Set(merged.map((tpl) => tpl.id));
    const customExtras = existingActivities.filter((a) => !mergedIds.has(a.id));
    return [...merged.map((tpl) => existingMap.get(tpl.id) ?? tpl), ...customExtras];
  }, [existingActivities, religionEnabled]);

  const [selectedActIds, setSelectedActIds] = useState<Set<string>>(
    () =>
      new Set(
        existingActivities.length > 0
          ? existingActivities.map((a) => a.id)
          : CORE_PRODUCTIVITY_ACTIVITIES.map((a) => a.id)
      )
  );

  const [actOverrides, setActOverrides] = useState<
    Record<
      string,
      {
        dailyTarget: number;
        weeklyTarget?: number;
        monthlyTarget?: number;
        xpReward: number;
        priority: PriorityLevel;
      }
    >
  >({});

  const toggleCategory = (catId: string) => {
    setEnabledCategories((prev) =>
      prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId]
    );
  };

  const handleAddCustomCategory = () => {
    const clean = newCatName.trim().slice(0, 40);
    if (!clean) return;
    const id = `cat_${clean.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 18)}_${Date.now()
      .toString(36)
      .slice(-3)}`;
    setCustomCategories((prev) => [...prev, { id, name: clean, isSpiritual: false }]);
    setEnabledCategories((prev) => [...prev, id]);
    setNewCatName('');
  };

  const toggleActivity = (actId: string) => {
    setSelectedActIds((prev) => {
      const next = new Set(prev);
      if (next.has(actId)) {
        next.delete(actId);
      } else {
        next.add(actId);
      }
      return next;
    });
  };

  const visibleStep3Templates = useMemo(() => {
    const catSet = new Set(enabledCategories);
    return candidateTemplates.filter(
      (a) =>
        (a.category === 'spiritual' ? religionEnabled : true) &&
        (catSet.has(a.category) || selectedActIds.has(a.id))
    );
  }, [candidateTemplates, enabledCategories, religionEnabled, selectedActIds]);

  const handleFinish = async () => {
    const chosen = candidateTemplates
      .filter((a) => selectedActIds.has(a.id))
      .filter((a) => (a.category === 'spiritual' ? religionEnabled : true))
      .map((a, idx) => {
        const ov = actOverrides[a.id];
        return {
          ...a,
          dailyTarget: ov?.dailyTarget ?? a.dailyTarget,
          weeklyTarget: ov?.weeklyTarget ?? a.weeklyTarget,
          monthlyTarget: ov?.monthlyTarget ?? a.monthlyTarget,
          xpReward: ov?.xpReward ?? a.xpReward,
          priority: ov?.priority ?? a.priority ?? 'medium',
          reminderEnabled: remindersEnabled ? Boolean(a.reminderEnabled) : false,
          order: idx,
          isActive: true,
        };
      });

    const finalList =
      chosen.length > 0
        ? chosen
        : CORE_PRODUCTIVITY_ACTIVITIES.slice(0, 3).map((a, idx) => ({ ...a, order: idx }));

    await onComplete({
      displayName: displayName.trim() || 'Adventurer',
      language: selectedLang,
      religionTrackingEnabled: religionEnabled,
      remindersEnabled,
      enabledCategories,
      customCategories,
      selectedActivities: finalList,
      privacy,
    });
  };

  const stepsMeta = [
    { num: 1, label: t.onboardingStep1 },
    { num: 2, label: t.onboardingStep2 },
    { num: 3, label: t.onboardingStep3 },
    { num: 4, label: t.onboardingStep4 },
  ] as const;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-wizard-title"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
    >
      <div className="max-w-3xl w-full rounded-2xl bg-[#121824] border border-white/[0.12] p-5 sm:p-6 my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-white/[0.07]">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="onboarding-wizard-title"
                className="font-display text-lg sm:text-xl font-bold text-slate-100"
              >
                {t.onboardingTitle}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">{t.onboardingSubtitle}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onSkip}
            aria-label={t.onboardingSkip}
            className="min-w-[40px] min-h-[40px] rounded-xl bg-[#1A2233] text-slate-300 hover:text-white flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="grid grid-cols-4 gap-2 py-3 border-b border-white/[0.06]">
          {stepsMeta.map((s) => {
            const active = step === s.num;
            const passed = step > s.num;
            return (
              <button
                key={s.num}
                type="button"
                onClick={() => setStep(s.num)}
                className={`px-2 py-2 rounded-xl text-left border transition-colors ${
                  active
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                    : passed
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-[#0B0F17] border-white/[0.06] text-slate-400'
                }`}
              >
                <div className="font-tabular text-[11px] font-bold">
                  {formatDigits(s.num, selectedLang)} / {formatDigits(4, selectedLang)}
                </div>
                <div className="text-xs font-medium truncate mt-0.5">{s.label}</div>
              </button>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label htmlFor="wizard-display-name" className="block text-xs text-slate-300 mb-1.5">
                  {t.yourNameLabel}
                </label>
                <input
                  id="wizard-display-name"
                  type="text"
                  maxLength={100}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <div className="text-xs text-slate-300 mb-2">{t.languageCardTitle}</div>
                <div className="inline-flex items-center p-1 rounded-xl bg-[#0B0F17] border border-white/[0.1]">
                  <button
                    type="button"
                    onClick={async () => {
                      setSelectedLang('en');
                      await onChangeLanguage('en');
                    }}
                    className={`min-h-[40px] px-5 rounded-lg text-xs font-semibold transition-colors ${
                      selectedLang === 'en'
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    EN
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setSelectedLang('bn');
                      await onChangeLanguage('bn');
                    }}
                    className={`min-h-[40px] px-5 rounded-lg text-xs font-semibold transition-colors ${
                      selectedLang === 'bn'
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    বাংলা
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {ONBOARDING_DEFAULT_CATEGORIES.filter((c) => !c.isOptionalSpiritual).map((cat) => {
                  const selected = enabledCategories.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCategory(cat.id)}
                      className={`min-h-[48px] px-4 py-3 rounded-xl border flex items-center justify-between text-sm font-medium transition-colors ${
                        selected
                          ? 'bg-emerald-500/15 border-emerald-500/45 text-emerald-200'
                          : 'bg-[#0B0F17] border-white/[0.08] text-slate-300 hover:border-white/20'
                      }`}
                    >
                      <span>{getLocalizedCategoryLabel(cat.id, selectedLang, customCategories)}</span>
                      <span
                        className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                          selected
                            ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                            : 'border-slate-600'
                        }`}
                      >
                        {selected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </span>
                    </button>
                  );
                })}
                {customCategories.map((cat) => {
                  const selected = enabledCategories.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCategory(cat.id)}
                      className={`min-h-[48px] px-4 py-3 rounded-xl border flex items-center justify-between text-sm font-medium transition-colors ${
                        selected
                          ? 'bg-emerald-500/15 border-emerald-500/45 text-emerald-200'
                          : 'bg-[#0B0F17] border-white/[0.08] text-slate-300'
                      }`}
                    >
                      <span>{cat.name}</span>
                      <span
                        className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                          selected
                            ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                            : 'border-slate-600'
                        }`}
                      >
                        {selected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Add Custom Category inline */}
              <div className="p-4 rounded-xl bg-[#0B0F17] border border-white/[0.07] space-y-2.5">
                <div className="text-xs font-semibold text-slate-200">{t.customCategoryLabel}</div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    maxLength={40}
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder={t.newCategoryPlaceholder}
                    className="flex-1 min-h-[42px] px-3 rounded-xl bg-[#121824] border border-white/[0.1] text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomCategory}
                    className="min-h-[42px] px-4 rounded-xl bg-[#1A2233] border border-white/[0.1] hover:border-amber-400/40 text-xs font-semibold text-amber-300 inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{t.addCategoryBtn}</span>
                  </button>
                </div>
              </div>

              {/* Optional Spiritual & Religious Tracking Toggle (OFF by default) */}
              <div className="p-4 rounded-xl bg-[#0B0F17] border border-white/[0.08] flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-100">{t.religionToggleTitle}</div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{t.religionToggleDesc}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={religionEnabled}
                  onClick={() => {
                    const next = !religionEnabled;
                    setReligionEnabled(next);
                    if (next) {
                      setEnabledCategories((prev) =>
                        prev.includes('spiritual') ? prev : [...prev, 'spiritual']
                      );
                    } else {
                      setEnabledCategories((prev) => prev.filter((c) => c !== 'spiritual'));
                    }
                  }}
                  className={`min-h-[38px] px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap border transition-colors shrink-0 ${
                    religionEnabled
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                      : 'bg-[#1A2233] border-white/[0.1] text-slate-300'
                  }`}
                >
                  {religionEnabled ? t.onLabel : t.offLabel}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              {visibleStep3Templates.map((act) => {
                const selected = selectedActIds.has(act.id);
                const ov = actOverrides[act.id] ?? {
                  dailyTarget: act.dailyTarget,
                  weeklyTarget: act.weeklyTarget,
                  monthlyTarget: act.monthlyTarget,
                  xpReward: act.xpReward,
                  priority: act.priority ?? 'medium',
                };
                return (
                  <div
                    key={act.id}
                    className={`rounded-xl border p-3.5 transition-colors ${
                      selected
                        ? 'bg-[#0F1826] border-amber-500/35'
                        : 'bg-[#0B0F17] border-white/[0.06] opacity-75'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => toggleActivity(act.id)}
                        className="flex items-center gap-3 text-left min-w-0 flex-1"
                      >
                        <span
                          className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                            selected
                              ? 'bg-amber-500 border-amber-400 text-slate-950'
                              : 'border-slate-600'
                          }`}
                        >
                          {selected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-100 truncate">
                            {getLocalizedActivityTitle(act, selectedLang)}
                          </div>
                          <div className="text-xs text-slate-400">
                            {getLocalizedCategoryLabel(
                              act.category,
                              selectedLang,
                              customCategories
                            )}{' '}
                            · {getLocalizedUnitLabel(act.unitLabel, selectedLang)}
                          </div>
                        </div>
                      </button>
                    </div>

                    {selected && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3 pt-3 border-t border-white/[0.06]">
                        <label className="text-[11px] text-slate-400">
                          {t.dailyTargetLabel}
                          <input
                            type="number"
                            min={1}
                            value={ov.dailyTarget}
                            onChange={(e) =>
                              setActOverrides((prev) => ({
                                ...prev,
                                [act.id]: {
                                  ...ov,
                                  dailyTarget: Math.max(1, Number(e.target.value) || 1),
                                },
                              }))
                            }
                            className="mt-1 w-full min-h-[38px] px-2.5 rounded-lg bg-[#0B0F17] border border-white/[0.1] font-tabular text-xs text-slate-100"
                          />
                        </label>
                        <label className="text-[11px] text-slate-400">
                          {t.weeklyTargetLabel}
                          <input
                            type="number"
                            min={1}
                            value={ov.weeklyTarget ?? ov.dailyTarget * 7}
                            onChange={(e) =>
                              setActOverrides((prev) => ({
                                ...prev,
                                [act.id]: {
                                  ...ov,
                                  weeklyTarget: Math.max(1, Number(e.target.value) || 1),
                                },
                              }))
                            }
                            className="mt-1 w-full min-h-[38px] px-2.5 rounded-lg bg-[#0B0F17] border border-white/[0.1] font-tabular text-xs text-slate-100"
                          />
                        </label>
                        <label className="text-[11px] text-slate-400">
                          {t.xpRewardLabel}
                          <input
                            type="number"
                            min={0}
                            max={5000}
                            value={ov.xpReward}
                            onChange={(e) =>
                              setActOverrides((prev) => ({
                                ...prev,
                                [act.id]: {
                                  ...ov,
                                  xpReward: Math.max(0, Number(e.target.value) || 0),
                                },
                              }))
                            }
                            className="mt-1 w-full min-h-[38px] px-2.5 rounded-lg bg-[#0B0F17] border border-white/[0.1] font-tabular text-xs text-slate-100"
                          />
                        </label>
                        <label className="text-[11px] text-slate-400">
                          {t.priorityLabel}
                          <select
                            value={ov.priority}
                            onChange={(e) =>
                              setActOverrides((prev) => ({
                                ...prev,
                                [act.id]: {
                                  ...ov,
                                  priority: e.target.value as PriorityLevel,
                                },
                              }))
                            }
                            className="mt-1 w-full min-h-[38px] px-2 rounded-lg bg-[#0B0F17] border border-white/[0.1] text-xs text-slate-100"
                          >
                            <option value="high">{t.priorities.high}</option>
                            <option value="medium">{t.priorities.medium}</option>
                            <option value="low">{t.priorities.low}</option>
                          </select>
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#0B0F17] border border-white/[0.08] flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Bell className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <div className="text-sm font-semibold text-slate-100">{t.remindersToggleTitle}</div>
                    <p className="text-xs text-slate-400 mt-1">{t.remindersToggleDesc}</p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={remindersEnabled}
                  onClick={() => setRemindersEnabled((v) => !v)}
                  className={`min-h-[38px] px-3.5 rounded-xl text-xs font-semibold border shrink-0 ${
                    remindersEnabled
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                      : 'bg-[#1A2233] border-white/[0.1] text-slate-300'
                  }`}
                >
                  {remindersEnabled ? t.onLabel : t.offLabel}
                </button>
              </div>

              <div className="p-4 rounded-xl bg-[#0B0F17] border border-white/[0.08] space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                  <Shield className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                  <span>{t.visibilityTitle}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {(['private', 'friends', 'public'] as const).map((vis) => {
                    const active = privacy.visibility === vis;
                    const opt = t.visibilityOptions[vis];
                    return (
                      <button
                        key={vis}
                        type="button"
                        onClick={() => setPrivacy((p) => ({ ...p, visibility: vis }))}
                        className={`p-3 rounded-xl border text-left transition-colors ${
                          active
                            ? 'bg-amber-500/15 border-amber-500/45 text-amber-200'
                            : 'bg-[#121824] border-white/[0.07] text-slate-300'
                        }`}
                      >
                        <div className="text-xs font-semibold">{opt.title}</div>
                        <div className="text-[11px] text-slate-400 mt-1 leading-snug">{opt.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="pt-4 border-t border-white/[0.07] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={step === 1 ? onSkip : () => setStep((s) => (s - 1) as 1 | 2 | 3 | 4)}
            className="min-h-[44px] px-4 rounded-xl bg-[#1A2233] border border-white/[0.08] text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            {step > 1 && <ChevronLeft className="w-4 h-4" aria-hidden="true" />}
            <span>{step === 1 ? t.onboardingSkip : t.onboardingBack}</span>
          </button>

          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3 | 4)}
              className="min-h-[44px] px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <span>{t.onboardingNext}</span>
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              className="min-h-[44px] px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Check className="w-4 h-4" aria-hidden="true" />
              <span>{t.onboardingFinish}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
