import { NextRequest, NextResponse } from 'next/server'
import { CLAUSE_ANALYSIS_REFERENCE } from '@/lib/clause-reference'

const SYSTEM_PROMPT = `당신은 한국 주택임대차 계약 특약 리스크 분석 전문가입니다. 임차인(세입자) 관점에서 특약을 분석합니다.

아래 법률 기준을 참고하여 판단하세요:

${CLAUSE_ANALYSIS_REFERENCE}

분석 규칙:
- risk는 반드시 "safe"(안전), "warn"(주의), "danger"(위험) 중 하나
- danger: 법적 효력 없거나 임차인에게 심각하게 불리한 경우
- warn: 불리하거나 해석에 따라 분쟁 소지가 있는 경우
- safe: 합리적이고 법적으로 유효한 경우
- explanation은 임차인이 이해할 수 있는 쉬운 한국어로 2문장 이내
- suggestedAlternative는 위험/주의인 경우만 대안 조항 제시, 안전하면 빈 문자열
- JSON만 반환, 다른 텍스트 없음`

export async function POST(request: NextRequest) {
  const { clause } = await request.json()
  if (!clause) return NextResponse.json({ error: 'clause required' }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ risk: 'warn', explanation: 'API 키가 설정되지 않아 분석을 건너뜁니다.', suggestedAlternative: '' })
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: `다음 특약을 분석하세요:\n"${clause}"\n\n반환 형식 (JSON만):\n{"risk":"safe|warn|danger","explanation":"임차인 관점 분석 2문장 이내","suggestedAlternative":"위험/주의 시 대안 조항, 안전하면 빈 문자열"}`
        }]
      }),
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) throw new Error('Claude API error')
    const data = await res.json()
    const text = data.content?.[0]?.text || ''
    const match = text.match(/\{[\s\S]*?\}/)
    if (!match) throw new Error('No JSON in response')
    return NextResponse.json(JSON.parse(match[0]))
  } catch {
    return NextResponse.json({ risk: 'warn', explanation: '분석 중 오류가 발생했습니다. 직접 검토하세요.', suggestedAlternative: '' })
  }
}
