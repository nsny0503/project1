'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ServiceHeader from '@/components/ui/ServiceHeader'
import StatusTag from '@/components/ui/StatusTag'
import InfoRow from '@/components/ui/InfoRow'
import type { Contract, ClauseRequest } from '@/lib/types'

export default function LandlordContractDetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()

  const [contract, setContract] = useState<Contract | null>(null)
  const [clauseRequests, setClauseRequests] = useState<ClauseRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [respondingId, setRespondingId] = useState<string | null>(null)
  const [editedClause, setEditedClause] = useState('')
  const [hasSignature, setHasSignature] = useState(false)
  const [modifyNotifDismissed, setModifyNotifDismissed] = useState(false)
  const prevTtSigned = useRef<boolean | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)

  const fetchData = useCallback(async () => {
    const { data: contractData } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', id)
      .single()
    if (contractData) {
      prevTtSigned.current = contractData.tt_signed
      setContract(contractData)
    }

    const { data: requestsData } = await supabase
      .from('clause_requests')
      .select('*')
      .eq('contract_id', id)
      .order('created_at', { ascending: true })
    if (requestsData) setClauseRequests(requestsData)

    setLoading(false)
  }, [id])

  useEffect(() => {
    fetchData()

    const reqChannel = supabase
      .channel(`clause_requests:${id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'clause_requests',
        filter: `contract_id=eq.${id}`,
      }, () => { fetchData() })
      .subscribe()

    const contractChannel = supabase
      .channel(`contracts:${id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'contracts',
        filter: `id=eq.${id}`,
      }, (payload) => {
        const updated = payload.new as Contract
        if (updated) {
          // Detect signature reset: was signed, now unsigned
          if (prevTtSigned.current === true && updated.tt_signed === false) {
            setModifyNotifDismissed(false)
          }
          prevTtSigned.current = updated.tt_signed
          setContract(updated)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(reqChannel)
      supabase.removeChannel(contractChannel)
    }
  }, [id, fetchData])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = 130 * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.strokeStyle = '#191F28'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [contract?.tt_signed])

  const getCanvasCtx = () => {
    const canvas = canvasRef.current
    if (!canvas) return null
    return canvas.getContext('2d')
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDrawing.current = true
    const ctx = getCanvasCtx()
    if (!ctx) return
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect()
    ctx.beginPath()
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return
    const ctx = getCanvasCtx()
    if (!ctx) return
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect()
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
    ctx.stroke()
    setHasSignature(true)
  }

  const handleMouseUp = () => { isDrawing.current = false }
  const handleMouseLeave = () => { isDrawing.current = false }

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    isDrawing.current = true
    const ctx = getCanvasCtx()
    if (!ctx) return
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect()
    const touch = e.touches[0]
    ctx.beginPath()
    ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top)
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    if (!isDrawing.current) return
    const ctx = getCanvasCtx()
    if (!ctx) return
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect()
    const touch = e.touches[0]
    ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top)
    ctx.stroke()
    setHasSignature(true)
  }

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    isDrawing.current = false
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }

  const acceptRequest = async (requestId: string, clauseIndex: number, updatedText: string) => {
    await fetch(`/api/clause-requests/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'accepted', updated_clause: updatedText, responded_at: new Date().toISOString() }),
    })
    if (contract) {
      const updatedClauses = [...contract.clauses]
      updatedClauses[clauseIndex] = {
        ...updatedClauses[clauseIndex],
        text: updatedText,
        risk: 'safe',
        explanation: '집주인이 수정 수락한 조항입니다.',
      }
      await fetch(`/api/contracts/${contract.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clauses: updatedClauses }),
      })
    }
    setRespondingId(null)
  }

  const rejectRequest = async (requestId: string) => {
    await fetch(`/api/clause-requests/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected', responded_at: new Date().toISOString() }),
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center">
        <p className="text-sm text-[#8B95A1]">불러오는 중...</p>
      </div>
    )
  }

  if (!contract) {
    return (
      <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center">
        <p className="text-sm text-[#8B95A1]">계약을 찾을 수 없습니다.</p>
      </div>
    )
  }

  const status = contract.ll_signed && contract.tt_signed
    ? '완료'
    : contract.tt_signed
    ? '서명대기'
    : '진행중'

  const typeLabel =
    contract.contract_type === 'A' ? '전세' :
    contract.contract_type === 'B' ? '월세' : '반전세'

  const steps = [
    {
      label: '매물 정보 입력',
      done: true,
      subtitle: new Date(contract.created_at).toLocaleDateString('ko-KR'),
    },
    {
      label: '특약조항 입력',
      done: contract.clauses.length > 0,
      subtitle: contract.clauses.length + '개 입력됨',
    },
    {
      label: '임차인 접속',
      done: !!contract.tt_name,
      subtitle: contract.tt_name ? '완료' : '대기 중...',
    },
    {
      label: '임차인 개인정보 입력',
      done: !!contract.tt_name,
      subtitle: contract.tt_name || '대기 중...',
    },
    {
      label: '특약 수정 요청 처리',
      done: clauseRequests.length > 0 && clauseRequests.every(r => r.status !== 'pending'),
      subtitle:
        clauseRequests.length > 0
          ? clauseRequests.length + '건 처리됨'
          : '수정 요청 없음',
    },
    {
      label: '보증금 위험도 확인',
      done: contract.tt_signed,
      subtitle: contract.tt_signed ? '완료' : '대기 중...',
    },
    {
      label: '임차인 서명',
      done: contract.tt_signed,
      subtitle: contract.tt_signed_at && !contract.tt_signed
        ? '수정 요청으로 재서명 필요'
        : contract.tt_signed_at
        ? new Date(contract.tt_signed_at).toLocaleDateString('ko-KR')
        : '대기 중...',
    },
    {
      label: '집주인 서명 + 계약 완료',
      done: contract.ll_signed,
      subtitle: contract.ll_signed
        ? '완료'
        : contract.tt_signed
        ? '서명 가능'
        : '임차인 서명 후 가능',
    },
  ]

  const pendingReqs = clauseRequests.filter(r => r.status === 'pending')

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      <ServiceHeader role="landlord" onBack={() => router.push('/landlord')} />

      <div className="max-w-[480px] mx-auto px-4 pt-4 pb-10">
        {/* Page header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-base font-bold text-[#191F28]">{contract.ll_address}</p>
            <p className="text-sm text-[#6B7684]">{contract.ll_address_detail}</p>
          </div>
          <StatusTag
            label={status}
            color={status === '완료' ? 'green' : status === '서명대기' ? 'yellow' : 'blue'}
          />
        </div>

        {/* Timeline card */}
        <div className="bg-white rounded-2xl border border-[#E8EAED] p-4 mb-4">
          <p className="text-sm font-bold text-[#191F28] mb-4">공동작성 현황</p>
          {steps.map((step, index) => {
            const prevDone = index === 0 ? true : steps[index - 1].done
            const isActive = !step.done && prevDone
            const isResetStep = index === 6 && contract.tt_signed_at && !contract.tt_signed
            return (
              <div key={index} className="flex items-start gap-3 mb-3 last:mb-0">
                <div
                  className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                    isResetStep
                      ? 'border-2 border-[#F59E0B] bg-[#FFFBEB]'
                      : step.done
                      ? 'bg-[#00B493] text-white text-xs'
                      : isActive
                      ? 'border-2 border-[#F59E0B] bg-[#FFFBEB]'
                      : 'bg-[#F2F4F6] text-[#8B95A1] text-xs'
                  }`}
                >
                  {isResetStep ? (
                    <span className="text-xs text-[#F59E0B] font-bold">!</span>
                  ) : step.done ? (
                    <span className="text-xs">✓</span>
                  ) : isActive ? (
                    <span className="w-2 h-2 bg-[#F59E0B] rounded-full animate-pulse" />
                  ) : (
                    <span className="text-xs">{index + 1}</span>
                  )}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${isResetStep ? 'text-[#92400E]' : 'text-[#191F28]'}`}>{step.label}</p>
                  <p className={`text-xs mt-0.5 ${isResetStep ? 'text-[#D97706] font-semibold' : 'text-[#8B95A1]'}`}>{step.subtitle}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Signature reset notification */}
        {contract.tt_signed_at && !contract.tt_signed && !modifyNotifDismissed && (
          <div className="bg-[#FFFBEB] border-2 border-[#F59E0B] rounded-2xl p-4 mb-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">✏️</span>
                <div>
                  <p className="text-sm font-bold text-[#92400E]">임차인이 계약 수정을 요청했습니다</p>
                  <p className="text-xs text-[#B45309] mt-0.5">임차인 서명이 초기화되었습니다. 임차인과 수정 내용을 협의한 뒤 재서명을 진행하세요.</p>
                </div>
              </div>
              <button
                onClick={() => setModifyNotifDismissed(true)}
                className="text-[#B45309] text-lg leading-none flex-shrink-0 mt-0.5"
              >
                ×
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-[#92400E]">
              <span className="font-semibold">다음 단계:</span>
              <span>특약 수정 요청(아래) 처리 → 임차인 재서명 대기</span>
            </div>
          </div>
        )}

        {/* Modification requests */}
        {pendingReqs.length > 0 && (
          <div className="border border-[#FEF3C7] bg-[#FFFBEB] rounded-2xl p-4 mb-4">
            <p className="font-bold text-[#92400E] mb-3">
              임차인 수정 요청 ({pendingReqs.length}건)
            </p>
            {pendingReqs.map(req => (
              <div key={req.id} className="mb-3 last:mb-0">
                <p className="text-sm font-semibold text-[#191F28]">
                  특약 {req.clause_index + 1}: {contract.clauses[req.clause_index]?.text?.slice(0, 40) || ''}...
                </p>
                <p className="text-xs text-[#6B7684] mt-1">임차인: {req.message}</p>
                {req.suggested_alternative && (
                  <p className="italic text-xs text-[#6B7684] mt-1">
                    AI 제안: {req.suggested_alternative}
                  </p>
                )}

                {respondingId === req.id ? (
                  <>
                    <textarea
                      value={editedClause}
                      onChange={e => setEditedClause(e.target.value)}
                      rows={3}
                      className="border border-[#E8EAED] rounded-xl px-4 py-3.5 w-full text-sm focus:border-[#3182F6] outline-none mt-2 resize-none"
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => acceptRequest(req.id, req.clause_index, editedClause)}
                        className="bg-[#3182F6] text-white text-xs rounded-lg px-3 py-1.5 font-semibold"
                      >
                        수락 확정
                      </button>
                      <button
                        onClick={() => setRespondingId(null)}
                        className="bg-[#F2F4F6] text-xs rounded-lg px-3 py-1.5"
                      >
                        취소
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => {
                        setRespondingId(req.id)
                        setEditedClause(req.suggested_alternative || contract.clauses[req.clause_index]?.text || '')
                      }}
                      className="bg-[#3182F6] text-white text-xs rounded-lg px-3 py-1.5 font-semibold"
                    >
                      수정 수락
                    </button>
                    <button
                      onClick={() => rejectRequest(req.id)}
                      className="bg-[#FFF0F0] text-[#E03131] border border-[#FFD0D0] text-xs rounded-lg px-3 py-1.5 font-semibold"
                    >
                      거절
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Contract summary */}
        <div className="bg-white rounded-2xl border border-[#E8EAED] p-4 mb-4">
          <p className="text-sm font-bold mb-2">계약 정보</p>
          <InfoRow label="주소" value={contract.ll_address} />
          <InfoRow label="임차인" value={contract.tt_name || contract.ll_tenant_name || '미정'} />
          <InfoRow label="계약유형" value={typeLabel} />
          <InfoRow label="보증금" value={contract.ll_deposit + '원'} />
          <InfoRow label="월세" value={contract.ll_monthly_rent + '원'} />
          <InfoRow label="계약기간" value={`${contract.ll_start_date} ~ ${contract.ll_end_date}`} />
        </div>

        {/* Landlord signature section */}
        {!contract.tt_signed && contract.tt_signed_at && (
          // Modification requested state
          <div className="bg-[#FFFBEB] rounded-2xl border border-[#FEF3C7] p-4 mb-4 text-center">
            <p className="text-sm font-semibold text-[#92400E]">임차인 재서명 대기 중</p>
            <p className="text-xs text-[#B45309] mt-1">임차인이 수정 내용을 확인하고 다시 서명하면 이 화면에서 최종 서명할 수 있습니다.</p>
          </div>
        )}
        {!contract.tt_signed && !contract.tt_signed_at && (
          <div className="bg-[#F9FAFB] rounded-2xl border border-[#E8EAED] p-4 mb-4 text-center">
            <p className="text-sm text-[#8B95A1]">임차인 서명 완료 후 서명 가능합니다.</p>
          </div>
        )}

        {contract.tt_signed && !contract.ll_signed && (
          <div className="bg-[#EFF6FF] rounded-2xl border-2 border-[#3182F6] p-4 mb-4">
            <p className="font-bold text-[#1971C2]">임차인이 서명을 완료했습니다.</p>
            <p className="text-sm text-[#6B7684] mt-1 mb-4">
              집주인 서명 후 계약이 최종 완료됩니다.
            </p>

            <canvas
              ref={canvasRef}
              style={{ height: '130px', touchAction: 'none' }}
              className="border-2 border-dashed border-[#93C5FD] rounded-xl bg-white w-full block"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            />

            <div className="text-center mt-2">
              <button
                onClick={clearSignature}
                className="text-sm text-[#6B7684] underline"
              >
                서명 지우기
              </button>
            </div>

            <button
              disabled={!hasSignature}
              onClick={async () => {
                const signatureData = canvasRef.current?.toDataURL('image/png') || null
                await fetch(`/api/contracts/${contract.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ll_signed: true, ll_signed_at: new Date().toISOString(), ll_signature: signatureData }),
                })
              }}
              className="mt-4 bg-[#3182F6] text-white rounded-2xl py-4 w-full font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              서명 완료
            </button>
          </div>
        )}

        {contract.ll_signed && contract.tt_signed && (
          <div className="bg-[#EAFAF4] rounded-2xl p-4 mb-4 text-center">
            <p className="font-bold text-[#00A37A]">🎉 계약이 최종 완료되었습니다!</p>
            <button
              disabled
              className="mt-3 bg-[#F2F4F6] text-[#8B95A1] rounded-xl px-4 py-2 text-sm"
            >
              PDF 다운로드 (준비 중)
            </button>
          </div>
        )}

        {/* Bottom actions */}
        <div className="flex gap-3 mt-2 mb-8">
          <button
            onClick={() => {
              if (contract.tt_signed) {
                alert('임차인 서명 후 계약서 수정이 불가합니다.')
              } else {
                router.push('/landlord/new')
              }
            }}
            className="bg-[#F2F4F6] text-[#191F28] rounded-xl px-4 py-2.5 text-sm font-semibold flex-1"
          >
            계약서 수정
          </button>
          <button
            onClick={() => {
              if (confirm('정말 계약을 취소하시겠습니까?')) {
                router.push('/landlord')
              }
            }}
            className="bg-[#FFF0F0] text-[#E03131] border border-[#FFD0D0] rounded-xl px-4 py-2.5 text-sm font-semibold flex-1"
          >
            계약 취소
          </button>
        </div>
      </div>
    </div>
  )
}
