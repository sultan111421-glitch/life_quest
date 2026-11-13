import React, { useEffect, useState } from 'react';
import { Bell, Check, Minus, Pause, Play, Plus, RotateCcw, Timer } from 'lucide-react';
import {
  ActivityDefinition,
  ActivityEntry,
  CustomCategoryDef,
  DailyLog,
  Language,
  PrayerKey,
} from '../types/quest';
import { formatDigits } from '../utils/dhakaTime';
import {
  calculateActivityPeriodProgress,
  calculateActivityProgress,
} from '../utils/gamification';
import {
  getLocalizedActivityTitle,
  getLocalizedCategoryLabel,
  getLocalizedUnitLabel,
  PRAYER_LABELS,
  UI_COPY,
} from '../utils/i18n';

interface QuestCardProps {
  activity: ActivityDefinition;
  entry?: ActivityEntry;
  lang: Language;
  onChange: (nextEntry: ActivityEntry) => void;
  compact?: boolean;
  customCategories?: CustomCategoryDef[];
  dailyLogs?: Record<string, DailyLog>;
  todayKey?: string;
  onTimerLogged?: () => void;
}

export const QuestCard: React.FC<QuestCardProps> = ({
  activity,
  entry,
  lang,
  onChange,
  compact = false,
  customCategories = [],
  dailyLogs,
  todayKey,
  onTimerLogged,
}) => {
  const t = UI_COPY[lang];
  const progress = calculateActivityProgress(activity, entry, lang);
  const pct = Math.round(progress.ratio * 100);
  const localizedTitle = getLocalizedActivityTitle(activity, lang);
  const localizedUnit = getLocalizedUnitLabel(activity.unitLabel, lang);
  const localizedCategory = getLocalizedCategoryLabel(
    activity.category,
    lang,
    customCategories
  );

  // Built-in interactive timer for duration ('time') activities
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [timerRunning]);

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  const handleLogTimerMinutes = () => {
    const addedMins = Math.max(1, Math.round(elapsedSeconds / 60));
    const currentTotal =
      Math.max(0, Number(entry?.hours ?? 0)) * 60 +
      Math.max(0, Number(entry?.minutes ?? 0));
    const nextTotal = Math.min(24 * 60 + 59, currentTotal + addedMins);
    onChange({
      ...entry,
      hours: Math.floor(nextTotal / 60),
      minutes: nextTotal % 60,
    });
    setTimerRunning(false);
    setElapsedSeconds(0);
    onTimerLogged?.();
  };

  const handleTogglePrayer = (key: PrayerKey) => {
    const current = entry?.prayers ?? {
      fajr: false,
      dhuhr: false,
      asr: false,
      maghrib: false,
      isha: false,
    };
    onChange({
      ...entry,
      prayers: {
        ...current,
        [key]: !current[key],
      },
    });
  };

  const handleNumberStep = (delta: number) => {
    const curr = Math.max(0, Number(entry?.value ?? 0));
    const isHourUnit = activity.unitLabel === 'ঘণ্টা' || activity.unitLabel === 'hrs';
    const isGlassUnit = activity.unitLabel === 'গ্লাস' || activity.unitLabel === 'glasses';
    const step = isHourUnit ? 0.5 : isGlassUnit ? 1 : 5;
    const next = Math.max(0, Math.round((curr + delta * step) * 10) / 10);
    onChange({
      ...entry,
      value: next,
    });
  };

  const periodWeekly =
    !compact && dailyLogs && todayKey
      ? calculateActivityPeriodProgress(activity, dailyLogs, todayKey, 7)
      : null;

  return (
    <div
      className={`rounded-2xl border transition-colors p-4 sm:p-5 ${
        progress.completed
          ? 'bg-[#131D2B] border-emerald-500/35'
          : 'bg-[#121824] border-white/[0.07] hover:border-white/[0.14]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400 mb-1">
            <span>{localizedCategory}</span>
            <span aria-hidden="true">·</span>
            <span className="font-tabular text-amber-400/90">
              +{formatDigits(progress.earnedXp, lang)} /{' '}
              {formatDigits(activity.xpReward, lang)} XP
            </span>
            {activity.priority === 'high' && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-rose-300 font-medium">{t.priorities.high}</span>
              </>
            )}
            {activity.reminderEnabled && activity.reminderTime && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-sky-300 font-tabular">
                  <Bell className="w-3 h-3" aria-hidden="true" />
                  {activity.reminderTime}
                </span>
              </>
            )}
          </div>
          <h3 className="font-display text-base sm:text-lg font-semibold text-slate-100 leading-snug">
            {localizedTitle}
          </h3>
        </div>

        <div className="text-right shrink-0">
          <span
            className={`font-tabular text-xs font-semibold ${
              progress.completed ? 'text-emerald-400' : 'text-slate-300'
            }`}
          >
            {progress.completed ? t.completedLabel : `${formatDigits(pct, lang)}%`}
          </span>
        </div>
      </div>

      {/* Slim progress bar */}
      <div className="mt-3 h-1.5 w-full rounded-full bg-slate-800/90 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-200 ${
            progress.completed ? 'bg-emerald-400' : 'bg-amber-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {periodWeekly && (
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400 font-tabular">
          <span>
            {t.weeklyProgressShort}: {formatDigits(periodWeekly.accumulated, lang)} /{' '}
            {formatDigits(periodWeekly.target, lang)} {localizedUnit}
          </span>
          <span>{formatDigits(periodWeekly.pct, lang)}%</span>
        </div>
      )}

      {/* Interactive Controls by Input Type */}
      <div className="mt-4">
        {activity.inputType === 'prayer' && (
          <div>
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {PRAYER_LABELS[lang].map(({ key, label }) => {
                const checked = Boolean(entry?.prayers?.[key]);
                return (
                  <button
                    key={key}
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    aria-label={`${localizedTitle} - ${label}`}
                    onClick={() => handleTogglePrayer(key)}
                    className={`min-h-[44px] px-1.5 py-2 rounded-xl border text-xs sm:text-sm font-medium flex flex-col items-center justify-center gap-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                      checked
                        ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                        : 'bg-[#1A2233] border-white/[0.06] text-slate-300 hover:border-white/20'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-md flex items-center justify-center border ${
                        checked
                          ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                          : 'border-slate-500'
                      }`}
                    >
                      {checked && <Check className="w-3 h-3 stroke-[3]" />}
                    </span>
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </div>
            {!compact && (
              <p className="mt-2.5 text-[11px] text-slate-400">
                {t.prayerPrivacyHint}
              </p>
            )}
          </div>
        )}

        {activity.inputType === 'checkbox' && (
          <button
            type="button"
            role="checkbox"
            aria-checked={Boolean(entry?.completed)}
            aria-label={`${localizedTitle} - ${t.markDoneLabel}`}
            onClick={() =>
              onChange({ ...entry, completed: !Boolean(entry?.completed) })
            }
            className={`w-full min-h-[44px] px-4 py-2.5 rounded-xl border flex items-center justify-between text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
              entry?.completed
                ? 'bg-emerald-500/15 border-emerald-500/45 text-emerald-300'
                : 'bg-[#1A2233] border-white/[0.07] text-slate-200 hover:border-white/20'
            }`}
          >
            <span>{entry?.completed ? t.doneTodayLabel : t.markDoneLabel}</span>
            <span
              className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                entry?.completed
                  ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                  : 'border-slate-500'
              }`}
            >
              {entry?.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </span>
          </button>
        )}

        {activity.inputType === 'number' && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={`${localizedTitle} ${t.decreaseAria}`}
                onClick={() => handleNumberStep(-1)}
                className="min-w-[44px] min-h-[44px] rounded-xl bg-[#1A2233] border border-white/[0.07] hover:border-white/20 flex items-center justify-center text-slate-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <Minus className="w-4 h-4" />
              </button>
              <input
                type="number"
                min={0}
                step={
                  activity.unitLabel === 'ঘণ্টা' || activity.unitLabel === 'hrs'
                    ? '0.5'
                    : '1'
                }
                aria-label={`${localizedTitle} (${localizedUnit})`}
                value={entry?.value ?? ''}
                placeholder={formatDigits(0, lang)}
                onChange={(e) => {
                  const raw = e.target.value;
                  onChange({
                    ...entry,
                    value: raw === '' ? 0 : Math.max(0, Number(raw)),
                  });
                }}
                className="w-16 min-h-[44px] px-2 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-center font-tabular text-sm text-slate-100 focus:outline-none focus:border-amber-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                type="button"
                aria-label={`${localizedTitle} ${t.increaseAria}`}
                onClick={() => handleNumberStep(1)}
                className="min-w-[44px] min-h-[44px] rounded-xl bg-[#1A2233] border border-white/[0.07] hover:border-white/20 flex items-center justify-center text-slate-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <span className="text-xs text-slate-400 font-tabular shrink-0">
              {t.targetLabel} {formatDigits(activity.dailyTarget, lang)} {localizedUnit}
            </span>
          </div>
        )}

        {activity.inputType === 'time' && (
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-slate-300">
                  <input
                    type="number"
                    min={0}
                    max={24}
                    aria-label={`${localizedTitle} ${t.hoursUnit}`}
                    value={entry?.hours ?? ''}
                    placeholder={formatDigits(0, lang)}
                    onChange={(e) =>
                      onChange({
                        ...entry,
                        hours:
                          e.target.value === ''
                            ? 0
                            : Math.max(0, Math.min(24, Number(e.target.value))),
                      })
                    }
                    className="w-16 min-h-[44px] px-2 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-center font-tabular text-sm text-slate-100 focus:outline-none focus:border-amber-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span>{t.hoursUnit}</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-300">
                  <input
                    type="number"
                    min={0}
                    max={59}
                    aria-label={`${localizedTitle} ${t.minutesUnit}`}
                    value={entry?.minutes ?? ''}
                    placeholder={formatDigits(0, lang)}
                    onChange={(e) =>
                      onChange({
                        ...entry,
                        minutes:
                          e.target.value === ''
                            ? 0
                            : Math.max(0, Math.min(59, Number(e.target.value))),
                      })
                    }
                    className="w-16 min-h-[44px] px-2 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-center font-tabular text-sm text-slate-100 focus:outline-none focus:border-amber-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span>{t.minutesUnit}</span>
                </label>
              </div>
              <span className="text-xs text-slate-400 font-tabular">
                {t.targetLabel} {formatDigits(activity.dailyTarget, lang)} {t.minutesUnit}
              </span>
            </div>

            {!compact && (
              <div className="pt-2 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-300 font-tabular">
                  <Timer className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
                  <span>{formatTimer(elapsedSeconds)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setTimerRunning((r) => !r)}
                    className="min-h-[34px] px-2.5 rounded-lg bg-[#1A2233] border border-white/[0.08] hover:border-amber-400/40 text-xs font-medium text-slate-200 inline-flex items-center gap-1 whitespace-nowrap"
                  >
                    {timerRunning ? (
                      <>
                        <Pause className="w-3 h-3 text-amber-400" aria-hidden="true" />
                        <span>{t.timerPause}</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                        <span>{t.timerStart}</span>
                      </>
                    )}
                  </button>
                  {elapsedSeconds > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={handleLogTimerMinutes}
                        className="min-h-[34px] px-2.5 rounded-lg bg-emerald-500 text-slate-950 text-xs font-bold whitespace-nowrap"
                      >
                        {t.timerLogBtn}
                      </button>
                      <button
                        type="button"
                        aria-label={t.timerReset}
                        onClick={() => {
                          setTimerRunning(false);
                          setElapsedSeconds(0);
                        }}
                        className="min-h-[34px] min-w-[34px] rounded-lg bg-[#1A2233] text-slate-400 hover:text-white flex items-center justify-center"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activity.inputType === 'text' && (
          <div>
            <input
              type="text"
              maxLength={240}
              aria-label={localizedTitle}
              value={entry?.textValue ?? ''}
              placeholder={t.textPlaceholder}
              onChange={(e) =>
                onChange({
                  ...entry,
                  textValue: e.target.value,
                })
              }
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#0B0F17] border border-white/[0.1] text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>
        )}
      </div>
    </div>
  );
};

