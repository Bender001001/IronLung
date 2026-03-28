// Cache the model name across warm serverless invocations
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
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-2.0-flash-001",
      "gemini-2.0-flash-lite",
      "gemini-1.5-flash-latest",
      "gemini-1.5-flash",
      "gemini-1.5-pro",
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
          if (available.includes(c)) { cachedModel = c; return c; }
        }
        const fallback = available.find(m => m.includes("flash")) || available[0];
        if (fallback) { cachedModel = fallback; return fallback; }
      }
    } catch {}
    return "gemini-2.5-flash";
  }

  const model = await findModel();

  const prompt = `You are a nutrition database. Given a food description, return accurate macronutrient data as a JSON object.

IMPORTANT: You MUST return real nutritional data. Never return zeros unless the food truly has zero of that macro. If you are unsure of exact values, give your best reasonable estimate based on typical serving sizes from restaurants, USDA data, or common nutrition databases.

Return ONLY a valid JSON object — no markdown, no code fences, no explanation. Start with { and end with }.

{
  "name": "descriptive food name",
  "portion_size": 1,
  "portion_unit": "serving",
  "protein_g": 0,
  "carbs_g": 0,
  "fat_g": 0,
  "calories": 0,
  "notes": "brief note about source or accuracy"
}

Rules:
- For restaurant/fast food items, use the restaurant's published nutrition data if you know it
- If multiple foods are described, combine into one entry with a combined name
- Round all numbers to 1 decimal place
- Use common portion units: serving, g, oz, cup, tbsp, piece, slice
- If you see a nutrition label in an image, use those exact numbers
- If estimating from a photo of a meal, note that in the notes field
- calories should roughly equal protein_g*4 + carbs_g*4 + fat_g*9
- NEVER return all zeros — if you cannot identify the food, set name to "Unknown" and estimate generously

Food to analyze: ${text || "See attached image"}`;

  const parts = [{ text: prompt }];
  if (imageBase64) {
    parts.push({
      inline_data: {
        mime_type: mimeType || "image/jpeg",
        data: imageBase64,
      },
    });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
        }),
      }
    );

    if (!response.ok) {
      cachedModel = null; // Reset cache on error so next call re-detects
      const err = await response.text();
      return res.status(500).json({ error: "Gemini error", detail: err });
    }

    const data = await response.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Check for blocked/empty responses
    if (!raw || raw.trim().length === 0) {
      const finishReason = data.candidates?.[0]?.finishReason;
      return res.status(500).json({
        error: "Empty response from Gemini",
        detail: `finishReason: ${finishReason || "unknown"}. The model returned no content.`
      });
    }

    // Robustly extract JSON — find first { and last }
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      return res.status(500).json({ error: "Failed to parse response", detail: `No JSON found in: ${raw.slice(0, 200)}` });
    }
    const jsonStr = raw.slice(start, end + 1);

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      return res.status(500).json({ error: "Invalid JSON from Gemini", detail: `${parseErr.message} — raw: ${jsonStr.slice(0, 200)}` });
    }

    // Validate: if all macros are zero, something went wrong
    const p = parseFloat(parsed.protein_g) || 0;
    const c = parseFloat(parsed.carbs_g) || 0;
    const f = parseFloat(parsed.fat_g) || 0;
    const cal = parseFloat(parsed.calories) || 0;

    if (p === 0 && c === 0 && f === 0 && cal === 0) {
      // Retry once with a more forceful prompt
      const retryPrompt = `The food "${text || "in the image"}" definitely has calories. Look up the nutrition facts for this specific item. Even if unsure, give your best estimate. Return ONLY JSON: {"name":"...","portion_size":1,"portion_unit":"serving","protein_g":0,"carbs_g":0,"fat_g":0,"calories":0,"notes":"..."}`;
      const retryParts = [{ text: retryPrompt }];
      if (imageBase64) retryParts.push({ inline_data: { mime_type: mimeType || "image/jpeg", data: imageBase64 } });

      try {
        const retryRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: retryParts }],
              generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
            }),
          }
        );
        if (retryRes.ok) {
          const retryData = await retryRes.json();
          const retryRaw = retryData.candidates?.[0]?.content?.parts?.[0]?.text || "";
          const rs = retryRaw.indexOf("{");
          const re = retryRaw.lastIndexOf("}");
          if (rs !== -1 && re > rs) {
            const retryParsed = JSON.parse(retryRaw.slice(rs, re + 1));
            return res.status(200).json({ ...retryParsed, _model: model, _retried: true });
          }
        }
      } catch {}

      // If retry also failed, return original with a warning
      parsed.notes = (parsed.notes || "") + " — Warning: all values returned as zero, may be inaccurate";
    }

    return res.status(200).json({ ...parsed, _model: model });

  } catch (err) {
    return res.status(500).json({ error: "Failed to parse response", detail: err.message });
  }
}
