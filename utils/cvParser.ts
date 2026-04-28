import { GoogleGenAI, Type } from "@google/genai";
import * as mammoth from 'mammoth';

export const parseCVWithGemini = async (file: File, ai: any, updateCost?: (usage: any, model: string) => Promise<void>) => {
  let documentContent: any;

  if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    documentContent = {
      text: result.value
    };
  } else if (file.type === 'application/pdf' || file.type === 'text/plain') {
    const base64Data = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.readAsDataURL(file);
    });
    documentContent = {
      inlineData: {
        mimeType: file.type,
        data: base64Data.split(',')[1],
      }
    };
  } else {
    throw new Error(`Unsupported file type for ${file.name}. Please upload a PDF, DOCX, or TXT file.`);
  }

  // 1. Parse CV with Gemini
  let response;
  let retries = 3;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview', // Update model to current recommended flash-preview for simple text tasks
        contents: [
          documentContent,
          "Extract the following information from this CV: 1. Full Name, 2. Email, 3. Phone number, 4. Location, 5. A brief profile summary, 6. Key skills categorized into technical, soft, and other, 7. Experience level (e.g., 'Entry Level', 'Junior', 'Mid-Level', 'Senior'), 8. Education history, 9. Experience history, 10. Awards (if any), 11. Qualifications (if any), 12. The complete, unedited raw text of the entire CV, 13. The university the student is currently attending (specifically check for Stellenbosch University, University of Pretoria, or University of Cape Town), 14. The faculty or department (e.g., 'Engineering', 'Commerce', 'Science', 'Arts')."
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              email: { type: Type.STRING },
              phone: { type: Type.STRING },
              location: { type: Type.STRING },
              profile_summary: { type: Type.STRING },
              full_cv_text: { type: Type.STRING },
              university: { type: Type.STRING, description: "The university the student is currently attending, specifically looking for Stellenbosch University, University of Pretoria, or University of Cape Town." },
              faculty: { type: Type.STRING, description: "The faculty or department the student belongs to (e.g., Engineering, Commerce, Science, Arts)." },
              skills: { 
                type: Type.OBJECT,
                properties: {
                  technical: { type: Type.ARRAY, items: { type: Type.STRING } },
                  soft: { type: Type.ARRAY, items: { type: Type.STRING } },
                  other: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
              },
              experience_level: { type: Type.STRING },
              education: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    degree: { type: Type.STRING },
                    institution: { type: Type.STRING },
                    year: { type: Type.STRING }
                  }
                }
              },
              experience: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    role: { type: Type.STRING },
                    company: { type: Type.STRING },
                    period: { type: Type.STRING },
                    location: { type: Type.STRING },
                    description: { type: Type.ARRAY, items: { type: Type.STRING } }
                  }
                }
              },
              awards: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    issuer: { type: Type.STRING },
                    date: { type: Type.STRING },
                    details: { type: Type.ARRAY, items: { type: Type.STRING } }
                  }
                }
              },
              qualifications: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    issuer: { type: Type.STRING },
                    date: { type: Type.STRING },
                    details: { type: Type.ARRAY, items: { type: Type.STRING } }
                  }
                }
              }
            },
            required: ["name", "profile_summary", "skills", "experience_level", "full_cv_text"]
          }
        }
      });
      if (response.usageMetadata && updateCost) {
        await updateCost(response.usageMetadata, 'gemini-3-flash-preview');
      }
      break; // Success, exit retry loop
    } catch (err: any) {
      if (attempt === retries) throw err;
      console.warn(`Gemini API error (attempt ${attempt}), retrying in ${attempt * 4}s...`, err);
      await new Promise(resolve => setTimeout(resolve, attempt * 4000));
    }
  }

  if (!response) {
    throw new Error("Failed to generate content after retries.");
  }

  const parsedData = JSON.parse(response.text || '{}');
  if (typeof parsedData.skills === 'object') {
    parsedData.skills = JSON.stringify(parsedData.skills);
  }
  if (Array.isArray(parsedData.education)) {
    parsedData.education = JSON.stringify(parsedData.education);
  }
  if (Array.isArray(parsedData.experience)) {
    parsedData.experience = JSON.stringify(parsedData.experience);
  }

  return parsedData;
};
