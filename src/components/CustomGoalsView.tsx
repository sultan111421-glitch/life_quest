import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Bell,
  Edit2,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  ActivityCategory,
  ActivityDefinition,
  CustomCategoryDef,
  InputType,
  Language,
  PriorityLevel,
} from '../types/quest';
import { UNIT_PRESETS } from '../utils/defaults';
import { formatDigits } from '../utils/dhakaTime';
import {
  CATEGORY_LABELS,
  getLocalizedActivityTitle,
  getLocalizedCategoryLabel,
  getLocalizedUnitLabel,
  INPUT_TYPE_LABELS,
  UI_COPY,
} from '../utils/i18n';

interface CustomGoalsViewProps {
  activities: ActivityDefinition[];
  lang: Language;
  customCategories: CustomCategoryDef[];
  religionEnabled: boolean;
  onSaveActivity: (
    act: Omit<ActivityDefinition, 'order'> & { order?: number }
  ) => Promise<void>;
  onDeleteActivity: (activityId: string) => Promise<void>;
  onReorderActivity: (activityId: string, direction: 'up' | 'down') => Promise<void>;
  onAddCustomCategory: (name: string, isSpiritual?: boolean) => Promise<CustomCategoryDef | null>;
}

export const CustomGoalsView: React.FC<CustomGoalsViewProps> = ({
  activities,
  lang,
  customCategories,
  religionEnabled,
  onSaveActivity,
  onDeleteActivity,
  onReorderActivity,
  onAddCustomCategory,
}) => {
  const t = UI_COPY[lang];
  const categoryLabels = CATEGORY_LABELS[lang];
  const inputTypeLabels = INPUT_TYPE_LABELS[lang];

  const sorted = useMemo(
    () => [...activities].sort((a, b) => a.order - b.order),
    [activities]
  );

  const availableCategories = useMemo(() => {
    const builtIn = (Object.keys(categoryLabels) as ActivityCategory[]).filter(
      (cat) => religionEnabled || cat !== 'spiritual'
    );
    const custom = customCategories
      .filter((c) => religionEnabled || !c.isSpiritual)
      .map((c) => c.id);
    return [...builtIn, ...custom];
  }, [categoryLabels, customCategories, religionEnabled]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ActivityCategory>('personal');
  const [inputType, setInputType] = useState<InputType>('checkbox');
  const [unitLabel, setUnitLabel] = useState('times');
  const [dailyTarget, setDailyTarget] = useState<number>(1);
  const [weeklyTarget, setWeeklyTarget] = useState<number>(7);
  const [monthlyTarget, setMonthlyTarget] = useState<number>(30);
  const [xpReward, setXpReward] = useState<number>(30);
  const [priority, setPriority] = useState<PriorityLevel>('medium');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('08:00');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!deleteConfirmId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDeleteConfirmId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteConfirmId]);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setCategory('personal');
    setInputType('checkbox');
    setUnitLabel('times');
    setDailyTarget(1);
    setWeeklyTarget(7);
    setMonthlyTarget(30);
    setXpReward(30);
    setPriority('medium');
    setReminderEnabled(false);
    setReminderTime('08:00');
    setFormError(null);
  };

  const handleStartEdit = (act: ActivityDefinition) => {
    setEditingId(act.id);
    setTitle(getLocalizedActivityTitle(act, lang));
    setCategory(act.category);
    setInputType(act.inputType);
    setUnitLabel(act.unitLabel);
    setDailyTarget(act.dailyTarget);
    setWeeklyTarget(act.weeklyTarget ?? act.dailyTarget * 7);
    setMonthlyTarget(act.monthlyTarget ?? act.dailyTarget * 30);
    setXpReward(act.xpReward);
    setPriority(act.priority ?? 'medium');
    setReminderEnabled(Boolean(act.reminderEnabled));
    setReminderTime(act.reminderTime ?? '08:00');
    setFormError(null);
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    const created = await onAddCustomCategory(newCategoryName.trim(), false);
    if (created) {
      setCategory(created.id);
      setNewCategoryName('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setFormError(t.goalTitleError);
      return;
    }

    const existing = editingId ? activities.find((a) => a.id === editingId) : undefined;
    const id = existing ? existing.id : `custom_${Date.now()}`;
    const safeDaily = Math.max(1, Number(dailyTarget) || 1);

    setSubmitting(true);
    try {
      await onSaveActivity({
        id,
        title: cleanTitle,
        category,
        inputType: existing?.inputType === 'prayer' ? 'prayer' : inputType,
        unitLabel: unitLabel.trim() || (inputType === 'time' ? 'min' : 'times'),
        dailyTarget: safeDaily,
        weeklyTarget: Math.max(safeDaily, Number(weeklyTarget) || safeDaily * 7),
        monthlyTarget: Math.max(safeDaily, Number(monthlyTarget) || safeDaily * 30),
        xpReward: Math.max(0, Number(xpReward) || 0),
        priority,
        reminderEnabled,
        reminderTime: reminderEnabled ? reminderTime : undefined,
        order: existing?.order,
        isCore: existing?.isCore ?? false,
        isActive: existing?.isActive ?? true,
      });
      resetForm();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-100">
          {t.goalsTitle}
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">{t.goalsSubtitle}</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Create / Edit Form */}
        <section className="xl:col-span-5 rounded-2xl bg-[#121824] border border-white/[0.08] p-5 self-start space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-slate-100">
              {editingId ? t.editGoalHeading : t.addGoalHeading}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t.cancel}</span>
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="goal-title" className="block text-xs text-slate-300 mb-1.5">
                {t.activityNameLabel}
              </label>
              <input
                id="goal-title"
                type="text"
                maxLength={100}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t.activityNamePlaceholder}
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="goal-category" className="block text-xs text-slate-300 mb-1.5">
                  {t.categoryLabel}
                </label>
                <select
                  id="goal-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ActivityCategory)}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                >
                  {availableCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {getLocalizedCategoryLabel(cat, lang, customCategories)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="goal-input-type" className="block text-xs text-slate-300 mb-1.5">
                  {t.inputTypeLabel}
                </label>
                <select
                  id="goal-input-type"
                  disabled={inputType === 'prayer'}
                  value={inputType}
                  onChange={(e) => {
                    const nextType = e.target.value as InputType;
                    setInputType(nextType);
                    if (nextType === 'time') setUnitLabel('min');
                    if (nextType === 'checkbox' || nextType === 'text') {
                      setDailyTarget(1);
                      setWeeklyTarget(7);
                      setMonthlyTarget(30);
                      setUnitLabel('goal');
                    }
                  }}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-sm text-slate-100 disabled:opacity-60 focus:outline-none focus:border-amber-400"
                >
                  {inputType === 'prayer' && (
                    <option value="prayer">{inputTypeLabels.prayer}</option>
                  )}
                  <option value="checkbox">{inputTypeLabels.checkbox}</option>
                  <option value="number">{inputTypeLabels.number}</option>
                  <option value="time">{inputTypeLabels.time}</option>
                  <option value="text">{inputTypeLabels.text}</option>
                </select>
              </div>
            </div>

            {/* Inline Custom Category Creator */}
            <div className="p-3 rounded-xl bg-[#0B0F17] border border-white/[0.06] space-y-2">
              <div className="text-[11px] font-medium text-slate-400">{t.customCategoryLabel}</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={40}
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder={t.newCategoryPlaceholder}
                  className="flex-1 min-h-[38px] px-3 rounded-lg bg-[#121824] border border-white/[0.1] text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={handleCreateCategory}
                  className="min-h-[38px] px-3 rounded-lg bg-[#1A2233] border border-white/[0.08] text-xs font-semibold text-amber-300 whitespace-nowrap"
                >
                  {t.addCategoryBtn}
                </button>
              </div>
            </div>

            {/* Daily, Weekly, Monthly Targets */}
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label htmlFor="goal-target" className="block text-xs text-slate-300 mb-1.5">
                  {t.dailyTargetLabel}
                </label>
                <input
                  id="goal-target"
                  type="number"
                  min={1}
                  max={10000}
                  value={dailyTarget}
                  onChange={(e) => {
                    const d = Math.max(1, Number(e.target.value) || 1);
                    setDailyTarget(d);
                    setWeeklyTarget(d * 7);
                    setMonthlyTarget(d * 30);
                  }}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0F17] border border-white/[0.1] font-tabular text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label htmlFor="goal-weekly-target" className="block text-xs text-slate-300 mb-1.5">
                  {t.weeklyTargetLabel}
                </label>
                <input
                  id="goal-weekly-target"
                  type="number"
                  min={1}
                  max={100000}
                  value={weeklyTarget}
                  onChange={(e) => setWeeklyTarget(Number(e.target.value))}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0F17] border border-white/[0.1] font-tabular text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label htmlFor="goal-monthly-target" className="block text-xs text-slate-300 mb-1.5">
                  {t.monthlyTargetLabel}
                </label>
                <input
                  id="goal-monthly-target"
                  type="number"
                  min={1}
                  max={1000000}
                  value={monthlyTarget}
                  onChange={(e) => setMonthlyTarget(Number(e.target.value))}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0F17] border border-white/[0.1] font-tabular text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* Unit Preset + Custom Unit + XP + Priority */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div>
                <label htmlFor="goal-unit-preset" className="block text-xs text-slate-300 mb-1.5">
                  {t.unitPresetLabel}
                </label>
                <select
                  id="goal-unit-preset"
                  value={UNIT_PRESETS.includes(unitLabel as (typeof UNIT_PRESETS)[number]) ? unitLabel : '__custom'}
                  onChange={(e) => {
                    if (e.target.value !== '__custom') {
                      setUnitLabel(e.target.value);
                    }
                  }}
                  className="w-full min-h-[42px] px-2.5 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-xs text-slate-100"
                >
                  {UNIT_PRESETS.map((u) => (
                    <option key={u} value={u}>
                      {getLocalizedUnitLabel(u, lang)}
                    </option>
                  ))}
                  <option value="__custom">{t.customUnitOption}</option>
                </select>
              </div>
              <div>
                <label htmlFor="goal-unit" className="block text-xs text-slate-300 mb-1.5">
                  {t.unitLabel}
                </label>
                <input
                  id="goal-unit"
                  type="text"
                  maxLength={30}
                  value={unitLabel}
                  onChange={(e) => setUnitLabel(e.target.value)}
                  placeholder={t.unitPlaceholder}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label htmlFor="goal-xp" className="block text-xs text-slate-300 mb-1.5">
                  {t.xpRewardLabel}
                </label>
                <input
                  id="goal-xp"
                  type="number"
                  min={0}
                  max={5000}
                  value={xpReward}
                  onChange={(e) => setXpReward(Number(e.target.value))}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0F17] border border-white/[0.1] font-tabular text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div>
                <label htmlFor="goal-priority" className="block text-xs text-slate-300 mb-1.5">
                  {t.priorityLabel}
                </label>
                <select
                  id="goal-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-xs text-slate-100"
                >
                  <option value="high">{t.priorities.high}</option>
                  <option value="medium">{t.priorities.medium}</option>
                  <option value="low">{t.priorities.low}</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 min-h-[42px] px-3 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-xs text-slate-200 cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={reminderEnabled}
                    onChange={(e) => setReminderEnabled(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 rounded"
                  />
                  <span className="truncate">{t.reminderLabel}</span>
                </label>
                {reminderEnabled && (
                  <input
                    type="time"
                    aria-label={t.reminderTimeLabel}
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                    className="min-h-[42px] px-2 rounded-xl bg-[#0B0F17] border border-white/[0.1] font-tabular text-xs text-slate-100"
                  />
                )}
              </div>
            </div>

            {formError && (
              <p className="text-xs text-rose-400" role="alert">
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[44px] rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>{editingId ? t.saveChangesBtn : t.createGoalBtn}</span>
            </button>
          </form>
        </section>

        {/* Activities List with Reorder, Edit, Toggle, Delete */}
        <section className="xl:col-span-7 rounded-2xl bg-[#121824] border border-white/[0.08] p-5">
          <h2 className="font-display text-lg font-semibold text-slate-100 mb-4">
            {t.allActivitiesHeading} ({formatDigits(sorted.length, lang)}
            {lang === 'bn' ? t.itemsSuffix : ` ${t.itemsSuffix}`})
          </h2>

          <div className="divide-y divide-white/[0.06]">
            {sorted.map((act, idx) => {
              const actTitle = getLocalizedActivityTitle(act, lang);
              const actUnit = getLocalizedUnitLabel(act.unitLabel, lang);
              return (
                <div
                  key={act.id}
                  className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span>{getLocalizedCategoryLabel(act.category, lang, customCategories)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{inputTypeLabels[act.inputType]}</span>
                      {act.priority && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span
                            className={
                              act.priority === 'high' ? 'text-rose-300 font-medium' : 'text-slate-400'
                            }
                          >
                            {t.priorities[act.priority]}
                          </span>
                        </>
                      )}
                      {act.reminderEnabled && act.reminderTime && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 text-sky-300 font-tabular">
                            <Bell className="w-3 h-3" aria-hidden="true" />
                            {act.reminderTime}
                          </span>
                        </>
                      )}
                      {!act.isActive && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-amber-400">{t.pausedLabel}</span>
                        </>
                      )}
                    </div>
                    <div className="font-display text-base font-semibold text-slate-100 mt-0.5 truncate">
                      {actTitle}
                    </div>
                    <div className="text-xs text-slate-400 font-tabular mt-0.5">
                      {t.targetLabel} {formatDigits(act.dailyTarget, lang)} {actUnit}
                      {act.weeklyTarget
                        ? ` · ${t.weeklyProgressShort}: ${formatDigits(act.weeklyTarget, lang)}`
                        : ''}
                      {act.monthlyTarget
                        ? ` · ${t.monthlyProgressShort}: ${formatDigits(act.monthlyTarget, lang)}`
                        : ''}{' '}
                      · {t.xpRewardLabel}: {formatDigits(act.xpReward, lang)} XP
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      aria-label={`${actTitle} — ${t.moveUpAria}`}
                      onClick={() => onReorderActivity(act.id, 'up')}
                      className="min-w-[40px] min-h-[40px] rounded-xl bg-[#1A2233] border border-white/[0.06] disabled:opacity-35 flex items-center justify-center text-slate-300 hover:text-white"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === sorted.length - 1}
                      aria-label={`${actTitle} — ${t.moveDownAria}`}
                      onClick={() => onReorderActivity(act.id, 'down')}
                      className="min-w-[40px] min-h-[40px] rounded-xl bg-[#1A2233] border border-white/[0.06] disabled:opacity-35 flex items-center justify-center text-slate-300 hover:text-white"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`${actTitle} — ${act.isActive ? t.pauseAria : t.resumeAria}`}
                      onClick={() => onSaveActivity({ ...act, isActive: !act.isActive })}
                      className="min-w-[40px] min-h-[40px] rounded-xl bg-[#1A2233] border border-white/[0.06] flex items-center justify-center text-slate-300 hover:text-white"
                    >
                      {act.isActive ? (
                        <Eye className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-slate-500" />
                      )}
                    </button>
                    <button
                      type="button"
                      aria-label={`${actTitle} — ${t.editAria}`}
                      onClick={() => handleStartEdit(act)}
                      className="min-w-[40px] min-h-[40px] rounded-xl bg-[#1A2233] border border-white/[0.06] flex items-center justify-center text-amber-400 hover:border-amber-400/40"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    {deleteConfirmId === act.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={async () => {
                            await onDeleteActivity(act.id);
                            setDeleteConfirmId(null);
                          }}
                          className="px-2.5 min-h-[40px] rounded-xl bg-rose-600 text-white text-xs font-medium"
                        >
                          {t.confirmDelete}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-2.5 min-h-[40px] rounded-xl bg-slate-700 text-slate-200 text-xs"
                        >
                          {t.cancelShort}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        aria-label={`${actTitle} — ${t.deleteAria}`}
                        onClick={() => setDeleteConfirmId(act.id)}
                        className="min-w-[40px] min-h-[40px] rounded-xl bg-[#1A2233] border border-white/[0.06] flex items-center justify-center text-rose-400 hover:border-rose-400/40"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};

