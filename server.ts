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

  // API Route: Get AI Coach insights
  app.post("/api/coach/insights", async (req, res) => {
    try {
      const { goals, recentLogs, queryType, customPlanText } = req.body;
      const ai = getAiClient();

      if (!ai) {
        return res.json({
          summary: "Coaching Guide Active",
          text: "To activate live customized hypertrophy tips from our AI coach, please add your `GEMINI_API_KEY` in the **Settings > Secrets** panel. For now, strive to maintain 0.8-1g of protein per pound of bodyweight and focus on compound lifts to maximize hypertrophy!",
          type: "general",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
      }

      const prompt = `
        Analyze the following hypertrophy goals, recent tracking logs, and their personal plan documents to provide a specific, high-impact coaching tip.
        
        USER GOALS:
        - Current Weight: ${goals.currentWeight} ${goals.weightUnit}
        - Target Weight: ${goals.targetWeight} ${goals.weightUnit}
        - Daily Protein Target: ${goals.dailyProteinTarget}g
        - Daily Calorie Target: ${goals.dailyCalorieTarget} kcal
        - Weekly Workout Days Goal: ${goals.weeklyWorkoutDaysTarget} days
        
        RECENT LOGS (Last few days of meals and workouts):
        ${JSON.stringify(recentLogs || [], null, 2)}

        USER'S CONNECTED PLAN/GUIDELINES (extracted from their Google Docs):
        ${customPlanText ? customPlanText.slice(0, 4000) : "No custom Google Docs plans synced yet."}
        
        QUERY FOCUS: ${queryType || "general"}
        
        Provide your expert coaching advice in a clean JSON format. Focus specifically on muscle hypertrophy, optimal protein distribution (aim for ~30-40g protein per meal to trigger muscle protein synthesis), and training volume/recovery. Be direct, encouraging, and action-oriented.
        If the user has loaded custom plans (from Google Docs above), base your coaching recommendations specifically around those custom foods and workouts to help them follow their plans successfully!
        Do not include verbose introductory text outside the JSON structure.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: `You are an elite Hypertrophy & Sports Nutrition Coach. Your clients are training for muscle growth (hypertrophy). You prioritize protein-to-bodyweight ratios (ideally 0.8g - 1.0g per lb of bodyweight for muscle growth), progressive overload, adequate training volume (10-20 working sets per muscle group per week), and calorie surpluses for muscle building.
          You must respond ONLY with a JSON object matching this schema:
          {
            "summary": "Short 1-sentence headline summarizing the advice",
            "text": "Detailed coaching insights with specific bullet points. Write in elegant markdown.",
            "type": "hypertrophy" | "nutrition" | "recovery" | "general"
          }`,
          responseMimeType: "application/json",
        },
      });

      const responseText = response.text || "{}";
      const parsed = JSON.parse(responseText.trim());
      
      res.json({
        ...parsed,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    } catch (error) {
      console.error("Error generating insights:", error);
      res.status(500).json({ error: "Failed to generate coaching insights" });
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
        return res.json({
          name: hasText ? hint.trim().slice(0, 40) : "Custom Meal Plate",
          protein: 30 * Math.max(1, imageList.length),
          carbs: 45 * Math.max(1, imageList.length),
          fiber: 6 * Math.max(1, imageList.length),
          calories: 450 * Math.max(1, imageList.length),
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
          Analyze the attached ${imageList.length} food plate / meal image(s) together as a single complete meal log entry.
          ${hasText ? `User provided this additional hint or description: "${hint.trim()}". Use this to help accurately identify the ingredients or portion size.` : 'No text description was provided by the user, so rely purely on visual detection of the food across all photos.'}

          Task:
          1. Identify the name of the meal or primary food items across all attached photos.
          2. Estimate the total combined protein content in grams (integer).
          3. Estimate the total combined carbohydrates (carbs) content in grams (integer).
          4. Estimate the total combined dietary fiber content in grams (integer).
          5. Estimate the total combined calories in kcal (integer).

          Provide realistic, accurate nutrition estimates based on the visual portion sizes in all photos combined.
          Respond ONLY with a JSON object matching this schema:
          {
            "name": "Concise meal title (e.g. Grilled Chicken Breast with Rice, Salad & Protein Shake)",
            "protein": 35,
            "carbs": 45,
            "fiber": 6,
            "calories": 520
          }
        `;
      } else {
        promptText = `
          Analyze the following text description of a meal or food items:
          "${hint.trim()}"

          Task:
          1. Identify/Format a concise name for the meal or primary food items described.
          2. Estimate the total combined protein content in grams (integer).
          3. Estimate the total combined carbohydrates (carbs) content in grams (integer).
          4. Estimate the total combined dietary fiber content in grams (integer).
          5. Estimate the total combined calories in kcal (integer).

          Provide realistic, accurate nutrition estimates based on standard nutritional databases and typical portion sizes for these items.
          Respond ONLY with a JSON object matching this schema:
          {
            "name": "Concise meal title (e.g. Scrambled Eggs with Avocado Toast & Orange Juice)",
            "protein": 24,
            "carbs": 32,
            "fiber": 7,
            "calories": 410
          }
        `;
      }

      parts.push({ text: promptText });

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: { parts },
        config: {
          systemInstruction: "You are an expert nutritional analyst and food recognition AI. Analyze food images and/or text descriptions accurately and estimate total combined protein, carbohydrates (carbs), dietary fiber in grams and calories in kcal realistically.",
          responseMimeType: "application/json",
        },
      });

      const responseText = response.text || "{}";
      const parsed = JSON.parse(responseText.trim());

      res.json({
        name: parsed.name || (hasText ? hint.trim().slice(0, 40) : "Analyzed Meal"),
        protein: Math.max(0, parseInt(parsed.protein) || 0),
        carbs: Math.max(0, parseInt(parsed.carbs) || 0),
        fiber: Math.max(0, parseInt(parsed.fiber) || 0),
        calories: Math.max(0, parseInt(parsed.calories) || 0)
      });
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
