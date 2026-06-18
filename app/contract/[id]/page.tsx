'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ServiceHeader from '@/components/ui/ServiceHeader'
import StatusTag from '@/components/ui/StatusTag'
import InfoRow from '@/components/ui/InfoRow'
import type { Contract, ClauseRequest } from '@/lib/types'

interface DepositResult {
  risk: 'safe' | 'warn' | 'danger' | 'unknown'
  riskLabel: string
  riskColor: string
  message: string
  medianDeposit?: number
  sampleCount?: number
  ratio?: number | null
}

interface TenantData {
  name: string
  nationality: string
  idNum: string
  phone: string
  visaType: string
}

const CONTRACT_TYPE_LABEL: Record<string, string> = { A: '월세', B: '전세', C: '단기' }
const STEP_LABELS = ['계약 확인', '내 정보', '조건 확인', '특약 검토', '보증금 분석', '서명', '완료']

export default function TenantContractPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()

  const [contract, setContract] = useState<Contract | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [step, setStep] = useState(1)

  const [tenantData, setTenantData] = useState<TenantData>({ name: '', nationality: '중국 (China)', idNum: '', phone: '', visaType: 'D-2 (유학)' })

  const [clauseRequests, setClauseRequests] = useState<ClauseRequest[]>([])
  const [openRequestForms, setOpenRequestForms] = useState<Record<number, boolean>>({})
  const [requestMessages, setRequestMessages] = useState<Record<number, string>>({})

  const [depositResult, setDepositResult] = useState<DepositResult | null>(null)
  const [depositLoading, setDepositLoading] = useState(false)
  const [warnChecks, setWarnChecks] = useState<boolean[]>([false, false])
  const [dangerChecks, setDangerChecks] = useState<boolean[]>([false, false])

  const [dangerClauseChecks, setDangerClauseChecks] = useState<Record<number, boolean>>({})
  const [warnAllChecked, setWarnAllChecked] = useState(false)
  const [finalAgreed, setFinalAgreed] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [landlordSigned, setLandlordSigned] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawingRef = useRef(false)
  const signatureInitialized = useRef(false)

  // Fetch contract on mount
  useEffect(() => {
    if (!id || id === 'demo') {
      setNotFound(false)
      setLoading(false)
      setContract({
        id: 'demo', created_at: new Date().toISOString(),
        ll_name: '김대한', ll_id_num: '', ll_phone: '010-1234-5678', ll_reg_no: '',
        ll_address: '서울특별시 강남구 역삼동 123-45', ll_address_detail: '302호',
        ll_housing_type: '오피스텔', ll_area: '33', ll_floor: '3', ll_total_floor: '10',
        ll_deposit: '30000000', ll_monthly_rent: '700000', ll_mgmt_fee: '100000',
        ll_mgmt_includes: ['인터넷'], ll_start_date: '2024-07-01', ll_end_date: '2026-06-30',
        ll_payment_day: '매월 5일', ll_tenant_name: '', ll_tenant_phone: '',
        contract_type: 'A',
        clauses: [
          { text: '임차인은 임대인의 서면 동의 없이 전대 또는 임차권 양도를 할 수 없다.', risk: 'safe', explanation: '일반적인 전대차 금지 조항입니다. 표준 계약서에 포함된 내용입니다.', suggestedAlternative: '' },
          { text: '임차인은 퇴실 시 원상복구 비용 전액을 부담한다. 자연마모도 포함한다.', risk: 'danger', explanation: '자연마모를 포함한 원상복구는 임차인에게 불리합니다. 자연마모는 임대인이 부담하는 것이 원칙입니다.', suggestedAlternative: '임차인은 고의 또는 과실로 인한 훼손에 대해서만 원상복구 의무를 지며, 정상적인 사용에 의한 마모는 제외한다.' },
          { text: '계약 기간 중 임대인은 사전 통보 없이 매물을 방문하여 점검할 수 있다.', risk: 'warn', explanation: '임대인의 무단 방문은 임차인의 주거 안정권을 침해할 수 있습니다. 사전 통보 의무를 명시해야 합니다.', suggestedAlternative: '임대인은 매물 방문 시 최소 24시간 전 임차인에게 통보하여야 한다.' },
        ],
        link_expires_at: undefined, tt_name: undefined, tt_nationality: undefined,
        tt_id_num: undefined, tt_phone: undefined, tt_visa_type: undefined,
        tt_signed: false, tt_signed_at: undefined, ll_signed: false, ll_signed_at: undefined
      })
      return
    }

    const fetchContract = async () => {
      const { data, error } = await supabase.from('contracts').select('*').eq('id', id).single()
      if (error || !data) { setNotFound(true); setLoading(false); return }
      if (data.link_expires_at && new Date(data.link_expires_at) < new Date()) { setNotFound(true); setLoading(false); return }
      if (data.tt_signed) { setStep(7) }
      setContract(data)
      setLandlordSigned(data.ll_signed || false)
      setLoading(false)
    }

    const fetchClauseRequests = async () => {
      const { data } = await supabase.from('clause_requests').select('*').eq('contract_id', id).order('created_at', { ascending: true })
      if (data) setClauseRequests(data)
    }

    fetchContract()
    fetchClauseRequests()

    const clauseChannel = supabase.channel('cr-tenant-' + id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clause_requests', filter: 'contract_id=eq.' + id }, () => { fetchClauseRequests() })
      .subscribe()

    const contractChannel = supabase.channel('ct-tenant-' + id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'contracts', filter: 'id=eq.' + id }, (payload) => {
        const updated = payload.new as Contract
        setContract(updated)
        if (updated.ll_signed) setLandlordSigned(true)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(clauseChannel)
      supabase.removeChannel(contractChannel)
    }
  }, [id])

  // Scroll to top on step change
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }) }, [step])

  // Deposit analysis on step 5
  useEffect(() => {
    if (step === 5 && !depositResult && contract) {
      analyzeDeposit()
    }
  }, [step, contract])

  // Canvas init on step 6
  useEffect(() => {
    if (step === 6 && canvasRef.current && !signatureInitialized.current) {
      signatureInitialized.current = true
      const canvas = canvasRef.current
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = (rect.width || 320) * dpr
      canvas.height = 130 * dpr
      const ctx = canvas.getContext('2d')!
      ctx.scale(dpr, dpr)
      ctx.strokeStyle = '#191F28'
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
    }
  }, [step])

  const analyzeDeposit = async () => {
    if (!contract) return
    setDepositLoading(true)
    try {
      const res = await fetch('/api/deposit/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: contract.ll_address, deposit: contract.ll_deposit, housing_type: contract.ll_housing_type })
      })
      const data = await res.json()
      setDepositResult(data)
    } catch {
      setDepositResult({ risk: 'unknown', riskLabel: '확인필요', riskColor: '#64748b', message: '분석 중 오류가 발생했습니다. 직접 시세를 확인해 주세요.' })
    } finally {
      setDepositLoading(false)
    }
  }

  // Canvas drawing
  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }
  const getTouchPos = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches[0]
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
  }
  const startDraw = (x: number, y: number) => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    isDrawingRef.current = true
    ctx.beginPath()
    ctx.moveTo(x, y)
  }
  const draw = (x: number, y: number) => {
    if (!isDrawingRef.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.lineTo(x, y)
    ctx.stroke()
    setHasSignature(true)
  }
  const stopDraw = () => { isDrawingRef.current = false }
  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }

  // Clause request
  const submitClauseRequest = async (clauseIndex: number) => {
    if (!contract) return
    const message = requestMessages[clauseIndex] || ''
    const clause = contract.clauses[clauseIndex]
    try {
      await fetch('/api/clause-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contract_id: contract.id, clause_index: clauseIndex, message, suggested_alternative: clause.suggestedAlternative || '' })
      })
      setOpenRequestForms(prev => ({ ...prev, [clauseIndex]: false }))
      // Realtime will refresh
    } catch {
      alert('요청 전송 중 오류가 발생했습니다.')
    }
  }

  // Final submit
  const handleSubmit = async () => {
    if (!contract) return
    setSubmitting(true)
    try {
      await fetch('/api/contracts/' + contract.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...tenantData.name ? { tt_name: tenantData.name } : {}, tt_nationality: tenantData.nationality, tt_id_num: tenantData.idNum, tt_phone: tenantData.phone, tt_visa_type: tenantData.visaType, tt_signed: true, tt_signed_at: new Date().toISOString() })
      })
      setStep(7)
    } catch {
      alert('서명 처리 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-4 border-[#3182F6] border-t-transparent rounded-full" />
    </div>
  )

  if (notFound) return (
    <div className="min-h-screen bg-[#F5F6F8] flex flex-col items-center justify-center p-6 text-center">
      <div className="text-4xl mb-4">⚠️</div>
      <h1 className="text-lg font-bold text-[#191F28] mb-2">유효하지 않은 계약 링크입니다</h1>
      <p className="text-sm text-[#6B7684]">링크가 만료되었거나 존재하지 않습니다. 집주인에게 새 링크를 요청해 주세요.</p>
      <a href="tel:1345" className="mt-6 text-sm text-[#3182F6] underline">외국인종합안내센터 ☎ 1345</a>
    </div>
  )

  if (!contract) return null

  const dangerClauses = contract.clauses.filter(c => c.risk === 'danger')
  const warnClauses = contract.clauses.filter(c => c.risk === 'warn')
  const safeClauses = contract.clauses.filter(c => c.risk === 'safe')

  const allDangerChecked = dangerClauses.every((_, i) => dangerClauseChecks[i])
  const canSign = (dangerClauses.length === 0 || allDangerChecked) && (warnClauses.length === 0 || warnAllChecked) && finalAgreed && hasSignature

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      <ServiceHeader role="tenant" contractId={contract.id !== 'demo' ? contract.id : undefined} />

      {/* Progress bar */}
      <div className="sticky top-14 z-40 bg-white border-b border-[#E8EAED] px-4 py-3">
        <div className="max-w-[480px] mx-auto">
          <div className="flex items-center">
            {STEP_LABELS.map((label, idx) => (
              <div key={idx} className="flex items-center flex-1 last:flex-none">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  step > idx + 1 ? 'bg-[#00B493] text-white' : step === idx + 1 ? 'bg-[#3182F6] text-white' : 'bg-[#F2F4F6] text-[#8B95A1]'
                }`}>
                  {step > idx + 1 ? '✓' : idx + 1}
                </div>
                {idx < STEP_LABELS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-0.5 ${step > idx + 1 ? 'bg-[#3182F6]' : 'bg-[#E8EAED]'}`} />
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-[#8B95A1] text-center mt-1.5">{step}단계 / 7단계 — {STEP_LABELS[step - 1]}</p>
        </div>
      </div>

      <div className="max-w-[480px] mx-auto px-4 pt-4 pb-32">

        {/* STEP 1 */}
        {step === 1 && (
          <div>
            <div className="bg-white rounded-2xl border border-[#E8EAED] p-4 mb-4">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">🏠</span>
                <div>
                  <p className="text-xs text-[#8B95A1]">새 계약 초대</p>
                  <p className="text-base font-bold text-[#191F28]">계약서를 확인해 주세요</p>
                </div>
              </div>
              <div className="bg-[#EFF6FF] rounded-xl p-3 mb-4">
                <p className="text-sm font-semibold text-[#191F28]">{contract.ll_address}</p>
                <p className="text-xs text-[#6B7684] mt-0.5">{contract.ll_address_detail} · {contract.ll_housing_type}</p>
              </div>
              <div className="divide-y divide-[#F2F4F6]">
                <InfoRow label="집주인" value={contract.ll_name} />
                <InfoRow label="계약 유형" value={CONTRACT_TYPE_LABEL[contract.contract_type] || contract.contract_type} noBorder />
              </div>
            </div>
            <button onClick={() => setStep(2)} className="bg-[#3182F6] text-white rounded-2xl py-4 w-full font-bold text-sm">시작하기</button>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div>
            <p className="text-lg font-bold text-[#191F28] mb-1">내 정보를 입력해 주세요</p>
            <p className="text-sm text-[#8B95A1] mb-4">계약서에 등록될 정보입니다. 여권과 동일하게 입력하세요.</p>
            <div className="bg-white rounded-2xl border border-[#E8EAED] p-4 mb-4">
              <div className="mb-3">
                <label className="block text-sm font-semibold text-[#191F28] mb-1.5">이름 (여권 기준)</label>
                <input className="border border-[#E8EAED] rounded-xl px-4 py-3.5 w-full text-sm focus:border-[#3182F6] outline-none" placeholder="홍길동 / Hong Gil-dong" value={tenantData.name} onChange={e => setTenantData(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-semibold text-[#191F28] mb-1.5">국적</label>
                <select className="border border-[#E8EAED] rounded-xl px-4 py-3.5 w-full text-sm focus:border-[#3182F6] outline-none bg-white" value={tenantData.nationality} onChange={e => setTenantData(p => ({ ...p, nationality: e.target.value }))}>
                  {['중국 (China)', '미국 (USA)', '베트남 (Vietnam)', '필리핀 (Philippines)', '태국 (Thailand)', '인도 (India)', '기타 (Other)'].map(n => <option key={n}>{n}</option>)}
                </select>
              </div>
              <div className="mb-3">
                <label className="block text-sm font-semibold text-[#191F28] mb-1.5">등록 외국인번호 / 여권번호</label>
                <input className="border border-[#E8EAED] rounded-xl px-4 py-3.5 w-full text-sm focus:border-[#3182F6] outline-none" value={tenantData.idNum} onChange={e => setTenantData(p => ({ ...p, idNum: e.target.value }))} />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-semibold text-[#191F28] mb-1.5">연락처</label>
                <input type="tel" className="border border-[#E8EAED] rounded-xl px-4 py-3.5 w-full text-sm focus:border-[#3182F6] outline-none" value={tenantData.phone} onChange={e => setTenantData(p => ({ ...p, phone: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#191F28] mb-1.5">체류 자격</label>
                <select className="border border-[#E8EAED] rounded-xl px-4 py-3.5 w-full text-sm focus:border-[#3182F6] outline-none bg-white" value={tenantData.visaType} onChange={e => setTenantData(p => ({ ...p, visaType: e.target.value }))}>
                  {['D-2 (유학)', 'E-7 (특정활동)', 'F-2 (거주)', 'F-4 (재외동포)', 'H-2 (방문취업)', 'F-6 (결혼이민)', '기타'].map(v => <option key={v}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className="bg-[#FFFBEB] border border-[#FEF3C7] rounded-xl p-3 mb-4">
              <p className="text-sm font-semibold text-[#92400E]">💡 체류 자격이 중요한 이유</p>
              <p className="text-xs text-[#B45309] mt-1">체류 자격에 따라 전입신고 방법과 계약 가능 여부가 달라집니다.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="bg-[#F2F4F6] text-[#191F28] rounded-2xl py-4 flex-1 font-bold text-sm">이전</button>
              <button onClick={() => { if (!tenantData.name || !tenantData.idNum || !tenantData.phone) { alert('이름, 번호, 연락처를 모두 입력해 주세요.'); return } setStep(3) }} className="bg-[#3182F6] text-white rounded-2xl py-4 flex-[2] font-bold text-sm">저장하고 다음</button>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div>
            <p className="text-lg font-bold text-[#191F28] mb-1">계약 조건을 확인해 주세요</p>
            <p className="text-sm text-[#8B95A1] mb-4">집주인이 입력한 내용입니다.</p>
            <div className="bg-white rounded-2xl border border-[#E8EAED] p-4 mb-3">
              <p className="text-sm font-bold text-[#191F28] mb-2">📍 임차 주택 정보</p>
              <div className="divide-y divide-[#F2F4F6]">
                <InfoRow label="주소" value={contract.ll_address + ' ' + contract.ll_address_detail} />
                <InfoRow label="주택 유형" value={contract.ll_housing_type} />
                <InfoRow label="층수" value={contract.ll_floor + '층 / ' + contract.ll_total_floor + '층'} noBorder />
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-[#E8EAED] p-4 mb-3">
              <p className="text-sm font-bold text-[#191F28] mb-2">💰 금액 조건</p>
              <div className="divide-y divide-[#F2F4F6]">
                <div className="py-3 flex justify-between items-start">
                  <div><p className="text-sm text-[#6B7684]">보증금</p><p className="text-xs text-[#8B95A1]">계약 시 납부하는 목돈</p></div>
                  <p className="text-lg font-black text-[#3182F6]">{parseInt(contract.ll_deposit || '0').toLocaleString()}원</p>
                </div>
                {contract.contract_type !== 'B' && (
                  <div className="py-3 flex justify-between items-start">
                    <div><p className="text-sm text-[#6B7684]">월세</p><p className="text-xs text-[#8B95A1]">매달 납부하는 금액</p></div>
                    <p className="text-base font-bold text-[#191F28]">{parseInt(contract.ll_monthly_rent || '0').toLocaleString()}원</p>
                  </div>
                )}
                <InfoRow label="계약 기간" value={contract.ll_start_date + ' ~ ' + contract.ll_end_date} />
                <InfoRow label="납부일" value={contract.ll_payment_day} noBorder />
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-[#E8EAED] p-4 mb-4">
              <p className="text-sm font-bold text-[#191F28] mb-3">📋 공동작성 현황</p>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2"><span className="text-lg">🏠</span><span className="text-sm text-[#191F28]">집주인 ({contract.ll_name})</span></div>
                <StatusTag label="✓ 완료" color="green" />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><span className="text-lg">👤</span><span className="text-sm text-[#191F28]">임차인 (나)</span></div>
                <StatusTag label="진행 중" color="blue" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="bg-[#F2F4F6] text-[#191F28] rounded-2xl py-4 flex-1 font-bold text-sm">이전</button>
              <button onClick={() => setStep(4)} className="bg-[#3182F6] text-white rounded-2xl py-4 flex-[2] font-bold text-sm">특약 확인하기</button>
            </div>
          </div>
        )}

        {/* STEP 4 */}
        {step === 4 && (
          <div>
            <p className="text-lg font-bold text-[#191F28] mb-1">특약조항을 확인해 주세요</p>
            <p className="text-sm text-[#8B95A1] mb-4">AI가 각 조항을 분석했어요. 위험 조항은 집주인과 협의하세요.</p>

            {/* Summary banner */}
            {dangerClauses.length > 0 ? (
              <div className="bg-[#FFF0F0] border border-[#FFD0D0] rounded-2xl p-3 mb-4 flex items-center gap-2">
                <span className="text-lg">⚠️</span>
                <p className="text-sm font-semibold text-[#E03131]">검토 필요 조항이 있습니다</p>
              </div>
            ) : (
              <div className="bg-[#EAFAF4] border border-[#C8F5EB] rounded-2xl p-3 mb-4 flex items-center gap-2">
                <span className="text-lg">✅</span>
                <p className="text-sm font-semibold text-[#00A37A]">모든 조항이 검토되었습니다</p>
              </div>
            )}

            <div className="flex gap-2 mb-4">
              {dangerClauses.length > 0 && <span className="bg-[#FFF0F0] text-[#E03131] text-xs font-bold rounded-lg px-2.5 py-1">🔴 {dangerClauses.length}</span>}
              {warnClauses.length > 0 && <span className="bg-[#FFFBEB] text-[#D48806] text-xs font-bold rounded-lg px-2.5 py-1">🟡 {warnClauses.length}</span>}
              {safeClauses.length > 0 && <span className="bg-[#EAFAF4] text-[#00A37A] text-xs font-bold rounded-lg px-2.5 py-1">🟢 {safeClauses.length}</span>}
            </div>

            {contract.clauses.length === 0 && (
              <div className="bg-[#EFF6FF] rounded-2xl p-4 mb-4">
                <p className="text-sm text-[#1971C2]">집주인이 특약을 입력하지 않았습니다. 표준 계약 조건이 적용됩니다.</p>
              </div>
            )}

            {contract.clauses.map((clause, idx) => {
              const req = clauseRequests.find(r => r.clause_index === idx)
              const cardBg = clause.risk === 'danger' ? 'bg-[#FFF8F8] border-[#FFD0D0]' : clause.risk === 'warn' ? 'bg-[#FFFDF0] border-[#FFE9A0]' : 'bg-[#F8FFFE] border-[#C8F5EB]'
              const aiBoxBg = clause.risk === 'danger' ? 'bg-[#FFF0F0] text-[#B91C1C]' : clause.risk === 'warn' ? 'bg-[#FFFBEB] text-[#92650A]' : 'bg-[#EAFAF4] text-[#007A58]'
              const riskTag = clause.risk === 'danger' ? { label: '🔴 검토 권장', color: 'red' as const } : clause.risk === 'warn' ? { label: '🟡 확인 필요', color: 'yellow' as const } : { label: '🟢 일반 조항', color: 'green' as const }

              return (
                <div key={idx} className={`rounded-2xl border p-4 mb-3 ${cardBg}`}>
                  <div className="flex items-center justify-between mb-2">
                    <StatusTag label={riskTag.label} color={riskTag.color} />
                    <span className="text-xs text-[#8B95A1]">특약 {idx + 1}</span>
                  </div>
                  <p className="text-sm font-semibold text-[#191F28] mb-2">
                    {req?.status === 'accepted' && req.updated_clause ? req.updated_clause : clause.text}
                  </p>
                  <div className={`rounded-xl p-3 text-xs ${aiBoxBg}`}>
                    {clause.risk === 'danger' ? '🔴 ' : clause.risk === 'warn' ? '🟡 ' : '🟢 '}
                    AI 분석 결과 — {clause.explanation}
                    {clause.suggestedAlternative && clause.risk !== 'safe' && (
                      <p className="mt-1 italic text-[#6B7684]">AI 제안: {clause.suggestedAlternative}</p>
                    )}
                  </div>

                  {req ? (
                    <div className="mt-2">
                      {req.status === 'pending' && <StatusTag label="요청 중..." color="yellow" />}
                      {req.status === 'accepted' && <StatusTag label="✓ 수정 완료" color="green" />}
                      {req.status === 'rejected' && (
                        <div className="flex items-center gap-2">
                          <StatusTag label="거절됨" color="red" />
                          <span className="text-xs text-[#6B7684]">위험을 인지하고 계약을 진행하거나 취소하세요.</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    (clause.risk === 'danger' || clause.risk === 'warn') && (
                      <button onClick={() => setOpenRequestForms(p => ({ ...p, [idx]: !p[idx] }))} className="mt-2 text-sm text-[#3182F6] underline font-semibold">
                        {openRequestForms[idx] ? '닫기' : '수정 요청'}
                      </button>
                    )
                  )}

                  {openRequestForms[idx] && !req && (
                    <div className="bg-white rounded-xl p-3 mt-2 border border-[#E8EAED]">
                      <p className="text-xs font-bold text-[#191F28] mb-2">집주인에게 수정 요청</p>
                      {clause.suggestedAlternative && (
                        <div className="bg-[#EFF6FF] rounded-lg p-2 mb-2">
                          <p className="text-xs text-[#1971C2] font-semibold">AI 제안 대안 조항:</p>
                          <p className="text-xs text-[#1971C2] mt-0.5">{clause.suggestedAlternative}</p>
                          <button onClick={() => setRequestMessages(p => ({ ...p, [idx]: clause.suggestedAlternative }))} className="text-xs text-[#3182F6] underline mt-1">이 내용으로 요청하기</button>
                        </div>
                      )}
                      <textarea rows={3} className="border border-[#E8EAED] rounded-xl px-3 py-2 w-full text-xs outline-none focus:border-[#3182F6]" placeholder="수정 요청 내용을 입력하세요." value={requestMessages[idx] || ''} onChange={e => setRequestMessages(p => ({ ...p, [idx]: e.target.value }))} />
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => setOpenRequestForms(p => ({ ...p, [idx]: false }))} className="bg-[#F2F4F6] text-[#191F28] rounded-lg px-3 py-1.5 text-xs font-semibold">취소</button>
                        <button onClick={() => submitClauseRequest(idx)} className="bg-[#3182F6] text-white rounded-lg px-3 py-1.5 text-xs font-semibold">요청 보내기</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            <div className="bg-[#EFF6FF] rounded-2xl p-3 mb-4">
              <p className="text-xs text-[#1971C2]">📞 <strong>외국인종합안내센터</strong> — 무료 주거 법률 상담</p>
              <a href="tel:1345" className="text-sm font-bold text-[#3182F6]">☎ 1345</a>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(3)} className="bg-[#F2F4F6] text-[#191F28] rounded-2xl py-4 flex-1 font-bold text-sm">이전</button>
              <button onClick={() => setStep(5)} className="bg-[#3182F6] text-white rounded-2xl py-4 flex-[2] font-bold text-sm">확인하고 다음</button>
            </div>
          </div>
        )}

        {/* STEP 5 */}
        {step === 5 && (
          <div>
            <p className="text-lg font-bold text-[#191F28] mb-1">보증금 위험도 분석</p>
            <p className="text-sm text-[#8B95A1] mb-4">서명 전 이 지역 실거래가를 기준으로 보증금이 적절한지 확인합니다.</p>

            {depositLoading && (
              <div className="bg-white rounded-2xl border border-[#E8EAED] p-8 text-center mb-4">
                <div className="animate-spin w-8 h-8 border-4 border-[#3182F6] border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-sm text-[#8B95A1]">AI가 이 지역 실거래가 데이터를 분석하고 있습니다...</p>
                <p className="text-xs text-[#8B95A1] mt-1">최대 15초 소요될 수 있습니다.</p>
              </div>
            )}

            {depositResult && !depositLoading && (() => {
              const borderColor = depositResult.risk === 'safe' ? 'border-[#C8F5EB] bg-[#F8FFFE]' : depositResult.risk === 'warn' ? 'border-[#FFE9A0] bg-[#FFFDF0]' : depositResult.risk === 'danger' ? 'border-[#FFD0D0] bg-[#FFF8F8]' : 'border-[#E8EAED] bg-[#F9FAFB]'
              const tagColor = depositResult.risk === 'safe' ? 'green' as const : depositResult.risk === 'warn' ? 'yellow' as const : depositResult.risk === 'danger' ? 'red' as const : 'gray' as const
              return (
                <div>
                  <div className={`rounded-2xl border p-4 mb-4 ${borderColor}`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-bold text-[#191F28]">보증금 위험도 분석</span>
                      <StatusTag label={depositResult.riskLabel} color={tagColor} />
                    </div>
                    <p className="text-sm text-[#374151] leading-relaxed">{depositResult.message}</p>
                    {depositResult.sampleCount && depositResult.sampleCount > 0 && (
                      <p className="text-xs text-[#8B95A1] mt-2">지역 중앙값 {depositResult.medianDeposit?.toLocaleString()}만원 기준 ({depositResult.sampleCount}건 거래 분석)</p>
                    )}
                  </div>

                  {depositResult.risk === 'safe' && (
                    <div className="bg-[#EAFAF4] rounded-2xl p-4 mb-4">
                      <p className="text-sm text-[#00A37A] font-semibold mb-2">이 보증금은 지역 시세 범위 내입니다.</p>
                      <ul className="text-xs text-[#6B7684] space-y-1">
                        <li>✓ 등기부등본 선순위 채권 확인</li>
                        <li>✓ 확정일자 신청 예정</li>
                        <li>✓ 전입신고 일정 확인</li>
                      </ul>
                    </div>
                  )}

                  {depositResult.risk === 'warn' && (
                    <div className="bg-[#FFFBEB] rounded-2xl p-4 mb-4">
                      <p className="text-sm text-[#92400E] font-semibold mb-2">아래 사항을 반드시 확인하세요.</p>
                      {['등기부등본 선순위 근저당을 확인했습니다', '확정일자를 신청할 예정입니다'].map((text, i) => (
                        <label key={i} className="flex items-center gap-2 mb-2 cursor-pointer">
                          <input type="checkbox" checked={warnChecks[i]} onChange={e => setWarnChecks(p => { const n = [...p]; n[i] = e.target.checked; return n })} className="w-4 h-4" />
                          <span className="text-xs text-[#191F28]">{text}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {depositResult.risk === 'danger' && (
                    <div className="bg-[#FFF0F0] rounded-2xl border border-[#FFD0D0] p-4 mb-4">
                      <p className="text-sm font-bold text-[#E03131] mb-2">⚠️ 전세사기 위험이 있을 수 있습니다. 서명 전 전문가 상담을 강력 권장합니다.</p>
                      {['등기부등본 선순위 채권을 직접 확인했습니다', '위험성을 인지하고 있으며, 본인 판단으로 진행합니다'].map((text, i) => (
                        <label key={i} className="flex items-center gap-2 mb-2 cursor-pointer">
                          <input type="checkbox" checked={dangerChecks[i]} onChange={e => setDangerChecks(p => { const n = [...p]; n[i] = e.target.checked; return n })} className="w-4 h-4" />
                          <span className="text-xs text-[#191F28]">{text}</span>
                        </label>
                      ))}
                      <div className="mt-3 space-y-1">
                        <a href="tel:1345" className="block text-xs text-[#3182F6] underline">외국인종합안내센터 ☎ 1345</a>
                        <a href="tel:15882188" className="block text-xs text-[#3182F6] underline">전세피해지원센터 ☎ 1588-2188</a>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button onClick={() => setStep(4)} className="bg-[#F2F4F6] text-[#191F28] rounded-2xl py-4 flex-1 font-bold text-sm">이전</button>
                    <button
                      onClick={() => setStep(6)}
                      disabled={depositResult.risk === 'warn' && !warnChecks.every(Boolean) || depositResult.risk === 'danger' && !dangerChecks.every(Boolean)}
                      className={`rounded-2xl py-4 flex-[2] font-bold text-sm ${
                        (depositResult.risk === 'warn' && !warnChecks.every(Boolean)) || (depositResult.risk === 'danger' && !dangerChecks.every(Boolean))
                          ? 'bg-[#F2F4F6] text-[#8B95A1] cursor-not-allowed'
                          : depositResult.risk === 'danger' ? 'bg-[#E03131] text-white' : 'bg-[#3182F6] text-white'
                      }`}
                    >
                      {depositResult.risk === 'danger' ? '위험성을 인지하고 서명 단계로' : depositResult.risk === 'warn' ? '확인했습니다, 서명 단계로' : '안심하고 서명 단계로'}
                    </button>
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* STEP 6 */}
        {step === 6 && (
          <div>
            <p className="text-lg font-bold text-[#191F28] mb-1">최종 확인 및 서명</p>
            <p className="text-sm text-[#8B95A1] mb-4">서명 후 계약의 법적 효력이 발생합니다.</p>

            <div className="bg-white rounded-2xl border border-[#E8EAED] p-4 mb-3">
              <p className="text-sm font-bold text-[#191F28] mb-2">계약 최종 요약</p>
              <div className="divide-y divide-[#F2F4F6]">
                <InfoRow label="주소" value={contract.ll_address} />
                <InfoRow label="보증금" value={parseInt(contract.ll_deposit || '0').toLocaleString() + '원'} valueClass="text-[#3182F6] font-black" />
                {contract.contract_type !== 'B' && <InfoRow label="월세" value={parseInt(contract.ll_monthly_rent || '0').toLocaleString() + '원'} />}
                <InfoRow label="계약기간" value={contract.ll_start_date + ' ~ ' + contract.ll_end_date} />
                <InfoRow label="임차인" value={tenantData.name} />
                <InfoRow label="임대인" value={contract.ll_name} noBorder />
              </div>
            </div>

            <div className="bg-[#F9FAFB] rounded-2xl border border-[#E8EAED] p-4 mb-3">
              <p className="text-sm font-bold text-[#191F28] mb-2">특약 및 위험도 요약</p>
              <div className="flex gap-2 mb-2">
                {dangerClauses.length > 0 && <span className="bg-[#FFF0F0] text-[#E03131] text-xs font-bold rounded-lg px-2 py-1">🔴 {dangerClauses.length}</span>}
                {warnClauses.length > 0 && <span className="bg-[#FFFBEB] text-[#D48806] text-xs font-bold rounded-lg px-2 py-1">🟡 {warnClauses.length}</span>}
                {safeClauses.length > 0 && <span className="bg-[#EAFAF4] text-[#00A37A] text-xs font-bold rounded-lg px-2 py-1">🟢 {safeClauses.length}</span>}
              </div>
              {depositResult && <p className="text-xs text-[#6B7684]">보증금 위험도: <strong style={{ color: depositResult.riskColor }}>{depositResult.riskLabel}</strong></p>}
            </div>

            {(dangerClauses.length > 0 || warnClauses.length > 0) && (
              <div className="bg-[#FFF0F0] rounded-2xl border border-[#FFD0D0] p-4 mb-3">
                <p className="text-sm font-bold text-[#E03131] mb-3">⚠️ 서명 전 마지막 확인</p>
                {dangerClauses.map((clause, i) => (
                  <label key={i} className="flex items-start gap-2 mb-2 cursor-pointer">
                    <input type="checkbox" checked={dangerClauseChecks[i] || false} onChange={e => setDangerClauseChecks(p => ({ ...p, [i]: e.target.checked }))} className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-[#191F28]">특약 {contract.clauses.findIndex(c => c === clause) + 1}: {clause.text.slice(0, 30)}...의 위험성을 인지하고 동의합니다.</span>
                  </label>
                ))}
                {warnClauses.length > 0 && (
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" checked={warnAllChecked} onChange={e => setWarnAllChecked(e.target.checked)} className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-[#191F28]">주의 필요 조항({warnClauses.length}개)의 내용을 충분히 이해했습니다.</span>
                  </label>
                )}
              </div>
            )}

            <div className="bg-white rounded-2xl border border-[#E8EAED] p-4 mb-3">
              <p className="text-sm font-bold text-[#191F28] mb-1">전자서명</p>
              <p className="text-xs text-[#8B95A1] mb-3">아래 박스에 손가락으로 서명해 주세요</p>
              <canvas
                ref={canvasRef}
                className="border-2 border-dashed border-[#D1D5DB] rounded-xl bg-[#FAFAFA] w-full block"
                style={{ height: '130px', touchAction: 'none' }}
                onMouseDown={e => startDraw(getPos(e).x, getPos(e).y)}
                onMouseMove={e => draw(getPos(e).x, getPos(e).y)}
                onMouseUp={stopDraw}
                onMouseLeave={stopDraw}
                onTouchStart={e => { e.preventDefault(); startDraw(getTouchPos(e).x, getTouchPos(e).y) }}
                onTouchMove={e => { e.preventDefault(); draw(getTouchPos(e).x, getTouchPos(e).y) }}
                onTouchEnd={stopDraw}
              />
              {!hasSignature && <p className="text-center text-xs text-[#D1D5DB] -mt-16 pointer-events-none relative z-10">여기에 서명하세요</p>}
              <button onClick={clearCanvas} className="text-sm text-[#6B7684] underline mt-2 block mx-auto">서명 지우기</button>
            </div>

            <div className="bg-white rounded-2xl border border-[#E8EAED] p-4 mb-4">
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={finalAgreed} onChange={e => setFinalAgreed(e.target.checked)} className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span className="text-xs text-[#191F28]">위의 계약 내용을 모두 확인하였으며 동의합니다. 전자서명은 자필 서명과 동일한 법적 효력을 가집니다.</span>
              </label>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(5)} className="bg-[#F2F4F6] text-[#191F28] rounded-2xl py-4 flex-1 font-bold text-sm">이전</button>
              <button
                onClick={handleSubmit}
                disabled={!canSign || submitting}
                className={`rounded-2xl py-4 flex-[2] font-bold text-sm ${!canSign || submitting ? 'bg-[#F2F4F6] text-[#8B95A1] cursor-not-allowed' : 'bg-[#3182F6] text-white'}`}
              >
                {submitting ? '처리 중...' : '서명 완료 및 제출'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 7 */}
        {step === 7 && (
          <div className="text-center py-10">
            <div className="w-20 h-20 bg-[#ECFDF5] rounded-full flex items-center justify-center mx-auto text-4xl">✅</div>
            <h1 className="text-2xl font-black text-[#191F28] mt-5">서명 완료!</h1>
            <p className="text-sm text-[#8B95A1] mt-2 leading-relaxed">집주인의 서명을 기다리고 있어요.<br />서명이 완료되면 알림을 드릴게요.</p>

            <div className="bg-white rounded-2xl border border-[#E8EAED] p-4 mt-6 text-left">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#00B493] flex items-center justify-center text-white text-xs">✓</div>
                  <span className="text-sm text-[#191F28]">임차인 서명 완료</span>
                </div>
                <StatusTag label="완료" color="green" />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${landlordSigned ? 'bg-[#00B493] text-white' : 'border-2 border-[#E8EAED] bg-white'}`}>
                    {landlordSigned ? '✓' : <span className="w-2 h-2 bg-[#E8EAED] rounded-full animate-pulse block" />}
                  </div>
                  <span className="text-sm text-[#191F28]">임대인 서명 {landlordSigned ? '완료' : '대기 중'}</span>
                </div>
                <StatusTag label={landlordSigned ? '완료' : '대기'} color={landlordSigned ? 'green' : 'gray'} />
              </div>
            </div>

            {landlordSigned && (
              <div className="bg-[#EAFAF4] rounded-2xl p-4 mt-4">
                <p className="text-base font-bold text-[#00A37A]">🎉 계약이 최종 완료되었습니다!</p>
              </div>
            )}

            <div className="bg-[#EFF6FF] rounded-2xl p-4 mt-4 text-left">
              <p className="text-xs text-[#1971C2] leading-relaxed">
                • 등기부등본 선순위 채권을 확인하셨나요?<br />
                • 전입신고는 입주 당일 바로 신청하세요.<br />
                • 확정일자는 주민센터 또는 인터넷등기소에서 받으세요.
              </p>
            </div>

            <div className="mt-4 space-y-2">
              <a href="tel:1345" className="block text-sm text-[#3182F6] underline">외국인종합안내센터 ☎ 1345</a>
              <a href="tel:15882188" className="block text-sm text-[#3182F6] underline">전세피해지원센터 ☎ 1588-2188</a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
