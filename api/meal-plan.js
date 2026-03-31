let cachedModel = null;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { foods, targets, preferences } = req.body;
  if (!foods || !targets) return res.status(400).json({ error: "Missing foods or targets" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });

  const sanitize = (str) => String(str || "").replace(/[^\x20-\x7E]/g, "").replace(/"/g, "'").trim();

  async function findModel() {
    if (cachedModel) return cachedModel;
    const candidates = ["gemini-2.5-flash","gemini-2.0-flash","gemini-2.0-flash-001","gemini-1.5-flash-latest","gemini-1.5-flash"];
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
    return "gemini-2.0-flash";
  }

  const model = await findModel();

  const ALLOWED_CATEGORIES = ['Protein', 'Carb', 'Fat', 'RTD Protein', 'Snack', 'Dairy', 'Supplements'];

const topFoods = foods
  .filter(f => f.calories > 0 && f.protein_g > 0 && ALLOWED_CATEGORIES.includes(f.category))
  .sort((a, b) => b.protein_g - a.protein_g)
  .slice(0, 50);

  const foodList = topFoods.map(f =>
    `${sanitize(f.name)}|P${f.protein_g}|C${f.carbs_g}|F${f.fat_g}|${f.calories}cal`
  ).join("\n");

  const mealItemSchema = {
    type: "ARRAY",
    items: {
      type: "OBJECT",
      properties: {
        name: { type: "STRING" },
        portions: { type: "INTEGER" }
      },
      required: ["name", "portions"]
    }
  };

  const responseSchema = {
    type: "OBJECT",
    properties: {
      breakfast: mealItemSchema,
      lunch: mealItemSchema,
      dinner: mealItemSchema,
      snacks: mealItemSchema,
      notes: { type: "STRING" }
    },
    required: ["breakfast", "lunch", "dinner", "snacks", "notes"]
  };

  const prompt = `You are a meal planning AI for a bodybuilder on a cut.

MACRO TARGETS: Protein ${targets.protein}g, Carbs ${targets.carbs}g, Fat ${targets.fat}g, Calories ${targets.calories}
${preferences ? `PREFERENCES: ${preferences}` : ""}

AVAILABLE FOODS (name|protein|carbs|fat|calories):
${foodList}

Create a full day meal plan across breakfast, lunch, dinner, snacks using ONLY the foods above.
Match food names exactly. Use integer portions (1, 2, or 3). Hit protein target within 10g.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
            responseSchema
          }
        })
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

    let parsed;
    try {
      const scrubbed = raw.replace(/[\x00-\x1F\x7F]/g, " ");
      parsed = JSON.parse(scrubbed);
    } catch (parseErr) {
      return res.status(500).json({ error: "Invalid JSON", detail: parseErr.message, raw: raw.slice(0, 500) });
    }

    const slots = ["breakfast", "lunch", "dinner", "snacks"];
    for (const slot of slots) {
      if (!Array.isArray(parsed[slot])) parsed[slot] = [];
      parsed[slot] = parsed[slot].filter(item => {
        const match = topFoods.find(f =>
          sanitize(f.name).toLowerCase() === sanitize(item.name || "").toLowerCase()
        );
        if (match) {
          item.name = match.name;
          item.portions = Math.max(1, Math.min(5, Math.round(parseFloat(item.portions) || 1)));
          item.protein_g = match.protein_g;
          item.carbs_g = match.carbs_g;
          item.fat_g = match.fat_g;
          item.calories = match.calories;
          return true;
        }
        return false;
      });
    }

    return res.status(200).json({ ...parsed, _model: model });

  } catch (err) {
    return res.status(500).json({ error: "Server error", detail: err.message });
  }
}
