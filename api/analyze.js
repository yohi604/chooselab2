export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY is not set" });

  try {
    const {
      destination,
      tripType,
      duration,
      startDate,
      people,
      season,
      transport,
      notes
    } = req.body || {};

    if (!destination || !tripType || !duration) {
      return res.status(400).json({ error: "destination, tripType, duration are required" });
    }

    const systemPrompt = `
너는 "TripReady"의 여행 준비 설계 도우미다.
목표: 여행 준비의 귀찮음을 줄이고, 빠뜨림 불안을 낮추는 '현실적인 준비 설계'를 제공한다.
톤: 따뜻하지만 중립적, 과장/확신/단정 금지, 판매/공포 조장 금지, 불필요한 장문 금지.
정확성: 지역/규정/가격/운항 등은 변동 가능하므로 "확인 필요"를 적절히 포함한다.
출력: 아래 스키마의 '엄격한 JSON'만 출력 (설명 텍스트/코드펜스 금지).

반환 JSON 스키마:
{
  "trip": {
    "destination": string,
    "trip_type": "국내"|"해외",
    "duration": string,
    "start_date": string|null,
    "people": string|null,
    "season": string|null,
    "transport": string[],
    "notes": string|null
  },
  "summary": string,
  "timeline": {
    "D-14": string[],
    "D-7": string[],
    "D-3": string[],
    "D-1": string[]
  },
  "checklist": {
    "서류/예약": string[],
    "의류": string[],
    "전자기기": string[],
    "위생/생활": string[],
    "기타": string[]
  },
  "common_misses": string[],
  "scores": {
    "prep_complexity": number,
    "risk_level": number,
    "forget_risk": number,
    "start_now": string
  },
  "disclaimer": string
}

규칙:
- 해외면 여권/비자/보험/환전/유심(eSIM)/해외결제/로밍 등을 우선 고려.
- 렌트카/자차면 면허, 국제면허(해외 시), 주차, 보험/면책, 내비/거치대 등을 고려.
- 계절/시기가 입력되면 날씨 변수(장마/한파/폭염)를 반영.
- 아이/부모님 동반 등 notes가 있으면 해당 준비물을 반영.
- 장소 추천이나 일정 코스는 하지 말 것(다음 버전). 오직 '준비/할 일 설계' 중심.
- 너무 디테일한 브랜드/가격/규정 단정 금지. "확인 필요" 포함.
`;

    const userInput = {
      destination,
      tripType,
      duration,
      startDate: startDate || null,
      people: people || null,
      season: season || null,
      transport: Array.isArray(transport) ? transport : [],
      notes: notes || null
    };

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "아래 입력을 바탕으로 JSON만 출력해줘:\n" + JSON.stringify(userInput) }
        ],
        response_format: { type: "json_object" },
        temperature: 0.5,
      }),
    });

    const json = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ error: "OpenAI API error", details: json });
    }

    const text = json.choices?.[0]?.message?.content ?? "";

    const parsed = safeParseJson(text);
    if (!parsed) {
      return res.status(500).json({ error: "Failed to parse model JSON", raw: text });
    }

    parsed.trip ||= {
      destination,
      trip_type: tripType,
      duration,
      start_date: startDate || null,
      people: people || null,
      season: season || null,
      transport: Array.isArray(transport) ? transport : [],
      notes: notes || null
    };

    parsed.disclaimer ||= "참고용 설계이며, 현지/항공사/숙소 정책은 최종 확인이 필요합니다.";
    return res.status(200).json(parsed);

  } catch (e) {
    return res.status(500).json({ error: "Server error", message: e?.message || String(e) });
  }
}

function safeParseJson(text) {
  if (!text) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const sliced = text.slice(start, end + 1);
  try { return JSON.parse(sliced); } catch { return null; }
}
