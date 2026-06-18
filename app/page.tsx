'use client';

import Link from 'next/link';
import StatusTag from '@/components/ui/StatusTag';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F5F6F8] flex flex-col items-center justify-center p-6">
      <div className="max-w-[480px] w-full">

        {/* Logo Section */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#3182F6]">
            <span className="text-2xl font-black text-white">I</span>
          </div>
          <h1 className="text-3xl font-black text-[#191F28] mt-3">Insure!</h1>
          <p className="text-sm text-[#8B95A1]">외국인과 집주인이 함께 작성하는</p>
          <p className="text-sm text-[#8B95A1]">안전한 주거 계약 서비스</p>
        </div>

        {/* Role Selection */}
        <div className="flex flex-col gap-4 w-full">

          {/* Card 1 - Tenant */}
          <Link href="/contract/demo">
            <div className="cursor-pointer border-2 border-transparent hover:border-[#3182F6] hover:shadow-md transition-all rounded-2xl p-5 bg-white">
              <div className="flex justify-between items-start">
                <StatusTag label="임차인 (외국인)" color="blue" />
                <span className="text-2xl">🌏</span>
              </div>
              <h2 className="text-lg font-extrabold text-[#191F28] mt-3">외국인 임차인 화면</h2>
              <p className="text-sm text-[#6B7684] mt-1">
                계약 조건 확인, 특약 AI 분석, 전자서명까지 단계별로 안내받으세요.
              </p>
              <div className="flex justify-end mt-3">
                <span className="text-sm text-[#3182F6] font-semibold">시작하기 →</span>
              </div>
            </div>
          </Link>

          {/* Card 2 - Landlord */}
          <Link href="/landlord">
            <div className="cursor-pointer border-2 border-transparent hover:border-[#00B493] hover:shadow-md transition-all rounded-2xl p-5 bg-white">
              <div className="flex justify-between items-start">
                <StatusTag label="집주인 (임대인)" color="green" />
                <span className="text-2xl">🏠</span>
              </div>
              <h2 className="text-lg font-extrabold text-[#191F28] mt-3">집주인 화면</h2>
              <p className="text-sm text-[#6B7684] mt-1">
                매물 등록, 특약 입력, 임차인 초대 링크 생성 및 계약 진행 현황을 관리하세요.
              </p>
              <div className="flex justify-end mt-3">
                <span className="text-sm text-[#00B493] font-semibold">시작하기 →</span>
              </div>
            </div>
          </Link>

        </div>

        {/* Footer */}
        <div className="mt-10 text-center text-xs text-[#8B95A1]">
          © 2024 Insure! — AI 기반 안전 임대차 계약
        </div>

      </div>
    </div>
  );
}
