import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { clause } = await request.json()
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ alternative: '' })

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: '당신은 한국 임대차 계약 전문가입니다.',
        messages: [{ role: 'user', content: `아래 특약의 임차인 친화적인 대안 조항을 제안하세요: ${clause}\n반환 형식 (JSON만): {"alternative":"대안 조항 텍스트"}` }]
      }),
      signal: AbortSignal.timeout(15000),
    })
    const data = await res.json()
    const text = data.content?.[0]?.text || ''
    const match = text.match(/\{[\s\S]*?\}/)
    if (match) return NextResponse.json(JSON.parse(match[0]))
    return NextResponse.json({ alternative: '' })
  } catch {
    return NextResponse.json({ alternative: '' })
  }
}
