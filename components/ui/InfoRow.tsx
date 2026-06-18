'use client';

interface InfoRowProps {
  label: string;
  value: string;
  valueClass?: string;
  noBorder?: boolean;
}

export default function InfoRow({ label, value, valueClass, noBorder }: InfoRowProps) {
  return (
    <div
      className={`flex justify-between items-center py-3 ${noBorder ? '' : 'border-b border-[#F2F4F6]'}`}
    >
      <span className="text-sm text-[#6B7684]">{label}</span>
      <span className={`text-sm font-semibold text-[#191F28] text-right ${valueClass ?? ''}`}>
        {value}
      </span>
    </div>
  );
}
