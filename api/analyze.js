// Vercel Serverless Function
// 실거래가 API 조회 → 보증금 위험도 분석

const LAWD_MAP = {
  // 서울
  '종로구':'11110','용산구':'11170','성동구':'11200','광진구':'11215',
  '동대문구':'11230','중랑구':'11260','성북구':'11290','강북구':'11305',
  '도봉구':'11320','노원구':'11350','은평구':'11380','서대문구':'11410',
  '마포구':'11440','양천구':'11470','강서구':'11500','구로구':'11530',
  '금천구':'11545','영등포구':'11560','동작구':'11590','관악구':'11620',
  '서초구':'11650','강남구':'11680','송파구':'11710','강동구':'11740',
  // 중구/서구/동구/남구/북구는 시/도 조합으로 처리
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
  // 경기 주요
  '수원장안구':'41111','수원권선구':'41113','수원팔달구':'41115','수원영통구':'41117',
  '성남수정구':'41131','성남중원구':'41133','성남분당구':'41135',
  '의정부시':'41150','안양만안구':'41171','안양동안구':'41173',
  '부천소사구':'41192','부천오정구':'41194','부천원미구':'41196',
  '광명시':'41210','평택시':'41220','고양덕양구':'41281','고양일산동구':'41285','고양일산서구':'41287',
  '구리시':'41310','남양주시':'41360','오산시':'41370','시흥시':'41390',
  '군포시':'41410','의왕시':'41430','하남시':'41450',
  '용인처인구':'41461','용인기흥구':'41463','용인수지구':'41465',
  '파주시':'41480','화성시':'41590','안산단원구':'41273','안산상록구':'41271',
};

const AMBIGUOUS = ['중구','서구','동구','남구','북구','강서구'];
const CITY_HINT = {
  '서울':'서울','인천':'인천','부산':'부산','대구':'대구','광주':'광주','대전':'대전',
};

function extractLawdCd(address) {
  if (!address) return null;
  const guMatch = address.match(/([가-힣]+구)/);
  if (!guMatch) return null;
  const gu = guMatch[1];

  if (AMBIGUOUS.includes(gu)) {
    const city = Object.keys(CITY_HINT).find(c => address.includes(c));
    if (city) {
      const key = city + gu;
      if (LAWD_MAP[key]) return LAWD_MAP[key];
    }
  }
  return LAWD_MAP[gu] || null;
}

function getEndpoint(housingType) {
  const ht = (housingType || '').toLowerCase();
  if (ht.includes('아파트')) return 'RTMSDataSvcAptRent/getRTMSDataSvcAptRent';
  if (ht.includes('오피스텔')) return 'RTMSDataSvcOffiRent/getRTMSDataSvcOffiRent';
  return 'RTMSDataSvcRHRent/getRTMSDataSvcRHRent'; // 연립·다세대·빌라 기본
}

function getRecentMonths(n) {
  const months = [];
  const now = new Date();
  for (let i = 1; i <= n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    months.push(`${y}${m}`);
  }
  return months;
}

async function fetchTransactions(endpoint, lawdCd, dealYmd, serviceKey) {
  const url = `https://apis.data.go.kr/1613000/${endpoint}` +
    `?LAWD_CD=${lawdCd}&DEAL_YMD=${dealYmd}&serviceKey=${serviceKey}&_type=json&numOfRows=100`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) return [];
  const json = await res.json();
  const items = json?.response?.body?.items?.item;
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}

function parseWon(v) {
  if (!v && v !== 0) return 0;
  return parseInt(String(v).replace(/[^0-9]/g, '')) || 0;
}

function analyzeRisk(deposit, transactions) {
  const dep = parseWon(deposit); // 원 단위 입력 가정

  if (!transactions.length) {
    return {
      risk: 'unknown', riskLabel: '데이터 없음', riskColor: '#64748b',
      message: '해당 지역·유형의 최근 거래 데이터를 찾을 수 없습니다. 직접 시세를 확인해 주세요.',
      medianDeposit: null, sampleCount: 0, ratio: null,
    };
  }

  // 보증금액 필드명이 API마다 다름 → 여러 키 시도
  const deposits = transactions
    .map(t => parseWon(t['보증금액'] ?? t['보증금'] ?? t['전세금']) * 10000)
    .filter(v => v > 0);

  if (!deposits.length) {
    return {
      risk: 'unknown', riskLabel: '비교 불가', riskColor: '#64748b',
      message: '거래 데이터에서 보증금 정보를 추출할 수 없습니다.',
      medianDeposit: null, sampleCount: 0, ratio: null,
    };
  }

  deposits.sort((a, b) => a - b);
  const median = deposits[Math.floor(deposits.length / 2)];
  const ratio = dep > 0 && median > 0 ? (dep / median * 100).toFixed(1) : null;
  const medManWon = Math.round(median / 10000);

  let risk, riskLabel, riskColor, message;

  if (!dep) {
    risk = 'unknown'; riskLabel = '보증금 미입력'; riskColor = '#64748b';
    message = '집주인 입력 화면에서 보증금을 입력하면 위험도를 분석합니다.';
  } else if (!ratio) {
    risk = 'unknown'; riskLabel = '비교 불가'; riskColor = '#64748b';
    message = '시세 비교 데이터가 부족합니다.';
  } else if (parseFloat(ratio) <= 110) {
    risk = 'safe'; riskLabel: '안전'; riskColor = '#22c55e';
    message = `지역 중앙 보증금(${medManWon.toLocaleString()}만원) 대비 ${ratio}% 수준입니다. 시세 범위 내 보증금입니다.`;
    riskLabel = '안전';
  } else if (parseFloat(ratio) <= 130) {
    risk = 'warn'; riskLabel = '주의'; riskColor = '#f59e0b';
    message = `보증금이 지역 중앙값 대비 ${ratio}%로 다소 높습니다. 등기부등본에서 선순위 채권을 반드시 확인하세요.`;
  } else {
    risk = 'danger'; riskLabel = '고위험'; riskColor = '#ef4444';
    message = `보증금이 지역 중앙값 대비 ${ratio}%로 현저히 높습니다. 전세사기 위험이 있습니다. 전문가 검토를 강력히 권합니다.`;
  }

  return { risk, riskLabel, riskColor, message, medianDeposit: medManWon, sampleCount: deposits.length, ratio };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { address = '', deposit = '', housing_type = '' } = req.body || {};
  const serviceKey = process.env.DATA_GO_KR_KEY;

  if (!serviceKey) {
    return res.json({
      risk: 'unknown', riskLabel: '설정 필요', riskColor: '#64748b',
      message: 'Vercel 환경변수 DATA_GO_KR_KEY를 설정하면 실거래가 분석이 시작됩니다.',
      medianDeposit: null, sampleCount: 0, ratio: null,
    });
  }

  const lawdCd = extractLawdCd(address);
  if (!lawdCd) {
    return res.json({
      risk: 'unknown', riskLabel: '주소 인식 불가', riskColor: '#64748b',
      message: `'${address}' 에서 지역코드를 추출할 수 없습니다. 주소에 구(區) 단위를 포함해 주세요.`,
      medianDeposit: null, sampleCount: 0, ratio: null,
    });
  }

  const months = getRecentMonths(3);
  const endpoint = getEndpoint(housing_type);
  let transactions = [];

  await Promise.allSettled(
    months.map(ym =>
      fetchTransactions(endpoint, lawdCd, ym, serviceKey)
        .then(data => { transactions.push(...data); })
        .catch(() => {})
    )
  );

  const analysis = analyzeRisk(deposit, transactions);
  return res.json({ lawdCd, ...analysis });
};
