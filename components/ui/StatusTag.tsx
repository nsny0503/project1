'use client';

type StatusTagColor = 'green' | 'yellow' | 'red' | 'blue' | 'gray';

interface StatusTagProps {
  label: string;
  color: StatusTagColor;
}

const colorStyles: Record<StatusTagColor, string> = {
  green: 'bg-[#EAFAF4] text-[#00A37A]',
  yellow: 'bg-[#FFF9E6] text-[#D48806]',
  red: 'bg-[#FFF0F0] text-[#E03131]',
  blue: 'bg-[#EFF6FF] text-[#1971C2]',
  gray: 'bg-[#F2F4F6] text-[#6B7684]',
};

export default function StatusTag({ label, color }: StatusTagProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold ${colorStyles[color]}`}
    >
      {label}
    </span>
  );
}
