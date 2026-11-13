import React, { useState } from 'react';
import { DailyLog, Language } from '../../types/quest';
import {
  formatDigits,
  formatLocalizedDate,
  formatLocalizedShortDate,
  formatLocalizedShortDay,
  getLastNDaysKeys,
} from '../../utils/dhakaTime';
import { DailySeriesPoint } from '../../utils/gamification';
import { UI_COPY } from '../../utils/i18n';

interface CompletionRingProps {
  percentage: number;
  lang: Language;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

export const CompletionRing: React.FC<CompletionRingProps> = ({
  percentage,
  lang,
  size = 112,
  strokeWidth = 9,
  label,
}) => {
  const t = UI_COPY[lang];
  const clamped = Math.max(0, Math.min(100, Math.round(percentage)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={clamped >= 80 ? '#10B981' : '#F59E0B'}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-300 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-tabular text-2xl font-bold text-slate-100 leading-none">
          {formatDigits(clamped, lang)}%
        </span>
        <span className="text-[11px] text-slate-400 mt-1">
          {label ?? t.dailyProgress}
        </span>
      </div>
    </div>
  );
};

interface ProgressBarChartProps {
  series: DailySeriesPoint[];
  metric: 'completionPct' | 'xpEarned';
  lang: Language;
  height?: number;
}

export const ProgressBarChart: React.FC<ProgressBarChartProps> = ({
  series,
  metric,
  lang,
  height = 190,
}) => {
  const t = UI_COPY[lang];
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const maxVal =
    metric === 'completionPct'
      ? 100
      : Math.max(100, ...series.map((s) => s.xpEarned));

  const activePoint = hoveredIdx !== null ? series[hoveredIdx] : series[series.length - 1];

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
        <span>
          {activePoint ? formatLocalizedDate(activePoint.dateKey, lang, false) : ''}
        </span>
        {activePoint && (
          <span className="font-tabular text-slate-200 font-medium">
            {formatDigits(activePoint.completionPct, lang)}% {t.completedLabel} ·{' '}
            {formatDigits(activePoint.xpEarned, lang)} XP
          </span>
        )}
      </div>

      <div
        className="flex items-end gap-1.5 sm:gap-2 w-full pt-4 border-b border-white/[0.08]"
        style={{ height }}
        role="img"
        aria-label={t.progressChart}
      >
        {series.map((point, idx) => {
          const val = metric === 'completionPct' ? point.completionPct : point.xpEarned;
          const pctHeight = Math.max(4, Math.round((val / maxVal) * 100));
          const isHovered = hoveredIdx === idx;
          const barColor =
            point.completionPct >= 80
              ? 'bg-emerald-500/85 hover:bg-emerald-400'
              : point.completionPct >= 40
                ? 'bg-amber-500/85 hover:bg-amber-400'
                : 'bg-slate-600/70 hover:bg-slate-500';

          return (
            <button
              key={point.dateKey}
              type="button"
              onMouseEnter={() => setHoveredIdx(idx)}
              onFocus={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              aria-label={`${formatLocalizedDate(point.dateKey, lang, false)}: ${formatDigits(
                point.completionPct,
                lang
              )}%, ${formatDigits(point.xpEarned, lang)} XP`}
              className="flex-1 h-full flex flex-col justify-end items-center group focus:outline-none"
            >
              <div
                className={`w-full max-w-[28px] rounded-t-md transition-all duration-150 ${barColor} ${
                  isHovered ? 'ring-2 ring-amber-400/50' : ''
                }`}
                style={{ height: `${pctHeight}%` }}
              />
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-1 mt-2 text-[11px] text-slate-400 font-tabular">
        {series.length <= 10 ? (
          series.map((point) => (
            <span key={point.dateKey} className="flex-1 text-center truncate">
              {formatLocalizedShortDay(point.dateKey, lang)}
            </span>
          ))
        ) : (
          <>
            <span>{formatLocalizedShortDate(series[0]?.dateKey || '', lang)}</span>
            <span>
              {formatLocalizedShortDate(
                series[Math.floor(series.length / 2)]?.dateKey || '',
                lang
              )}
            </span>
            <span>
              {formatLocalizedShortDate(series[series.length - 1]?.dateKey || '', lang)}
            </span>
          </>
        )}
      </div>
    </div>
  );
};

interface MultiActivityChartProps {
  series: DailySeriesPoint[];
  lang: Language;
  religionEnabled?: boolean;
}

export const MultiActivityChart: React.FC<MultiActivityChartProps> = ({
  series,
  lang,
  religionEnabled = true,
}) => {
  const t = UI_COPY[lang];
  const [selectedMetric, setSelectedMetric] = useState<
    'prayerCount' | 'studyMinutes' | 'exerciseMinutes' | 'quranMinutes' | 'wastedMinutes'
  >('studyMinutes');

  const safeMetric =
    !religionEnabled && (selectedMetric === 'prayerCount' || selectedMetric === 'quranMinutes')
      ? 'studyMinutes'
      : selectedMetric;

  const metricConfig = {
    studyMinutes: {
      label: `${t.studyTab} (${t.minutesUnit})`,
      color: '#38BDF8',
      max: Math.max(120, ...series.map((s) => s.studyMinutes)),
      getValue: (s: DailySeriesPoint) => s.studyMinutes,
      unit: t.minutesUnit,
    },
    exerciseMinutes: {
      label: `${t.exerciseTab} (${t.minutesUnit})`,
      color: '#10B981',
      max: Math.max(45, ...series.map((s) => s.exerciseMinutes)),
      getValue: (s: DailySeriesPoint) => s.exerciseMinutes,
      unit: t.minutesUnit,
    },
    prayerCount: {
      label: t.prayerConsistency,
      color: '#F59E0B',
      max: 5,
      getValue: (s: DailySeriesPoint) => s.prayerCount,
      unit: lang === 'en' ? 'waqt' : 'ওয়াক্ত',
    },
    quranMinutes: {
      label: `${t.quranTab} (${t.minutesUnit})`,
      color: '#A78BFA',
      max: Math.max(30, ...series.map((s) => s.quranMinutes)),
      getValue: (s: DailySeriesPoint) => s.quranMinutes,
      unit: t.minutesUnit,
    },
    wastedMinutes: {
      label: `${t.wastedTimeTab} (${t.minutesUnit})`,
      color: '#FB7185',
      max: Math.max(60, ...series.map((s) => s.wastedMinutes)),
      getValue: (s: DailySeriesPoint) => s.wastedMinutes,
      unit: t.minutesUnit,
    },
  };

  const current = metricConfig[safeMetric];
  const svgW = 600;
  const svgH = 170;
  const padX = 16;
  const padY = 18;
  const usableW = svgW - padX * 2;
  const usableH = svgH - padY * 2;

  const points = series.map((s, idx) => {
    const x =
      series.length <= 1
        ? padX + usableW / 2
        : padX + (idx / (series.length - 1)) * usableW;
    const val = current.getValue(s);
    const y = padY + usableH - (val / current.max) * usableH;
    return { x, y, val, dateKey: s.dateKey };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');
  const areaPoints =
    points.length > 0
      ? `${points[0].x},${padY + usableH} ${polylinePoints} ${points[points.length - 1].x},${padY + usableH}`
      : '';

  const visibleTabs = (
    [
      ['studyMinutes', t.studyTab],
      ['exerciseMinutes', t.exerciseTab],
      ...(religionEnabled
        ? ([
            ['prayerCount', t.prayerTab],
            ['quranMinutes', t.quranTab],
          ] as const)
        : []),
      ['wastedMinutes', t.wastedTimeTab],
    ] as const
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        {visibleTabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSelectedMetric(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              safeMetric === key
                ? 'bg-amber-500 text-slate-950'
                : 'bg-[#1A2233] text-slate-300 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="w-full h-44"
          role="img"
          aria-label={current.label}
        >
          <defs>
            <linearGradient id={`grad-${selectedMetric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={current.color} stopOpacity="0.32" />
              <stop offset="100%" stopColor={current.color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75, 1].map((frac) => {
            const y = padY + usableH * (1 - frac);
            return (
              <line
                key={frac}
                x1={padX}
                y1={y}
                x2={svgW - padX}
                y2={y}
                stroke="rgba(255,255,255,0.06)"
                strokeDasharray="4 4"
              />
            );
          })}
          {areaPoints && (
            <polygon points={areaPoints} fill={`url(#grad-${selectedMetric})`} />
          )}
          {polylinePoints && (
            <polyline
              fill="none"
              stroke={current.color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={polylinePoints}
            />
          )}
          {points.map((pt) => (
            <circle
              key={pt.dateKey}
              cx={pt.x}
              cy={pt.y}
              r={series.length <= 14 ? 4 : 2.5}
              fill={current.color}
            >
              <title>
                {`${formatLocalizedDate(pt.dateKey, lang, false)}: ${formatDigits(
                  pt.val,
                  lang
                )} ${current.unit}`}
              </title>
            </circle>
          ))}
        </svg>
      </div>

      <div className="flex items-center justify-between gap-1 mt-1 mb-2 text-[11px] text-slate-400 font-tabular border-t border-white/[0.06] pt-2">
        {series.length <= 10 ? (
          series.map((point) => (
            <span key={point.dateKey} className="flex-1 text-center truncate">
              {formatLocalizedShortDay(point.dateKey, lang)}
            </span>
          ))
        ) : (
          <>
            <span>{formatLocalizedShortDate(series[0]?.dateKey || '', lang)}</span>
            <span>
              {formatLocalizedShortDate(
                series[Math.floor(series.length / 2)]?.dateKey || '',
                lang
              )}
            </span>
            <span>
              {formatLocalizedShortDate(series[series.length - 1]?.dateKey || '', lang)}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{current.label}</span>
        <span className="font-tabular">
          {t.maxLabel}{' '}
          {formatDigits(Math.max(0, ...series.map(current.getValue)), lang)}{' '}
          {current.unit}
        </span>
      </div>
    </div>
  );
};

interface HeatmapProps {
  dailyLogs: Record<string, DailyLog>;
  todayKey: string;
  lang: Language;
  weeks?: number;
  selectedDateKey?: string;
  onSelectDate?: (dateKey: string) => void;
}

export const ActivityHeatmap: React.FC<HeatmapProps> = ({
  dailyLogs,
  todayKey,
  lang,
  weeks = 12,
  selectedDateKey,
  onSelectDate,
}) => {
  const t = UI_COPY[lang];
  const totalDays = weeks * 7;
  const keys = getLastNDaysKeys(todayKey, totalDays);

  const getIntensityClass = (pct: number | undefined) => {
    if (pct === undefined || pct === 0) return 'bg-slate-800/70 border-white/[0.04]';
    if (pct < 35) return 'bg-amber-900/50 border-amber-700/30';
    if (pct < 65) return 'bg-amber-600/60 border-amber-500/40';
    if (pct < 85) return 'bg-emerald-600/75 border-emerald-400/40';
    return 'bg-emerald-400 border-emerald-300/60';
  };

  return (
    <div>
      <div className="grid grid-flow-col grid-rows-7 gap-1.5 overflow-x-auto pb-2">
        {keys.map((dateKey) => {
          const log = dailyLogs[dateKey];
          const pct = log?.completionPct;
          const isSelected = selectedDateKey === dateKey;
          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onSelectDate?.(dateKey)}
              title={`${formatLocalizedDate(dateKey, lang, false)} · ${formatDigits(
                pct ?? 0,
                lang
              )}% ${t.completedLabel}`}
              aria-label={`${formatLocalizedDate(dateKey, lang, false)} (${formatDigits(
                pct ?? 0,
                lang
              )}%)`}
              className={`w-4 h-4 sm:w-5 sm:h-5 rounded-[4px] border transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${getIntensityClass(
                pct
              )} ${isSelected ? 'ring-2 ring-amber-400' : ''}`}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
        <span>
          {lang === 'bn'
            ? `গত ${formatDigits(weeks, lang)} সপ্তাহের ধারাবাহিকতা`
            : t.heatmapWeeksLabel(weeks)}
        </span>
        <div className="flex items-center gap-1.5">
          <span>{t.lessLabel}</span>
          <span className="w-3 h-3 rounded-[3px] bg-slate-800/70 inline-block" />
          <span className="w-3 h-3 rounded-[3px] bg-amber-900/50 inline-block" />
          <span className="w-3 h-3 rounded-[3px] bg-amber-600/60 inline-block" />
          <span className="w-3 h-3 rounded-[3px] bg-emerald-600/75 inline-block" />
          <span className="w-3 h-3 rounded-[3px] bg-emerald-400 inline-block" />
          <span>{t.moreHeatmapLabel}</span>
        </div>
      </div>
    </div>
  );
};
