'use client';

import StatusTag from './StatusTag';

interface ServiceHeaderProps {
  role: 'landlord' | 'tenant';
  contractId?: string;
  onBack?: () => void;
}

export default function ServiceHeader({ role, contractId, onBack }: ServiceHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#E8EAED]">
      <div className="max-w-[480px] mx-auto flex items-center justify-between px-4 h-14">
        {/* Left: back button or spacer */}
        <div className="w-9 flex items-center">
          {onBack ? (
            <button
              onClick={onBack}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-[#F2F4F6] text-[#6B7684]"
              aria-label="뒤로 가기"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          ) : null}
        </div>

        {/* Center: logo + title */}
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-[#3182F6] flex items-center justify-center">
            <span className="text-white font-bold text-sm">I</span>
          </div>
          <span className="font-bold text-[#191F28] ml-2">Insure!</span>
        </div>

        {/* Right: role badge + contract id */}
        <div className="flex items-center gap-1.5">
          {role === 'landlord' ? (
            <StatusTag label="집주인" color="green" />
          ) : (
            <StatusTag label="임차인" color="blue" />
          )}
          {contractId && (
            <span className="text-xs text-[#8B95A1] ml-2">#{contractId.slice(0, 8)}</span>
          )}
        </div>
      </div>
    </header>
  );
}
