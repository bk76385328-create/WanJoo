import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface MoveSuggestion {
  explanation: string;
  column: number;
  confidence: number;
}

export async function analyzeGameScreenshot(base64Image: string): Promise<MoveSuggestion> {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Tu es un expert du jeu X2 Blocks. 
    Analyse cette capture d'écran du jeu.
    Identifie le bloc actuel en bas de l'écran et la grille de blocs au-dessus.
    Détermine le meilleur coup (la meilleure colonne où lâcher le bloc) pour maximiser les fusions et le score.
    
    Réponds au format JSON avec les champs suivants :
    - explanation: une courte explication en français de pourquoi c'est le meilleur coup.
    - column: le numéro de la colonne (de 1 à 5, généralement X2 Blocks a 5 colonnes).
    - confidence: ton niveau de confiance de 0 à 1.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: "image/png",
              data: base64Image.split(",")[1],
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          explanation: { type: Type.STRING },
          column: { type: Type.NUMBER },
          confidence: { type: Type.NUMBER },
        },
        required: ["explanation", "column", "confidence"],
      },
    },
  });

  try {
    const result = JSON.parse(response.text || "{}");
    return result as MoveSuggestion;
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    throw new Error("L'IA n'a pas pu analyser l'image correctement.");
  }
}
