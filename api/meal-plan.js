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

  const totalMacroTarget = (targets.protein || 1) + (targets.carbs || 1) + (targets.fat || 1);
  const pW = (targets.protein || 1) / totalMacroTarget;
  const cW = (targets.carbs || 1) / totalMacroTarget;
  const fW = (targets.fat || 1) / totalMacroTarget;

  const scored = eligible.map(f => ({
    ...f,
    _score: (f.protein_g * pW) + (f.carbs_g * cW) + (f.fat_g * fW)
  })).sort((a, b) => b._score - a._score);

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

  const prompt = `You are a precision meal planning AI for a bodybuilder on a cut.

MACRO TARGETS:
- Calories: ${targets.calories}kcal (target — code will auto-adjust after)
- Protein: ${targets.protein}g (within ±15g)
- Fat: ${targets.fat}g (within ±15g)
- Carbs: ${targets.carbs}g (hit as close as possible)

${preferences ? `PREFERENCES: ${preferences}` : ""}

RULES:
1. Each meal must have 2-3 items. Use portions=1 for everything.
2. Do NOT repeat foods across meals.
3. Max 1 RTD protein per day.
4. Include a carb source in at least 3 of the 4 meals.
5. Aim for variety — don't stack two high-calorie items in the same meal.

AVAILABLE FOODS (index|name|protein|carbs|fat|calories):
${foodList}

Return only valid JSON. Reference foods by index number only.`;

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

    // Resolve Gemini indices to real food objects
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

    // ── POST-PROCESSING: deterministic calorie correction ──────────────────
    const CAL_TARGET = targets.calories;
    const CAL_MAX = CAL_TARGET + 150;
    const CAL_MIN = CAL_TARGET - 200;

    const totalCals = () =>
      slots.reduce((sum, slot) =>
        sum + parsed[slot].reduce((s, item) => s + item.calories * item.portions, 0), 0);

    // TRIM: if over budget, repeatedly drop the highest-cal non-protein item
    // (keep items where protein is their dominant macro to preserve protein target)
    let iterations = 0;
    while (totalCals() > CAL_MAX && iterations < 10) {
      iterations++;
      let worstSlot = null, worstIdx = -1, worstCal = -1;
      for (const slot of slots) {
        // Only trim meals with more than 1 item
        if (parsed[slot].length <= 1) continue;
        for (let i = 0; i < parsed[slot].length; i++) {
          const item = parsed[slot][i];
          const itemCal = item.calories * item.portions;
          const isProteinDominant = item.protein_g * 4 > item.calories * 0.4;
          if (!isProteinDominant && itemCal > worstCal) {
            worstCal = itemCal;
            worstSlot = slot;
            worstIdx = i;
          }
        }
      }
      if (worstSlot === null) break; // nothing safe to drop
      // Try halving portions first (2→1), then drop entirely
      const item = parsed[worstSlot][worstIdx];
      if (item.portions > 1) {
        item.portions = 1;
      } else {
        parsed[worstSlot].splice(worstIdx, 1);
      }
    }

    // FILL: if under budget by >200, try bumping portions on a low-cal carb item
    iterations = 0;
    while (totalCals() < CAL_MIN && iterations < 5) {
      iterations++;
      let bestSlot = null, bestIdx = -1;
      for (const slot of slots) {
        for (let i = 0; i < parsed[slot].length; i++) {
          const item = parsed[slot][i];
          if (item.portions < 2 && item.calories <= 400) {
            const calAfter = totalCals() + item.calories;
            if (calAfter <= CAL_MAX) {
              bestSlot = slot;
              bestIdx = i;
              break;
            }
          }
        }
        if (bestSlot) break;
      }
      if (!bestSlot) break;
      parsed[bestSlot][bestIdx].portions = 2;
    }
    // ── END POST-PROCESSING ────────────────────────────────────────────────

    return res.status(200).json({ ...parsed, _model: model });
  } catch (err) {
    return res.status(500).json({ error: "Server error", detail: err.message });
  }
}
