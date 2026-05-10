import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface WordDefinition {
  word: string;
  category: string;
  definition: string;
  examples: string[];
}

export async function getDefinition(word: string): Promise<WordDefinition> {
  const prompt = `Definisikan kata "${word}" dalam bahasa Indonesia dengan gaya Kamus Besar Bahasa Indonesia (KBBI). Berikan juga kategori katanya (seperti nomina, verba, adjektiva) dan minimal 3 contoh kalimat penggunaannya yang natural.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          category: { type: Type.STRING, description: "Kategori kata (n, v, adj, dll)" },
          definition: { type: Type.STRING },
          examples: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["word", "category", "definition", "examples"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("Gagal mendapatkan definisi");
  
  return JSON.parse(text.trim()) as WordDefinition;
}
