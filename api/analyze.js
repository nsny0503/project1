// Vercel Serverless Function
// 실거래가 API 조회 → Claude AI 계약 위험도 분석

const LAWD_MAP = {
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
};

const AMBIGUOUS = ['중구','서구','동구','남구','북구','강서구'];
const CITY_HINT = ['서울','인천','부산','대구','광주','대전'];

function extractLawdCd(address) {
  if (!address) return null;
  const guMatch = address.match(/([가-힣]+구)/);
  if (!guMatch) return null;
  const gu = guMatch[1];
  if (AMBIGUOUS.includes(gu)) {
    const city = CITY_HINT.find(c => address.includes(c));
    if (city && LAWD_MAP[city + gu]) return LAWD_MAP[city + gu];
  }
  return LAWD_MAP[gu] || null;
}

function getEndpoint(housingType) {
  const ht = (housingType || '').toLowerCase();
  if (ht.includes('아파트')) return 'RTMSDataSvcAptRent/getRTMSDataSvcAptRent';
  if (ht.includes('오피스텔')) return 'RTMSDataSvcOffiRent/getRTMSDataSvcOffiRent';
  return 'RTMSDataSvcRHRent/getRTMSDataSvcRHRent';
}

function getRecentMonths(n) {
  const months = [];
  const now = new Date();
  for (let i = 1; i <= n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

function parseXml(xml) {
  const items = [];
  const blocks = xml.match(/<item>([\s\S]*?)<\/item>/g);
  if (!blocks) return items;
  for (const block of blocks) {
    const obj = {};
    const fields = block.match(/<(\w+)>([^<]*)<\/\1>/g) || [];
    for (const f of fields) {
      const m = f.match(/<(\w+)>([^<]*)<\/\1>/);
      if (m) obj[m[1]] = m[2].trim();
    }
    items.push(obj);
  }
  return items;
}

async function fetchTransactions(endpoint, lawdCd, dealYmd, serviceKey) {
  const url = `https://apis.data.go.kr/1613000/${endpoint}` +
    `?LAWD_CD=${lawdCd}&DEAL_YMD=${dealYmd}&serviceKey=${serviceKey}&numOfRows=100`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return [];
  const xml = await res.text();
  return parseXml(xml);
}

function parseWon(v) {
  return parseInt(String(v || '0').replace(/[^0-9]/g, '')) || 0;
}

function calcMarket(deposit, transactions) {
  const dep = parseWon(deposit);
  // 기술문서 기준 필드명: deposit (보증금액, 만원 단위)
  const deposits = transactions
    .map(t => parseWon(t['deposit']) * 10000)
    .filter(v => v > 0);

  if (!deposits.length) return { dep, median: 0, medManWon: 0, ratio: null, sampleCount: 0 };

  deposits.sort((a, b) => a - b);
  const median = deposits[Math.floor(deposits.length / 2)];
  const ratio = dep > 0 && median > 0 ? parseFloat((dep / median * 100).toFixed(1)) : null;
  return { dep, median, medManWon: Math.round(median / 10000), ratio, sampleCount: deposits.length };
}

async function callClaude(prompt, apiKey) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error('Claude API error');
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { address = '', deposit = '', housing_type = '' } = req.body || {};
  const dataKey = process.env.DATA_GO_KR_KEY;
  const claudeKey = process.env.ANTHROPIC_API_KEY;

  // 1. 실거래가 조회
  let transactions = [];
  let lawdCd = null;

  if (dataKey) {
    lawdCd = extractLawdCd(address);
    if (lawdCd) {
      const months = getRecentMonths(3);
      const endpoint = getEndpoint(housing_type);
      await Promise.allSettled(
        months.map(ym =>
          fetchTransactions(endpoint, lawdCd, ym, dataKey)
            .then(d => { transactions.push(...d); })
            .catch(() => {})
        )
      );
    }
  }

  // 2. 시세 수치 계산
  const mkt = calcMarket(deposit, transactions);

  // 3. Claude AI 분석
  let riskLabel, riskColor, message;

  if (claudeKey) {
    const depManWon = Math.round(mkt.dep / 10000);
    const prompt = `당신은 한국 임대차 계약 리스크 분석 전문가입니다.
아래 계약 정보를 분석하고 JSON만 반환하세요. 다른 텍스트 없이 JSON만.

계약 정보:
- 주소: ${address}
- 주택 유형: ${housing_type || '미입력'}
- 보증금: ${depManWon > 0 ? depManWon.toLocaleString() + '만원' : '미입력'}
- 지역 최근 거래 중앙값: ${mkt.medManWon > 0 ? mkt.medManWon.toLocaleString() + '만원 (' + mkt.sampleCount + '건)' : '데이터 없음'}
- 보증금/중앙값 비율: ${mkt.ratio !== null ? mkt.ratio + '%' : '산출 불가'}

반환 형식 (JSON):
{
  "risk": "safe" | "warn" | "danger" | "unknown",
  "riskLabel": "안전" | "주의" | "고위험" | "확인필요",
  "message": "한국어로 2-3문장. 위험 요소와 확인해야 할 사항 포함."
}`;

    try {
      const raw = await callClaude(prompt, claudeKey);
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        riskLabel = parsed.riskLabel;
        message = parsed.message;
        const colorMap = { safe: '#22c55e', warn: '#f59e0b', danger: '#ef4444', unknown: '#64748b' };
        riskColor = colorMap[parsed.risk] || '#64748b';
      } else {
        throw new Error('JSON not found');
      }
    } catch (e) {
      // Claude 실패 시 룰 기반으로 폴백
      riskLabel = null;
    }
  }

  // Claude 미설정 또는 실패 시 룰 기반
  if (!riskLabel) {
    if (!mkt.ratio) {
      riskLabel = '데이터 없음'; riskColor = '#64748b';
      message = '해당 지역 실거래 데이터가 없습니다. 직접 시세를 확인해 주세요.';
    } else if (mkt.ratio <= 110) {
      riskLabel = '안전'; riskColor = '#22c55e';
      message = `지역 중앙값(${mkt.medManWon.toLocaleString()}만원) 대비 ${mkt.ratio}% 수준입니다. 시세 범위 내 보증금입니다.`;
    } else if (mkt.ratio <= 130) {
      riskLabel = '주의'; riskColor = '#f59e0b';
      message = `보증금이 지역 중앙값 대비 ${mkt.ratio}%입니다. 등기부등본 선순위 채권을 반드시 확인하세요.`;
    } else {
      riskLabel = '고위험'; riskColor = '#ef4444';
      message = `보증금이 지역 중앙값 대비 ${mkt.ratio}%로 현저히 높습니다. 전세사기 위험이 있으니 전문가 검토를 권합니다.`;
    }
  }

  return res.json({ lawdCd, medianDeposit: mkt.medManWon, sampleCount: mkt.sampleCount, ratio: mkt.ratio, riskLabel, riskColor, message });
};
