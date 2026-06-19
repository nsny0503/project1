'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Contract } from '@/lib/types'

const CONTRACT_TYPE_LABEL: Record<string, string> = { A: '월세', B: '전세', C: '단기임대' }

function fmt(n: string | undefined) {
  const v = parseInt(n || '0')
  return v > 0 ? v.toLocaleString() + '원' : '-'
}

export default function ContractViewPage() {
  const { id } = useParams() as { id: string }
  const [contract, setContract] = useState<Contract | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id === 'demo') {
      setContract({
        id: 'demo', created_at: new Date().toISOString(),
        ll_name: '김대한', ll_id_num: '800101-1******', ll_phone: '010-1234-5678', ll_reg_no: '2024-서울강남-0001',
        ll_address: '서울특별시 강남구 역삼동 123-45', ll_address_detail: '302호',
        ll_housing_type: '오피스텔', ll_area: '33', ll_floor: '3', ll_total_floor: '10',
        ll_deposit: '30000000', ll_monthly_rent: '700000', ll_mgmt_fee: '100000',
        ll_mgmt_includes: ['인터넷', '수도'], ll_start_date: '2024-07-01', ll_end_date: '2026-06-30',
        ll_payment_day: '매월 5일', ll_tenant_name: '王小明', ll_tenant_phone: '010-9876-5432',
        contract_type: 'A',
        clauses: [
          { text: '임차인은 임대인의 서면 동의 없이 전대 또는 임차권 양도를 할 수 없다.', risk: 'safe', explanation: '', suggestedAlternative: '' },
          { text: '임차인은 퇴실 시 고의 또는 과실로 인한 훼손에 대해서만 원상복구 의무를 지며, 정상적인 사용에 의한 마모는 제외한다.', risk: 'safe', explanation: '', suggestedAlternative: '' },
        ],
        link_expires_at: undefined,
        tt_name: '王小明', tt_nationality: '중국 (China)', tt_id_num: 'G12345678', tt_phone: '010-9876-5432', tt_visa_type: 'D-2 (유학)',
        tt_signed: true, tt_signed_at: new Date().toISOString(), tt_signature: undefined,
        ll_signed: true, ll_signed_at: new Date().toISOString(), ll_signature: undefined
      })
      setLoading(false)
      return
    }
    supabase.from('contracts').select('*').eq('id', id).single().then(({ data }) => {
      if (data) setContract(data)
      setLoading(false)
    })
  }, [id])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="animate-spin w-8 h-8 border-4 border-gray-400 border-t-transparent rounded-full" />
    </div>
  )
  if (!contract) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <p className="text-gray-500">계약서를 찾을 수 없습니다.</p>
    </div>
  )

  const bothSigned = contract.tt_signed && contract.ll_signed
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
  const ttSignedDate = contract.tt_signed_at ? new Date(contract.tt_signed_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'
  const llSignedDate = contract.ll_signed_at ? new Date(contract.ll_signed_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'

  return (
    <div className="bg-gray-100 min-h-screen print:bg-white">
      {/* Top bar — hidden on print */}
      <div className="print:hidden sticky top-0 z-50 bg-[#1a1a2e] text-white px-4 py-3 flex items-center justify-between shadow">
        <button onClick={() => window.history.back()} className="text-sm font-semibold hover:opacity-80">← 돌아가기</button>
        <span className="text-sm font-bold">표준임대차계약서</span>
        <button
          onClick={() => window.print()}
          className="text-sm font-semibold bg-white text-[#1a1a2e] rounded-lg px-4 py-1.5"
        >
          인쇄 / PDF 저장
        </button>
      </div>

      {/* Status banner — only show if not both signed, hidden on print */}
      {!bothSigned && (
        <div className="print:hidden max-w-[860px] mx-auto mt-4 px-4">
          <div className="bg-[#FFFBEB] border border-[#FEF3C7] rounded-xl p-4 text-sm text-[#92400E] text-center">
            양측 서명이 완료되지 않았습니다. 임차인·집주인 모두 서명 완료 후 최종 계약서가 완성됩니다.
          </div>
        </div>
      )}

      {/* A4 contract body */}
      <div
        className="max-w-[860px] mx-auto my-6 bg-white shadow-lg print:shadow-none print:my-0 print:max-w-full"
        style={{ fontFamily: '"Noto Serif KR", "Malgun Gothic", serif' }}
      >
        <div className="px-12 py-10 print:px-10 print:py-8">

          {/* Header */}
          <div className="text-center mb-8 pb-4 border-b-2 border-black">
            <p className="text-xs text-gray-400 mb-1">[별지 제24호서식] 〈개정 2025.10.31.〉</p>
            <h1 className="text-3xl font-black tracking-[0.3em] mb-1">표준임대차계약서</h1>
            <p className="text-xs text-gray-500">(민간임대주택에 관한 특별법 시행규칙)</p>
          </div>

          <p className="text-sm mb-8 leading-7 text-justify indent-4">
            임대인과 임차인은 아래와 같이 임대차계약을 체결하고 이를 증명하기 위해 본서 2통을 작성하여
            임대인과 임차인이 각각 서명 또는 날인한 후 1통씩 보관한다.
          </p>

          {/* ── 1. 임대사업자 정보 ── */}
          <section className="mb-5">
            <div className="bg-gray-800 text-white text-sm font-bold px-3 py-1.5">1. 임대사업자(임대인) 정보</div>
            <table className="w-full border-collapse text-sm">
              <tbody>
                <tr>
                  <td className="border border-gray-400 bg-gray-50 px-3 py-2 font-semibold w-28 text-center">성명(법인명)</td>
                  <td className="border border-gray-400 px-3 py-2 w-40">{contract.ll_name || '　'}</td>
                  <td className="border border-gray-400 bg-gray-50 px-3 py-2 font-semibold w-32 text-center">주민등록번호</td>
                  <td className="border border-gray-400 px-3 py-2">{contract.ll_id_num ? contract.ll_id_num.replace(/(\d{6})-?(\d)(\d{6})/, '$1-$2******') : '　'}</td>
                </tr>
                <tr>
                  <td className="border border-gray-400 bg-gray-50 px-3 py-2 font-semibold text-center">주소</td>
                  <td className="border border-gray-400 px-3 py-2" colSpan={3}>{contract.ll_address} {contract.ll_address_detail}</td>
                </tr>
                <tr>
                  <td className="border border-gray-400 bg-gray-50 px-3 py-2 font-semibold text-center">전화번호</td>
                  <td className="border border-gray-400 px-3 py-2">{contract.ll_phone || '　'}</td>
                  <td className="border border-gray-400 bg-gray-50 px-3 py-2 font-semibold text-center">임대사업자등록번호</td>
                  <td className="border border-gray-400 px-3 py-2">{contract.ll_reg_no || '해당없음'}</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* ── 2. 임차인 정보 ── */}
          <section className="mb-5">
            <div className="bg-gray-800 text-white text-sm font-bold px-3 py-1.5">2. 임차인 정보</div>
            <table className="w-full border-collapse text-sm">
              <tbody>
                <tr>
                  <td className="border border-gray-400 bg-gray-50 px-3 py-2 font-semibold w-28 text-center">성명</td>
                  <td className="border border-gray-400 px-3 py-2 w-40">{contract.tt_name || contract.ll_tenant_name || '　'}</td>
                  <td className="border border-gray-400 bg-gray-50 px-3 py-2 font-semibold w-32 text-center">등록외국인번호<br/>/ 여권번호</td>
                  <td className="border border-gray-400 px-3 py-2">{contract.tt_id_num || '　'}</td>
                </tr>
                <tr>
                  <td className="border border-gray-400 bg-gray-50 px-3 py-2 font-semibold text-center">국적</td>
                  <td className="border border-gray-400 px-3 py-2">{contract.tt_nationality || '　'}</td>
                  <td className="border border-gray-400 bg-gray-50 px-3 py-2 font-semibold text-center">체류자격</td>
                  <td className="border border-gray-400 px-3 py-2">{contract.tt_visa_type || '　'}</td>
                </tr>
                <tr>
                  <td className="border border-gray-400 bg-gray-50 px-3 py-2 font-semibold text-center">전화번호</td>
                  <td className="border border-gray-400 px-3 py-2" colSpan={3}>{contract.tt_phone || '　'}</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* ── 3. 민간임대주택 표시 ── */}
          <section className="mb-5">
            <div className="bg-gray-800 text-white text-sm font-bold px-3 py-1.5">3. 민간임대주택 표시</div>
            <table className="w-full border-collapse text-sm">
              <tbody>
                <tr>
                  <td className="border border-gray-400 bg-gray-50 px-3 py-2 font-semibold w-28 text-center">주택 유형</td>
                  <td className="border border-gray-400 px-3 py-2 w-40">{contract.ll_housing_type}</td>
                  <td className="border border-gray-400 bg-gray-50 px-3 py-2 font-semibold w-32 text-center">계약 구분</td>
                  <td className="border border-gray-400 px-3 py-2">{CONTRACT_TYPE_LABEL[contract.contract_type] || contract.contract_type}</td>
                </tr>
                <tr>
                  <td className="border border-gray-400 bg-gray-50 px-3 py-2 font-semibold text-center">소재지</td>
                  <td className="border border-gray-400 px-3 py-2" colSpan={3}>{contract.ll_address} {contract.ll_address_detail}</td>
                </tr>
                <tr>
                  <td className="border border-gray-400 bg-gray-50 px-3 py-2 font-semibold text-center">주거전용면적</td>
                  <td className="border border-gray-400 px-3 py-2">{contract.ll_area ? `${contract.ll_area}㎡` : '　'}</td>
                  <td className="border border-gray-400 bg-gray-50 px-3 py-2 font-semibold text-center">층수</td>
                  <td className="border border-gray-400 px-3 py-2">{contract.ll_floor}층 / 전체 {contract.ll_total_floor}층</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* ── 4. 계약 내용 ── */}
          <section className="mb-5">
            <div className="bg-gray-800 text-white text-sm font-bold px-3 py-1.5">4. 계약 내용</div>
            <table className="w-full border-collapse text-sm">
              <tbody>
                <tr>
                  <td className="border border-gray-400 bg-gray-50 px-3 py-2.5 font-semibold w-28 text-center">임대보증금</td>
                  <td className="border border-gray-400 px-4 py-2.5 font-bold" colSpan={3}>
                    금 {parseInt(contract.ll_deposit || '0').toLocaleString()}원정
                    <span className="text-gray-500 font-normal ml-3 text-xs">
                      (￦{parseInt(contract.ll_deposit || '0').toLocaleString()})
                    </span>
                  </td>
                </tr>
                {contract.contract_type !== 'B' && (
                  <tr>
                    <td className="border border-gray-400 bg-gray-50 px-3 py-2.5 font-semibold text-center">월임대료</td>
                    <td className="border border-gray-400 px-4 py-2.5 font-bold" colSpan={3}>
                      금 {parseInt(contract.ll_monthly_rent || '0').toLocaleString()}원정
                      <span className="text-gray-500 font-normal ml-3 text-xs">납부일: 매월 {contract.ll_payment_day}</span>
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="border border-gray-400 bg-gray-50 px-3 py-2.5 font-semibold text-center">관리비</td>
                  <td className="border border-gray-400 px-4 py-2.5" colSpan={3}>
                    금 {parseInt(contract.ll_mgmt_fee || '0').toLocaleString()}원정
                    {contract.ll_mgmt_includes?.length > 0 && (
                      <span className="text-gray-500 ml-2 text-xs">(포함: {contract.ll_mgmt_includes.join(', ')})</span>
                    )}
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-400 bg-gray-50 px-3 py-2.5 font-semibold text-center">임대기간</td>
                  <td className="border border-gray-400 px-4 py-2.5 font-bold" colSpan={3}>
                    {contract.ll_start_date} ~ {contract.ll_end_date}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* ── 5. 표준 계약 조항 ── */}
          <section className="mb-5">
            <div className="bg-gray-800 text-white text-sm font-bold px-3 py-1.5">5. 표준 계약 조항</div>
            <div className="border border-gray-400 border-t-0 px-5 py-4 text-xs leading-7 text-gray-800 space-y-1.5">
              <p><strong>제1조(임대보증금 및 월임대료)</strong> 임대인은 위 민간임대주택을 임차인에게 임대보증금 및 월임대료로 위 금액을 약정하여 임대한다.</p>
              <p><strong>제2조(임대기간)</strong> 임대기간은 위 기간으로 하며, 민간임대주택에 관한 특별법 제34조에 따라 임대인은 임차인이 의무임대기간 동안 계속 거주를 희망하는 경우 정당한 사유 없이 계약 갱신을 거절하지 못한다.</p>
              <p><strong>제3조(임대료 증액)</strong> 임대인은 임대료 증액을 청구하는 경우 직전 임대료의 5%를 초과하여 청구할 수 없으며, 임대차 계약 또는 약정한 임대료 증액 후 1년 이내에는 증액을 청구하지 못한다.</p>
              <p><strong>제4조(임차주택의 수선)</strong> 임대인은 임차주택의 사용·수익에 필요한 상태를 유지하게 할 수선의무를 부담한다. 단, 임차인의 고의나 과실로 인한 파손은 임차인이 수선·복구한다.</p>
              <p><strong>제5조(원상회복)</strong> 임차인은 임대차 종료 시 임차주택을 원래 상태로 반환하여야 한다. 단, 정상적 사용에 의한 마모는 원상복구 의무에서 제외한다.</p>
              <p><strong>제6조(임대보증금 반환보증)</strong> 임대사업자는 민간임대주택에 관한 특별법 제49조에 따라 임대보증금에 대한 보증에 가입하여야 한다.</p>
            </div>
          </section>

          {/* ── 6. 특약사항 ── */}
          <section className="mb-8">
            <div className="bg-gray-800 text-white text-sm font-bold px-3 py-1.5">6. 특약사항</div>
            <div className="border border-gray-400 border-t-0 px-5 py-4 min-h-28">
              {contract.clauses && contract.clauses.length > 0 ? (
                contract.clauses.map((c, i) => (
                  <p key={i} className="text-sm mb-2 leading-7">
                    제{i + 1}항. {c.text}
                  </p>
                ))
              ) : (
                <p className="text-sm text-gray-400">특약사항 없음</p>
              )}
            </div>
          </section>

          {/* ── 7. 서명 및 날인 ── */}
          <section className="mb-6">
            <div className="bg-gray-800 text-white text-sm font-bold px-3 py-1.5 mb-4">7. 서명 및 날인</div>

            <p className="text-sm text-center mb-6 leading-7">
              {today}에 아래 당사자들은 위 계약 내용에 합의하였음을 확인하고 각자 서명합니다.
            </p>

            <div className="grid grid-cols-2 gap-6">
              {/* 임대인 서명 */}
              <div className="border-2 border-gray-300 rounded p-4">
                <p className="text-sm font-black text-center mb-4 pb-2 border-b border-gray-200">임대인 (집주인)</p>
                <table className="w-full text-xs mb-4">
                  <tbody>
                    <tr>
                      <td className="py-1.5 text-gray-500 w-16">성명</td>
                      <td className="py-1.5 font-semibold">{contract.ll_name}</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 text-gray-500">연락처</td>
                      <td className="py-1.5">{contract.ll_phone}</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 text-gray-500">서명일</td>
                      <td className="py-1.5">{contract.ll_signed ? llSignedDate : '-'}</td>
                    </tr>
                  </tbody>
                </table>
                <div className="border border-dashed border-gray-300 rounded h-24 flex items-center justify-center bg-gray-50 overflow-hidden">
                  {contract.ll_signature ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={contract.ll_signature} alt="임대인 서명" className="max-h-full max-w-full object-contain" />
                  ) : contract.ll_signed ? (
                    <p className="text-sm font-bold text-green-600">✓ 서명 완료</p>
                  ) : (
                    <p className="text-xs text-gray-400">서명 대기 중</p>
                  )}
                </div>
              </div>

              {/* 임차인 서명 */}
              <div className="border-2 border-gray-300 rounded p-4">
                <p className="text-sm font-black text-center mb-4 pb-2 border-b border-gray-200">임차인 (세입자)</p>
                <table className="w-full text-xs mb-4">
                  <tbody>
                    <tr>
                      <td className="py-1.5 text-gray-500 w-16">성명</td>
                      <td className="py-1.5 font-semibold">{contract.tt_name || contract.ll_tenant_name || '-'}</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 text-gray-500">국적/비자</td>
                      <td className="py-1.5">{contract.tt_nationality} / {contract.tt_visa_type}</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 text-gray-500">서명일</td>
                      <td className="py-1.5">{contract.tt_signed ? ttSignedDate : '-'}</td>
                    </tr>
                  </tbody>
                </table>
                <div className="border border-dashed border-gray-300 rounded h-24 flex items-center justify-center bg-gray-50 overflow-hidden">
                  {contract.tt_signature ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={contract.tt_signature} alt="임차인 서명" className="max-h-full max-w-full object-contain" />
                  ) : contract.tt_signed ? (
                    <p className="text-sm font-bold text-green-600">✓ 서명 완료</p>
                  ) : (
                    <p className="text-xs text-gray-400">서명 대기 중</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Footer */}
          <div className="border-t border-gray-200 pt-4 text-center">
            <p className="text-xs text-gray-400">본 계약서는 InSure! 서비스를 통해 전자적으로 작성된 표준임대차계약서입니다.</p>
            <p className="text-xs text-gray-400 mt-0.5">계약 ID: {contract.id} | 출력일: {today}</p>
          </div>

        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 15mm; }
          body { margin: 0; background: white; }
          .print\\:hidden { display: none !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:my-0 { margin: 0 !important; }
          .print\\:max-w-full { max-width: 100% !important; }
          .print\\:bg-white { background: white !important; }
          .print\\:px-10 { padding-left: 40px !important; padding-right: 40px !important; }
          .print\\:py-8 { padding-top: 32px !important; padding-bottom: 32px !important; }
        }
      `}</style>
    </div>
  )
}
