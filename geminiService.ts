
import { GoogleGenAI, Type } from "@google/genai";
import { AcademicInfo, Lesson } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export async function generateCourseMeta(info: AcademicInfo) {
  const prompt = `Generate a professional course description and core learning objectives for a ${info.gradeLevel} ${info.subject} course named "${info.courseName}" for ${info.term} of the ${info.academicYear} academic year. Keep it concise and academic.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
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

  return JSON.parse(response.text ?? '{}');
}

export async function generateLessonDetails(info: AcademicInfo, lessons: Lesson[]) {
  const lessonListText = lessons.map(l => `- Lesson ID: "${l.id}", Lesson Name: "${l.name}", CCSS: "${l.ccss}"`).join('\n');
  const prompt = `As an expert math instructional designer, for each of the following lessons for ${info.gradeLevel} ${info.subject}, generate professional curriculum details.
  Lessons:
  ${lessonListText}
  
  Provide:
  1. Expectations ("Students will be able to...")
  2. Main Skills (Mathematical skills)
  3. Essential Questions (High-quality inquiry)
  4. Suggested Teaching Strategies (Differentiation & Approaches)
  5. Activities (Classroom-ready engagement)
  
  Return a JSON object with a "results" property containing an array of objects. Each object must include the "lessonId" and the generated details.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          results: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                lessonId: { type: Type.STRING, description: "The unique ID of the lesson provided in the input." },
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

  return JSON.parse(response.text ?? '{"results": []}');
}
