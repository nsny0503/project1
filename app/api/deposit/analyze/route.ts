import { NextRequest, NextResponse } from 'next/server'

const LAWD_MAP: Record<string, string> = {
  '종로구':'11110','용산구':'11170','성동구':'11200','광진구':'11215',
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
}

function extractLawdCd(address: string): string | null {
  if (!address) return null
  const sorted = Object.keys(LAWD_MAP).sort((a, b) => b.length - a.length)
  for (const key of sorted) {
    if (address.includes(key)) return LAWD_MAP[key]
  }
  const shortMatch = address.match(/([가-힣]{2,4})(구)?/g) || []
  for (const m of shortMatch) {
    const candidate = m.endsWith('구') ? m : m + '구'
    if (LAWD_MAP[candidate]) return LAWD_MAP[candidate]
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
  const deposits = transactions.map(t => parseWon(t['deposit']) * 10000).filter(v => v > 0)
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
            fetch(`https://apis.data.go.kr/1613000/${endpoint}?LAWD_CD=${lawdCd}&DEAL_YMD=${ym}&serviceKey=${dataKey}&numOfRows=100`, { signal: AbortSignal.timeout(8000) })
              .then(r => r.text())
              .then(xml => { transactions.push(...parseXml(xml)) })
              .catch(() => {})
          )
        )
      }
    }

    const mkt = calcMarket(deposit, transactions)
    let risk = 'unknown', riskLabel = '확인필요', message = '해당 지역 실거래 데이터를 찾을 수 없습니다. 직접 시세를 확인해 주세요.'
    const riskColorMap: Record<string, string> = { safe: '#22c55e', warn: '#f59e0b', danger: '#ef4444', unknown: '#64748b' }

    if (claudeKey) {
      const depManWon = Math.round(mkt.dep / 10000)
      const prompt = `당신은 한국 임대차 계약 리스크 분석 전문가입니다.\n아래 계약 정보를 분석하고 JSON만 반환하세요.\n\n계약 정보:\n- 주소: ${address}\n- 주택 유형: ${housing_type || '미입력'}\n- 보증금: ${depManWon > 0 ? depManWon.toLocaleString() + '만원' : '미입력'}\n- 지역 최근 거래 중앙값: ${mkt.medManWon > 0 ? mkt.medManWon.toLocaleString() + '만원 (' + mkt.sampleCount + '건)' : '데이터 없음'}\n- 보증금/중앙값 비율: ${mkt.ratio !== null ? mkt.ratio + '%' : '산출 불가'}\n\n반환 형식 (JSON):\n{"risk":"safe|warn|danger|unknown","riskLabel":"안전|주의|고위험|확인필요","message":"한국어로 2-3문장."}`
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
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          risk = parsed.risk; riskLabel = parsed.riskLabel; message = parsed.message
        } else throw new Error('no json')
      } catch {
        // fallback to rule-based
        if (mkt.ratio !== null) {
          if (mkt.ratio <= 110) { risk = 'safe'; riskLabel = '안전'; message = `지역 중앙값(${mkt.medManWon.toLocaleString()}만원) 대비 ${mkt.ratio}% 수준입니다.` }
          else if (mkt.ratio <= 130) { risk = 'warn'; riskLabel = '주의'; message = `보증금이 지역 중앙값 대비 ${mkt.ratio}%입니다. 등기부등본 선순위 채권을 반드시 확인하세요.` }
          else { risk = 'danger'; riskLabel = '고위험'; message = `보증금이 지역 중앙값 대비 ${mkt.ratio}%로 현저히 높습니다. 전문가 검토를 권합니다.` }
        }
      }
    } else if (mkt.ratio !== null) {
      if (mkt.ratio <= 110) { risk = 'safe'; riskLabel = '안전'; message = `지역 중앙값(${mkt.medManWon.toLocaleString()}만원) 대비 ${mkt.ratio}% 수준입니다.` }
      else if (mkt.ratio <= 130) { risk = 'warn'; riskLabel = '주의'; message = `보증금이 지역 중앙값 대비 ${mkt.ratio}%입니다. 등기부등본 선순위 채권을 반드시 확인하세요.` }
      else { risk = 'danger'; riskLabel = '고위험'; message = `보증금이 지역 중앙값 대비 ${mkt.ratio}%로 현저히 높습니다.` }
    }

    return NextResponse.json({ lawdCd, medianDeposit: mkt.medManWon, sampleCount: mkt.sampleCount, ratio: mkt.ratio, risk, riskLabel, riskColor: riskColorMap[risk] || '#64748b', message })
  } catch {
    return NextResponse.json({ risk: 'unknown', riskLabel: '확인필요', message: '분석 중 오류가 발생했습니다.', medianDeposit: 0, sampleCount: 0, ratio: null, riskColor: '#64748b' })
  }
}
