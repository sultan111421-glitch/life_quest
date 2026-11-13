import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Edit3 } from 'lucide-react';
import {
  ActivityDefinition,
  ActivityEntry,
  CustomCategoryDef,
  DailyLog,
  Language,
  NavPage,
} from '../types/quest';
import {
  formatDigits,
  formatLocalizedDate,
  formatLocalizedMonthYear,
  getLocalizedWeekdays,
  getMonthCalendarCells,
  parseDateKey,
} from '../utils/dhakaTime';
import { calculateActivityProgress } from '../utils/gamification';
import { getLocalizedActivityTitle, UI_COPY } from '../utils/i18n';
import { ActivityHeatmap } from './charts/QuestCharts';
import { QuestCard } from './QuestCard';

interface CalendarViewProps {
  todayKey: string;
  selectedDateKey: string;
  onSelectDateKey: (dateKey: string) => void;
  activities: ActivityDefinition[];
  dailyLogs: Record<string, DailyLog>;
  lang: Language;
  customCategories?: CustomCategoryDef[];
  onUpdateEntry: (dateKey: string, activityId: string, entry: ActivityEntry) => void;
  onNavigate: (page: NavPage) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  todayKey,
  selectedDateKey,
  onSelectDateKey,
  activities,
  dailyLogs,
  lang,
  customCategories = [],
  onUpdateEntry,
  onNavigate,
}) => {
  const t = UI_COPY[lang];
  const weekdays = getLocalizedWeekdays(lang);
  const initialParsed = parseDateKey(selectedDateKey);
  const [viewYear, setViewYear] = useState(initialParsed.year);
  const [viewMonth0, setViewMonth0] = useState(initialParsed.month - 1);

  const cells = useMemo(
    () => getMonthCalendarCells(viewYear, viewMonth0),
    [viewYear, viewMonth0]
  );

  const handlePrevMonth = () => {
    if (viewMonth0 === 0) {
      setViewYear((y) => y - 1);
      setViewMonth0(11);
    } else {
      setViewMonth0((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth0 === 11) {
      setViewYear((y) => y + 1);
      setViewMonth0(0);
    } else {
      setViewMonth0((m) => m + 1);
    }
  };

  const selectedLog = dailyLogs[selectedDateKey];
  const activeActivities = useMemo(
    () => activities.filter((a) => a.isActive).sort((a, b) => a.order - b.order),
    [activities]
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Monthly Calendar */}
        <section className="xl:col-span-7 rounded-2xl bg-[#121824] border border-white/[0.08] p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="font-display text-xl font-bold text-slate-100">
                {formatLocalizedMonthYear(viewYear, viewMonth0, lang)}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">{t.calendarSubtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={t.prevMonthAria}
                onClick={handlePrevMonth}
                className="min-w-[44px] min-h-[44px] rounded-xl bg-[#1A2233] border border-white/[0.07] flex items-center justify-center text-slate-200 hover:border-white/20"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label={t.nextMonthAria}
                onClick={handleNextMonth}
                className="min-w-[44px] min-h-[44px] rounded-xl bg-[#1A2233] border border-white/[0.07] flex items-center justify-center text-slate-200 hover:border-white/20"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-slate-400 mb-2">
            {weekdays.map((d) => (
              <div key={d} className="py-1 font-medium">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {cells.map((dateKey, idx) => {
              if (!dateKey) {
                return <div key={`empty-${idx}`} className="min-h-[56px]" />;
              }
              const log = dailyLogs[dateKey];
              const pct = log?.completionPct ?? 0;
              const isSelected = dateKey === selectedDateKey;
              const isFuture = dateKey > todayKey;
              const dayNumber = Number(dateKey.slice(-2));

              const bgStyle = isFuture
                ? 'bg-[#0B0F17]/40 text-slate-600 border-white/[0.03]'
                : pct >= 80
                  ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40'
                  : pct >= 40
                    ? 'bg-amber-500/15 text-amber-200 border-amber-500/35'
                    : log
                      ? 'bg-slate-800/70 text-slate-300 border-white/[0.07]'
                      : 'bg-[#0B0F17] text-slate-400 border-white/[0.05]';

              return (
                <button
                  key={dateKey}
                  type="button"
                  disabled={isFuture}
                  onClick={() => onSelectDateKey(dateKey)}
                  aria-label={`${formatLocalizedDate(dateKey, lang, false)} (${formatDigits(
                    pct,
                    lang
                  )}%)`}
                  className={`min-h-[56px] p-1.5 rounded-xl border flex flex-col items-center justify-between transition-colors ${bgStyle} ${
                    isSelected ? 'ring-2 ring-amber-400' : ''
                  }`}
                >
                  <span className="font-tabular text-xs font-semibold">
                    {formatDigits(dayNumber, lang)}
                  </span>
                  {!isFuture && (
                    <span className="font-tabular text-[10px] opacity-85">
                      {log ? `${formatDigits(pct, lang)}%` : '—'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Selected Date Detail & Quick Edit */}
        <section className="xl:col-span-5 rounded-2xl bg-[#121824] border border-white/[0.08] p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-white/[0.06]">
              <div>
                <div className="text-xs text-slate-400">{t.selectedDateDetails}</div>
                <h2 className="font-display text-lg font-bold text-slate-100 mt-0.5">
                  {formatLocalizedDate(selectedDateKey, lang, true)}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('quests')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-semibold whitespace-nowrap"
              >
                <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t.fullEdit}</span>
              </button>
            </div>

            <div className="flex items-center justify-between py-3 text-sm border-b border-white/[0.06]">
              <span className="text-slate-300">{t.completionRateLabel}</span>
              <span className="font-tabular font-bold text-emerald-400">
                {formatDigits(selectedLog?.completionPct ?? 0, lang)}% · +
                {formatDigits(selectedLog?.totalXpEarned ?? 0, lang)} XP
              </span>
            </div>

            <div className="mt-4 space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
              {activeActivities.map((act) => {
                const prog = calculateActivityProgress(
                  act,
                  selectedLog?.entries?.[act.id],
                  lang
                );
                return (
                  <div
                    key={act.id}
                    className="flex items-center justify-between gap-3 py-2 border-b border-white/[0.04] last:border-b-0 text-xs sm:text-sm"
                  >
                    <span className="text-slate-200 truncate">
                      {getLocalizedActivityTitle(act, lang)}
                    </span>
                    <span
                      className={`font-tabular shrink-0 ${
                        prog.completed ? 'text-emerald-400 font-medium' : 'text-slate-400'
                      }`}
                    >
                      {prog.summaryText}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {activeActivities[0] && (
            <div className="mt-4 pt-4 border-t border-white/[0.06]">
              <QuestCard
                activity={activeActivities[0]}
                entry={selectedLog?.entries?.[activeActivities[0].id]}
                lang={lang}
                customCategories={customCategories}
                onChange={(nextEntry) =>
                  onUpdateEntry(selectedDateKey, activeActivities[0].id, nextEntry)
                }
                compact
              />
            </div>
          )}
        </section>
      </div>

      {/* Activity Heatmap */}
      <section className="rounded-2xl bg-[#121824] border border-white/[0.08] p-5">
        <h2 className="font-display text-lg font-bold text-slate-100 mb-3">
          {t.heatmapTitle}
        </h2>
        <ActivityHeatmap
          dailyLogs={dailyLogs}
          todayKey={todayKey}
          lang={lang}
          weeks={14}
          selectedDateKey={selectedDateKey}
          onSelectDate={onSelectDateKey}
        />
      </section>
    </div>
  );
};
