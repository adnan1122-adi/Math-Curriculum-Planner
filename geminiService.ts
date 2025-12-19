
import { GoogleGenAI, Type } from "@google/genai";
import { AcademicInfo, Lesson } from "./types";

export async function generateCourseMeta(info: AcademicInfo) {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY is missing. Please set it in your environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `Generate a professional course description and core learning objectives for a ${info.gradeLevel} ${info.subject} course named "${info.courseName}" for ${info.term} of the ${info.academicYear} academic year. Ensure the tone is highly academic and school-ready.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are a world-class educational consultant specialized in CCSS-aligned curriculum design and instructional planning. Output valid JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            objectives: { type: Type.STRING },
            prerequisites: { type: Type.STRING },
            credits: { type: Type.STRING }
          },
          required: ["description", "objectives", "prerequisites", "credits"]
        }
      }
    });

    if (!response.text) throw new Error("Empty AI response");
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Meta Generation Error:", error);
    throw error;
  }
}

export async function generateLessonDetails(info: AcademicInfo, lessons: Lesson[]) {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY is missing.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const lessonListText = lessons.map(l => `ID: ${l.id} | Lesson: ${l.name} | CCSS: ${l.ccss}`).join('\n');
  const prompt = `Generate detailed instructional content for these ${info.gradeLevel} lessons:\n${lessonListText}\n\nInclude: expectations, skills, questions, strategies, and activities for each.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are a professional math instructional designer. Output valid JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            results: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  lessonId: { type: Type.STRING },
                  expectations: { type: Type.STRING },
                  skills: { type: Type.STRING },
                  questions: { type: Type.STRING },
                  strategies: { type: Type.STRING },
                  activities: { type: Type.STRING }
                },
                required: ["lessonId", "expectations", "skills", "questions", "strategies", "activities"]
              }
            }
          },
          required: ["results"]
        }
      }
    });

    if (!response.text) throw new Error("Empty AI response");
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Lesson Details Error:", error);
    throw error;
  }
}
