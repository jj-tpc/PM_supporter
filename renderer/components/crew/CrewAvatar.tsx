import { memo } from 'react';

interface Props {
  name: string;
  size?: 'sm' | 'md';
}

export const CrewAvatar = memo(function CrewAvatar({ name, size = 'sm' }: Props) {
  const initial = name.charAt(0).toUpperCase();
  const sizeClass = size === 'sm' ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm';
  const hue = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-medium text-white shrink-0`}
      style={{ backgroundColor: `oklch(0.6 0.15 ${hue})` }}
      title={name}
    >
      {initial}
    </div>
  );
});
