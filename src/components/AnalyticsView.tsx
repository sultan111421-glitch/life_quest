import React, { useMemo, useState } from 'react';
import { Award, AlertCircle, BarChart3, Clock, TrendingUp } from 'lucide-react';
import { ActivityDefinition, CustomCategoryDef, DailyLog, Language } from '../types/quest';
import {
  formatDigits,
  formatLocalizedDate,
  formatLocalizedDuration,
} from '../utils/dhakaTime';
import { calculateAnalytics } from '../utils/gamification';
import {
  getLocalizedActivityTitle,
  getLocalizedUnitLabel,
  UI_COPY,
} from '../utils/i18n';
import { MultiActivityChart, ProgressBarChart } from './charts/QuestCharts';

interface AnalyticsViewProps {
  todayKey: string;
  activities: ActivityDefinition[];
  dailyLogs: Record<string, DailyLog>;
  lang: Language;
  religionEnabled: boolean;
  customCategories: CustomCategoryDef[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  todayKey,
  activities,
  dailyLogs,
  lang,
  religionEnabled,
  customCategories,
}) => {
  const t = UI_COPY[lang];
  const [rangeDays, setRangeDays] = useState<1 | 7 | 30>(7);

  const analytics = useMemo(
    () =>
      calculateAnalytics(
        dailyLogs,
        activities,
        todayKey,
        rangeDays,
        religionEnabled,
        customCategories
      ),
    [activities, customCategories, dailyLogs, rangeDays, religionEnabled, todayKey]
  );

  const hasLoggedDays = analytics.avgNecessaryOrRestMinutes > 0 || analytics.avgProductiveMinutes > 0 || analytics.avgWastedMinutes > 0;
  const prodPct = hasLoggedDays ? (analytics.avgProductiveMinutes / 1440) * 100 : 0;
  const restPct = hasLoggedDays ? (analytics.avgNecessaryOrRestMinutes / 1440) * 100 : 0;
  const wastedPct = hasLoggedDays ? (analytics.avgWastedMinutes / 1440) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Range Selector Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-100">
            {t.analyticsTitle}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            {religionEnabled ? t.analyticsSubtitle : t.analyticsSubtitleSecular}
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#121824] border border-white/[0.08] self-start">
          {(
            [
              [1, t.dailyTab],
              [7, t.weeklyTab],
              [30, t.monthlyTab],
            ] as const
          ).map(([days, label]) => (
            <button
              key={days}
              type="button"
              onClick={() => setRangeDays(days)}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                rangeDays === days
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl bg-[#121824] border border-white/[0.07] p-4">
          <div className="text-xs text-slate-400">{t.avgCompletion}</div>
          <div className="font-tabular text-2xl font-bold text-emerald-400 mt-1.5">
            {formatDigits(analytics.avgCompletionPct, lang)}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1">{t.inSelectedRange}</div>
        </div>

        <div className="rounded-2xl bg-[#121824] border border-white/[0.07] p-4">
          <div className="text-xs text-slate-400">
            {religionEnabled ? t.prayerConsistency : t.focusConsistency}
          </div>
          <div className="font-tabular text-2xl font-bold text-amber-400 mt-1.5">
            {formatDigits(
              religionEnabled ? analytics.prayerConsistencyPct : analytics.focusConsistencyPct,
              lang
            )}
            %
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {religionEnabled ? t.fiveWaqtAvg : t.productiveRatioAvg}
          </div>
        </div>

        <div className="rounded-2xl bg-[#121824] border border-white/[0.07] p-4">
          <div className="text-xs text-slate-400">{t.totalXpRange}</div>
          <div className="font-tabular text-2xl font-bold text-slate-100 mt-1.5">
            {formatDigits(analytics.totalXpInRange, lang)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">{t.inSelectedRange}</div>
        </div>

        <div className="rounded-2xl bg-[#121824] border border-white/[0.07] p-4">
          <div className="text-xs text-slate-400">{t.loggedDays}</div>
          <div className="font-tabular text-2xl font-bold text-sky-400 mt-1.5">
            {formatDigits(Object.keys(dailyLogs).length, lang)} {t.daysUnit}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">{t.totalSaved}</div>
        </div>
      </div>

      {/* Time Audit Overview */}
      <section className="rounded-2xl bg-[#121824] border border-white/[0.08] p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-sky-400" aria-hidden="true" />
            <h2 className="font-display text-lg font-semibold text-slate-100">
              {t.timeAuditSummaryTitle}
            </h2>
          </div>
          <span className="font-tabular text-xs font-semibold text-emerald-400">
            {t.timeAuditEfficiency}:{' '}
            {analytics.auditEfficiencyPct === null
              ? t.noAuditDataYet
              : `${formatDigits(analytics.auditEfficiencyPct, lang)}%`}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
          <div>
            <div className="text-xs text-slate-400">{t.avgProductiveLabel}</div>
            <div className="font-tabular text-xl font-bold text-emerald-400 mt-1">
              {formatLocalizedDuration(analytics.avgProductiveMinutes, lang)}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">{t.necessaryRestTimeLabel}</div>
            <div className="font-tabular text-xl font-bold text-slate-200 mt-1">
              {formatLocalizedDuration(analytics.avgNecessaryOrRestMinutes, lang)}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">{t.avgWastedLabel}</div>
            <div className="font-tabular text-xl font-bold text-rose-400 mt-1">
              {formatLocalizedDuration(analytics.avgWastedMinutes, lang)}
            </div>
          </div>
        </div>

        <div className="h-2.5 w-full rounded-full bg-[#0B0F17] border border-white/[0.06] overflow-hidden flex">
          <div
            className="h-full bg-emerald-400 transition-all duration-300"
            style={{ width: `${prodPct}%` }}
          />
          <div
            className="h-full bg-slate-600/80 transition-all duration-300"
            style={{ width: `${restPct}%` }}
          />
          <div
            className="h-full bg-rose-400 transition-all duration-300"
            style={{ width: `${wastedPct}%` }}
          />
        </div>
        <p className="text-[11px] text-slate-500 mt-2">{t.timeAuditCapNote}</p>
      </section>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-2xl bg-[#121824] border border-white/[0.08] p-5">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-amber-400" aria-hidden="true" />
            <h2 className="font-display text-lg font-semibold text-slate-100">
              {t.dailyCompletionChart}
            </h2>
          </div>
          <ProgressBarChart
            series={analytics.series}
            metric="completionPct"
            lang={lang}
          />
        </section>

        <section className="rounded-2xl bg-[#121824] border border-white/[0.08] p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-sky-400" aria-hidden="true" />
            <h2 className="font-display text-lg font-semibold text-slate-100">
              {t.activityTrendsChart}
            </h2>
          </div>
          <MultiActivityChart
            series={analytics.series}
            lang={lang}
            religionEnabled={religionEnabled}
          />
        </section>
      </div>

      {/* Best Days & Areas Needing Improvement */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-2xl bg-[#121824] border border-white/[0.08] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-4 h-4 text-emerald-400" aria-hidden="true" />
            <h2 className="font-display text-lg font-semibold text-slate-100">
              {t.bestDaysTitle}
            </h2>
          </div>
          {analytics.bestDays.length === 0 ? (
            <p className="text-sm text-slate-400">{t.noRecordsYet}</p>
          ) : (
            <div className="space-y-2.5">
              {analytics.bestDays.map((day, idx) => (
                <div
                  key={day.dateKey}
                  className="flex items-center justify-between py-2 border-b border-white/[0.05] last:border-b-0 text-sm"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-tabular text-xs text-slate-400 w-5">
                      {formatDigits(idx + 1, lang)}.
                    </span>
                    <span className="text-slate-200">
                      {formatLocalizedDate(day.dateKey, lang, false)}
                    </span>
                  </div>
                  <div className="font-tabular text-xs sm:text-sm">
                    <span className="text-emerald-400 font-semibold">
                      {formatDigits(day.completionPct, lang)}%
                    </span>
                    <span className="text-slate-500 mx-2">·</span>
                    <span className="text-amber-400">
                      {formatDigits(day.totalXpEarned, lang)} XP
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-[#121824] border border-white/[0.08] p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 text-amber-400" aria-hidden="true" />
            <h2 className="font-display text-lg font-semibold text-slate-100">
              {t.needsImprovementTitle}
            </h2>
          </div>
          <div className="space-y-3">
            {analytics.needsImprovement.map((stat) => (
              <div
                key={stat.activity.id}
                className="py-2 border-b border-white/[0.05] last:border-b-0"
              >
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-slate-200 font-medium">
                    {getLocalizedActivityTitle(stat.activity, lang)}
                  </span>
                  <span className="font-tabular text-amber-400 text-xs">
                    {t.avgPrefix} {formatDigits(stat.avgCompletionPct, lang)}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{ width: `${stat.avgCompletionPct}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1.5">{t.improvementTip}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Activity-wise Complete Statistics Table */}
      <section className="rounded-2xl bg-[#121824] border border-white/[0.08] p-5 overflow-x-auto">
        <h2 className="font-display text-lg font-semibold text-slate-100 mb-4">
          {t.activityBreakdownTitle}
        </h2>
        <table className="w-full text-left border-collapse min-w-[540px]">
          <thead>
            <tr className="border-b border-white/[0.08] text-xs text-slate-400">
              <th className="py-2.5 pr-4 font-medium">{t.colActivity}</th>
              <th className="py-2.5 px-3 font-medium text-right">{t.colTarget}</th>
              <th className="py-2.5 px-3 font-medium text-right">{t.colDaysMet}</th>
              <th className="py-2.5 pl-3 font-medium text-right">{t.colAvgRate}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05] text-sm">
            {analytics.activityStats.map((stat) => (
              <tr key={stat.activity.id} className="hover:bg-white/[0.02]">
                <td className="py-3 pr-4 text-slate-200 font-medium">
                  {getLocalizedActivityTitle(stat.activity, lang)}
                </td>
                <td className="py-3 px-3 text-right font-tabular text-slate-300">
                  {formatDigits(stat.activity.dailyTarget, lang)}{' '}
                  {getLocalizedUnitLabel(stat.activity.unitLabel, lang)}
                </td>
                <td className="py-3 px-3 text-right font-tabular text-slate-300">
                  {formatDigits(stat.daysMetTarget, lang)} /{' '}
                  {formatDigits(stat.totalLoggedDays, lang)} {t.daysUnit}
                </td>
                <td className="py-3 pl-3 text-right font-tabular font-semibold text-emerald-400">
                  {formatDigits(stat.avgCompletionPct, lang)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
};
