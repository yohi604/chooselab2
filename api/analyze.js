export const config = {
  runtime: 'edge', // Vercel Edge Runtime 사용 (더 빠르고 저렴)
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
      throw new Error('OPENAI_API_KEY is missing');
    }

    const body = await req.json();
    const { situation, options, emotion } = body;

    if (!situation || !Array.isArray(options) || options.length < 2 || !emotion) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 시스템 프롬프트: JSON 구조 강제 및 바이럴 요소(share_summary) 추가
    const systemPrompt = `
당신은 "선택연구소"의 냉철하지만 따뜻한 AI 분석가입니다.
사용자의 고민, 선택지, 감정을 분석하여 명쾌하게 정리해야 합니다.

[원칙]
1. 정답을 강요하지 말고, 관점을 정리해 줄 것.
2. 톤: 차분함, 분석적, 공감하지만 감정에 매몰되지 않음.
3. 반드시 아래 JSON 스키마를 엄격히 준수할 것.

[출력 JSON 스키마]
{
  "emotion_summary": "사용자의 현재 감정 상태를 1-2문장으로 해석",
  "pattern_analysis": "이 고민에서 보이는 사용자의 결정 패턴이나 맹점 분석",
  "risks": ["선택 시 고려해야 할 잠재적 리스크 1", "리스크 2", "리스크 3"],
  "future_message": "이 선택 후 1년 뒤의 나에게 보내는 짧은 메시지",
  "recommendation": "지금 당장 실행해볼 수 있는 구체적인 행동 가이드 (A/B 중 하나를 고르라는 말 대신, 판단 기준을 제시)",
  "share_summary": "SNS 공유용 한 줄 요약 (예: '불안은 신호등일 뿐, 멈춤 신호가 아니다. 내 선택은 ___였다.')",
  "scores": {
    "feasibility": 0~100 숫자 (실행 가능성),
    "emotion_influence": 0~100 숫자 (감정이 판단을 흐리는 정도),
    "regret_probability": 0~100 숫자 (후회 확률),
    "risk_sensitivity": 0~100 숫자 (리스크 민감도)
  },
  "disclaimer": "이 결과는 참고용이며, 최종 선택의 책임은 본인에게 있습니다."
}
`;

    const userMessage = JSON.stringify({
      situation,
      emotion,
      options
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
        response_format: { type: "json_object" }, // JSON 모드 강제
        temperature: 0.7,
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    const resultText = data.choices[0].message.content;

    // CORS 헤더 포함하여 응답 반환
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
