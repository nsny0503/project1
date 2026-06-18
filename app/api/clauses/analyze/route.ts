import { NextRequest, NextResponse } from 'next/server'

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
        max_tokens: 500,
        system: '당신은 한국 임대차 계약 특약 리스크 분석 전문가입니다. 임차인 관점에서 특약을 분석하고 JSON만 반환하세요. 다른 텍스트 없이 JSON만.',
        messages: [{ role: 'user', content: `특약 분석: ${clause}\n반환 형식 (JSON만): {"risk":"safe|warn|danger","explanation":"한국어 2문장 임차인 관점 분석","suggestedAlternative":"위험할 경우 대안 조항, 안전하면 빈 문자열"}` }]
      }),
      signal: AbortSignal.timeout(15000),
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
