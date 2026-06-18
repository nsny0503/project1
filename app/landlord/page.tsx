'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Contract } from '@/lib/types';
import ServiceHeader from '@/components/ui/ServiceHeader';
import StatusTag from '@/components/ui/StatusTag';
import { ToastProvider, useToast } from '@/components/ui/Toast';

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function formatDeposit(val: string) {
  const num = Number(val.replace(/[^0-9]/g, ''));
  if (!val || isNaN(num)) return val;
  if (num >= 10000) {
    const uk = Math.floor(num / 10000);
    const rem = num % 10000;
    return rem > 0 ? `${uk}억 ${rem.toLocaleString()}만원` : `${uk}억원`;
  }
  return `${num.toLocaleString()}만원`;
}

function DashboardContent() {
  const router = useRouter();
  const { showToast } = useToast();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchContracts() {
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        showToast('계약 목록을 불러오지 못했습니다.', 'error');
      } else {
        setContracts((data as Contract[]) ?? []);
      }
      setLoading(false);
    }
    fetchContracts();
  }, [showToast]);

  const inProgress = contracts.filter((c) => !c.tt_signed && !c.ll_signed).length;
  const waitingSign = contracts.filter((c) => c.tt_signed && !c.ll_signed).length;
  const completed = contracts.filter((c) => c.tt_signed && c.ll_signed).length;

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      <ServiceHeader role="landlord" />

      {/* Main content */}
      <main className="max-w-[480px] mx-auto px-4 pb-24 pt-4">
        {/* Header row */}
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold text-[#191F28]">내 계약 목록</h1>
          <Link
            href="/landlord/new"
            className="bg-[#3182F6] text-white rounded-xl px-4 py-2 text-sm font-bold"
          >
            + 새 계약
          </Link>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white rounded-2xl border border-[#E8EAED] p-3 text-center">
            <div className="text-2xl font-black text-[#3182F6]">{inProgress}</div>
            <div className="text-xs text-[#8B95A1] mt-0.5">진행 중</div>
          </div>
          <div className="bg-white rounded-2xl border border-[#E8EAED] p-3 text-center">
            <div className="text-2xl font-black text-[#F59E0B]">{waitingSign}</div>
            <div className="text-xs text-[#8B95A1] mt-0.5">서명 대기</div>
          </div>
          <div className="bg-white rounded-2xl border border-[#E8EAED] p-3 text-center">
            <div className="text-2xl font-black text-[#00B493]">{completed}</div>
            <div className="text-xs text-[#8B95A1] mt-0.5">완료</div>
          </div>
        </div>

        {/* Contract list */}
        {loading ? (
          <>
            {[0, 1, 2].map((i) => (
              <div key={i} className="animate-pulse bg-gray-100 rounded-2xl h-24 mb-3" />
            ))}
          </>
        ) : contracts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E8EAED] p-8 text-center">
            <p className="text-sm text-[#8B95A1] mb-4">아직 진행 중인 계약이 없습니다.</p>
            <Link
              href="/landlord/new"
              className="inline-block bg-[#3182F6] text-white rounded-2xl px-6 py-3 text-sm font-bold"
            >
              새 계약 만들기
            </Link>
          </div>
        ) : (
          contracts.map((c) => {
            const tenantName = c.tt_name ?? c.ll_tenant_name ?? '임차인 미정';
            let statusTag: React.ReactNode;
            if (c.ll_signed && c.tt_signed) {
              statusTag = <StatusTag label="완료" color="green" />;
            } else if (c.tt_signed) {
              statusTag = <StatusTag label="서명대기" color="yellow" />;
            } else {
              statusTag = <StatusTag label="진행중" color="blue" />;
            }

            return (
              <div
                key={c.id}
                className="bg-white rounded-2xl border border-[#E8EAED] p-4 mb-3 cursor-pointer active:bg-[#F5F6F8] transition-colors"
                onClick={() => router.push('/landlord/contract/' + c.id)}
              >
                {/* Row 1: address + status */}
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-bold text-[#191F28] flex-1 truncate mr-2">
                    {c.ll_address}
                  </span>
                  {statusTag}
                </div>
                {/* Row 2: tenant name */}
                <div className="text-sm text-[#6B7684] mb-1.5">{tenantName}</div>
                {/* Row 3: deposit + date */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#191F28] font-semibold">
                    보증금 {formatDeposit(c.ll_deposit)}
                  </span>
                  <span className="text-xs text-[#8B95A1]">{formatDate(c.created_at)}</span>
                </div>
              </div>
            );
          })
        )}
      </main>

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E8EAED] z-40">
        <div className="max-w-[480px] mx-auto flex">
          {/* 대시보드 - active */}
          <button className="flex-1 py-3 flex flex-col items-center gap-0.5">
            <span className="text-base leading-none">🏠</span>
            <span className="text-xs font-bold text-[#3182F6]">대시보드</span>
          </button>

          {/* 새 계약 */}
          <Link href="/landlord/new" className="flex-1 py-3 flex flex-col items-center gap-0.5">
            <span className="text-base leading-none">➕</span>
            <span className="text-xs text-[#8B95A1]">새 계약</span>
          </Link>

          {/* 내 정보 */}
          <button
            className="flex-1 py-3 flex flex-col items-center gap-0.5"
            onClick={() => alert('준비 중입니다')}
          >
            <span className="text-base leading-none">👤</span>
            <span className="text-xs text-[#8B95A1]">내 정보</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

export default function LandlordDashboardPage() {
  return (
    <ToastProvider>
      <DashboardContent />
    </ToastProvider>
  );
}
