// Cache the model name across warm serverless invocations
let cachedModel = null;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { foods, targets, preferences } = req.body;
  if (!foods || !targets) return res.status(400).json({ error: "Missing foods or targets" });

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

  // Build a concise food list for the prompt
  const foodList = foods.map(f =>
    `${f.name}|${f.portion_size}${f.portion_unit}|P${f.protein_g}|C${f.carbs_g}|F${f.fat_g}|${f.calories}cal`
  ).join("\n");

  const prompt = `You are a meal planning AI for a bodybuilder on a cut. Create a full day meal plan using ONLY the foods listed below.

MACRO TARGETS:
- Protein: ${targets.protein}g
- Carbs: ${targets.carbs}g
- Fat: ${targets.fat}g
- Calories: ${targets.calories}

${preferences ? `PREFERENCES: ${preferences}` : ""}

AVAILABLE FOODS (name|serving|protein|carbs|fat|calories):
${foodList}

RULES:
- Use ONLY foods from the list above — do not invent foods
- Match the food names EXACTLY as written
- Hit protein target within 10g, calories within 100
- Use reasonable portions (0.5 to 3 servings)
- Spread protein across all meals
- Include 4 meals: breakfast, lunch, dinner, snacks
- Prioritize high-protein foods to hit the protein target
- Keep it practical — not 10 items per meal

Return ONLY valid JSON, no markdown, no explanation:
{
  "breakfast": [{"name": "exact food name", "portions": 1}],
  "lunch": [{"name": "exact food name", "portions": 1}],
  "dinner": [{"name": "exact food name", "portions": 1}],
  "snacks": [{"name": "exact food name", "portions": 1}],
  "totals": {"protein": 0, "carbs": 0, "fat": 0, "calories": 0},
  "notes": "brief note about the plan"
}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 2048, responseMimeType: "application/json" },,
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

    if (!raw || raw.trim().length === 0) {
      return res.status(500).json({ error: "Empty response from Gemini" });
    }

    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      return res.status(500).json({ error: "No JSON in response", detail: raw.slice(0, 200) });
    }

    let parsed;
    try {
      parsed = JSON.parse(raw.slice(start, end + 1));
    } catch (parseErr) {
      return res.status(500).json({ error: "Invalid JSON", detail: parseErr.message });
    }

    // Validate food names against the actual food list
    const foodNames = new Set(foods.map(f => f.name.toLowerCase()));
    const slots = ["breakfast", "lunch", "dinner", "snacks"];
    for (const slot of slots) {
      if (!Array.isArray(parsed[slot])) parsed[slot] = [];
      parsed[slot] = parsed[slot].filter(item => {
        const match = foods.find(f => f.name.toLowerCase() === item.name?.toLowerCase());
        if (match) {
          item.name = match.name; // normalize casing
          item.portions = Math.max(0.25, Math.min(5, parseFloat(item.portions) || 1));
          return true;
        }
        return false; // drop foods not in the database
      });
    }

    return res.status(200).json({ ...parsed, _model: model });

  } catch (err) {
    return res.status(500).json({ error: "Server error", detail: err.message });
  }
}
