let cachedModel = null;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { text, imageBase64, mimeType } = req.body;
  if (!text && !imageBase64) return res.status(400).json({ error: "No input provided" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });

  async function findModel() {
    if (cachedModel) return cachedModel;
    const candidates = [
      "gemini-2.5-flash","gemini-2.5-pro","gemini-2.0-flash-001",
      "gemini-2.0-flash","gemini-2.0-flash-lite","gemini-1.5-flash-latest",
      "gemini-1.5-flash-001","gemini-1.5-flash","gemini-1.0-pro",
    ];
    try {
      const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (listRes.ok) {
        const listData = await listRes.json();
        const available = (listData.models || [])
          .filter(m => (m.supportedGenerationMethods || []).includes("generateContent"))
          .map(m => m.name.replace("models/", ""));
        for (const c of candidates) {
          if (available.includes(c)) { cachedModel = c; return c; }
        }
        const fallback = available.find(m => m.includes("flash")) || available[0];
        if (fallback) { cachedModel = fallback; return fallback; }
      }
    } catch {}
    return "gemini-2.5-flash";
  }

  const model = await findModel();

  const prompt = `You are a nutrition expert. Analyze the food described or shown.
Return ONLY a valid JSON object — no markdown, no code fences, no explanation, nothing before or after the JSON.

{
  "name": "short food name",
  "portion_size": 1,
  "portion_unit": "serving",
  "protein_g": 0,
  "carbs_g": 0,
  "fat_g": 0,
  "calories": 0,
  "notes": ""
}

Rules:
- If multiple foods are described, combine into one entry
- Round all numbers to 1 decimal place
- If you see a nutrition label, use those exact numbers
- If estimating from a photo, keep notes brief
- Start your response with { and end with }

Food to analyze: ${text || "See image"}`;

  const parts = [{ text: prompt }];
  if (imageBase64) {
    parts.push({ inline_data: { mime_type: mimeType || "image/jpeg", data: imageBase64 } });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
        }),
      }
    );

    if (!response.ok) {
      cachedModel = null;
      const err = await response.text();
      return res.status(500).json({ error: "Gemini error", detail: err });
    }

    const data = await response.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Robustly extract JSON — find first { and last }
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      return res.status(500).json({ error: "Failed to parse response", detail: `No JSON found in: ${raw.slice(0, 100)}` });
    }
    const jsonStr = raw.slice(start, end + 1);
    const parsed = JSON.parse(jsonStr);
    return res.status(200).json({ ...parsed, _model: model });

  } catch (err) {
    return res.status(500).json({ error: "Failed to parse response", detail: err.message });
  }
}
