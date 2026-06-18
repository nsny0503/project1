'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ServiceHeader from '@/components/ui/ServiceHeader';
import { supabase } from '@/lib/supabase';

/* ────────────────────────────────────────────────────────── */
/* Types                                                      */
/* ────────────────────────────────────────────────────────── */

interface Clause {
  text: string;
  risk: 'danger' | 'warn' | 'safe';
  explanation: string;
  suggestedAlternative?: string;
}

interface FormData {
  // Step 1
  ll_name: string;
  ll_id_num: string;
  ll_phone: string;
  ll_reg_no: string;
  ll_address: string;
  ll_address_detail: string;
  ll_housing_type: string;
  ll_area: string;
  ll_floor: string;
  ll_total_floor: string;
  contract_type: 'A' | 'B' | 'C';
  // Step 2
  ll_deposit: string;
  ll_monthly_rent: string;
  ll_mgmt_fee: string;
  ll_mgmt_includes: string[];
  ll_start_date: string;
  ll_end_date: string;
  ll_payment_day: string;
  // Step 4 (tenant info)
  ll_tenant_name: string;
  ll_tenant_phone: string;
}

const defaultFormData: FormData = {
  ll_name: '',
  ll_id_num: '',
  ll_phone: '',
  ll_reg_no: '',
  ll_address: '',
  ll_address_detail: '',
  ll_housing_type: '원룸',
  ll_area: '',
  ll_floor: '',
  ll_total_floor: '',
  contract_type: 'A',
  ll_deposit: '',
  ll_monthly_rent: '',
  ll_mgmt_fee: '',
  ll_mgmt_includes: [],
  ll_start_date: '',
  ll_end_date: '',
  ll_payment_day: '매월 1일',
  ll_tenant_name: '',
  ll_tenant_phone: '',
};

/* ────────────────────────────────────────────────────────── */
/* Component                                                  */
/* ────────────────────────────────────────────────────────── */

export default function LandlordNewPage() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [newClauseText, setNewClauseText] = useState('');
  const [analyzingClause, setAnalyzingClause] = useState(false);
  const [clausePreview, setClausePreview] = useState<{
    risk: 'danger' | 'warn' | 'safe';
    explanation: string;
    suggestedAlternative?: string;
  } | null>(null);
  const [contractId, setContractId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  /* helpers */
  const setField = (key: keyof FormData, value: string) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const toggleMgmtInclude = (item: string) => {
    setFormData((prev) => {
      const list = prev.ll_mgmt_includes;
      return {
        ...prev,
        ll_mgmt_includes: list.includes(item)
          ? list.filter((i) => i !== item)
          : [...list, item],
      };
    });
  };

  /* AI clause analysis */
  const analyzeClause = async () => {
    if (!newClauseText.trim()) return;
    setAnalyzingClause(true);
    try {
      const res = await fetch('/api/clauses/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clause: newClauseText }),
      });
      if (!res.ok) throw new Error('분석 실패');
      const result = await res.json();
      setClausePreview(result);
    } catch {
      alert('분석 중 오류가 발생했습니다.');
    } finally {
      setAnalyzingClause(false);
    }
  };

  const addClause = () => {
    if (!clausePreview) return;
    setClauses((prev) => [
      ...prev,
      { text: newClauseText, ...clausePreview },
    ]);
    setNewClauseText('');
    setClausePreview(null);
  };

  const removeClause = (index: number) => {
    setClauses((prev) => prev.filter((_, i) => i !== index));
  };

  /* Step 4: save to Supabase */
  const handleStep4 = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, clauses }),
      });
      if (!res.ok) throw new Error('저장 실패');
      const result = await res.json();
      setContractId(result.id);
      setStep(4);
    } catch {
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  /* Link copy */
  const copyLink = async () => {
    if (!contractId) return;
    const url = `${window.location.origin}/contract/${contractId}`;
    await navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  /* Patch helper for step 4 settings */
  const patchContract = async (payload: Record<string, string>) => {
    if (!contractId) return;
    await fetch(`/api/contracts/${contractId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  };

  /* ── Step labels ── */
  const steps = ['① 매물 정보', '② 금액 조건', '③ 특약조항', '④ 초대 링크'];

  /* ── Shared input className ── */
  const inputCls =
    'border border-[#E8EAED] rounded-xl px-4 py-3.5 w-full text-[#191F28] text-sm focus:border-[#3182F6] outline-none bg-white';
  const labelCls = 'block text-sm font-semibold text-[#191F28] mb-1.5';

  /* ──────────────────────────────────────────────────────── */
  /* Render                                                   */
  /* ──────────────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      <ServiceHeader
        role="landlord"
        onBack={() => (step > 1 ? setStep(step - 1) : router.push('/landlord'))}
      />

      {/* Step indicator */}
      <div className="sticky top-14 z-40 bg-[#F5F6F8] border-b border-[#E8EAED] px-4 py-3">
        <div className="max-w-[480px] mx-auto flex gap-2 overflow-x-auto scrollbar-hide">
          {steps.map((label, i) => {
            const idx = i + 1;
            const isDone = idx < step;
            const isActive = idx === step;
            const baseChip =
              'text-xs font-bold rounded-full px-3.5 py-1.5 whitespace-nowrap';
            const chipCls = isActive
              ? `bg-[#3182F6] text-white ${baseChip}`
              : isDone
              ? `bg-[#EAFAF4] text-[#00A37A] ${baseChip}`
              : `bg-[#F2F4F6] text-[#8B95A1] ${baseChip}`;
            return (
              <span key={label} className={chipCls}>
                {label}
              </span>
            );
          })}
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-[480px] mx-auto px-4 pt-4 pb-32">

        {/* ───── STEP 1 ───── */}
        {step === 1 && (
          <>
            <h1 className="text-lg font-bold text-[#191F28] mb-1">집주인 · 매물 정보 입력</h1>
            <p className="text-sm text-[#8B95A1] mb-4">계약서에 등록될 정보입니다.</p>

            {/* 집주인 본인 정보 */}
            <div className="bg-white rounded-2xl border border-[#E8EAED] p-4 mb-4">
              <p className="text-sm font-bold text-[#191F28] mb-3">집주인 본인 정보</p>
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>성명</label>
                  <input
                    className={inputCls}
                    value={formData.ll_name}
                    onChange={(e) => setField('ll_name', e.target.value)}
                    placeholder="홍길동"
                  />
                </div>
                <div>
                  <label className={labelCls}>주민등록번호</label>
                  <input
                    className={inputCls}
                    value={formData.ll_id_num}
                    onChange={(e) => setField('ll_id_num', e.target.value)}
                    placeholder="000000-0000000"
                  />
                </div>
                <div>
                  <label className={labelCls}>전화번호</label>
                  <input
                    className={inputCls}
                    type="tel"
                    value={formData.ll_phone}
                    onChange={(e) => setField('ll_phone', e.target.value)}
                    placeholder="010-0000-0000"
                  />
                </div>
                <div>
                  <label className={labelCls}>임대사업자 등록번호</label>
                  <input
                    className={inputCls}
                    value={formData.ll_reg_no}
                    onChange={(e) => setField('ll_reg_no', e.target.value)}
                    placeholder="없으면 공란"
                  />
                </div>
              </div>
            </div>

            {/* 매물 정보 */}
            <div className="bg-white rounded-2xl border border-[#E8EAED] p-4 mb-4">
              <p className="text-sm font-bold text-[#191F28] mb-3">매물 정보</p>
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>도로명 주소</label>
                  <input
                    className={inputCls}
                    value={formData.ll_address}
                    onChange={(e) => setField('ll_address', e.target.value)}
                    placeholder="서울특별시 마포구 ..."
                  />
                </div>
                <div>
                  <label className={labelCls}>상세 주소</label>
                  <input
                    className={inputCls}
                    value={formData.ll_address_detail}
                    onChange={(e) => setField('ll_address_detail', e.target.value)}
                    placeholder="302호"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>주택 유형</label>
                    <select
                      className={inputCls}
                      value={formData.ll_housing_type}
                      onChange={(e) => setField('ll_housing_type', e.target.value)}
                    >
                      {['원룸','투룸','오피스텔','아파트','빌라','연립주택','다세대주택','다가구주택'].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>전용면적</label>
                    <input
                      className={inputCls}
                      value={formData.ll_area}
                      onChange={(e) => setField('ll_area', e.target.value)}
                      placeholder="33㎡"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>해당 층</label>
                    <input
                      className={inputCls}
                      type="number"
                      value={formData.ll_floor}
                      onChange={(e) => setField('ll_floor', e.target.value)}
                      placeholder="3"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>건물 전체 층</label>
                    <input
                      className={inputCls}
                      type="number"
                      value={formData.ll_total_floor}
                      onChange={(e) => setField('ll_total_floor', e.target.value)}
                      placeholder="5"
                    />
                  </div>
                </div>

                {/* 계약 유형 토글 */}
                <div>
                  <label className={labelCls}>계약 유형</label>
                  <div className="flex gap-2">
                    {[{ label: '월세', val: 'A' }, { label: '전세', val: 'B' }, { label: '단기', val: 'C' }].map(
                      ({ label, val }) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setField('contract_type', val)}
                          className={
                            formData.contract_type === val
                              ? 'border-2 border-[#3182F6] bg-[#EFF6FF] text-[#1971C2] font-bold text-sm rounded-xl py-2 flex-1 text-center'
                              : 'border border-[#E8EAED] bg-white text-[#8B95A1] text-sm rounded-xl py-2 flex-1 text-center'
                          }
                        >
                          {label}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ───── STEP 2 ───── */}
        {step === 2 && (
          <>
            <h1 className="text-lg font-bold text-[#191F28] mb-1">금액 조건 입력</h1>
            <p className="text-sm text-[#8B95A1] mb-4">정확하게 입력하세요. 계약서에 그대로 반영됩니다.</p>

            <div className="bg-white rounded-2xl border border-[#E8EAED] p-4 mb-4">
              <div className="space-y-4">
                {/* 보증금 */}
                <div>
                  <label className={labelCls}>보증금</label>
                  <div className="flex items-center gap-2">
                    <input
                      className={inputCls}
                      type="text"
                      value={formData.ll_deposit}
                      onChange={(e) => setField('ll_deposit', e.target.value)}
                      placeholder="50,000,000"
                    />
                    <span className="text-sm text-[#6B7684] whitespace-nowrap">원</span>
                  </div>
                </div>

                {/* 월세 (전세 제외) */}
                {formData.contract_type !== 'B' && (
                  <div>
                    <label className={labelCls}>월세</label>
                    <div className="flex items-center gap-2">
                      <input
                        className={inputCls}
                        type="text"
                        value={formData.ll_monthly_rent}
                        onChange={(e) => setField('ll_monthly_rent', e.target.value)}
                        placeholder="500,000"
                      />
                      <span className="text-sm text-[#6B7684] whitespace-nowrap">원</span>
                    </div>
                  </div>
                )}

                {/* 관리비 */}
                <div>
                  <label className={labelCls}>관리비</label>
                  <div className="flex items-center gap-2">
                    <input
                      className={inputCls}
                      type="text"
                      value={formData.ll_mgmt_fee}
                      onChange={(e) => setField('ll_mgmt_fee', e.target.value)}
                      placeholder="50,000"
                    />
                    <span className="text-sm text-[#6B7684] whitespace-nowrap">원</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {['인터넷', 'TV', '청소', '경비'].map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggleMgmtInclude(item)}
                        className={
                          formData.ll_mgmt_includes.includes(item)
                            ? 'bg-[#EFF6FF] border border-[#93C5FD] text-[#1971C2] text-xs font-semibold rounded-lg px-3 py-1.5'
                            : 'bg-[#F2F4F6] text-[#8B95A1] text-xs font-semibold rounded-lg px-3 py-1.5'
                        }
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 계약 기간 */}
                <div>
                  <label className={labelCls}>계약 시작일</label>
                  <input
                    className={inputCls}
                    type="date"
                    value={formData.ll_start_date}
                    onChange={(e) => setField('ll_start_date', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>계약 종료일</label>
                  <input
                    className={inputCls}
                    type="date"
                    value={formData.ll_end_date}
                    onChange={(e) => setField('ll_end_date', e.target.value)}
                  />
                </div>

                {/* 월세 납부일 */}
                <div>
                  <label className={labelCls}>월세 납부일</label>
                  <select
                    className={inputCls}
                    value={formData.ll_payment_day}
                    onChange={(e) => setField('ll_payment_day', e.target.value)}
                  >
                    {['매월 1일', '매월 5일', '매월 10일', '매월 15일', '매월 25일'].map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ───── STEP 3 ───── */}
        {step === 3 && (
          <>
            <h1 className="text-lg font-bold text-[#191F28] mb-1">특약조항 입력</h1>
            <p className="text-sm text-[#8B95A1] mb-4">입력 즉시 AI가 임차인 관점에서 분석합니다.</p>

            {/* Existing clauses */}
            {clauses.map((clause, i) => {
              const cardCls =
                clause.risk === 'danger'
                  ? 'bg-[#FFF8F8] border-[#FFD0D0]'
                  : clause.risk === 'warn'
                  ? 'bg-[#FFFDF0] border-[#FFE9A0]'
                  : 'bg-[#F8FFFE] border-[#C8F5EB]';
              const aiTextCls =
                clause.risk === 'danger'
                  ? 'text-[#B91C1C]'
                  : clause.risk === 'warn'
                  ? 'text-[#92650A]'
                  : 'text-[#007A58]';
              const riskIcon =
                clause.risk === 'danger' ? '🔴' : clause.risk === 'warn' ? '🟡' : '🟢';
              const riskLabel =
                clause.risk === 'danger'
                  ? '검토 권장'
                  : clause.risk === 'warn'
                  ? '확인 필요'
                  : '일반 조항';

              return (
                <div key={i} className={`mb-3 border rounded-2xl p-4 ${cardCls}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#8B95A1]">특약 {i + 1}</span>
                    <button
                      onClick={() => removeClause(i)}
                      className="text-xs text-[#E03131] underline"
                    >
                      삭제
                    </button>
                  </div>
                  <p className="text-sm font-semibold text-[#191F28] mt-1 mb-2">{clause.text}</p>
                  <div className="bg-white bg-opacity-70 rounded-xl p-3 text-xs">
                    <span className={aiTextCls}>
                      {riskIcon} {riskLabel} — {clause.explanation}
                    </span>
                    {clause.suggestedAlternative && (
                      <p className="mt-1 italic text-[#6B7684]">
                        AI 제안 대안: {clause.suggestedAlternative}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}

            {/* New clause input */}
            <div className="bg-white rounded-2xl border border-[#E8EAED] p-4 mb-4">
              <p className="text-sm font-bold text-[#191F28] mb-3">AI 분석 후 추가</p>
              <textarea
                rows={3}
                className="border border-[#E8EAED] rounded-xl px-4 py-3.5 w-full text-[#191F28] text-sm focus:border-[#3182F6] outline-none bg-white resize-none"
                placeholder="예: 임차인은 흡연을 금지한다."
                value={newClauseText}
                onChange={(e) => setNewClauseText(e.target.value)}
              />

              {/* Preview after analysis */}
              {clausePreview && (
                <div
                  className={`mt-3 rounded-xl p-3 text-xs ${
                    clausePreview.risk === 'danger'
                      ? 'bg-[#FFF8F8] border border-[#FFD0D0] text-[#B91C1C]'
                      : clausePreview.risk === 'warn'
                      ? 'bg-[#FFFDF0] border border-[#FFE9A0] text-[#92650A]'
                      : 'bg-[#F8FFFE] border border-[#C8F5EB] text-[#007A58]'
                  }`}
                >
                  {clausePreview.risk === 'danger' ? '🔴 검토 권장' : clausePreview.risk === 'warn' ? '🟡 확인 필요' : '🟢 일반 조항'} — {clausePreview.explanation}
                  {clausePreview.suggestedAlternative && (
                    <p className="mt-1 italic text-[#6B7684]">
                      AI 제안 대안: {clausePreview.suggestedAlternative}
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-2 mt-3">
                {!clausePreview ? (
                  <button
                    onClick={analyzeClause}
                    disabled={analyzingClause || !newClauseText.trim()}
                    className="bg-[#3182F6] text-white rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50 flex items-center gap-2"
                  >
                    {analyzingClause && (
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                    )}
                    AI 분석 후 추가
                  </button>
                ) : (
                  <>
                    <button
                      onClick={addClause}
                      className="bg-[#3182F6] text-white rounded-xl px-4 py-2 text-sm font-bold"
                    >
                      이 특약 추가
                    </button>
                    <button
                      onClick={() => setClausePreview(null)}
                      className="bg-[#F2F4F6] text-[#191F28] rounded-xl px-4 py-2 text-sm font-bold"
                    >
                      다시 입력
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Templates */}
            <div className="bg-[#EFF6FF] rounded-2xl p-4 mb-4">
              <p className="text-sm font-bold text-[#1971C2] mb-2">추천 특약 템플릿</p>
              <div className="flex flex-wrap gap-2">
                {[
                  {
                    label: '전대차 금지',
                    text: '임차인은 임대인의 서면 동의 없이 본 주택을 전대하거나 임차권을 양도할 수 없다.',
                  },
                  {
                    label: '원상복구',
                    text: '임차인은 계약 종료 시 임대 당시의 원상태로 복구하여야 하며, 임의 변경·훼손한 경우 비용을 부담한다.',
                  },
                  {
                    label: '인테리어 제한',
                    text: '임차인은 임대인의 서면 동의 없이 내부 구조를 변경하거나 인테리어 공사를 시행할 수 없다.',
                  },
                ].map(({ label, text }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setNewClauseText(text)}
                    className="bg-white border border-[#93C5FD] text-[#1971C2] text-xs font-semibold rounded-lg px-3 py-1.5 cursor-pointer"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ───── STEP 4 ───── */}
        {step === 4 && contractId && (
          <>
            {/* Success card */}
            <div className="bg-[#EAFAF4] rounded-2xl p-4 mb-4 flex items-center gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <p className="font-bold text-[#00A37A]">계약서 초안 완성!</p>
                <p className="text-sm text-[#6B7684]">임차인 서명만 남았어요</p>
              </div>
            </div>

            {/* Link card */}
            <div className="bg-[#EFF6FF] border-2 border-dashed border-[#93C5FD] rounded-2xl p-4 mb-4">
              <p className="text-xs font-bold text-[#6B7684] mb-2">임차인 초대 링크</p>
              <div className="bg-white rounded-xl p-3 text-sm text-[#191F28] break-all mb-3">
                {typeof window !== 'undefined'
                  ? `${window.location.origin}/contract/${contractId}`
                  : `/contract/${contractId}`}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={copyLink}
                  className="bg-[#F2F4F6] text-[#191F28] rounded-xl px-4 py-2 text-sm font-bold flex-1"
                >
                  {linkCopied ? '복사됨!' : '링크 복사'}
                </button>
                <button
                  onClick={() => {
                    const url =
                      typeof window !== 'undefined'
                        ? `${window.location.origin}/contract/${contractId}`
                        : `/contract/${contractId}`;
                    alert('카카오 공유: ' + url);
                  }}
                  className="bg-[#FEE500] text-[#3A1D1D] font-bold rounded-xl px-4 py-2 text-sm flex-1"
                >
                  카카오 공유
                </button>
              </div>
            </div>

            {/* Link settings */}
            <div className="bg-[#F9FAFB] rounded-2xl p-4 mb-4">
              <p className="text-sm font-bold text-[#191F28] mb-3">링크 설정</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <label className="text-sm text-[#6B7684] whitespace-nowrap">유효 기간</label>
                  <select
                    className="border border-[#E8EAED] rounded-xl px-3 py-2 text-sm text-[#191F28] focus:border-[#3182F6] outline-none bg-white"
                    defaultValue="7일"
                    onChange={(e) => {
                      const days = parseInt(e.target.value);
                      const expires = new Date(Date.now() + days * 86400000).toISOString();
                      patchContract({ link_expires_at: expires });
                    }}
                  >
                    <option value="7">7일</option>
                    <option value="14">14일</option>
                    <option value="30">30일</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>임차인 이름 (선택)</label>
                  <input
                    className={inputCls}
                    value={formData.ll_tenant_name}
                    onChange={(e) => setField('ll_tenant_name', e.target.value)}
                    onBlur={() => patchContract({ ll_tenant_name: formData.ll_tenant_name })}
                    placeholder="홍길동"
                  />
                </div>
                <div>
                  <label className={labelCls}>연락처 (선택)</label>
                  <input
                    className={inputCls}
                    type="tel"
                    value={formData.ll_tenant_phone}
                    onChange={(e) => setField('ll_tenant_phone', e.target.value)}
                    onBlur={() => patchContract({ ll_tenant_phone: formData.ll_tenant_phone })}
                    placeholder="010-0000-0000"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => router.push(`/landlord/contract/${contractId}`)}
                className="bg-[#3182F6] text-white rounded-2xl py-4 w-full font-bold text-sm"
              >
                계약 현황 확인하기
              </button>
              <button
                onClick={() => router.push('/landlord')}
                className="bg-[#F2F4F6] text-[#191F28] rounded-2xl py-4 w-full font-bold text-sm"
              >
                대시보드로 돌아가기
              </button>
            </div>
          </>
        )}
      </div>

      {/* ───── Fixed bottom buttons (steps 1-3) ───── */}
      {step < 4 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E8EAED] p-4 z-40">
          <div className="max-w-[480px] mx-auto flex gap-3">
            {step === 1 && (
              <>
                <button
                  onClick={() => router.push('/landlord')}
                  className="bg-[#F2F4F6] text-[#191F28] rounded-2xl py-4 font-bold text-sm"
                  style={{ flex: '1 1 33%' }}
                >
                  취소
                </button>
                <button
                  onClick={() => setStep(2)}
                  className="bg-[#3182F6] text-white rounded-2xl py-4 font-bold text-sm"
                  style={{ flex: '2 1 66%' }}
                >
                  다음
                </button>
              </>
            )}
            {step === 2 && (
              <>
                <button
                  onClick={() => setStep(1)}
                  className="bg-[#F2F4F6] text-[#191F28] rounded-2xl py-4 font-bold text-sm flex-1"
                >
                  이전
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="bg-[#3182F6] text-white rounded-2xl py-4 font-bold text-sm flex-1"
                >
                  다음
                </button>
              </>
            )}
            {step === 3 && (
              <>
                <button
                  onClick={() => setStep(2)}
                  className="bg-[#F2F4F6] text-[#191F28] rounded-2xl py-4 font-bold text-sm flex-1"
                >
                  이전
                </button>
                <button
                  onClick={handleStep4}
                  disabled={saving}
                  className="bg-[#3182F6] text-white rounded-2xl py-4 font-bold text-sm flex-1 disabled:opacity-50"
                >
                  {saving ? '저장 중...' : '임차인 초대하기'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
