export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { text, imageBase64, mimeType } = req.body;
  if (!text && !imageBase64) return res.status(400).json({ error: "No input provided" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });

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
- If multiple foods are described (e.g. "2 eggs and toast"), combine them into one entry with a combined name
- Round all numbers to 1 decimal place
- Use common portion units: serving, g, oz, cup, tbsp, piece, slice
- If you see a nutrition label in an image, use those exact numbers
- If estimating from a photo of a meal, note that in the notes field
- calories must equal roughly protein_g*4 + carbs_g*4 + fat_g*9

Food to analyze: ${text || "See image"}`;

  // Build content parts
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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
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

    // Strip any markdown fences just in case
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: "Failed to parse response", detail: err.message });
  }
}
