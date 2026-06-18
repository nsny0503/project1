import { NextRequest, NextResponse } from 'next/server'

const LAWD_MAP: Record<string, string> = {
  '종로구':'11110','중구':'11140','용산구':'11170','성동구':'11200','광진구':'11215',
  '동대문구':'11230','중랑구':'11260','성북구':'11290','강북구':'11305',
  '도봉구':'11320','노원구':'11350','은평구':'11380','서대문구':'11410',
  '마포구':'11440','양천구':'11470','강서구':'11500','구로구':'11530',
  '금천구':'11545','영등포구':'11560','동작구':'11590','관악구':'11620',
  '서초구':'11650','강남구':'11680','송파구':'11710','강동구':'11740',
  '서울중구':'11140',
  '인천중구':'28110','인천동구':'28140','미추홀구':'28177','연수구':'28185',
  '남동구':'28200','부평구':'28237','계양구':'28245','인천서구':'28260',
  '부산중구':'26110','부산서구':'26140','부산동구':'26170','영도구':'26200',
  '부산진구':'26230','동래구':'26260','부산남구':'26290','부산북구':'26320',
  '해운대구':'26350','사하구':'26380','금정구':'26410','부산강서구':'26440',
  '연제구':'26470','수영구':'26500','사상구':'26530',
  '대구중구':'27110','대구동구':'27140','대구서구':'27170','대구남구':'27200',
  '대구북구':'27230','수성구':'27260','달서구':'27290',
  '광주동구':'29110','광주서구':'29140','광주남구':'29155','광주북구':'29170','광산구':'29200',
  '대전동구':'30110','대전중구':'30140','대전서구':'30170','유성구':'30200','대덕구':'30230',
  '수원장안구':'41111','수원권선구':'41113','수원팔달구':'41115','수원영통구':'41117',
  '성남수정구':'41131','성남중원구':'41133','성남분당구':'41135',
  '의정부시':'41150','안양만안구':'41171','안양동안구':'41173',
  '부천소사구':'41192','부천오정구':'41194','부천원미구':'41196',
  '광명시':'41210','고양덕양구':'41281','고양일산동구':'41285','고양일산서구':'41287',
  '구리시':'41310','남양주시':'41360','시흥시':'41390','군포시':'41410',
  '하남시':'41450','용인처인구':'41461','용인기흥구':'41463','용인수지구':'41465',
  '파주시':'41480','화성시':'41590','안산단원구':'41273','안산상록구':'41271',
  '오산시':'41370','안성시':'41550','평택시':'41220','김포시':'41570',
  '양주시':'41630','구리시':'41310','동두천시':'41250',
}

function extractLawdCd(address: string): string | null {
  if (!address) return null
  const sorted = Object.keys(LAWD_MAP).sort((a, b) => b.length - a.length)
  for (const key of sorted) {
    if (address.includes(key)) return LAWD_MAP[key]
  }
  const matches = address.match(/([가-힣]{2,5}(?:구|시|군))/g) || []
  for (const m of matches) {
    if (LAWD_MAP[m]) return LAWD_MAP[m]
  }
  return null
}

function getEndpoint(housingType: string): string {
  const ht = (housingType || '').toLowerCase()
  if (ht.includes('아파트')) return 'RTMSDataSvcAptRent/getRTMSDataSvcAptRent'
  if (ht.includes('오피스텔')) return 'RTMSDataSvcOffiRent/getRTMSDataSvcOffiRent'
  return 'RTMSDataSvcRHRent/getRTMSDataSvcRHRent'
}

function getRecentMonths(n: number): string[] {
  const months: string[] = []
  const now = new Date()
  for (let i = 1; i <= n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

function parseXml(xml: string): Record<string, string>[] {
  const items: Record<string, string>[] = []
  const blocks = xml.match(/<item>([\s\S]*?)<\/item>/g)
  if (!blocks) return items
  for (const block of blocks) {
    const obj: Record<string, string> = {}
    const fields = block.match(/<(\w+)>([^<]*)<\/\1>/g) || []
    for (const f of fields) {
      const m = f.match(/<(\w+)>([^<]*)<\/\1>/)
      if (m) obj[m[1]] = m[2].trim()
    }
    items.push(obj)
  }
  return items
}

function parseWon(v: string | undefined): number {
  return parseInt(String(v || '0').replace(/[^0-9]/g, '')) || 0
}

function calcMarket(deposit: string, transactions: Record<string, string>[]) {
  const dep = parseWon(deposit)
  const deposits = transactions
    .map(t => (parseWon(t['deposit'] || t['보증금'] || t['depositAmount']) * 10000))
    .filter(v => v > 0)
  if (!deposits.length) return { dep, median: 0, medManWon: 0, ratio: null as number | null, sampleCount: 0 }
  deposits.sort((a, b) => a - b)
  const median = deposits[Math.floor(deposits.length / 2)]
  const ratio = dep > 0 && median > 0 ? parseFloat((dep / median * 100).toFixed(1)) : null
  return { dep, median, medManWon: Math.round(median / 10000), ratio, sampleCount: deposits.length }
}

export async function POST(request: NextRequest) {
  try {
    const { address = '', deposit = '', housing_type = '' } = await request.json()
    const dataKey = process.env.DATA_GO_KR_KEY
    const claudeKey = process.env.ANTHROPIC_API_KEY

    let transactions: Record<string, string>[] = []
    let lawdCd: string | null = null

    if (dataKey) {
      lawdCd = extractLawdCd(address)
      if (lawdCd) {
        const months = getRecentMonths(3)
        const endpoint = getEndpoint(housing_type)
        await Promise.allSettled(
          months.map(ym =>
            fetch(
              `https://apis.data.go.kr/1613000/${endpoint}?LAWD_CD=${lawdCd}&DEAL_YMD=${ym}&serviceKey=${encodeURIComponent(dataKey)}&numOfRows=100`,
              { signal: AbortSignal.timeout(8000) }
            )
              .then(r => r.text())
              .then(xml => { transactions.push(...parseXml(xml)) })
              .catch(() => {})
          )
        )
      }
    }

    const mkt = calcMarket(deposit, transactions)
    const depManWon = Math.round(mkt.dep / 10000)
    const riskColorMap: Record<string, string> = { safe: '#22c55e', warn: '#f59e0b', danger: '#ef4444', unknown: '#64748b' }

    if (!claudeKey) {
      // Rule-based fallback
      if (depManWon === 0) {
        return NextResponse.json({ lawdCd, medianDeposit: mkt.medManWon, sampleCount: mkt.sampleCount, ratio: null, risk: 'unknown', riskLabel: '확인필요', riskColor: '#64748b', message: '보증금 정보가 없어 분석할 수 없습니다.' })
      }
      if (mkt.ratio !== null) {
        if (mkt.ratio <= 110) return NextResponse.json({ lawdCd, medianDeposit: mkt.medManWon, sampleCount: mkt.sampleCount, ratio: mkt.ratio, risk: 'safe', riskLabel: '안전', riskColor: '#22c55e', message: `지역 중앙값(${mkt.medManWon.toLocaleString()}만원) 대비 ${mkt.ratio}% 수준으로 적정 범위입니다.` })
        if (mkt.ratio <= 130) return NextResponse.json({ lawdCd, medianDeposit: mkt.medManWon, sampleCount: mkt.sampleCount, ratio: mkt.ratio, risk: 'warn', riskLabel: '주의', riskColor: '#f59e0b', message: `보증금이 지역 중앙값 대비 ${mkt.ratio}%입니다. 등기부등본 선순위 채권을 반드시 확인하세요.` })
        return NextResponse.json({ lawdCd, medianDeposit: mkt.medManWon, sampleCount: mkt.sampleCount, ratio: mkt.ratio, risk: 'danger', riskLabel: '고위험', riskColor: '#ef4444', message: `보증금이 지역 중앙값 대비 ${mkt.ratio}%로 현저히 높습니다. 전문가 상담을 강력 권합니다.` })
      }
      return NextResponse.json({ lawdCd, medianDeposit: 0, sampleCount: 0, ratio: null, risk: 'warn', riskLabel: '확인필요', riskColor: '#f59e0b', message: '실거래가 데이터를 찾지 못했습니다. 국토교통부 실거래가 공개시스템(rt.molit.go.kr)에서 직접 시세를 확인하세요.' })
    }

    const marketInfo = mkt.sampleCount > 0
      ? `최근 3개월 ${mkt.sampleCount}건 거래 중앙값: ${mkt.medManWon.toLocaleString()}만원, 보증금/중앙값 비율: ${mkt.ratio}%`
      : '실거래가 API 데이터 없음 (AI 지식 기반 판단)'

    const prompt = `당신은 한국 주택임대차 보증금 위험도 분석 전문가입니다. 외국인 임차인을 위한 분석을 진행합니다.

계약 정보:
- 주소: ${address || '미입력'}
- 주택 유형: ${housing_type || '미입력'}
- 보증금: ${depManWon > 0 ? depManWon.toLocaleString() + '만원' : '미입력 (0원)'}
- 실거래가 데이터: ${marketInfo}

분석 기준:
1. 실거래가 데이터가 있으면 중앙값 비율로 판단 (110% 이하 safe, 130% 이하 warn, 초과 danger)
2. 데이터가 없으면 주소(지역)와 보증금을 기반으로 AI 지식으로 판단
   - 강남/서초/용산/성동 오피스텔 1억~3억 → 일반적 범위
   - 강남 빌라 전세 3억 이하 → 주의 (전세사기 위험 지역)
   - 경기/인천 1억 이하 → 지역에 따라 safe~warn
3. 보증금 0원 또는 미입력은 unknown 반환
4. 외국인 임차인 특성: 전입신고와 확정일자가 특히 중요함을 언급

반환 형식 (JSON만, 다른 텍스트 없음):
{"risk":"safe|warn|danger|unknown","riskLabel":"안전|주의|고위험|확인필요","message":"한국어 2-3문장. 이 지역/보증금 수준에 대한 구체적 조언 포함."}`

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': claudeKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 400, messages: [{ role: 'user', content: prompt }] }),
        signal: AbortSignal.timeout(15000),
      })
      const data = await res.json()
      const text = data.content?.[0]?.text || ''
      const jsonMatch = text.match(/\{[\s\S]*?\}/)
      if (!jsonMatch) throw new Error('no json')
      const parsed = JSON.parse(jsonMatch[0])
      return NextResponse.json({
        lawdCd,
        medianDeposit: mkt.medManWon,
        sampleCount: mkt.sampleCount,
        ratio: mkt.ratio,
        risk: parsed.risk,
        riskLabel: parsed.riskLabel,
        riskColor: riskColorMap[parsed.risk] || '#64748b',
        message: parsed.message
      })
    } catch {
      // Rule-based fallback when Claude fails
      if (mkt.ratio !== null) {
        if (mkt.ratio <= 110) return NextResponse.json({ lawdCd, medianDeposit: mkt.medManWon, sampleCount: mkt.sampleCount, ratio: mkt.ratio, risk: 'safe', riskLabel: '안전', riskColor: '#22c55e', message: `지역 중앙값(${mkt.medManWon.toLocaleString()}만원) 대비 ${mkt.ratio}% 수준입니다.` })
        if (mkt.ratio <= 130) return NextResponse.json({ lawdCd, medianDeposit: mkt.medManWon, sampleCount: mkt.sampleCount, ratio: mkt.ratio, risk: 'warn', riskLabel: '주의', riskColor: '#f59e0b', message: `보증금이 지역 중앙값 대비 ${mkt.ratio}%입니다. 등기부등본 선순위 채권을 확인하세요.` })
        return NextResponse.json({ lawdCd, medianDeposit: mkt.medManWon, sampleCount: mkt.sampleCount, ratio: mkt.ratio, risk: 'danger', riskLabel: '고위험', riskColor: '#ef4444', message: `보증금이 지역 중앙값 대비 ${mkt.ratio}%로 현저히 높습니다.` })
      }
      return NextResponse.json({ lawdCd, medianDeposit: 0, sampleCount: 0, ratio: null, risk: 'warn', riskLabel: '확인필요', riskColor: '#f59e0b', message: '실거래가 시스템에서 데이터를 가져오지 못했습니다. 국토교통부 실거래가 공개시스템(rt.molit.go.kr)에서 직접 시세를 확인해 주세요.' })
    }
  } catch {
    return NextResponse.json({ risk: 'unknown', riskLabel: '확인필요', message: '분석 중 오류가 발생했습니다.', medianDeposit: 0, sampleCount: 0, ratio: null, riskColor: '#64748b' })
  }
}
