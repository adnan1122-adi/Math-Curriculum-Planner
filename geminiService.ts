
import { GoogleGenAI, Type } from "@google/genai";
import { AcademicInfo, Lesson } from "./types";

// The API key must be obtained from process.env.API_KEY.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function generateCourseMeta(info: AcademicInfo) {
  const prompt = `Generate a professional course description and core learning objectives for a ${info.gradeLevel} ${info.subject} course named "${info.courseName}" for ${info.term} of the ${info.academicYear} academic year. Ensure the tone is highly academic and school-ready.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: {
      systemInstruction: "You are a world-class educational consultant specialized in CCSS-aligned curriculum design and instructional planning.",
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

  if (!response.text) {
    throw new Error("No response text received from meta generation.");
  }

  return JSON.parse(response.text);
}

export async function generateLessonDetails(info: AcademicInfo, lessons: Lesson[]) {
  const lessonListText = lessons.map(l => `- ID: ${l.id}, Lesson: ${l.name}, Standard: ${l.ccss}`).join('\n');
  const prompt = `Generate detailed instructional content for the following ${info.gradeLevel} ${info.subject} lessons:
  
  ${lessonListText}
  
  For EACH lesson, provide:
  - Expectations: What students will achieve.
  - Main Skills: Specific mathematical skills involved.
  - Essential Questions: Inquiry-based prompts.
  - Teaching Strategies: Instructional methods and differentiation.
  - Activities: Concrete classroom tasks.
  
  Format the output as a JSON object with a 'results' array containing one object per lesson.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: {
      systemInstruction: "You are a professional math instructional designer. Your task is to expand lesson titles into complete instructional frameworks based on CCSS standards.",
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

  if (!response.text) {
    throw new Error("No response text received from lesson details generation.");
  }

  return JSON.parse(response.text);
}
