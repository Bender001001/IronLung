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

  const eligible = foods.filter(f => f.calories > 0 && ALLOWED_CATEGORIES.includes(f.category));

  // Macro-weighted score: weight each macronutrient by its share of the target
  const totalMacroTarget = (targets.protein || 1) + (targets.carbs || 1) + (targets.fat || 1);
  const pW = (targets.protein || 1) / totalMacroTarget;
  const cW = (targets.carbs || 1) / totalMacroTarget;
  const fW = (targets.fat || 1) / totalMacroTarget;

  const scored = eligible.map(f => ({
    ...f,
    _score: (f.protein_g * pW) + (f.carbs_g * cW) + (f.fat_g * fW)
  })).sort((a, b) => b._score - a._score);

  // Pool: top 15 by balanced score, then top 10 pure carb sources, then top 5 pure protein sources
  const pool15 = scored.slice(0, 15);
  const usedIds = new Set(pool15.map(f => f.id));

  const carbPool = eligible
    .filter(f => !usedIds.has(f.id))
    .sort((a, b) => b.carbs_g - a.carbs_g)
    .slice(0, 10);
  carbPool.forEach(f => usedIds.add(f.id));

  const protPool = eligible
    .filter(f => !usedIds.has(f.id))
    .sort((a, b) => b.protein_g - a.protein_g)
    .slice(0, 5);

  const topFoods = [...pool15, ...carbPool, ...protPool];

  const foodList = topFoods.map((f, i) =>
    `${i}|${sanitize(f.name)}|P${f.protein_g}|C${f.carbs_g}|F${f.fat_g}|${f.calories}cal`
  ).join("\n");

  const mealItemSchema = {
    type: "ARRAY",
    items: {
      type: "OBJECT",
      properties: {
        index: { type: "INTEGER" },
        portions: { type: "INTEGER" }
      },
      required: ["index", "portions"]
    }
  };

  const responseSchema = {
    type: "OBJECT",
    properties: {
      breakfast: mealItemSchema,
      lunch: mealItemSchema,
      dinner: mealItemSchema,
      snacks: mealItemSchema,
    },
    required: ["breakfast", "lunch", "dinner", "snacks"]
  };

  const prompt = `You are a precision meal planning AI for a bodybuilder on a cut. Your job is to hit ALL three macro targets accurately.

MACRO TARGETS — priority order:
1. Calories: ${targets.calories}kcal (HARD LIMIT — stay within +100/-200. Never exceed by more than 100.)
2. Protein: ${targets.protein}g (within ±15g)
3. Fat: ${targets.fat}g (within ±15g)
4. Carbs: ${targets.carbs}g (hit as close as possible AFTER calories are in range)

${preferences ? `PREFERENCES: ${preferences}` : ""}

RULES:
1. Calories are the hard limit. If hitting carb target would push calories over ${targets.calories + 100}, use fewer carbs.
2. Use portions=1 for almost everything. portions=2 only if food is under 150cal and you have a big macro gap left.
3. Never use portions=3 or higher.
4. Do NOT use the same food in more than one meal slot. Every item across breakfast, lunch, dinner, snacks must be a different food.
5. Do NOT stack protein shakes — max 1 RTD protein per day total.
6. Include at least one carb source (rice, oats, potato, fruit, bread) per meal to distribute carbs evenly.
7. After selecting, verify: total calories are within ${targets.calories}±100, protein within ±15g, no food repeated.

AVAILABLE FOODS (index|name|protein|carbs|fat|calories):
${foodList}

Return only valid JSON matching the schema. Reference foods by index number only.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 4096,
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
      parsed[slot] = parsed[slot]
        .filter(item => {
          const idx = parseInt(item.index);
          return !isNaN(idx) && idx >= 0 && idx < topFoods.length;
        })
        .map(item => {
          const food = topFoods[parseInt(item.index)];
          const portions = Math.max(1, Math.min(2, Math.round(parseFloat(item.portions) || 1)));
          return {
            name: food.name,
            portions,
            protein_g: food.protein_g,
            carbs_g: food.carbs_g,
            fat_g: food.fat_g,
            calories: food.calories,
            id: food.id
          };
        });
    }

    return res.status(200).json({ ...parsed, _model: model });
  } catch (err) {
    return res.status(500).json({ error: "Server error", detail: err.message });
  }
}
