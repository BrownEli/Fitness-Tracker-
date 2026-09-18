import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Initialize Gemini client lazily to avoid crashing on startup if the key is missing.
  let aiClient: GoogleGenAI | null = null;
  function getAiClient(): GoogleGenAI | null {
    if (!aiClient && process.env.GEMINI_API_KEY) {
      aiClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
    return aiClient;
  }

  // Multi-model fallback execution helper for high availability & low latency with timeout protection
  async function generateContentWithFallback(ai: GoogleGenAI, requestPayload: any, timeoutMs = 16000): Promise<string> {
    const candidateModels = [
      "gemini-3.8-flash",      // latest high-performance model from gemini-api skill
      "gemini-flash-latest",   // general flash alias
      "gemini-3.1-flash-lite"  // fast, efficient fallback
    ];

    let lastError: any = null;
    for (const modelName of candidateModels) {
      try {
        let timeoutId: any;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error(`Model ${modelName} timed out after ${timeoutMs}ms`));
          }, timeoutMs);
        });

        const callPromise = ai.models.generateContent({
          ...requestPayload,
          model: modelName
        });

        const response: any = await Promise.race([callPromise, timeoutPromise]);
        clearTimeout(timeoutId);

        if (response && typeof response.text === "string" && response.text.trim()) {
          return response.text.trim();
        }
      } catch (err: any) {
        console.warn(`Model ${modelName} encountered error:`, err?.status || err?.message || err);
        lastError = err;
      }
    }
    throw lastError || new Error("All AI models are currently unavailable.");
  }

  // Fallback offline generator for fitness advice if Gemini API is degraded
  function generateFallbackAdvice(query: string, goals: any): { summary: string; text: string; type: string } {
    const qLower = (query || "").toLowerCase();
    const weightTarget = goals?.targetWeight ? `${goals.targetWeight} ${goals.weightUnit || 'kg'}` : "target weight";
    const proteinTarget = goals?.dailyProteinTarget || 160;

    if (qLower.includes("fat") || qLower.includes("burn") || qLower.includes("cut") || qLower.includes("lose")) {
      return {
        summary: "Optimal Fat Loss & Muscle Retention Strategy",
        text: `### Key Principles for Fat Loss While Maintaining Muscle:\n\n* **Caloric Deficit**: Maintain a modest deficit (300-500 kcal below maintenance) to preserve lean muscle tissue.\n* **Compound Lifts**: Prioritize heavy compound exercises (Squats, Deadlifts, Bench Press, Overhead Press, Rows) to signal your body to retain muscle mass.\n* **Protein Intake**: Keep daily protein high at **${proteinTarget}g** (approx. 0.8–1.0g per lb of bodyweight).\n* **Metabolic Conditioning**: Incorporate 2-3 sessions of incline walking or high-intensity interval training (HIIT) 15-20 min post-workout.\n* **Progressive Overload**: Continue tracking and increasing weight or reps each session.`,
        type: "hypertrophy"
      };
    }

    if (qLower.includes("bench") || qLower.includes("plateau") || qLower.includes("stuck")) {
      return {
        summary: "Plateau Breakthrough & Progressive Overload Protocol",
        text: `### Strategy to Overcome Strength Plateaus:\n\n* **Micro-Loading**: Add smaller increments (1.25–2.5 lbs / 0.5–1 kg) rather than big jumps.\n* **Volume Deload**: Take 1 week at 60-70% volume to allow systemic CNS and tendon recovery.\n* **Accessory Focus**: Strengthen weak points (e.g. triceps lockout with close-grip bench, pause reps at the chest for bottom strength).\n* **Nutritional Surplus**: Ensure you are hitting your **${proteinTarget}g** protein goal and sufficient pre-workout carbohydrates.`,
        type: "hypertrophy"
      };
    }

    if (qLower.includes("protein") || qLower.includes("food") || qLower.includes("eat") || qLower.includes("diet") || qLower.includes("meal")) {
      return {
        summary: "Protein Distribution & Nutrient Timing Strategy",
        text: `### Nutrition Timing for Muscle Growth:\n\n* **Meal Distribution**: Distribute your daily **${proteinTarget}g** protein across 3-5 meals with at least 30-40g per feeding.\n* **Pre-Workout Fuel**: Consume easily digestible carbs and 20-30g protein 60-90 minutes prior to training.\n* **Post-Workout Recovery**: Prioritize a complete protein source rich in leucine within 2 hours post-training.\n* **Hydration**: Aim for 3-4 liters of water daily to support intracellular muscle hydration.`,
        type: "nutrition"
      };
    }

    return {
      summary: query ? `Coaching Insight: ${query.slice(0, 45)}` : "Hypertrophy Progression Protocol",
      text: `### Tailored Coaching Recommendations:\n\n* **Progressive Overload**: Strive to add weight or repetitions to every working set across your weekly training sessions.\n* **Protein Priority**: Maintain your daily **${proteinTarget}g** target toward your goal of **${weightTarget}**.\n* **Working Volume**: Target 10-20 high-quality working sets per muscle group weekly taken to 1-2 reps in reserve (RIR).\n* **Rest & Recovery**: Allow 48-72 hours before hitting the same muscle group hard again.`,
      type: "hypertrophy"
    };
  }

  // API Route: Get AI Coach insights
  app.post("/api/coach/insights", async (req, res) => {
    try {
      const { goals, recentLogs, queryType, customPlanText } = req.body;
      const ai = getAiClient();

      const isCustomQuestion = queryType && queryType !== "general_assessment" && queryType !== "general";

      if (!ai) {
        const fallback = generateFallbackAdvice(isCustomQuestion ? queryType : "", goals);
        return res.json({
          ...fallback,
          timestamp: new Date().toISOString()
        });
      }

      const prompt = `
        ${isCustomQuestion
          ? `The user is asking a direct question to their Hypertrophy & Nutrition AI Coach:\nQUESTION: "${queryType}"\n\nProvide a comprehensive, expert answer tailored to their fitness profile below.`
          : `Analyze the user's hypertrophy goals, recent tracking logs, and workout history to provide a high-impact coaching recommendation.`
        }
        
        USER GOALS:
        - Current Weight: ${goals?.currentWeight || 75} ${goals?.weightUnit || 'kg'}
        - Target Weight: ${goals?.targetWeight || 80} ${goals?.weightUnit || 'kg'}
        - Daily Protein Target: ${goals?.dailyProteinTarget || 160}g
        - Daily Calorie Target: ${goals?.dailyCalorieTarget || 2400} kcal
        - Weekly Workout Days Goal: ${goals?.weeklyWorkoutDaysTarget || 4} days
        
        RECENT LOGS (Recent workouts and meals):
        ${JSON.stringify(recentLogs || [], null, 2)}

        USER'S CONNECTED PLAN/GUIDELINES (extracted from their Google Docs):
        ${customPlanText ? customPlanText.slice(0, 4000) : "No custom Google Docs plans synced yet."}
        
        Provide your expert coaching advice formatted in a clean JSON structure. Focus specifically on hypertrophy, optimal protein synthesis distribution (~30-40g protein per meal), mechanical tension, and recovery.
        ${isCustomQuestion ? "Ensure the 'summary' directly states the question/topic and 'text' directly and thoroughly answers the question with clear bullet points." : ""}
      `;

      try {
        const rawText = await generateContentWithFallback(ai, {
          contents: prompt,
          config: {
            systemInstruction: `You are an elite Hypertrophy & Sports Nutrition Coach. Your clients are training for muscle growth (hypertrophy). You prioritize protein-to-bodyweight ratios (0.8g - 1.0g per lb of bodyweight), progressive overload, adequate training volume, and recovery.
            You must respond ONLY with a JSON object matching this schema:
            {
              "summary": "Short 1-sentence headline summarizing the advice or answered topic",
              "text": "Detailed coaching insights with specific bullet points and actionable steps. Write in markdown.",
              "type": "hypertrophy" | "nutrition" | "recovery" | "general"
            }`,
            responseMimeType: "application/json",
          },
        });

        let parsed: { summary?: string; text?: string; type?: string } = {};

        try {
          const cleaned = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
          parsed = JSON.parse(cleaned);
        } catch (parseErr) {
          console.warn("Could not parse JSON response directly, creating structured fallback:", parseErr);
          parsed = {
            summary: isCustomQuestion ? `Answer: ${queryType.slice(0, 45)}` : "Hypertrophy Coach Recommendation",
            text: rawText,
            type: "general"
          };
        }

        return res.json({
          summary: parsed.summary || (isCustomQuestion ? `Coach Answer: ${queryType.slice(0, 45)}` : "Hypertrophy Recommendation"),
          text: parsed.text || rawText || "Keep consistent with your daily protein targets and progressive training.",
          type: parsed.type || "hypertrophy",
          timestamp: new Date().toISOString()
        });
      } catch (geminiError) {
        console.error("Gemini API call failed, using intelligent coaching fallback:", geminiError);
        const fallback = generateFallbackAdvice(isCustomQuestion ? queryType : "", goals);
        return res.json({
          ...fallback,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error("Error generating insights:", error);
      const fallback = generateFallbackAdvice(req.body?.queryType || "", req.body?.goals);
      return res.json({
        ...fallback,
        timestamp: new Date().toISOString()
      });
    }
  });

  // API Route: Chat with AI Coach regarding a specific recommendation
  app.post("/api/coach/chat", async (req, res) => {
    try {
      const { insightSummary, insightText, insightType, chatHistory, userMessage, goals } = req.body;
      const ai = getAiClient();

      if (!userMessage || !userMessage.trim()) {
        return res.status(400).json({ error: "Message is required" });
      }

      if (!ai) {
        return res.json({
          reply: "Focus on consistent progressive overload and hitting your daily protein target! Allow 48-72h recovery between heavy muscle groups.",
          timestamp: new Date().toISOString()
        });
      }

      const formattedHistory = (chatHistory || []).map((msg: { sender: string; text: string }) =>
        `${msg.sender === 'user' ? 'User' : 'Coach'}: ${msg.text}`
      ).join('\n');

      const prompt = `
        The user is having a quick follow-up chat with you regarding a specific coaching recommendation they received.

        RECOMMENDATION CONTEXT:
        Summary: ${insightSummary || "Hypertrophy Guidance"}
        Category: ${insightType || "general"}
        Original Advice: ${insightText || ""}

        USER GOALS:
        ${goals ? `- Target Weight: ${goals.targetWeight} ${goals.weightUnit || 'kg'}, Daily Protein: ${goals.dailyProteinTarget || 160}g, Calories: ${goals.dailyCalorieTarget || 2400} kcal` : ""}

        CONVERSATION SO FAR:
        ${formattedHistory || "No previous messages."}

        USER'S NEW MESSAGE:
        "${userMessage.trim()}"

        CRITICAL INSTRUCTION:
        1. Answer directly and practically in context of this recommendation.
        2. YOUR ENTIRE RESPONSE MUST NOT EXCEED 500 CHARACTERS. Keep it concise, punchy, actionable, and conversational.
      `;

      try {
        const rawReply = await generateContentWithFallback(ai, {
          contents: prompt,
          config: {
            systemInstruction: "You are an expert Hypertrophy Coach answering follow-up questions about a specific recommendation. Provide concise, highly actionable replies. STRICT LIMIT: Response must not exceed 500 characters.",
          },
        });

        let reply = (rawReply || "").trim();
        if (reply.length > 500) {
          reply = reply.slice(0, 497) + "...";
        }

        return res.json({
          reply,
          timestamp: new Date().toISOString()
        });
      } catch (geminiError) {
        console.error("Gemini chat failed, returning fallback:", geminiError);
        return res.json({
          reply: `Great question! Focus on progressive tension and maintain ${goals?.dailyProteinTarget || 160}g protein to support recovery.`,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error("Error in coach chat:", error);
      res.json({
        reply: "Focus on consistent progressive overload and hitting your daily protein target!",
        timestamp: new Date().toISOString()
      });
    }
  });

  // API Route: Analyze food plate image(s) or text description with Gemini AI
  app.post("/api/analyze-food", async (req, res) => {
    try {
      const { image, images, hint } = req.body;
      const ai = getAiClient();

      const imageList: string[] = Array.isArray(images) && images.length > 0
        ? images
        : (image ? [image] : []);

      const hasText = Boolean(hint && hint.trim());

      if (imageList.length === 0 && !hasText) {
        return res.status(400).json({ error: "Please provide a meal description or attach photo(s)." });
      }

      if (!ai) {
        const lowerHint = (hint || "").toLowerCase();
        const isSingleItem = lowerHint.includes("yogurt") || lowerHint.includes("drink") || lowerHint.includes("shake") || lowerHint.includes("smoothie") || lowerHint.includes("bar") || lowerHint.includes("coffee") || lowerHint.includes("apple") || lowerHint.includes("snack") || !lowerHint.includes(" and ") && !lowerHint.includes(" with ");

        if (isSingleItem) {
          return res.json({
            name: hasText ? hint.trim().slice(0, 40) : "Food Item",
            protein: 25,
            carbs: 15,
            fiber: 2,
            fat: 4,
            calories: 200,
            items: [],
            note: "Single food item — no plate breakdown needed."
          });
        }

        const fallbackMajorItems = [
          {
            name: "Main Protein",
            portion: "180g",
            protein: 32,
            carbs: 0,
            fiber: 0,
            fat: 8,
            calories: 210
          },
          {
            name: "Plate Carbohydrate",
            portion: "1 cup (160g)",
            protein: 4,
            carbs: 45,
            fiber: 2,
            fat: 1,
            calories: 210
          }
        ];

        return res.json({
          name: hasText ? hint.trim().slice(0, 40) : "Meal Plate",
          protein: 36,
          carbs: 45,
          fiber: 2,
          fat: 9,
          calories: 420,
          items: fallbackMajorItems,
          note: "GEMINI_API_KEY is not configured in Settings > Secrets. Provided default estimates."
        });
      }

      const parts: any[] = [];
      for (const imgStr of imageList) {
        let base64Data = imgStr;
        let mimeType = "image/jpeg";

        if (imgStr.includes(";base64,")) {
          const splitParts = imgStr.split(";base64,");
          const mimeMatch = splitParts[0].match(/data:(.*?);/);
          if (mimeMatch) {
            mimeType = mimeMatch[1];
          }
          base64Data = splitParts[1];
        }

        parts.push({
          inlineData: {
            mimeType,
            data: base64Data,
          },
        });
      }

      let promptText = "";
      if (imageList.length > 0) {
        promptText = `
          Analyze the attached food image(s) to determine the meal components, portion estimates, and total nutrition including precise fat estimates.
          ${hasText ? `User description or note: "${hint.trim()}".` : 'Rely on visual detection of the food.'}

          CRITICAL RULES FOR BREAKDOWN & PORTION ESTIMATION:
          1. GRAMS / MILLILITERS REQUIREMENT:
             - Every single food item or beverage MUST include an estimate in grams ("g") for solid foods or milliliters ("ml") for drinks/liquids.
             - Examples: "180g", "250g", "120g", "330ml", "250ml", "500ml".
             - Never output vague measurements like "1 cup" or "1 serving" without the metric equivalent; always specify the grams or ml (e.g. "180g" or "250ml").
          2. IF THIS IS A SINGLE ITEM (e.g., yogurt, protein drink, shake, protein bar, fruit, a single bowl, or coffee):
             - DO NOT break it down into ingredients!
             - Set "items": [] (empty array).
             - Set root "portion": estimated grams (e.g. "200g") or milliliters (e.g. "330ml").
          3. IF THIS IS A MULTI-ITEM PLATE (e.g., Salmon and Rice, Chicken and Sweet Potato):
             - ONLY give a count for each MAJOR food component on the plate (e.g. Salmon, Rice).
             - DO NOT break down into seasonings, spices, or garnishes.
             - For each major item in "items":
               - "name": Clean name of the food (e.g. "Salmon Fillet", "White Rice").
               - "portion": Estimated weight in grams (e.g. "200g") or volume in ml (e.g. "250ml").
               - "carbs": Estimated grams of carbohydrates (integer).
               - "protein": Estimated grams of protein (integer).
               - "fiber": Estimated grams of dietary fiber (integer).
               - "fat": Estimated grams of dietary fat (integer) based on food composition and preparation.
               - "calories": Estimated calories in kcal (integer).
             - Set root "portion": Total combined estimated weight or volume (e.g. "380g").
          4. ACCURATE FAT ESTIMATION REQUIREMENT:
             - You must provide an estimated number for fats ("fat" in grams as an integer) for the overall meal and for each major food item.
             - Make this estimate as realistic and close as possible (e.g. salmon ~12-16g fat/200g, white rice ~0-1g fat, olive oil/butter cooking additions, chicken breast ~3-5g fat, ribeye steak ~20-30g fat, eggs ~5g fat per egg, avocado ~15g fat, etc.).
          5. Total combined plate nutrition:
             - "name": Clean meal title (e.g. "Salmon and White Rice", or "Greek Yogurt").
             - "portion": Total estimated grams ("g") or milliliters ("ml") for the meal.
             - "protein": Total protein in grams.
             - "carbs": Total carbohydrates in grams.
             - "fiber": Total dietary fiber in grams.
             - "fat": Total fats in grams.
             - "calories": Total calories in kcal.

          Respond ONLY with valid JSON:
          Example for single item:
          {
            "name": "Greek Yogurt",
            "portion": "170g",
            "protein": 18,
            "carbs": 6,
            "fiber": 0,
            "fat": 2,
            "calories": 110,
            "items": []
          }

          Example for plate with major foods:
          {
            "name": "Salmon and White Rice",
            "portion": "380g",
            "protein": 40,
            "carbs": 45,
            "fiber": 1,
            "fat": 15,
            "calories": 475,
            "items": [
              {
                "name": "Salmon Fillet",
                "portion": "200g",
                "carbs": 0,
                "protein": 36,
                "fiber": 0,
                "fat": 14,
                "calories": 265
              },
              {
                "name": "White Rice",
                "portion": "180g",
                "carbs": 45,
                "protein": 4,
                "fiber": 1,
                "fat": 1,
                "calories": 210
              }
            ]
          }
        `;
      } else {
        promptText = `
          Analyze the following food description to estimate macros and fats as accurately as possible:
          "${hint.trim()}"

          CRITICAL RULES FOR BREAKDOWN & PORTION ESTIMATION:
          1. GRAMS / MILLILITERS REQUIREMENT:
             - Every food item or beverage MUST include an estimate in grams ("g") for solid foods or milliliters ("ml") for drinks/liquids.
             - Examples: "180g", "250g", "120g", "330ml", "250ml".
          2. IF THIS IS A SINGLE ITEM (e.g., yogurt, protein drink, shake, smoothie, coffee, bar, snack):
             - DO NOT break it down into ingredients!
             - Set "items": [] (empty array).
             - Set root "portion": estimated grams (e.g. "200g") or milliliters (e.g. "330ml").
          3. IF THIS IS A MULTI-ITEM PLATE (e.g., Salmon and Rice, Steak and Potatoes):
             - ONLY give a count for each MAJOR food component on the plate (e.g. Salmon, Rice).
             - DO NOT break down into ingredients or spices! Only the primary foods.
             - For each major food item:
               - "name": Name of the food (e.g. "Salmon Fillet", "White Rice").
               - "portion": Estimated weight in grams (e.g. "200g") or milliliters (e.g. "250ml").
               - "carbs": Grams of carbohydrates (integer).
               - "protein": Grams of protein (integer).
               - "fiber": Grams of dietary fiber (integer).
               - "fat": Grams of dietary fat (integer) as close and realistic as possible.
               - "calories": Calories in kcal (integer).
             - Set root "portion": Total combined estimated grams or ml (e.g. "380g").
          4. ACCURATE FAT ESTIMATION:
             - Provide an estimated integer for total fats ("fat") for the meal and each item, calibrated as close to real food nutrition data as possible.
          5. Total overall nutrition (name, portion, protein, carbs, fiber, fat, calories).

          Respond ONLY with valid JSON matching the format described above.
        `;
      }

      parts.push({ text: promptText });

      try {
        const rawText = await generateContentWithFallback(ai, {
          contents: { parts },
          config: {
            systemInstruction: "You are an expert nutritional analyst. For any food or drink, always include realistic portion estimates in grams (g) for solid foods or milliliters (ml) for beverages. Provide realistic macro estimates including protein, carbs, dietary fiber, and especially total fats (g) based on the food's natural fat content and typical preparation methods. Return fat as an accurate integer.",
            responseMimeType: "application/json",
          },
        });

        const parsed = JSON.parse(rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim());

        const rawItemsList = Array.isArray(parsed.items) ? parsed.items : [];
        // Only keep breakdown if there are 2 or more major food items!
        const items: Array<{ name: string; portion?: string; carbs: number; protein: number; fiber: number; fat: number; calories: number }> =
          rawItemsList.length > 1
            ? rawItemsList.map((it: any) => {
                let portionStr = it.portion ? String(it.portion).trim() : undefined;
                // If portion does not specify g or ml, check if we can format it
                if (portionStr && !portionStr.toLowerCase().includes('g') && !portionStr.toLowerCase().includes('ml')) {
                  portionStr = `${portionStr} (est. 150g)`;
                }
                return {
                  name: String(it.name || "Food Item"),
                  portion: portionStr,
                  carbs: Math.max(0, Math.round(Number(it.carbs) || 0)),
                  protein: Math.max(0, Math.round(Number(it.protein) || 0)),
                  fiber: Math.max(0, Math.round(Number(it.fiber) || 0)),
                  fat: Math.max(0, Math.round(Number(it.fat) || 0)),
                  calories: Math.max(0, Math.round(Number(it.calories) || 0)),
                };
              })
            : [];

        const computedProtein = items.length > 0 ? items.reduce((s, i) => s + i.protein, 0) : 0;
        const computedCarbs = items.length > 0 ? items.reduce((s, i) => s + i.carbs, 0) : 0;
        const computedFiber = items.length > 0 ? items.reduce((s, i) => s + i.fiber, 0) : 0;
        const computedFat = items.length > 0 ? items.reduce((s, i) => s + i.fat, 0) : 0;
        const computedCalories = items.length > 0 ? items.reduce((s, i) => s + i.calories, 0) : 0;

        const finalProtein = Math.max(0, parseInt(parsed.protein) || computedProtein);
        const finalCarbs = Math.max(0, parseInt(parsed.carbs) || computedCarbs);
        const finalFiber = Math.max(0, parseInt(parsed.fiber) || computedFiber);
        const finalFat = Math.max(0, parseInt(parsed.fat) !== undefined && !isNaN(parseInt(parsed.fat)) ? parseInt(parsed.fat) : computedFat);
        const finalCalories = Math.max(0, parseInt(parsed.calories) || computedCalories);

        // Derive or format meal portion in grams or milliliters
        let finalPortion = parsed.portion ? String(parsed.portion).trim() : undefined;
        if (!finalPortion && items.length > 0) {
          // Sum grams from items if available
          let totalGrams = 0;
          for (const it of items) {
            const match = it.portion?.match(/(\d+)\s*g/i);
            if (match) totalGrams += parseInt(match[1]);
          }
          if (totalGrams > 0) {
            finalPortion = `${totalGrams}g`;
          }
        }
        if (!finalPortion) {
          const lowerName = (parsed.name || hint || "").toLowerCase();
          const isDrink = lowerName.includes("drink") || lowerName.includes("water") || lowerName.includes("coffee") || lowerName.includes("juice") || lowerName.includes("shake") || lowerName.includes("smoothie") || lowerName.includes("tea") || lowerName.includes("soda");
          finalPortion = isDrink ? "300ml" : "250g";
        }

        return res.json({
          name: parsed.name || (hasText ? hint.trim().slice(0, 40) : "Analyzed Meal"),
          portion: finalPortion,
          protein: finalProtein,
          carbs: finalCarbs,
          fiber: finalFiber,
          fat: finalFat,
          calories: finalCalories,
          items
        });
      } catch (geminiError) {
        console.error("Gemini food analysis failed, returning heuristic estimates:", geminiError);
        const lowerHint = (hint || "").toLowerCase();
        const isDrink = lowerHint.includes("water") || lowerHint.includes("drink") || lowerHint.includes("shake") || lowerHint.includes("smoothie") || lowerHint.includes("coffee") || lowerHint.includes("tea") || lowerHint.includes("juice") || lowerHint.includes("soda");
        const isSingle = isDrink || lowerHint.includes("yogurt") || lowerHint.includes("bar") || lowerHint.includes("apple") || lowerHint.includes("banana");

        if (isSingle) {
          return res.json({
            name: hasText ? hint.trim().slice(0, 40) : (isDrink ? "Beverage" : "Food Item"),
            portion: isDrink ? "330ml" : "180g",
            protein: isDrink ? (lowerHint.includes("shake") ? 25 : 1) : 15,
            carbs: 10,
            fiber: 1,
            fat: isDrink ? 1 : 4,
            calories: isDrink ? (lowerHint.includes("shake") ? 180 : 45) : 150,
            items: []
          });
        }

        const fallbackMajorItems = [
          { name: "Main Protein", portion: "180g", carbs: 0, protein: 30, fiber: 0, fat: 8, calories: 200 },
          { name: "Side Starch / Grain", portion: "160g", carbs: 45, protein: 4, fiber: 2, fat: 1, calories: 210 }
        ];

        return res.json({
          name: hasText ? hint.trim().slice(0, 40) : "Meal Plate",
          portion: "340g",
          protein: 34,
          carbs: 45,
          fiber: 2,
          fat: 9,
          calories: 410,
          items: fallbackMajorItems
        });
      }
    } catch (error) {
      console.error("Error analyzing food with Gemini:", error);
      res.status(500).json({ error: "Failed to analyze food" });
    }
  });

  // API Route: Download Android Blueprint file
  app.get("/api/download-blueprint", (req, res) => {
    const filePath = path.join(process.cwd(), "android_blueprint.md");
    if (fs.existsSync(filePath)) {
      res.setHeader("Content-Disposition", "attachment; filename=android_blueprint.md");
      res.setHeader("Content-Type", "text/markdown");
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.status(404).send("Blueprint file not found.");
    }
  });

  // Vite middleware for development or serving pre-built files in production
  const isProduction = process.env.NODE_ENV === "production";
  const distPath = path.join(process.cwd(), 'dist');

  if (!isProduction) {
    console.log("Starting in development mode with Vite middleware...");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting in production mode, serving pre-built files from dist...");
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
