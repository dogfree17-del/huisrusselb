import { GoogleGenAI, Type } from '@google/genai';

export const generateTailoredCV = async (
  ai: GoogleGenAI,
  student: any,
  job: any,
  updateCost: (usageMetadata: any, model: string) => Promise<void>
) => {
  const modelName = 'gemini-3-pro-preview'; // Update model to current recommended pro variant for complex logic
  
  let skillsList: string[] = [];
  try {
    const parsedSkills = JSON.parse(student.skills || '[]');
    if (Array.isArray(parsedSkills)) {
      skillsList = parsedSkills;
    } else {
      skillsList = Object.values(parsedSkills).flat() as string[];
    }
  } catch (e) {
    skillsList = [];
  }

  const isTailoring = job.title || job.description;
  const prompt = `You are an expert Executive Career Strategist and Technical Recruiter.
${isTailoring ? 
  `Your goal is to tailor a candidate's resume to perfectly match the following Job Description, maximizing their chances of passing ATS (Applicant Tracking Systems) and impressing hiring managers.
  
  JOB DESCRIPTION:
  Title: ${job.title || 'Not specified'}
  Company: ${job.company || 'Not specified'}
  Description: ${job.description || 'Not specified'}` : 
  `Your goal is to perform a high-end, general optimization of a candidate's resume. Focus on clarity, impact, professional narrative, and structural excellence.`
}

CANDIDATE "GROUND TRUTH" DATA:
Name: ${student.name}
Summary: ${student.profile_summary}
Skills: ${skillsList.join(', ')}
Experience Level: ${student.experience_level}
Education: ${student.education || 'Not specified'}
Experience: ${student.experience || 'Not specified'}
Additional Context: ${student.additional_info || 'None'}
${student.full_cv_text ? `Full CV Text: ${student.full_cv_text}` : ''}

CRITICAL RULES FOR CV GENERATION:
1. NO FABRICATION: You must NEVER invent a job, a degree, a metric, or a project that is not explicitly supported by the "Ground Truth" data. 
2. ${isTailoring ? `KEYWORD OPTIMIZATION (ATS): Review the Job Description and integrate key skills naturally.` : `IMPACT OPTIMIZATION: Focus on strong results and professional branding.`}
3. STANDARD HEADINGS: Use conventional professional titles.
4. PROFESSIONAL SUMMARY: Rewrite into a 3-4 line powerful summary highlighting the candidate's core value proposition.
5. ACCOMPLISHMENTS (GOOGLE XYZ FORMULA): For Work Experience, use: "Accomplished [X] as measured by [Y], by doing [Z]". Use strong action verbs.
6. F-PATTERN LAYOUT: For EVERY bullet point in the Experience section, you MUST bold the first 3-4 words representing the "Result" or impact. Example: "**Increased revenue by 15%** by implementing..."
7. EDUCATION & SKILLS: Categorize skills into "technical" and "soft".
8. REFERENCES: Extract any references from the text.

TASK:
1. ${isTailoring ? `Analyze the match and rewrite parts to fit the role.` : `Perform a structural and content audit and rewrite for maximum professional impact.`}
2. Rewrite "Professional Summary".
3. Extract "Qualifications" (Certifications).
4. Rewrite "Work Experience" bullet points using Google XYZ formula. Limit to 3-5 bullets per role.
5. Extract Education.
6. Categorize skills into technical (Hard Skills) and soft (Professional).
7. Extract references if present.

Return a JSON object matching the requested schema.`;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: [prompt],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          jobTitle: { type: Type.STRING },
          tailoredSummary: { type: Type.STRING },
          qualifications: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                issuer: { type: Type.STRING },
                date: { type: Type.STRING },
                details: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["name", "issuer", "date", "details"]
            }
          },
          tailoredSkills: {
            type: Type.OBJECT,
            properties: {
              technical: { type: Type.ARRAY, items: { type: Type.STRING } },
              soft: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["technical", "soft"]
          },
          tailoredExperience: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                role: { type: Type.STRING },
                company: { type: Type.STRING },
                period: { type: Type.STRING },
                location: { type: Type.STRING },
                description: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["role", "company", "period", "location", "description"]
            }
          },
          education: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                degree: { type: Type.STRING },
                institution: { type: Type.STRING },
                year: { type: Type.STRING }
              },
              required: ["degree", "institution", "year"]
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
          references: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                title: { type: Type.STRING },
                contact: { type: Type.STRING }
              },
              required: ["name", "title", "contact"]
            }
          }
        },
        required: ["jobTitle", "tailoredSummary", "tailoredExperience", "education"]
      }
    }
  });

  if (response.usageMetadata) {
    await updateCost(response.usageMetadata, modelName);
  }

  return JSON.parse(response.text || '{}');
};
