// Supabase 계약 데이터 CRUD
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Supabase 환경변수 미설정' });
  }

  const base = `${SUPABASE_URL}/rest/v1/contracts`;
  const headers = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };

  const { id } = req.query;

  // 계약서 조회
  if (req.method === 'GET') {
    if (!id) return res.status(400).json({ error: 'id 필요' });
    const r = await fetch(`${base}?id=eq.${id}&select=*`, { headers });
    const data = await r.json();
    return res.json(data[0] || null);
  }

  // 계약서 생성 (집주인)
  if (req.method === 'POST') {
    const r = await fetch(base, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=representation' },
      body: JSON.stringify(req.body),
    });
    const data = await r.json();
    return res.json(data[0] || null);
  }

  // 세입자 정보 업데이트
  if (req.method === 'PATCH') {
    if (!id) return res.status(400).json({ error: 'id 필요' });
    const r = await fetch(`${base}?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Prefer': 'return=representation' },
      body: JSON.stringify(req.body),
    });
    const data = await r.json();
    return res.json(data[0] || null);
  }

  return res.status(405).end();
};
