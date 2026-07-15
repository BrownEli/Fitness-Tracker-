import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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
