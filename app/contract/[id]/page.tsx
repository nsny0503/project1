'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
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

  const [contract, setContract] = useState<Contract | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [step, setStep] = useState(1)

  const [tenantData, setTenantData] = useState<TenantData>({ name: '', nationality: '중국 (China)', idNum: '', phone: '', visaType: 'D-2 (유학)' })

  const [clauseRequests, setClauseRequests] = useState<ClauseRequest[]>([])
  const [openRequestForms, setOpenRequestForms] = useState<Record<number, boolean>>({})
  const [requestMessages, setRequestMessages] = useState<Record<number, string>>({})
  const [expandedClauses, setExpandedClauses] = useState<Record<number, boolean>>({})

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

  // Post-signature modification
  const [showModifyModal, setShowModifyModal] = useState(false)
  const [modifyLoading, setModifyLoading] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawingRef = useRef(false)
  const signatureInitialized = useRef(false)

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
          { text: '임차인은 임대인의 서면 동의 없이 전대 또는 임차권 양도를 할 수 없다.', risk: 'safe', explanation: '표준 계약서에 포함된 일반적인 조항입니다. 법적으로 유효하며 임차인에게 불리하지 않습니다.', suggestedAlternative: '' },
          { text: '임차인은 퇴실 시 원상복구 비용 전액을 부담한다. 자연마모도 포함한다.', risk: 'danger', explanation: '자연마모(벽지 변색, 장판 마모 등)까지 임차인에게 부담시키는 것은 민법 및 판례에 위반됩니다. 정상 사용에 의한 손모는 임대인이 부담하는 것이 원칙입니다.', suggestedAlternative: '임차인은 고의 또는 과실로 인한 훼손에 대해서만 원상복구 의무를 지며, 정상적인 사용에 의한 마모(자연손모)는 임대인이 부담한다.' },
          { text: '계약 기간 중 임대인은 사전 통보 없이 매물을 방문하여 점검할 수 있다.', risk: 'warn', explanation: '임대인의 무단 방문은 임차인의 주거 안정권과 사생활을 침해할 수 있습니다. 최소한의 사전 통보 의무를 계약서에 명시해야 분쟁을 예방할 수 있습니다.', suggestedAlternative: '임대인은 임차주택 방문 시 최소 24시간 전에 임차인에게 사전 통보하여야 한다. 단, 화재·누수 등 긴급 상황은 예외로 한다.' },
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
      if (data.tt_signed) setStep(7)
      setContract(data)
      setLandlordSigned(data.ll_signed || false)
      if (data.tt_name) setTenantData(p => ({ ...p, name: data.tt_name || '', nationality: data.tt_nationality || p.nationality, idNum: data.tt_id_num || '', phone: data.tt_phone || '', visaType: data.tt_visa_type || p.visaType }))
      setLoading(false)
    }

    const fetchClauseRequests = async () => {
      const { data } = await supabase.from('clause_requests').select('*').eq('contract_id', id).order('created_at', { ascending: true })
      if (data) setClauseRequests(data)
    }

    fetchContract()
    fetchClauseRequests()

    const clauseChannel = supabase.channel('cr-tenant-' + id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clause_requests', filter: 'contract_id=eq.' + id }, () => fetchClauseRequests())
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

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }) }, [step])

  useEffect(() => {
    if (step === 5 && !depositResult && contract) analyzeDeposit()
  }, [step, contract])

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
      setDepositResult(await res.json())
    } catch {
      setDepositResult({ risk: 'warn', riskLabel: '확인필요', riskColor: '#f59e0b', message: '분석 중 오류가 발생했습니다. 국토교통부 실거래가 공개시스템(rt.molit.go.kr)에서 직접 시세를 확인해 주세요.' })
    } finally {
      setDepositLoading(false)
    }
  }

  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }
  const getTouchPos = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const touch = e.touches[0]
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
  }
  const startDraw = (x: number, y: number) => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    isDrawingRef.current = true
    ctx.beginPath(); ctx.moveTo(x, y)
  }
  const draw = (x: number, y: number) => {
    if (!isDrawingRef.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.lineTo(x, y); ctx.stroke()
    setHasSignature(true)
  }
  const stopDraw = () => { isDrawingRef.current = false }
  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }

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
    } catch {
      alert('요청 전송 중 오류가 발생했습니다.')
    }
  }

  const handleSubmit = async () => {
    if (!contract) return
    setSubmitting(true)
    try {
      const canvas = canvasRef.current
      const signatureData = canvas ? canvas.toDataURL('image/png') : ''
      await fetch('/api/contracts/' + contract.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(tenantData.name ? { tt_name: tenantData.name } : {}),
          tt_nationality: tenantData.nationality,
          tt_id_num: tenantData.idNum,
          tt_phone: tenantData.phone,
          tt_visa_type: tenantData.visaType,
          tt_signed: true,
          tt_signed_at: new Date().toISOString(),
          ...(signatureData ? { tt_signature: signatureData } : {})
        })
      })
      setStep(7)
    } catch {
      alert('서명 처리 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  // Post-signature modification — resets both signatures with mutual consent
  const handleRequestModification = async () => {
    if (!contract || contract.id === 'demo') {
      setShowModifyModal(false)
      setStep(4)
      return
    }
    setModifyLoading(true)
    try {
      await fetch('/api/contracts/' + contract.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tt_signed: false, tt_signed_at: null, ll_signed: false, ll_signed_at: null, tt_signature: null, ll_signature: null })
      })
      setShowModifyModal(false)
      signatureInitialized.current = false
      setHasSignature(false)
      setFinalAgreed(false)
      setDangerClauseChecks({})
      setWarnAllChecked(false)
      setStep(4)
    } catch {
      alert('수정 요청 중 오류가 발생했습니다.')
    } finally {
      setModifyLoading(false)
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

      {/* Progress */}
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
            <div className="bg-[#FFFBEB] border border-[#FEF3C7] rounded-xl p-3 mb-4">
              <p className="text-sm font-semibold text-[#92400E]">AI가 특약 조항을 분석해 드립니다</p>
              <p className="text-xs text-[#B45309] mt-1">위험 조항 감지, 법적 근거 제시, 수정안 자동 생성 서비스입니다.</p>
            </div>
            <button onClick={() => setStep(2)} className="bg-[#3182F6] text-white rounded-2xl py-4 w-full font-bold text-sm">계약 검토 시작하기</button>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div>
            <p className="text-lg font-bold text-[#191F28] mb-1">내 정보를 입력해 주세요</p>
            <p className="text-sm text-[#8B95A1] mb-4">계약서에 등록될 정보입니다. 여권과 동일하게 입력하세요.</p>
            <div className="bg-white rounded-2xl border border-[#E8EAED] p-4 mb-4">
              {[
                { label: '이름 (여권 기준)', key: 'name', placeholder: '홍길동 / Hong Gil-dong', type: 'text' },
                { label: '등록 외국인번호 / 여권번호', key: 'idNum', placeholder: '', type: 'text' },
                { label: '연락처', key: 'phone', placeholder: '', type: 'tel' },
              ].map(({ label, key, placeholder, type }) => (
                <div key={key} className="mb-3">
                  <label className="block text-sm font-semibold text-[#191F28] mb-1.5">{label}</label>
                  <input
                    type={type}
                    className="border border-[#E8EAED] rounded-xl px-4 py-3.5 w-full text-sm focus:border-[#3182F6] outline-none"
                    placeholder={placeholder}
                    value={tenantData[key as keyof TenantData]}
                    onChange={e => setTenantData(p => ({ ...p, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="mb-3">
                <label className="block text-sm font-semibold text-[#191F28] mb-1.5">국적</label>
                <select className="border border-[#E8EAED] rounded-xl px-4 py-3.5 w-full text-sm focus:border-[#3182F6] outline-none bg-white" value={tenantData.nationality} onChange={e => setTenantData(p => ({ ...p, nationality: e.target.value }))}>
                  {['중국 (China)', '미국 (USA)', '베트남 (Vietnam)', '필리핀 (Philippines)', '태국 (Thailand)', '인도 (India)', '기타 (Other)'].map(n => <option key={n}>{n}</option>)}
                </select>
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
              <p className="text-xs text-[#B45309] mt-1">체류자격에 따라 전입신고 방법과 주임법 적용 여부가 달라집니다. F-4 재외동포는 거소 변경신고로 대항력 취득 가능합니다.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="bg-[#F2F4F6] text-[#191F28] rounded-2xl py-4 flex-1 font-bold text-sm">이전</button>
              <button
                onClick={() => {
                  if (!tenantData.name || !tenantData.idNum || !tenantData.phone) { alert('이름, 번호, 연락처를 모두 입력해 주세요.'); return }
                  setStep(3)
                }}
                className="bg-[#3182F6] text-white rounded-2xl py-4 flex-[2] font-bold text-sm"
              >저장하고 다음</button>
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
                <InfoRow label="층수" value={contract.ll_floor + '층 / 전체 ' + contract.ll_total_floor + '층'} noBorder />
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
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="bg-[#F2F4F6] text-[#191F28] rounded-2xl py-4 flex-1 font-bold text-sm">이전</button>
              <button onClick={() => setStep(4)} className="bg-[#3182F6] text-white rounded-2xl py-4 flex-[2] font-bold text-sm">특약 확인하기</button>
            </div>
          </div>
        )}

        {/* STEP 4 */}
        {step === 4 && (
          <div>
            <p className="text-lg font-bold text-[#191F28] mb-1">특약조항 AI 분석 결과</p>
            <p className="text-sm text-[#8B95A1] mb-4">주택임대차보호법 기준으로 각 조항을 분석했습니다.</p>

            {dangerClauses.length > 0 ? (
              <div className="bg-[#FFF0F0] border border-[#FFD0D0] rounded-2xl p-3 mb-4 flex items-center gap-2">
                <span className="text-lg">⚠️</span>
                <div>
                  <p className="text-sm font-semibold text-[#E03131]">위험 조항 {dangerClauses.length}개가 감지되었습니다</p>
                  <p className="text-xs text-[#E03131] mt-0.5">집주인과 협의 또는 수정 요청을 권장합니다</p>
                </div>
              </div>
            ) : (
              <div className="bg-[#EAFAF4] border border-[#C8F5EB] rounded-2xl p-3 mb-4 flex items-center gap-2">
                <span className="text-lg">✅</span>
                <p className="text-sm font-semibold text-[#00A37A]">모든 조항이 검토되었습니다</p>
              </div>
            )}

            <div className="flex gap-2 mb-4">
              {dangerClauses.length > 0 && <span className="bg-[#FFF0F0] text-[#E03131] text-xs font-bold rounded-lg px-2.5 py-1">🔴 위험 {dangerClauses.length}</span>}
              {warnClauses.length > 0 && <span className="bg-[#FFFBEB] text-[#D48806] text-xs font-bold rounded-lg px-2.5 py-1">🟡 주의 {warnClauses.length}</span>}
              {safeClauses.length > 0 && <span className="bg-[#EAFAF4] text-[#00A37A] text-xs font-bold rounded-lg px-2.5 py-1">🟢 안전 {safeClauses.length}</span>}
            </div>

            {contract.clauses.length === 0 && (
              <div className="bg-[#EFF6FF] rounded-2xl p-4 mb-4">
                <p className="text-sm text-[#1971C2]">집주인이 특약을 입력하지 않았습니다. 표준 계약 조건이 적용됩니다.</p>
              </div>
            )}

            {contract.clauses.map((clause, idx) => {
              const req = clauseRequests.find(r => r.clause_index === idx)
              const isExpanded = expandedClauses[idx] !== false // default expanded
              const cardStyle =
                clause.risk === 'danger' ? 'bg-[#FFF8F8] border-[#FFD0D0]' :
                clause.risk === 'warn' ? 'bg-[#FFFDF0] border-[#FFE9A0]' :
                'bg-[#F8FFFE] border-[#C8F5EB]'
              const riskTag =
                clause.risk === 'danger' ? { label: '🔴 위험 — 검토 필요', color: 'red' as const } :
                clause.risk === 'warn' ? { label: '🟡 주의 — 확인 필요', color: 'yellow' as const } :
                { label: '🟢 안전 — 일반 조항', color: 'green' as const }

              return (
                <div key={idx} className={`rounded-2xl border p-4 mb-4 ${cardStyle}`}>
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <StatusTag label={riskTag.label} color={riskTag.color} />
                    <button
                      onClick={() => setExpandedClauses(p => ({ ...p, [idx]: !isExpanded }))}
                      className="text-xs text-[#8B95A1]"
                    >
                      특약 {idx + 1} {isExpanded ? '▲' : '▼'}
                    </button>
                  </div>

                  {/* Clause text */}
                  <div className="bg-white rounded-xl p-3 mb-3 border border-[#E8EAED]">
                    <p className="text-xs text-[#8B95A1] mb-1 font-semibold">원문 조항</p>
                    <p className="text-sm text-[#191F28] leading-relaxed font-medium">
                      {req?.status === 'accepted' && req.updated_clause ? (
                        <>
                          <span className="line-through text-[#8B95A1]">{clause.text}</span>
                          <span className="block mt-1 text-[#00A37A]">→ {req.updated_clause}</span>
                        </>
                      ) : clause.text}
                    </p>
                  </div>

                  {isExpanded && (
                    <>
                      {/* AI Analysis */}
                      <div className={`rounded-xl p-3 mb-3 ${
                        clause.risk === 'danger' ? 'bg-[#FFF0F0] border border-[#FFD0D0]' :
                        clause.risk === 'warn' ? 'bg-[#FFFBEB] border border-[#FFE9A0]' :
                        'bg-[#EAFAF4] border border-[#C8F5EB]'
                      }`}>
                        <p className="text-xs font-bold mb-1.5 text-[#191F28]">
                          {clause.risk === 'danger' ? '🔴 AI 분석 — 문제점' :
                           clause.risk === 'warn' ? '🟡 AI 분석 — 주의사항' :
                           '🟢 AI 분석 — 안전 확인'}
                        </p>
                        <p className="text-xs leading-relaxed text-[#374151]">{clause.explanation}</p>
                      </div>

                      {/* AI Suggested Alternative */}
                      {clause.suggestedAlternative && clause.risk !== 'safe' && (
                        <div className="bg-[#EFF6FF] rounded-xl p-3 mb-3 border border-[#BFDBFE]">
                          <p className="text-xs font-bold text-[#1971C2] mb-1.5">💡 AI 권장 수정안</p>
                          <p className="text-xs text-[#1E40AF] leading-relaxed italic">"{clause.suggestedAlternative}"</p>
                          {!req && (
                            <button
                              onClick={() => {
                                setRequestMessages(p => ({ ...p, [idx]: clause.suggestedAlternative }))
                                setOpenRequestForms(p => ({ ...p, [idx]: true }))
                              }}
                              className="mt-2 text-xs font-bold text-[#3182F6] bg-white border border-[#3182F6] rounded-lg px-3 py-1.5"
                            >
                              이 수정안으로 요청하기
                            </button>
                          )}
                        </div>
                      )}

                      {/* Request status */}
                      {req ? (
                        <div className="mt-1">
                          {req.status === 'pending' && (
                            <div className="flex items-center gap-2 bg-[#FFFBEB] rounded-lg px-3 py-2">
                              <div className="w-3 h-3 rounded-full bg-[#F59E0B] animate-pulse flex-shrink-0" />
                              <span className="text-xs text-[#92400E]">수정 요청이 집주인에게 전달되었습니다. 답변 대기 중...</span>
                            </div>
                          )}
                          {req.status === 'accepted' && (
                            <div className="flex items-center gap-2 bg-[#EAFAF4] rounded-lg px-3 py-2">
                              <span className="text-xs font-bold text-[#00A37A]">✓ 집주인이 수정을 승인했습니다</span>
                            </div>
                          )}
                          {req.status === 'rejected' && (
                            <div className="bg-[#FFF0F0] rounded-lg px-3 py-2">
                              <p className="text-xs font-bold text-[#E03131]">집주인이 수정을 거절했습니다</p>
                              <p className="text-xs text-[#6B7684] mt-0.5">위험을 인지하고 진행하거나, 계약을 재검토하세요.</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        (clause.risk === 'danger' || clause.risk === 'warn') && !openRequestForms[idx] && (
                          <button
                            onClick={() => setOpenRequestForms(p => ({ ...p, [idx]: true }))}
                            className="text-sm text-[#3182F6] font-semibold underline"
                          >
                            집주인에게 수정 요청하기
                          </button>
                        )
                      )}

                      {/* Request form */}
                      {openRequestForms[idx] && !req && (
                        <div className="bg-white rounded-xl p-3 mt-2 border border-[#E8EAED]">
                          <p className="text-xs font-bold text-[#191F28] mb-2">수정 요청 내용</p>
                          <textarea
                            rows={3}
                            className="border border-[#E8EAED] rounded-xl px-3 py-2 w-full text-xs outline-none focus:border-[#3182F6]"
                            placeholder="수정 요청 내용을 입력하세요."
                            value={requestMessages[idx] || ''}
                            onChange={e => setRequestMessages(p => ({ ...p, [idx]: e.target.value }))}
                          />
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => setOpenRequestForms(p => ({ ...p, [idx]: false }))} className="bg-[#F2F4F6] text-[#191F28] rounded-lg px-3 py-1.5 text-xs font-semibold">취소</button>
                            <button onClick={() => submitClauseRequest(idx)} className="bg-[#3182F6] text-white rounded-lg px-3 py-1.5 text-xs font-semibold">요청 보내기</button>
                          </div>
                        </div>
                      )}
                    </>
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
              const borderColor =
                depositResult.risk === 'safe' ? 'border-[#C8F5EB] bg-[#F8FFFE]' :
                depositResult.risk === 'warn' ? 'border-[#FFE9A0] bg-[#FFFDF0]' :
                depositResult.risk === 'danger' ? 'border-[#FFD0D0] bg-[#FFF8F8]' :
                'border-[#E8EAED] bg-[#F9FAFB]'
              const tagColor =
                depositResult.risk === 'safe' ? 'green' as const :
                depositResult.risk === 'warn' ? 'yellow' as const :
                depositResult.risk === 'danger' ? 'red' as const : 'gray' as const
              return (
                <div>
                  <div className={`rounded-2xl border p-4 mb-4 ${borderColor}`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-bold text-[#191F28]">보증금 위험도</span>
                      <StatusTag label={depositResult.riskLabel} color={tagColor} />
                    </div>
                    <div className="bg-white rounded-xl p-3 mb-3">
                      <p className="text-sm text-[#374151] leading-relaxed">{depositResult.message}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-white rounded-xl p-2">
                        <p className="text-xs text-[#8B95A1]">내 보증금</p>
                        <p className="text-sm font-black text-[#191F28]">{Math.round(parseInt(contract.ll_deposit || '0') / 10000).toLocaleString()}만</p>
                      </div>
                      <div className="bg-white rounded-xl p-2">
                        <p className="text-xs text-[#8B95A1]">지역 중앙값</p>
                        <p className="text-sm font-black text-[#191F28]">{(depositResult.medianDeposit || 0) > 0 ? depositResult.medianDeposit?.toLocaleString() + '만' : 'N/A'}</p>
                      </div>
                      <div className="bg-white rounded-xl p-2">
                        <p className="text-xs text-[#8B95A1]">비율</p>
                        <p className={`text-sm font-black ${depositResult.ratio && depositResult.ratio > 130 ? 'text-[#E03131]' : depositResult.ratio && depositResult.ratio > 110 ? 'text-[#D48806]' : 'text-[#00A37A]'}`}>
                          {depositResult.ratio ? depositResult.ratio + '%' : 'N/A'}
                        </p>
                      </div>
                    </div>
                    {depositResult.sampleCount && depositResult.sampleCount > 0 && (
                      <p className="text-xs text-[#8B95A1] mt-2 text-center">{depositResult.sampleCount}건 실거래 데이터 기준</p>
                    )}
                  </div>

                  {depositResult.risk === 'safe' && (
                    <div className="bg-[#EAFAF4] rounded-2xl p-4 mb-4">
                      <p className="text-sm text-[#00A37A] font-semibold mb-2">보증금은 적정 수준입니다. 아래 사항을 챙기세요.</p>
                      <ul className="text-xs text-[#6B7684] space-y-1">
                        <li>✓ 등기부등본 선순위 채권 반드시 확인</li>
                        <li>✓ 입주 당일 전입신고 신청</li>
                        <li>✓ 확정일자 주민센터 또는 인터넷등기소에서 취득</li>
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

                  {depositResult.risk === 'unknown' && (
                    <div className="bg-[#F9FAFB] rounded-2xl border border-[#E8EAED] p-4 mb-4">
                      <p className="text-sm font-semibold text-[#6B7684] mb-2">이 지역 실거래 데이터를 찾지 못했습니다.</p>
                      <p className="text-xs text-[#8B95A1]">국토교통부 실거래가 공개시스템에서 직접 확인하세요.</p>
                      <a href="https://rt.molit.go.kr" target="_blank" rel="noopener noreferrer" className="block mt-2 text-xs text-[#3182F6] underline">rt.molit.go.kr 바로가기</a>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button onClick={() => setStep(4)} className="bg-[#F2F4F6] text-[#191F28] rounded-2xl py-4 flex-1 font-bold text-sm">이전</button>
                    <button
                      onClick={() => setStep(6)}
                      disabled={
                        (depositResult.risk === 'warn' && !warnChecks.every(Boolean)) ||
                        (depositResult.risk === 'danger' && !dangerChecks.every(Boolean))
                      }
                      className={`rounded-2xl py-4 flex-[2] font-bold text-sm ${
                        (depositResult.risk === 'warn' && !warnChecks.every(Boolean)) ||
                        (depositResult.risk === 'danger' && !dangerChecks.every(Boolean))
                          ? 'bg-[#F2F4F6] text-[#8B95A1] cursor-not-allowed'
                          : depositResult.risk === 'danger' ? 'bg-[#E03131] text-white' : 'bg-[#3182F6] text-white'
                      }`}
                    >
                      {depositResult.risk === 'danger' ? '위험 인지 후 서명 단계로' :
                       depositResult.risk === 'warn' ? '확인 후 서명 단계로' : '서명 단계로'}
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

            {/* Contract preview link */}
            <a
              href={`/contract/${contract.id}/view`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between bg-[#EFF6FF] rounded-2xl border border-[#BFDBFE] p-3 mb-3"
            >
              <div>
                <p className="text-sm font-semibold text-[#1971C2]">📄 표준임대차계약서 미리보기</p>
                <p className="text-xs text-[#3182F6]">계약서 전체 내용을 확인하고 인쇄할 수 있습니다</p>
              </div>
              <span className="text-[#3182F6] text-lg">→</span>
            </a>

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
                    <span className="text-xs text-[#191F28]">위험 특약 {contract.clauses.findIndex(c => c === clause) + 1}의 위험성을 인지하고 동의합니다.</span>
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
          <div className="py-6">
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-[#ECFDF5] rounded-full flex items-center justify-center mx-auto text-4xl">✅</div>
              <h1 className="text-2xl font-black text-[#191F28] mt-5">서명 완료!</h1>
              <p className="text-sm text-[#8B95A1] mt-2 leading-relaxed">집주인의 서명을 기다리고 있어요.<br />서명이 완료되면 알림을 드릴게요.</p>
            </div>

            {/* Signing status */}
            <div className="bg-white rounded-2xl border border-[#E8EAED] p-4 mb-4">
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
              <div className="bg-[#EAFAF4] rounded-2xl p-4 mb-4 text-center">
                <p className="text-base font-bold text-[#00A37A]">🎉 계약이 최종 완료되었습니다!</p>
              </div>
            )}

            {/* Contract view link */}
            <a
              href={`/contract/${contract.id}/view`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between bg-[#EFF6FF] rounded-2xl border border-[#BFDBFE] p-4 mb-4"
            >
              <div>
                <p className="text-sm font-semibold text-[#1971C2]">📄 계약서 저장/인쇄</p>
                <p className="text-xs text-[#3182F6]">표준임대차계약서 형식으로 확인할 수 있습니다</p>
              </div>
              <span className="text-[#3182F6] text-lg">→</span>
            </a>

            <div className="bg-[#EFF6FF] rounded-2xl p-4 mb-4 text-left">
              <p className="text-sm font-semibold text-[#1971C2] mb-2">입주 전 체크리스트</p>
              <p className="text-xs text-[#1971C2] leading-relaxed">
                • 등기부등본 선순위 채권 확인 (인터넷등기소)<br />
                • 전입신고 — 입주 당일 주민센터 또는 정부24<br />
                • 확정일자 — 주민센터 또는 인터넷등기소<br />
                • 임대차 신고 — 보증금 6천만원 이상 시 의무 (30일 이내)
              </p>
            </div>

            {/* Post-signature modification */}
            {!landlordSigned && (
              <div className="bg-[#FFFBEB] rounded-2xl border border-[#FEF3C7] p-4 mb-4">
                <p className="text-sm font-semibold text-[#92400E] mb-1">계약 내용을 수정하고 싶으신가요?</p>
                <p className="text-xs text-[#B45309] mb-3">집주인과 상호 동의 후 수정할 수 있습니다. 서명이 초기화되고 특약 검토 단계로 돌아갑니다.</p>
                <button
                  onClick={() => setShowModifyModal(true)}
                  className="bg-[#FFFBEB] border border-[#D97706] text-[#92400E] rounded-xl px-4 py-2 text-sm font-semibold w-full"
                >
                  계약 내용 수정 요청
                </button>
              </div>
            )}

            <div className="mt-2 space-y-2 text-center">
              <a href="tel:1345" className="block text-sm text-[#3182F6] underline">외국인종합안내센터 ☎ 1345</a>
              <a href="tel:15882188" className="block text-sm text-[#3182F6] underline">전세피해지원센터 ☎ 1588-2188</a>
            </div>
          </div>
        )}
      </div>

      {/* Modification confirmation modal */}
      {showModifyModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-[480px] mb-4">
            <h2 className="text-lg font-black text-[#191F28] mb-2">계약 내용 수정 요청</h2>
            <p className="text-sm text-[#6B7684] mb-4 leading-relaxed">
              집주인과 상호 동의 하에 수정합니다.<br />
              <strong className="text-[#191F28]">양측 서명이 모두 초기화</strong>되며, 특약 검토 단계부터 다시 진행합니다.<br />
              집주인에게 먼저 연락하여 동의를 받았는지 확인하세요.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowModifyModal(false)}
                className="bg-[#F2F4F6] text-[#191F28] rounded-2xl py-3 flex-1 font-bold text-sm"
              >
                취소
              </button>
              <button
                onClick={handleRequestModification}
                disabled={modifyLoading}
                className="bg-[#D97706] text-white rounded-2xl py-3 flex-[2] font-bold text-sm"
              >
                {modifyLoading ? '처리 중...' : '수정 단계로 돌아가기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
