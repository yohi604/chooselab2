export const config = {
  runtime: 'edge', // Vercel Edge Runtime (빠르고 저렴함)
};

export default async function handler(req) {
  // CORS 설정
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    const body = await req.json();
    const {
      destination,
      tripType,
      duration,
      startDate,
      people,
      season,
      transport,
      notes
    } = body;

    if (!destination || !tripType || !duration) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `
당신은 "TripReady"의 전문 여행 설계 어시스턴트입니다.
사용자의 여행 상황을 분석하여 가장 현실적이고 유용한 "준비 리스트"와 "타임라인"을 JSON으로 반환하세요.

[원칙]
1. 막연한 정보보다는 구체적인 행동 지침을 제공할 것.
2. 해외 여행 시 여권 유효기간, 비자, 로밍, 환전 등을 최우선 체크.
3. 톤앤매너: 꼼꼼하지만 친절하게. 불안감을 조성하지 말고 '준비됨'의 안도감을 줄 것.
4. 반드시 아래 JSON 포맷을 준수할 것.

[반환 JSON 스키마]
{
  "summary": "이번 여행의 핵심 준비 포인트 2~3문장 요약",
  "timeline": {
    "D-30 (또는 D-14)": ["할일1", "할일2"],
    "D-7": ["할일1", "할일2"],
    "D-1": ["할일1", "할일2"]
  },
  "checklist": {
    "필수 서류/예약": ["항목1", "항목2"],
    "의류/패션": ["항목1", "항목2"],
    "전자기기/어댑터": ["항목1", "항목2"],
    "세면/상비약": ["항목1", "항목2"],
    "기타/꿀템": ["항목1", "항목2"]
  },
  "common_misses": ["사람들이 자주 빠뜨리는 것 1", "놓치기 쉬운 것 2", "현지 주의사항"],
  "scores": {
    "prep_complexity": 1~10 숫자 (준비 난이도),
    "risk_level": 1~10 숫자 (현지 리스크/변수),
    "forget_risk": 1~10 숫자 (준비물 누락 위험도),
    "start_now": "지금 당장" 또는 "D-14부터" 등 추천 시작 시점
  },
  "trip": {
    "destination": "${destination}",
    "trip_type": "${tripType}",
    "duration": "${duration}"
  }
}
`;

    const userMessage = JSON.stringify({
      destination,
      tripType,
      duration,
      startDate: startDate || "미정",
      people: people || "미정",
      season: season || "미정",
      transport: transport || [],
      notes: notes || ""
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    const resultText = data.choices[0].message.content;

    return new Response(resultText, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
