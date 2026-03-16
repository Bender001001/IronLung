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

  // Compact prompt — fewer output tokens needed = less chance of truncation
  const prompt = `Analyze this food and return ONLY valid JSON, nothing else, no markdown.
Format: {"name":"...","portion_size":1,"portion_unit":"serving","protein_g":0,"carbs_g":0,"fat_g":0,"calories":0,"notes":""}
Rules: combine multiple foods into one entry, round to 1 decimal, use exact label numbers if visible, estimate if photo.
Food: ${text || "See image"}`;

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
          generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
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

    // Extract JSON between first { and last }
    const start = raw.indexOf("{");
    let end = raw.lastIndexOf("}");

    if (start === -1) {
      return res.status(500).json({ error: "Failed to parse response", detail: `No JSON in: ${raw.slice(0,120)}` });
    }

    // If truncated (no closing brace), attempt to repair by closing open fields
    let jsonStr;
    if (end === -1 || end <= start) {
      // Try to salvage by extracting whatever fields parsed before truncation
      let partial = raw.slice(start);
      // Close any open string and the object
      if (!partial.endsWith("}")) {
        // Find last complete key:value pair by looking for last comma or last complete value
        const lastComma = partial.lastIndexOf(",");
        const lastColon = partial.lastIndexOf(":");
        if (lastComma > 0) {
          partial = partial.slice(0, lastComma) + "}";
        } else if (lastColon > 0) {
          // Incomplete value — drop the last field entirely
          const secondLastComma = partial.lastIndexOf(",", lastColon);
          partial = secondLastComma > 0 ? partial.slice(0, secondLastComma) + "}" : '{"name":"Unknown food","portion_size":1,"portion_unit":"serving","protein_g":0,"carbs_g":0,"fat_g":0,"calories":0,"notes":"Could not fully parse"}';
        }
      }
      jsonStr = partial;
    } else {
      jsonStr = raw.slice(start, end + 1);
    }

    const parsed = JSON.parse(jsonStr);
    return res.status(200).json({ ...parsed, _model: model });

  } catch (err) {
    return res.status(500).json({ error: "Failed to parse response", detail: err.message });
  }
}
