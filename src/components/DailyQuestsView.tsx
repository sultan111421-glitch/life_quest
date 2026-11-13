import React, { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Lock, Plus } from 'lucide-react';
import {
  ActivityCategory,
  ActivityDefinition,
  ActivityEntry,
  CustomCategoryDef,
  DailyLog,
  Language,
  LevelConfig,
  NavPage,
} from '../types/quest';
import { TIME_AUDIT_ENTRY_KEY } from '../utils/defaults';
import {
  formatDigits,
  formatLocalizedDate,
  formatLocalizedShortDay,
  getLastNDaysKeys,
  shiftDateKey,
} from '../utils/dhakaTime';
import { calculateDailySummary, clampTimeAuditPair } from '../utils/gamification';
import {
  CATEGORY_LABELS,
  getLocalizedCategoryLabel,
  UI_COPY,
} from '../utils/i18n';
import { QuestCard } from './QuestCard';

interface DailyQuestsViewProps {
  todayKey: string;
  selectedDateKey: string;
  lang: Language;
  onSelectDateKey: (key: string) => void;
  activities: ActivityDefinition[];
  dailyLogs: Record<string, DailyLog>;
  levelConfig: LevelConfig;
  customCategories: CustomCategoryDef[];
  religionEnabled: boolean;
  onUpdateEntry: (dateKey: string, activityId: string, entry: ActivityEntry) => void;
  onUpdateNote: (dateKey: string, note: string) => void;
  onNavigate: (page: NavPage) => void;
  onTimerLogged?: () => void;
}

export const DailyQuestsView: React.FC<DailyQuestsViewProps> = ({
  todayKey,
  selectedDateKey,
  lang,
  onSelectDateKey,
  activities,
  dailyLogs,
  levelConfig,
  customCategories,
  religionEnabled,
  onUpdateEntry,
  onUpdateNote,
  onNavigate,
  onTimerLogged,
}) => {
  const t = UI_COPY[lang];
  const [categoryFilter, setCategoryFilter] = useState<'all' | ActivityCategory>('all');

  const activeActivities = useMemo(
    () =>
      activities
        .filter((a) => a.isActive)
        .filter((a) => (categoryFilter === 'all' ? true : a.category === categoryFilter))
        .sort((a, b) => a.order - b.order),
    [activities, categoryFilter]
  );

  const visibleCategoryTabs = useMemo(() => {
    const fromBuiltIn = (Object.keys(CATEGORY_LABELS[lang]) as ActivityCategory[]).filter(
      (cat) => religionEnabled || cat !== 'spiritual'
    );
    const fromCustom = customCategories
      .filter((c) => religionEnabled || !c.isSpiritual)
      .map((c) => c.id);
    const activeCats = new Set(activities.filter((a) => a.isActive).map((a) => a.category));
    return Array.from(new Set([...fromBuiltIn, ...fromCustom])).filter(
      (cat) => activeCats.has(cat) || ['learning', 'health', 'focus', 'personal'].includes(cat)
    );
  }, [activities, customCategories, lang, religionEnabled]);

  const selectedLog = dailyLogs[selectedDateKey];
  const entries = selectedLog?.entries ?? {};

  const selectedSummary = useMemo(
    () => calculateDailySummary(activities, entries, levelConfig),
    [activities, entries, levelConfig]
  );

  const quickDates = useMemo(() => getLastNDaysKeys(todayKey, 7), [todayKey]);
  const isToday = selectedDateKey === todayKey;

  const auditEntry = entries[TIME_AUDIT_ENTRY_KEY];
  const {
    productiveMinutes: productiveMin,
    wastedMinutes: wastedMin,
    necessaryRestMinutes: necessaryRestMin,
  } = clampTimeAuditPair(auditEntry?.value, auditEntry?.minutes);
  const totalAudited = productiveMin + wastedMin;
  const efficiencyPct =
    totalAudited > 0 ? Math.round((productiveMin / totalAudited) * 100) : null;

  return (
    <div className="space-y-6">
      {/* Header & Date Selector Bar */}
      <section className="rounded-2xl bg-[#121824] border border-white/[0.08] p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span>{isToday ? t.todaysRecord : t.editingPastRecord}</span>
              <span aria-hidden="true">·</span>
              <span className="font-tabular text-amber-400">
                +{formatDigits(selectedSummary.totalXpEarned, lang)} XP
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-tabular text-emerald-400">
                {formatDigits(selectedSummary.completionPct, lang)}% {t.completedLabel}
              </span>
            </div>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-100 mt-1">
              {formatLocalizedDate(selectedDateKey, lang, true)}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-label={t.prevDayAria}
              onClick={() => onSelectDateKey(shiftDateKey(selectedDateKey, -1))}
              className="min-w-[44px] min-h-[44px] px-3 rounded-xl bg-[#1A2233] border border-white/[0.07] hover:border-white/20 text-slate-200 flex items-center justify-center"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <label className="flex items-center gap-2 min-h-[44px] px-3 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-xs text-slate-200">
              <CalendarDays className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
              <input
                type="date"
                max={todayKey}
                aria-label={t.pickDateAria}
                value={selectedDateKey}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) onSelectDateKey(val > todayKey ? todayKey : val);
                }}
                className="bg-transparent text-slate-100 font-tabular focus:outline-none"
              />
            </label>
            <button
              type="button"
              aria-label={t.nextDayAria}
              disabled={selectedDateKey >= todayKey}
              onClick={() => onSelectDateKey(shiftDateKey(selectedDateKey, 1))}
              className="min-w-[44px] min-h-[44px] px-3 rounded-xl bg-[#1A2233] border border-white/[0.07] hover:border-white/20 disabled:opacity-40 text-slate-200 flex items-center justify-center"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {!isToday && (
              <button
                type="button"
                onClick={() => onSelectDateKey(todayKey)}
                className="min-h-[44px] px-3.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-semibold whitespace-nowrap"
              >
                {t.backToToday}
              </button>
            )}
          </div>
        </div>

        {/* 7-day quick date strip */}
        <div className="grid grid-cols-7 gap-1.5 mt-4 pt-4 border-t border-white/[0.06]">
          {quickDates.map((dKey) => {
            const log = dailyLogs[dKey];
            const active = dKey === selectedDateKey;
            const dayNum = dKey.slice(-2);
            return (
              <button
                key={dKey}
                type="button"
                onClick={() => onSelectDateKey(dKey)}
                className={`min-h-[52px] py-1.5 px-1 rounded-xl border text-center transition-colors flex flex-col items-center justify-center ${
                  active
                    ? 'bg-amber-500 border-amber-400 text-slate-950 font-semibold'
                    : 'bg-[#0B0F17] border-white/[0.06] text-slate-300 hover:border-white/20'
                }`}
              >
                <span className="text-[10px] opacity-80">
                  {formatLocalizedShortDay(dKey, lang)}
                </span>
                <span className="font-tabular text-sm font-bold leading-tight">
                  {formatDigits(dayNum, lang)}
                </span>
                <span
                  className={`text-[10px] font-tabular ${
                    active ? 'text-slate-900' : 'text-emerald-400'
                  }`}
                >
                  {formatDigits(log?.completionPct ?? 0, lang)}%
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Category Filter Tabs + Manage Custom Goals CTA */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
              categoryFilter === 'all'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-[#121824] border border-white/[0.07] text-slate-300 hover:text-white'
            }`}
          >
            {t.allCategories} ({formatDigits(activities.filter((a) => a.isActive).length, lang)})
          </button>
          {visibleCategoryTabs.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                categoryFilter === cat
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-[#121824] border border-white/[0.07] text-slate-300 hover:text-white'
              }`}
            >
              {getLocalizedCategoryLabel(cat, lang, customCategories)}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onNavigate('goals')}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1A2233] border border-white/[0.08] hover:border-amber-400/40 text-xs font-medium text-slate-200 whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
          <span>{t.manageCustomGoals}</span>
        </button>
      </div>

      {/* Respectful Privacy Banner shown only when spiritual tracking is enabled */}
      {religionEnabled && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#121824] border border-white/[0.06] text-xs text-slate-300">
          <Lock className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
          <span>{t.spiritualPrivacyBanner}</span>
        </div>
      )}

      {/* Quests Grid */}
      {activeActivities.length === 0 ? (
        <div className="rounded-2xl bg-[#121824] border border-white/[0.07] p-8 text-center">
          <p className="text-sm text-slate-300">{t.noActiveInCategory}</p>
          <button
            type="button"
            onClick={() => onNavigate('goals')}
            className="mt-4 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-semibold"
          >
            {t.addNewGoalBtn}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeActivities.map((activity) => (
            <QuestCard
              key={activity.id}
              activity={activity}
              entry={entries[activity.id]}
              lang={lang}
              customCategories={customCategories}
              dailyLogs={dailyLogs}
              todayKey={todayKey}
              onTimerLogged={onTimerLogged}
              onChange={(nextEntry) =>
                onUpdateEntry(selectedDateKey, activity.id, nextEntry)
              }
            />
          ))}
        </div>
      )}

      {/* Time Audit & Wasted Time Tracker */}
      <section className="rounded-2xl bg-[#121824] border border-white/[0.08] p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-sky-400 shrink-0" aria-hidden="true" />
            <div>
              <h2 className="font-display text-base sm:text-lg font-semibold text-slate-100">
                {t.timeAuditTitle}
              </h2>
              <p className="text-xs text-slate-400">{t.timeAuditSubtitle}</p>
            </div>
          </div>
          <div className="font-tabular text-xs sm:text-sm font-semibold text-sky-400">
            {t.timeAuditEfficiency}:{' '}
            {efficiencyPct === null ? t.noAuditDataYet : `${formatDigits(efficiencyPct, lang)}%`}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="audit-productive-min"
              className="block text-xs text-slate-300 mb-1.5"
            >
              {t.productiveTimeLabel} ({t.minutesUnit})
            </label>
            <input
              id="audit-productive-min"
              type="number"
              min={0}
              max={1440 - wastedMin}
              value={productiveMin}
              onChange={(e) =>
                onUpdateEntry(selectedDateKey, TIME_AUDIT_ENTRY_KEY, {
                  ...auditEntry,
                  value: Math.max(
                    0,
                    Math.min(1440 - wastedMin, Number(e.target.value) || 0)
                  ),
                })
              }
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#0B0F17] border border-white/[0.1] font-tabular text-sm text-emerald-300 focus:outline-none focus:border-emerald-400"
            />
          </div>

          <div>
            <label
              htmlFor="audit-wasted-min"
              className="block text-xs text-slate-300 mb-1.5"
            >
              {t.wastedTimeLabel} ({t.minutesUnit})
            </label>
            <input
              id="audit-wasted-min"
              type="number"
              min={0}
              max={1440 - productiveMin}
              value={wastedMin}
              onChange={(e) =>
                onUpdateEntry(selectedDateKey, TIME_AUDIT_ENTRY_KEY, {
                  ...auditEntry,
                  minutes: Math.max(
                    0,
                    Math.min(1440 - productiveMin, Number(e.target.value) || 0)
                  ),
                })
              }
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#0B0F17] border border-white/[0.1] font-tabular text-sm text-rose-300 focus:outline-none focus:border-rose-400"
            />
          </div>
        </div>

        {/* 24h Breakdown Bar (Productive / Necessary Rest & Sleep / Wasted) */}
        <div className="mt-4 space-y-2">
          <div className="h-2.5 w-full rounded-full bg-[#0B0F17] border border-white/[0.06] overflow-hidden flex">
            <div
              className="h-full bg-emerald-400 transition-all duration-300"
              style={{ width: `${(productiveMin / 1440) * 100}%` }}
            />
            <div
              className="h-full bg-slate-600/80 transition-all duration-300"
              style={{ width: `${(necessaryRestMin / 1440) * 100}%` }}
            />
            <div
              className="h-full bg-rose-400 transition-all duration-300"
              style={{ width: `${(wastedMin / 1440) * 100}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span>
              {t.necessaryRestTimeLabel}:{' '}
              <strong className="font-tabular text-slate-200">
                {formatDigits(necessaryRestMin, lang)} {t.minutesUnit}
              </strong>
            </span>
            <span>{wastedMin > 60 ? t.wastedTimeWarning : t.wastedTimeGood}</span>
          </div>
          <p className="text-[11px] text-slate-500">{t.timeAuditCapNote}</p>
        </div>
      </section>

      {/* Daily Reflection Note */}
      <section className="rounded-2xl bg-[#121824] border border-white/[0.07] p-4 sm:p-5">
        <label className="block text-sm font-semibold text-slate-200 mb-2">
          {t.dailyReflectionLabel} ({formatLocalizedDate(selectedDateKey, lang, false)})
        </label>
        <textarea
          rows={2}
          maxLength={500}
          value={selectedLog?.note ?? ''}
          onChange={(e) => onUpdateNote(selectedDateKey, e.target.value)}
          placeholder={t.dailyReflectionPlaceholder}
          className="w-full rounded-xl bg-[#0B0F17] border border-white/[0.1] p-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
        />
      </section>
    </div>
  );
};
