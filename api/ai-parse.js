export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { text, imageBase64, mimeType } = req.body;
  if (!text && !imageBase64) return res.status(400).json({ error: "No input provided" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });

  // Auto-detect which model is available for this API key
  async function findModel() {
    const candidates = [
      "gemini-2.5-flash",
      "gemini-2.5-pro",
      "gemini-2.0-flash-001",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
      "gemini-1.5-flash-latest",
      "gemini-1.5-flash-001",
      "gemini-1.5-flash",
      "gemini-1.0-pro",
    ];
    try {
      const listRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );
      if (listRes.ok) {
        const listData = await listRes.json();
        const available = (listData.models || [])
          .filter(m => (m.supportedGenerationMethods || []).includes("generateContent"))
          .map(m => m.name.replace("models/", ""));
        for (const c of candidates) {
          if (available.includes(c)) return c;
        }
        const fallback = available.find(m => m.includes("flash")) || available[0];
        if (fallback) return fallback;
      }
    } catch {}
    return "gemini-2.5-flash";
  }

  const model = await findModel();

  const prompt = `You are a nutrition expert. Analyze the food described or shown and return ONLY a JSON object with these exact fields. No markdown, no explanation, just raw JSON.

{
  "name": "short food name",
  "portion_size": 1,
  "portion_unit": "serving",
  "protein_g": 0,
  "carbs_g": 0,
  "fat_g": 0,
  "calories": 0,
  "notes": "optional short note about accuracy"
}

Rules:
- If multiple foods are described, combine into one entry with a combined name
- Round all numbers to 1 decimal place
- Use common portion units: serving, g, oz, cup, tbsp, piece, slice
- If you see a nutrition label in an image, use those exact numbers
- If estimating from a photo of a meal, note that in the notes field
- calories must equal roughly protein_g*4 + carbs_g*4 + fat_g*9

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
          generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: "Gemini error", detail: err });
    }

    const data = await response.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return res.status(200).json({ ...parsed, _model: model });
  } catch (err) {
    return res.status(500).json({ error: "Failed to parse response", detail: err.message });
  }
}
