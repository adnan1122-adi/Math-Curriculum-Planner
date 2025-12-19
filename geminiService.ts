
import { GoogleGenAI, Type } from "@google/genai";
import { AcademicInfo, Lesson } from "./types";

export async function generateCourseMeta(info: AcademicInfo) {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY environment variable is not configured. Please add it to your environment settings.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `Generate a professional course description and core learning objectives for a ${info.gradeLevel} ${info.subject} course named "${info.courseName}" for ${info.term} of the ${info.academicYear} academic year. Ensure the tone is highly academic and school-ready.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are a world-class educational consultant specialized in CCSS-aligned curriculum design and instructional planning. Your output must be strictly valid JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING, description: "Professional summary of the course." },
            objectives: { type: Type.STRING, description: "Bullet-pointed list of measurable learning outcomes." },
            prerequisites: { type: Type.STRING, description: "Standard prerequisites for this level." },
            credits: { type: Type.STRING, description: "Standard credit allocation (e.g., 1.0 Credit)." }
          },
          required: ["description", "objectives", "prerequisites", "credits"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from AI during meta generation.");
    return JSON.parse(text);
  } catch (error) {
    console.error("Meta Generation Error:", error);
    throw error;
  }
}

export async function generateLessonDetails(info: AcademicInfo, lessons: Lesson[]) {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY environment variable is not configured.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const lessonListText = lessons.map(l => `ID: ${l.id} | Lesson: ${l.name} | CCSS: ${l.ccss}`).join('\n');
  const prompt = `Generate detailed instructional content for the following ${info.gradeLevel} ${info.subject} lessons:
  
  ${lessonListText}
  
  For EACH lesson, provide:
  - expectations: What students will achieve.
  - skills: Specific mathematical skills involved.
  - questions: Inquiry-based prompts.
  - strategies: Instructional methods and differentiation.
  - activities: Concrete classroom tasks.
  
  Format the output as a JSON object with a 'results' array containing one object per lesson mapping back to the provided ID.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are a professional math instructional designer. Your task is to expand lesson titles into complete instructional frameworks based on CCSS standards. Your output must be strictly valid JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            results: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  lessonId: { type: Type.STRING, description: "The ID provided for the lesson." },
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

    const text = response.text;
    if (!text) throw new Error("Empty response from AI during lesson detail generation.");
    return JSON.parse(text);
  } catch (error) {
    console.error("Lesson Details Generation Error:", error);
    throw error;
  }
}
