import React from 'react';
import { BookOpen, Compass, Crown, Flame, Shield, Sparkles } from 'lucide-react';

interface AvatarBadgeProps {
  avatarId?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const AVATAR_CONFIG: Record<
  string,
  {
    icon: React.ComponentType<{ className?: string }>;
    border: string;
    bg: string;
    text: string;
  }
> = {
  crest: {
    icon: Sparkles,
    border: 'border-amber-500/40',
    bg: 'bg-amber-500/15',
    text: 'text-amber-400',
  },
  shield: {
    icon: Shield,
    border: 'border-emerald-500/40',
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
  },
  compass: {
    icon: Compass,
    border: 'border-sky-500/40',
    bg: 'bg-sky-500/15',
    text: 'text-sky-400',
  },
  flame: {
    icon: Flame,
    border: 'border-orange-500/40',
    bg: 'bg-orange-500/15',
    text: 'text-orange-400',
  },
  book: {
    icon: BookOpen,
    border: 'border-indigo-500/40',
    bg: 'bg-indigo-500/15',
    text: 'text-indigo-400',
  },
  crown: {
    icon: Crown,
    border: 'border-yellow-500/40',
    bg: 'bg-yellow-500/15',
    text: 'text-yellow-400',
  },
};

export const AvatarBadge: React.FC<AvatarBadgeProps> = ({
  avatarId = 'crest',
  size = 'md',
  className = '',
}) => {
  const cfg = AVATAR_CONFIG[avatarId] ?? AVATAR_CONFIG.crest;
  const Icon = cfg.icon;

  const boxSize =
    size === 'sm'
      ? 'w-9 h-9 rounded-xl'
      : size === 'lg'
        ? 'w-16 h-16 sm:w-20 sm:h-20 rounded-2xl'
        : 'w-11 h-11 rounded-xl';

  const iconSize =
    size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8 sm:w-9 sm:h-9' : 'w-5 h-5';

  return (
    <div
      className={`${boxSize} ${cfg.bg} ${cfg.border} border flex items-center justify-center shrink-0 ${className}`}
      aria-hidden="true"
    >
      <Icon className={`${iconSize} ${cfg.text}`} />
    </div>
  );
};
