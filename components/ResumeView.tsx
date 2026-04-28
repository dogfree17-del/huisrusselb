import React, { useState, useEffect, useRef } from 'react';
import { Printer, X, Star, Sparkles, Loader2, Send, Edit3, HelpCircle, Check, MessageSquare, Plus, ArrowUp, ArrowDown, Wand2, TrendingUp, Users, Zap, AlertCircle, BarChart3, Layout, FileText, Flame, Bold, Italic } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';
import { motion, AnimatePresence } from 'motion/react';
import { CVData, Experience, Education, Qualification, Award } from '../types';
import { DataService, AuthService } from '../services/supabase';

interface ResumeViewProps {
  ai: any;
  cvData: CVData;
  studentName: string;
  skills: any;
  email?: string;
  phone?: string;
  location?: string;
  linkedIn?: string;
  portfolio?: string;
  onClose: () => void;
  onSave?: (updatedData: CVData) => void;
  jobDescription?: string;
}

export default function ResumeView({ ai, cvData, studentName, skills, email = "student@example.com", phone = "+27 00 000 0000", location = "Local Area", linkedIn = "", portfolio = "", jobDescription = "", onClose, onSave }: ResumeViewProps) {
  const [currentCvData, setCurrentCvData] = useState<CVData>({
    ...cvData,
    references: cvData.references || [],
    certificates: cvData.certificates || [],
    sidebarOrder: cvData.sidebarOrder || ['education', 'certificates', 'skills', 'awards', 'references', 'sidebarCustomSections'],
    mainOrder: cvData.mainOrder || ['summary', 'qualifications', 'experience', 'customSections']
  });
  const [contactInfo, setContactInfo] = useState({ email, phone, location, linkedIn, portfolio });
  const [isEditing, setIsEditing] = useState(false);
  const [isManualEdit, setIsManualEdit] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedFont, setSelectedFont] = useState(currentCvData.formatting?.fontFamily || 'font-sans');
  const [fontSize, setFontSize] = useState(currentCvData.formatting?.fontSize || 'text-[10pt]');

  const fonts = [
    { name: 'Modern Sans', class: 'font-sans' },
    { name: 'Elegant Serif', class: 'font-serif' },
    { name: 'Technical Mono', class: 'font-mono' },
    { name: 'Geometric', class: 'font-geometric' },
    { name: 'Professional', class: 'font-professional' },
    { name: 'Classy Serif', class: 'font-elegant' },
    { name: 'Brutalist', class: 'font-brutalist' },
    { name: 'Minimalist', class: 'font-minimal' },
    { name: 'Handwriting', class: 'font-handwriting' }
  ];

  const fontSizes = [
    { name: 'Small', class: 'text-[9pt]' },
    { name: 'Standard', class: 'text-[10pt]' },
    { name: 'Medium', class: 'text-[11pt]' },
    { name: 'Large', class: 'text-[12pt]' }
  ];

  // AI Questions State
  const [aiQuestions, setAiQuestions] = useState<string[]>([]);
  const [aiAnswers, setAiAnswers] = useState<string[]>([]);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);

  // ATS Analysis State
  const [atsAnalysis, setAtsAnalysis] = useState<{
    score: number;
    matchedKeywords: string[];
    missingKeywords: string[];
    feedback: string[];
  } | null>(cvData.atsAnalysis || null);
  const [isAnalyzingAts, setIsAnalyzingAts] = useState(false);
  const [showAtsPanel, setShowAtsPanel] = useState(false);
  const [showAtsPreview, setShowAtsPreview] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [isOptimizingLayout, setIsOptimizingLayout] = useState(false);

  // Magic Cursor State
  const [magicState, setMagicState] = useState<{
    text: string;
    element: HTMLInputElement | HTMLTextAreaElement | null;
    start: number;
    end: number;
  } | null>(null);
  const [magicResult, setMagicResult] = useState<{
    type: 'quantify' | 'tone' | 'verbs';
    suggestions: string[];
    message?: string;
  } | null>(null);
  const [isMagicLoading, setIsMagicLoading] = useState(false);

  useEffect(() => {
    const checkSelection = () => {
      if (!isManualEdit) {
        setMagicState(null);
        return;
      }
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT')) {
        const inputEl = activeEl as HTMLInputElement | HTMLTextAreaElement;
        const start = inputEl.selectionStart || 0;
        const end = inputEl.selectionEnd || 0;
        if (end > start) {
          const text = inputEl.value.substring(start, end);
          if (text.trim().length > 0) {
            setMagicState({ text, element: inputEl, start, end });
            return;
          }
        } else {
          setMagicState(null);
          setMagicResult(null);
        }
      }
    };

    document.addEventListener('selectionchange', checkSelection);
    document.addEventListener('mouseup', checkSelection);
    document.addEventListener('keyup', checkSelection);
    return () => {
      document.removeEventListener('selectionchange', checkSelection);
      document.removeEventListener('mouseup', checkSelection);
      document.removeEventListener('keyup', checkSelection);
    };
  }, [isManualEdit]);

  const runMagicAction = async (action: 'quantify' | 'tone' | 'verbs') => {
    if (!magicState) return;
    setIsMagicLoading(true);
    setMagicResult(null);

    let prompt = '';
    let schema: any = {};

    if (action === 'quantify') {
      prompt = `Analyze this resume text. Identify missing metrics or vague claims. Suggest 1 improved version with placeholders for metrics (e.g., [X]%, $ [Y]), and provide a short message asking the user for the specific numbers.\nText: "${magicState.text}"`;
      schema = {
        type: Type.OBJECT,
        properties: {
          message: { type: Type.STRING },
          suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
      };
    } else if (action === 'tone') {
      prompt = `Rewrite this resume text in 3 different tones: 1. Aggressive/Sales-Driven, 2. Collaborative/Leadership, 3. Technical/Architectural.\nText: "${magicState.text}"`;
      schema = {
        type: Type.OBJECT,
        properties: {
          suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
      };
    } else if (action === 'verbs') {
      prompt = `Analyze this resume text. Replace weak verbs with high-impact action verbs (e.g., 'Spearheaded', 'Orchestrated'). Provide 2 improved variations.\nText: "${magicState.text}"`;
      schema = {
        type: Type.OBJECT,
        properties: {
          suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
      };
    }

    try {
      const response = await ai.getGenerativeModel({ model: 'gemini-1.5-flash' }).generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: schema
        }
      });
      const result = JSON.parse(response.response.text() || '{}');
      setMagicResult({ type: action, suggestions: result.suggestions || [], message: result.message });
    } catch (e) {
      console.error(e);
      alert('Failed to run magic action.');
    } finally {
      setIsMagicLoading(false);
    }
  };

  const applyMagicText = (newText: string) => {
    if (!magicState || !magicState.element) return;
    const el = magicState.element;
    const currentVal = el.value;
    const newVal = currentVal.substring(0, magicState.start) + newText + currentVal.substring(magicState.end);

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window[el.tagName === 'TEXTAREA' ? 'HTMLTextAreaElement' : 'HTMLInputElement'].prototype as any,
      'value'
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(el, newVal);
      const event = new Event('input', { bubbles: true });
      el.dispatchEvent(event);
    }

    setMagicState({
      ...magicState,
      text: newText,
      end: magicState.start + newText.length
    });
    setMagicResult(null);
  };

  const moveSection = (type: 'sidebar' | 'main', id: string, direction: 'up' | 'down') => {
    const orderKey = type === 'sidebar' ? 'sidebarOrder' : 'mainOrder';
    const currentOrder = currentCvData[orderKey] || [];
    const index = currentOrder.indexOf(id);
    if (index === -1) return;

    const newOrder = [...currentOrder];
    if (direction === 'up' && index > 0) {
      [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
    } else if (direction === 'down' && index < newOrder.length - 1) {
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    } else {
      return;
    }

    setCurrentCvData({ ...currentCvData, [orderKey]: newOrder });
  };

  const removeSection = (type: 'sidebar' | 'main', id: string) => {
    const orderKey = type === 'sidebar' ? 'sidebarOrder' : 'mainOrder';
    const currentOrder = currentCvData[orderKey] || [];
    const newOrder = currentOrder.filter(item => item !== id);
    setCurrentCvData({ ...currentCvData, [orderKey]: newOrder });
  };

  const addCustomSection = async (type: 'sidebar' | 'main', title: string) => {
    if (!title) return;
    const key = type === 'sidebar' ? 'sidebarCustomSections' : 'customSections';
    const orderKey = type === 'sidebar' ? 'sidebarOrder' : 'mainOrder';
    const id = `custom_${Date.now()}`;
    
    // Assisted formatting attempt
    setIsProcessing(true);
    let initialContent = "Add your content here...";
    try {
      const response = await ai.getGenerativeModel({ model: 'gemini-1.5-flash' }).generateContent(`Generate a professional template content for a CV section titled "${title}" in a brief, high-impact format.`);
      initialContent = response.response.text();
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }

    const newSection = { id, title, content: initialContent };
    const currentSections = currentCvData[key] || [];
    
    setCurrentCvData(prev => ({
      ...prev,
      [key]: [...(prev[key] || []), newSection],
      [orderKey]: [...(prev[orderKey] || []), id]
    }));
  };

  const addSkill = (type: 'technical' | 'soft') => {
    setCurrentCvData(prev => {
      const skills = prev.tailoredSkills || { technical: [], soft: [] };
      return {
        ...prev,
        tailoredSkills: {
          ...skills,
          [type]: [...(skills[type] || []), 'New Skill']
        }
      };
    });
  };

  const updateSkill = (type: 'technical' | 'soft', index: number, value: string) => {
    setCurrentCvData(prev => {
      const skills = prev.tailoredSkills || { technical: [], soft: [] };
      const newSkills = [...(skills[type] || [])];
      newSkills[index] = value;
      return {
        ...prev,
        tailoredSkills: {
          ...skills,
          [type]: newSkills
        }
      };
    });
  };

  const removeSkill = (type: 'technical' | 'soft', index: number) => {
    setCurrentCvData(prev => {
      const skills = prev.tailoredSkills || { technical: [], soft: [] };
      const newSkills = (skills[type] || []).filter((_, i) => i !== index);
      return {
        ...prev,
        tailoredSkills: {
          ...skills,
          [type]: newSkills
        }
      };
    });
  };

  const addExperience = () => {
    setCurrentCvData(prev => ({
      ...prev,
      tailoredExperience: [
        ...(prev.tailoredExperience || []),
        { role: 'Role', company: 'Company', period: '2024 - Present', location: 'City, Country', description: ['Key Achievement or Responsibility'] }
      ]
    }));
  };

  const updateExperience = (index: number, field: keyof Experience, value: any) => {
    setCurrentCvData(prev => {
      const newExp = [...(prev.tailoredExperience || [])];
      newExp[index] = { ...newExp[index], [field]: value };
      return { ...prev, tailoredExperience: newExp };
    });
  };

  const removeExperience = (index: number) => {
    setCurrentCvData(prev => ({
      ...prev,
      tailoredExperience: (prev.tailoredExperience || []).filter((_, i) => i !== index)
    }));
  };

  const renderSectionHeader = (title: string, type: 'sidebar' | 'main', id: string) => {
    const order = currentCvData[type === 'sidebar' ? 'sidebarOrder' : 'mainOrder'] || [];
    const index = order.indexOf(id);
    const isFirst = index === 0;
    const isLast = index === order.length - 1;

    return (
      <h2 className={`text-[1em] font-semibold uppercase tracking-[2pt] text-black ${type === 'main' ? 'border-b-[2px] border-black pb-1 mb-3' : 'mb-4'} flex justify-between items-center group/header`}>
        <div className="flex items-center gap-2">
          {title}
        </div>
        {isManualEdit && (
          <div className="flex gap-1 no-print opacity-0 group-hover/header:opacity-100 transition-opacity">
            <button 
              onClick={() => moveSection(type, id, 'up')} 
              disabled={isFirst}
              className="p-1 hover:bg-slate-100 rounded disabled:opacity-30 hover:text-indigo-600 transition-colors"
              title="Move Up"
            >
              <ArrowUp className="w-3 h-3" />
            </button>
            <button 
              onClick={() => moveSection(type, id, 'down')} 
              disabled={isLast}
              className="p-1 hover:bg-slate-100 rounded disabled:opacity-30 hover:text-indigo-600 transition-colors"
              title="Move Down"
            >
              <ArrowDown className="w-3 h-3" />
            </button>
            <button 
              onClick={() => removeSection(type, id)} 
              className="p-1 hover:bg-red-50 rounded text-red-400 hover:text-red-600 transition-colors"
              title="Remove Section"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </h2>
    );
  };

  const calculateScore = () => {
    let score = 0;
    if (currentCvData.tailoredSummary && currentCvData.tailoredSummary.length > 50) score += 20;
    if (currentCvData.tailoredExperience && currentCvData.tailoredExperience.length > 0) score += 30;
    if (currentCvData.education && currentCvData.education.length > 0) score += 20;
    if (currentCvData.tailoredSkills && (currentCvData.tailoredSkills.technical.length > 0 || currentCvData.tailoredSkills.soft.length > 0)) score += 20;
    if (contactInfo.linkedIn && contactInfo.portfolio) score += 10;
    else if (contactInfo.linkedIn || contactInfo.portfolio) score += 5;
    return score;
  };

  const score = calculateScore();

  const handlePrint = () => {
    window.print();
  };

  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave({ ...currentCvData, ...contactInfo, atsAnalysis: atsAnalysis || undefined });
    } catch (error) {
      console.error('Failed to save CV:', error);
      alert('Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const generateAIQuestions = async () => {
    setIsGeneratingQuestions(true);
    try {
      const response = await ai.getGenerativeModel({ model: 'gemini-1.5-flash' }).generateContent({
        contents: [
          {
            role: 'user',
            parts: [{
              text: `Analyze this CV data and generate 3-5 targeted questions for the candidate to help make the CV more detailed and impactful. 
              Focus on quantifying achievements, specific tools used, or leadership examples.
              
              CV Data: ${JSON.stringify(currentCvData)}
              
              Return a JSON array of strings (the questions).`
            }]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });

      const questions = JSON.parse(response.response.text() || '[]');
      const validQuestions = Array.isArray(questions) ? questions : [];
      setAiQuestions(validQuestions);
      setAiAnswers(new Array(validQuestions.length).fill(''));
      setShowQuestions(true);
    } catch (error) {
      console.error('Failed to generate questions:', error);
      alert('Failed to generate suggestions.');
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  const submitAIAnswers = async () => {
    setIsProcessing(true);
    try {
      const qaPairs = aiQuestions.map((q, i) => `Question: ${q}\nAnswer: ${aiAnswers[i]}`).join('\n\n');
      const response = await ai.getGenerativeModel({ model: 'gemini-1.5-flash' }).generateContent({
        contents: [
          {
            role: 'user',
            parts: [{
              text: `You are an expert CV editor. 
              Update the CV data based on these new details provided by the candidate.
              
              Current CV Data: ${JSON.stringify(currentCvData)}
              New Details:
              ${qaPairs}
              
              Return the updated CV data in the EXACT same JSON format.
              Integrate the new information seamlessly into the summary, experience, or qualifications sections.`
            }]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
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
              tailoredSkills: {
                type: Type.OBJECT,
                properties: {
                  technical: { type: Type.ARRAY, items: { type: Type.STRING } },
                  soft: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
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
                  }
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
                  }
                }
              }
            }
          }
        }
      });

      const updatedData = JSON.parse(response.response.text() || '{}');
      setCurrentCvData(prev => ({ ...prev, ...updatedData }));
      setShowQuestions(false);
      setAiQuestions([]);
      setAiAnswers([]);
    } catch (error) {
      console.error('Failed to update CV with answers:', error);
      alert('Failed to update CV.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAIEdit = async () => {
    if (!editPrompt.trim()) return;
    setIsProcessing(true);
    try {
      const response = await ai.getGenerativeModel({ model: 'gemini-1.5-flash' }).generateContent({
        contents: [
          {
            role: 'user',
            parts: [{
              text: `You are an expert CV editor.
              Current CV Data: ${JSON.stringify(currentCvData)}
              User Instruction: ${editPrompt}
              
              Modify the CV data based on the user instruction. Return the updated CV data in the EXACT same JSON format.
              Ensure the content remains professional and impactful.`
            }]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
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
              tailoredSkills: {
                type: Type.OBJECT,
                properties: {
                  technical: { type: Type.ARRAY, items: { type: Type.STRING } },
                  soft: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
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
                  }
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
                  }
                }
              }
            }
          }
        }
      });

      const updatedData = JSON.parse(response.response.text() || '{}');
      setCurrentCvData(prev => ({ ...prev, ...updatedData }));
      setEditPrompt('');
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to edit CV:', error);
      alert('Failed to edit CV. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const runAtsAnalysis = async () => {
    if (!jobDescription) {
      alert("No Job Description available for ATS Analysis.");
      return;
    }
    setIsAnalyzingAts(true);
    setShowAtsPanel(true);
    try {
      const response = await ai.getGenerativeModel({ model: 'gemini-1.5-flash' }).generateContent({
        contents: [{
          role: 'user',
          parts: [{
            text: `You are an expert ATS (Applicant Tracking System) simulator.
            Compare the following CV against the provided Job Description.
            
            JOB DESCRIPTION:
            ${jobDescription}
            
            CV DATA:
            ${JSON.stringify(currentCvData)}
            
            Analyze the match and provide:
            1. An overall ATS match score (0-100).
            2. A list of exact keywords (1-3 words each) from the JD that are MATCHED in the CV.
            3. A list of critical keywords from the JD that are MISSING in the CV.
            4. 2-3 short, actionable feedback points to improve the CV for this specific role.
            
            Return a JSON object matching the schema.`
          }]
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.NUMBER },
              matchedKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
              missingKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
              feedback: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["score", "matchedKeywords", "missingKeywords", "feedback"]
          }
        }
      });

      const result = JSON.parse(response.response.text() || '{}');
      setAtsAnalysis(result);
    } catch (error) {
      console.error('Failed to run ATS analysis:', error);
      alert('Failed to run ATS analysis.');
      setShowAtsPanel(false);
    } finally {
      setIsAnalyzingAts(false);
    }
  };

  const optimizeLayout = async () => {
    if (!jobDescription) {
      alert("No Job Description available to optimize layout.");
      return;
    }
    setIsOptimizingLayout(true);
    try {
      const response = await ai.getGenerativeModel({ model: 'gemini-1.5-flash' }).generateContent({
        contents: [{
          role: 'user',
          parts: [{
            text: `You are an expert CV layout optimizer.
            Given this Job Description:
            ${jobDescription}
            
            And these available CV sections:
            Main: ${currentCvData.mainOrder?.join(', ')}
            Sidebar: ${currentCvData.sidebarOrder?.join(', ')}
            
            Suggest the optimal ordering of these sections to best match the job description.
            For example, if the JD emphasizes specific skills, 'skills' might move up. If it emphasizes education, 'education' moves up.
            Return a JSON object with 'mainOrder' and 'sidebarOrder' arrays containing the exact same string keys, just reordered.`
          }]
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              mainOrder: { type: Type.ARRAY, items: { type: Type.STRING } },
              sidebarOrder: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["mainOrder", "sidebarOrder"]
          }
        }
      });

      const result = JSON.parse(response.response.text() || '{}');
      if (result.mainOrder && result.sidebarOrder) {
        setCurrentCvData(prev => ({
          ...prev,
          mainOrder: result.mainOrder,
          sidebarOrder: result.sidebarOrder
        }));
      }
    } catch (error) {
      console.error('Failed to optimize layout:', error);
      alert('Failed to optimize layout.');
    } finally {
      setIsOptimizingLayout(false);
    }
  };

  const applyTextFormatting = (format: 'bold' | 'italic') => {
    const activeEl = document.activeElement as HTMLInputElement | HTMLTextAreaElement;
    if (!activeEl || (activeEl.tagName !== 'INPUT' && activeEl.tagName !== 'TEXTAREA')) return;

    const start = activeEl.selectionStart;
    const end = activeEl.selectionEnd;
    if (start === null || end === null || start === end) return;

    const text = activeEl.value;
    const selectedText = text.substring(start, end);
    const wrapper = format === 'bold' ? '**' : '*';
    const newText = text.substring(0, start) + wrapper + selectedText + wrapper + text.substring(end);

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
    
    if (activeEl.tagName === 'INPUT' && nativeInputValueSetter) {
      nativeInputValueSetter.call(activeEl, newText);
    } else if (activeEl.tagName === 'TEXTAREA' && nativeTextAreaValueSetter) {
      nativeTextAreaValueSetter.call(activeEl, newText);
    }
    
    const event = new Event('input', { bubbles: true });
    activeEl.dispatchEvent(event);
    
    setTimeout(() => {
      activeEl.setSelectionRange(start + wrapper.length, end + wrapper.length);
    }, 0);
  };

  const highlightKeywords = (text: string) => {
    if (!text) return text;
    if (!atsAnalysis || !atsAnalysis.matchedKeywords || atsAnalysis.matchedKeywords.length === 0 || isManualEdit) {
      return text;
    }
    
    // Sort keywords by length descending to match longer phrases first
    const keywords = [...atsAnalysis.matchedKeywords].sort((a, b) => b.length - a.length);
    
    // Escape regex characters in keywords
    const escapedKeywords = keywords.map(kw => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`\\b(${escapedKeywords.join('|')})\\b`, 'gi');
    
    const parts = text.split(regex);
    
    return parts.map((part, i) => {
      if (keywords.some(kw => kw.toLowerCase() === part.toLowerCase())) {
        return <span key={i} className="bg-emerald-100 text-emerald-800 font-medium px-0.5 rounded">{part}</span>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  const renderFormattedText = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-black">{highlightKeywords(part.slice(2, -2))}</strong>;
      } else if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={i} className="italic text-black">{highlightKeywords(part.slice(1, -1))}</em>;
      }
      return <span key={i}>{highlightKeywords(part)}</span>;
    });
  };

  const renderSkills = () => {
    if (currentCvData.tailoredSkills) {
      return (
        <div className="space-y-4">
          {currentCvData.tailoredSkills.technical && currentCvData.tailoredSkills.technical.length > 0 && (
            <div>
              <h4 className="text-[0.8em] font-bold uppercase text-black mb-1">Hard Skills</h4>
              <ul className="list-disc pl-4 space-y-0.5">
                {currentCvData.tailoredSkills?.technical?.map((skill, idx) => (
                  <li key={idx} className="text-[0.8em] text-black">{highlightKeywords(skill)}</li>
                ))}
              </ul>
            </div>
          )}
          {currentCvData.tailoredSkills.soft && currentCvData.tailoredSkills.soft.length > 0 && (
            <div>
              <h4 className="text-[0.8em] font-bold uppercase text-black mb-1">Soft Skills</h4>
              <ul className="list-disc pl-4 space-y-0.5">
                {currentCvData.tailoredSkills?.soft?.map((skill, idx) => (
                  <li key={idx} className="text-[0.8em] text-black">{highlightKeywords(skill)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    if (!skills) return null;
    return null;
  };

  const renderAtsText = () => {
    let text = `${studentName}\n${currentCvData.jobTitle}\n${contactInfo.phone} | ${contactInfo.email} | ${contactInfo.location}\n\n`;
    
    text += `SUMMARY\n${currentCvData.tailoredSummary}\n\n`;

    const sections = [
      ...(currentCvData.mainOrder || ['experience', 'qualifications', 'custom']),
      ...(currentCvData.sidebarOrder || ['education', 'certificates', 'skills', 'awards', 'references'])
    ];

    sections.forEach(section => {
      if (section === 'experience' && currentCvData.tailoredExperience) {
        text += `WORK EXPERIENCE\n`;
        currentCvData.tailoredExperience.forEach(exp => {
          text += `${exp.role} at ${exp.company} ${exp.location ? `(${exp.location})` : ''} | ${exp.period}\n`;
          if (exp.description) {
            exp.description.forEach(desc => text += `- ${desc.replace(/\*\*/g, '').replace(/\*/g, '')}\n`);
          }
          text += '\n';
        });
      }
      if (section === 'qualifications' && currentCvData.qualifications) {
        text += `QUALIFICATIONS\n`;
        currentCvData.qualifications.forEach(qual => {
          text += `${qual.name} from ${qual.issuer} | ${qual.date}\n`;
          if (qual.details) {
            qual.details.forEach(detail => text += `- ${detail.replace(/\*\*/g, '').replace(/\*/g, '')}\n`);
          }
          text += '\n';
        });
      }
      if (section === 'education' && currentCvData.education) {
        text += `EDUCATION\n`;
        currentCvData.education.forEach(edu => {
          text += `${edu.degree} from ${edu.institution} | ${edu.year}\n`;
        });
        text += '\n';
      }
      if (section === 'skills' && currentCvData.tailoredSkills) {
        text += `SKILLS\n`;
        text += `Technical: ${currentCvData.tailoredSkills.technical.join(', ')}\n`;
        text += `Soft: ${currentCvData.tailoredSkills.soft.join(', ')}\n\n`;
      }
      if (section === 'certificates' && currentCvData.certificates) {
        text += `CERTIFICATES\n`;
        currentCvData.certificates.forEach(cert => {
          text += `${cert.title} from ${cert.issuer} | ${cert.year}\n`;
        });
        text += '\n';
      }
      if (section === 'awards' && currentCvData.awards) {
        text += `AWARDS\n`;
        currentCvData.awards.forEach(award => {
          text += `${award.name} from ${award.issuer} | ${award.date}\n`;
        });
        text += '\n';
      }
      if (section === 'references' && currentCvData.references) {
        text += `REFERENCES\n`;
        currentCvData.references.forEach(ref => {
          text += `${ref.name}, ${ref.title} | ${ref.contact}\n`;
        });
        text += '\n';
      }
    });

    return text;
  };

  return (
    <div className={`fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-100/95 backdrop-blur-xl p-4 sm:p-8 print:p-0 print:bg-white print:block ${isManualEdit ? 'editing-mode' : ''}`}>
      
      {/* Controls Container */}
      <div className="no-print fixed top-6 right-6 flex flex-col sm:flex-row gap-3 z-[70] max-w-[90vw] overflow-x-auto pb-2">
        {isManualEdit && (
          <div className="flex bg-white rounded-2xl shadow-xl border border-slate-200 p-1.5 h-12 items-center">
            <select
              value={selectedFont}
              onChange={(e) => setSelectedFont(e.target.value)}
              className="px-3 py-2 text-xs font-bold text-slate-700 bg-transparent border-r border-slate-100 focus:outline-none cursor-pointer uppercase tracking-widest"
            >
              {fonts.map(f => (
                <option key={f.class} value={f.class}>{f.name}</option>
              ))}
            </select>
            <select
              value={fontSize}
              onChange={(e) => setFontSize(e.target.value)}
              className="px-3 py-2 text-xs font-bold text-slate-700 bg-transparent border-r border-slate-100 focus:outline-none cursor-pointer uppercase tracking-widest"
            >
              {fontSizes.map(s => (
                <option key={s.class} value={s.class}>{s.name}</option>
              ))}
            </select>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyTextFormatting('bold')}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              title="Bold"
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyTextFormatting('italic')}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              title="Italic"
            >
              <Italic className="w-4 h-4" />
            </button>
            <div className="w-px h-6 bg-slate-100 mx-1" />
            <button 
              onClick={() => {
                const title = prompt("Section Title:");
                if (title) addCustomSection('main', title);
              }}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              title="Add Main Section"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        )}
        
        <div className="flex bg-white rounded-2xl shadow-xl border border-slate-200 p-1.5 h-12 items-center gap-1">
          <div className="px-4 py-2 text-[10px] uppercase font-black tracking-widest text-slate-500 border-r border-slate-100 h-full flex items-center">
            Match: <span className={`ml-2 ${(atsAnalysis ? atsAnalysis.score : score) > 70 ? 'text-[#00FF00]' : 'text-[#FF6321]'}`}>{atsAnalysis ? atsAnalysis.score : score}%</span>
          </div>
          
          <ControlBtn 
            active={isEditing} 
            onClick={() => { setIsEditing(!isEditing); setIsManualEdit(false); }} 
            icon={<Sparkles className="w-4 h-4" />} 
            label="AI Edit" 
          />
          
          <ControlBtn 
            active={isManualEdit} 
            onClick={() => { setIsManualEdit(!isManualEdit); setIsEditing(false); }} 
            icon={<Edit3 className="w-4 h-4" />} 
            label={isManualEdit ? "Finish" : "Manual"} 
          />
          
          <ControlBtn 
            active={showAtsPanel} 
            onClick={runAtsAnalysis} 
            disabled={isAnalyzingAts || !jobDescription}
            icon={isAnalyzingAts ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />} 
            label="ATS" 
          />
          
          <ControlBtn 
            onClick={handleSave} 
            disabled={isSaving}
            icon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} 
            label="Save" 
          />
          
          <ControlBtn 
            onClick={handlePrint} 
            icon={<Printer className="w-4 h-4" />} 
            label="Print" 
          />
        </div>

        <button onClick={onClose} className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-xl hover:bg-slate-800 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* AI Edit / ATS Feedback Panels */}
      <AnimatePresence>
        {isEditing && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className="no-print fixed top-24 right-6 w-80 bg-slate-900 text-white rounded-[32px] p-6 shadow-2xl z-[70] border border-[#FF6321]/30">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-[#FF6321] text-white rounded-full flex items-center justify-center shadow-lg"><Sparkles className="w-5 h-5" /></div>
              <h3 className="font-black uppercase italic tracking-tighter text-lg">AI CV COMMAND</h3>
            </div>
            <textarea
              value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)}
              placeholder="e.g. Make experience more data-driven..."
              className="w-full h-32 p-4 text-xs bg-slate-800 border border-slate-700 rounded-2xl focus:ring-1 focus:ring-[#FF6321] outline-none mb-4"
              disabled={isProcessing}
            />
            <button onClick={handleAIEdit} disabled={isProcessing || !editPrompt.trim()}
              className="w-full py-4 bg-[#FF6321] text-white rounded-xl font-black uppercase italic tracking-widest text-xs flex items-center justify-center gap-3 shadow-xl transform active:scale-95 transition-all">
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Run Synthesis"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main CV View */}
      <div className={`print-container w-[210mm] min-h-[297mm] bg-white shadow-2xl mx-auto flex flex-col print:shadow-none print:m-0 text-black p-[15mm] box-border relative rounded-xl ${selectedFont} ${fontSize}`}
        style={{ color: 'black' }}>
        
        {isManualEdit && (
          <div className="no-print absolute -left-20 top-0 flex flex-col gap-4">
            <button 
              onClick={() => {
                const title = prompt("Sidebar Section Title:");
                if (title) addCustomSection('sidebar', title);
              }}
              className="w-12 h-12 bg-white border-2 border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-600 transition-all shadow-sm"
              title="Add Sidebar Section"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>
        )}

        {showHeatmap && (
          <div className="absolute inset-0 pointer-events-none z-50 mix-blend-multiply opacity-40" style={{
            background: `radial-gradient(ellipse at 30% 15%, rgba(255,100,0,0.4) 0%, transparent 50%), radial-gradient(ellipse at 70% 15%, rgba(255,50,0,0.3) 0%, transparent 40%), radial-gradient(ellipse at 30% 45%, rgba(255,150,0,0.2) 0%, transparent 50%)`
          }} />
        )}
        
        <header className="mb-10 text-center relative z-10 border-b-2 border-slate-900 pb-8">
          <h1 className="text-4xl font-black uppercase italic tracking-tighter decoration-[#FF6321] decoration-4 mb-2">{studentName}</h1>
          {isManualEdit ? (
            <input 
              type="text" 
              value={currentCvData.jobTitle} 
              onChange={(e) => setCurrentCvData(prev => ({ ...prev, jobTitle: e.target.value }))}
              placeholder="Job Title"
              className="w-full text-center text-sm font-bold text-slate-500 tracking-widest uppercase mb-4 border-b border-dashed border-slate-200 outline-none focus:border-indigo-500 transition-colors" 
            />
          ) : (
            <div className="text-xs font-black text-[#FF6321] tracking-[0.4em] uppercase mb-4">{highlightKeywords(currentCvData.jobTitle)}</div>
          )}
          
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[10px] font-bold uppercase tracking-widest text-slate-600">
            {isManualEdit ? (
              <>
                <div className="flex items-center gap-1 border-b border-dashed border-slate-200">
                  <span className="text-[#FF6321]">PH:</span>
                  <input type="text" value={contactInfo.phone} onChange={(e) => setContactInfo({ ...contactInfo, phone: e.target.value })} className="outline-none w-28 bg-transparent" />
                </div>
                <div className="flex items-center gap-1 border-b border-dashed border-slate-200">
                  <span className="text-[#FF6321]">EM:</span>
                  <input type="text" value={contactInfo.email} onChange={(e) => setContactInfo({ ...contactInfo, email: e.target.value })} className="outline-none w-36 bg-transparent" />
                </div>
                <div className="flex items-center gap-1 border-b border-dashed border-slate-200">
                  <span className="text-[#FF6321]">LOC:</span>
                  <input type="text" value={contactInfo.location} onChange={(e) => setContactInfo({ ...contactInfo, location: e.target.value })} className="outline-none w-28 bg-transparent" />
                </div>
              </>
            ) : (
              <>
                <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-[#FF6321] rotate-45" /> {contactInfo.phone}</span>
                <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-[#FF6321] rotate-45" /> {contactInfo.email}</span>
                <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-[#FF6321] rotate-45" /> {contactInfo.location}</span>
                {contactInfo.linkedIn && <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-[#FF6321] rotate-45" /> LinkedIn</span>}
              </>
            )}
          </div>
        </header>

        <div className="flex gap-12 flex-1 relative z-10">
          <aside className="w-[30%] border-r border-slate-100 pr-8 flex flex-col gap-10">
            {(currentCvData.sidebarOrder || []).map(sectionId => {
              if (sectionId === 'education') {
                return (
                  <section key={sectionId}>
                    {renderSectionHeader("Education", "sidebar", "education")}
                    <div className="space-y-6">
                      {currentCvData.education?.map((edu, idx) => (
                        <div key={idx} className="space-y-1 group relative">
                          {isManualEdit ? (
                            <>
                              <input 
                                className="text-[11px] font-black uppercase text-slate-900 leading-tight w-full bg-transparent border-b border-dashed border-slate-200 outline-none focus:border-indigo-500"
                                value={edu.degree}
                                onChange={(e) => {
                                  const newEdu = [...(currentCvData.education || [])];
                                  newEdu[idx] = { ...newEdu[idx], degree: e.target.value };
                                  setCurrentCvData({ ...currentCvData, education: newEdu });
                                }}
                              />
                              <input 
                                className="text-[10px] font-bold italic text-slate-500 w-full bg-transparent border-b border-dashed border-slate-200 outline-none focus:border-indigo-500"
                                value={edu.institution}
                                onChange={(e) => {
                                  const newEdu = [...(currentCvData.education || [])];
                                  newEdu[idx] = { ...newEdu[idx], institution: e.target.value };
                                  setCurrentCvData({ ...currentCvData, education: newEdu });
                                }}
                              />
                              <input 
                                className="text-[9px] font-black text-[#FF6321] w-full bg-transparent border-b border-dashed border-slate-200 outline-none focus:border-indigo-500"
                                value={edu.year}
                                onChange={(e) => {
                                  const newEdu = [...(currentCvData.education || [])];
                                  newEdu[idx] = { ...newEdu[idx], year: e.target.value };
                                  setCurrentCvData({ ...currentCvData, education: newEdu });
                                }}
                              />
                              <button 
                                onClick={() => {
                                  const newEdu = (currentCvData.education || []).filter((_, i) => i !== idx);
                                  setCurrentCvData({ ...currentCvData, education: newEdu });
                                }}
                                className="absolute -right-6 top-0 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </>
                          ) : (
                            <>
                              <p className="text-[11px] font-black uppercase text-slate-900 leading-tight">{highlightKeywords(edu.degree)}</p>
                              <p className="text-[10px] font-bold italic text-slate-500">{highlightKeywords(edu.institution)}</p>
                              <p className="text-[9px] font-black text-[#FF6321]">{edu.year}</p>
                            </>
                          )}
                        </div>
                      ))}
                      {isManualEdit && (
                        <button 
                          onClick={() => setCurrentCvData({ ...currentCvData, education: [...(currentCvData.education || []), { degree: 'Degree', institution: 'Institution', year: 'Year' }] })}
                          className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors"
                        >
                          <Plus className="w-3 h-3" /> Add Education
                        </button>
                      )}
                    </div>
                  </section>
                );
              }

              if (sectionId === 'skills') {
                return (
                  <section key={sectionId}>
                    {renderSectionHeader("Expertise", "sidebar", "skills")}
                    <div className="space-y-6">
                      <div>
                        <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-[#FF6321] mb-3 flex justify-between">
                          Hard Skills
                          {isManualEdit && <button onClick={() => addSkill('technical')} className="text-slate-400 hover:text-indigo-600">+</button>}
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {currentCvData.tailoredSkills?.technical.map((s, i) => (
                            <div key={i} className="group relative flex items-center">
                              {isManualEdit ? (
                                <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-md border border-slate-200">
                                  <input 
                                    className="text-[9.5px] font-bold text-slate-800 bg-transparent outline-none w-16"
                                    value={s}
                                    onChange={(e) => updateSkill('technical', i, e.target.value)}
                                  />
                                  <button onClick={() => removeSkill('technical', i)} className="text-red-300 hover:text-red-500">×</button>
                                </div>
                              ) : (
                                <span className="text-[9.5px] font-bold text-slate-800 bg-slate-50 px-2 py-1 rounded-md border border-slate-200">{s}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-[#FF6321] mb-3 flex justify-between">
                          Professional
                          {isManualEdit && <button onClick={() => addSkill('soft')} className="text-slate-400 hover:text-indigo-600">+</button>}
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {currentCvData.tailoredSkills?.soft.map((s, i) => (
                            <div key={i} className="group relative flex items-center">
                              {isManualEdit ? (
                                <div className="flex items-center gap-1 border-b border-slate-200 italic">
                                  <input 
                                    className="text-[9.5px] font-bold text-slate-800 bg-transparent outline-none w-16"
                                    value={s}
                                    onChange={(e) => updateSkill('soft', i, e.target.value)}
                                  />
                                  <button onClick={() => removeSkill('soft', i)} className="text-red-300 hover:text-red-500">×</button>
                                </div>
                              ) : (
                                <span className="text-[9.5px] font-bold text-slate-800 border-b border-slate-200 italic">{s}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>
                );
              }

              if (sectionId === 'awards') {
                return (
                  <section key={sectionId}>
                    {renderSectionHeader("Awards", "sidebar", "awards")}
                    <div className="space-y-6">
                      {currentCvData.awards?.map((award, idx) => (
                        <div key={idx} className="space-y-1 group relative">
                          {isManualEdit ? (
                            <>
                              <input 
                                className="text-[11px] font-black uppercase text-slate-900 leading-tight w-full bg-transparent border-b border-dashed border-slate-200 outline-none focus:border-indigo-500"
                                value={award.name}
                                onChange={(e) => {
                                  const newAwards = [...(currentCvData.awards || [])];
                                  newAwards[idx] = { ...newAwards[idx], name: e.target.value };
                                  setCurrentCvData({ ...currentCvData, awards: newAwards });
                                }}
                              />
                              <input 
                                className="text-[10px] font-bold italic text-slate-500 w-full bg-transparent border-b border-dashed border-slate-200 outline-none focus:border-indigo-500"
                                value={award.issuer}
                                onChange={(e) => {
                                  const newAwards = [...(currentCvData.awards || [])];
                                  newAwards[idx] = { ...newAwards[idx], issuer: e.target.value };
                                  setCurrentCvData({ ...currentCvData, awards: newAwards });
                                }}
                              />
                              <input 
                                className="text-[9px] font-black text-[#FF6321] w-full bg-transparent border-b border-dashed border-slate-200 outline-none focus:border-indigo-500"
                                value={award.date}
                                onChange={(e) => {
                                  const newAwards = [...(currentCvData.awards || [])];
                                  newAwards[idx] = { ...newAwards[idx], date: e.target.value };
                                  setCurrentCvData({ ...currentCvData, awards: newAwards });
                                }}
                              />
                              <button 
                                onClick={() => {
                                  const newAwards = (currentCvData.awards || []).filter((_, i) => i !== idx);
                                  setCurrentCvData({ ...currentCvData, awards: newAwards });
                                }}
                                className="absolute -right-6 top-0 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </>
                          ) : (
                            <>
                              <p className="text-[11px] font-black uppercase text-slate-900 leading-tight">{highlightKeywords(award.name)}</p>
                              <p className="text-[10px] font-bold italic text-slate-500">{highlightKeywords(award.issuer)}</p>
                              <p className="text-[9px] font-black text-[#FF6321]">{award.date}</p>
                            </>
                          )}
                        </div>
                      ))}
                      {isManualEdit && (
                        <button 
                          onClick={() => setCurrentCvData({ ...currentCvData, awards: [...(currentCvData.awards || []), { name: 'Award Name', issuer: 'Issuer', date: 'Year', details: [] }] })}
                          className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors"
                        >
                          <Plus className="w-3 h-3" /> Add Award
                        </button>
                      )}
                    </div>
                  </section>
                );
              }

              if (sectionId === 'certificates') {
                return (
                  <section key={sectionId}>
                    {renderSectionHeader("Certifications", "sidebar", "certificates")}
                    <div className="space-y-6">
                      {currentCvData.certificates?.map((cert, idx) => (
                        <div key={idx} className="space-y-1 group relative">
                          {isManualEdit ? (
                            <>
                              <input 
                                className="text-[11px] font-black uppercase text-slate-900 leading-tight w-full bg-transparent border-b border-dashed border-slate-200 outline-none focus:border-indigo-500"
                                value={cert.title}
                                onChange={(e) => {
                                  const newCerts = [...(currentCvData.certificates || [])];
                                  newCerts[idx] = { ...newCerts[idx], title: e.target.value };
                                  setCurrentCvData({ ...currentCvData, certificates: newCerts });
                                }}
                              />
                              <input 
                                className="text-[10px] font-bold italic text-slate-500 w-full bg-transparent border-b border-dashed border-slate-200 outline-none focus:border-indigo-500"
                                value={cert.issuer}
                                onChange={(e) => {
                                  const newCerts = [...(currentCvData.certificates || [])];
                                  newCerts[idx] = { ...newCerts[idx], issuer: e.target.value };
                                  setCurrentCvData({ ...currentCvData, certificates: newCerts });
                                }}
                              />
                              <input 
                                className="text-[9px] font-black text-[#FF6321] w-full bg-transparent border-b border-dashed border-slate-200 outline-none focus:border-indigo-500"
                                value={cert.year}
                                onChange={(e) => {
                                  const newCerts = [...(currentCvData.certificates || [])];
                                  newCerts[idx] = { ...newCerts[idx], year: e.target.value };
                                  setCurrentCvData({ ...currentCvData, certificates: newCerts });
                                }}
                              />
                              <button 
                                onClick={() => {
                                  const newCerts = (currentCvData.certificates || []).filter((_, i) => i !== idx);
                                  setCurrentCvData({ ...currentCvData, certificates: newCerts });
                                }}
                                className="absolute -right-6 top-0 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </>
                          ) : (
                            <>
                              <p className="text-[11px] font-black uppercase text-slate-900 leading-tight">{highlightKeywords(cert.title)}</p>
                              <p className="text-[10px] font-bold italic text-slate-500">{highlightKeywords(cert.issuer)}</p>
                              <p className="text-[9px] font-black text-[#FF6321]">{cert.year}</p>
                            </>
                          )}
                        </div>
                      ))}
                      {isManualEdit && (
                        <button 
                          onClick={() => setCurrentCvData({ ...currentCvData, certificates: [...(currentCvData.certificates || []), { title: 'Certificate Name', issuer: 'Issuer', year: 'Year' }] })}
                          className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors"
                        >
                          <Plus className="w-3 h-3" /> Add Certificate
                        </button>
                      )}
                    </div>
                  </section>
                );
              }

              if (sectionId === 'references') {
                return (
                  <section key={sectionId}>
                    {renderSectionHeader("References", "sidebar", "references")}
                    <div className="space-y-6">
                      {currentCvData.references?.map((ref, idx) => (
                        <div key={idx} className="space-y-1 group relative">
                          {isManualEdit ? (
                            <>
                              <input 
                                className="text-[11px] font-black uppercase text-slate-900 leading-tight w-full bg-transparent border-b border-dashed border-slate-200 outline-none focus:border-indigo-500"
                                value={ref.name}
                                onChange={(e) => {
                                  const newRefs = [...(currentCvData.references || [])];
                                  newRefs[idx] = { ...newRefs[idx], name: e.target.value };
                                  setCurrentCvData({ ...currentCvData, references: newRefs });
                                }}
                              />
                              <input 
                                className="text-[10px] font-bold italic text-slate-500 w-full bg-transparent border-b border-dashed border-slate-200 outline-none focus:border-indigo-500"
                                value={ref.title}
                                onChange={(e) => {
                                  const newRefs = [...(currentCvData.references || [])];
                                  newRefs[idx] = { ...newRefs[idx], title: e.target.value };
                                  setCurrentCvData({ ...currentCvData, references: newRefs });
                                }}
                              />
                              <input 
                                className="text-[9px] font-black text-slate-400 w-full bg-transparent border-b border-dashed border-slate-200 outline-none focus:border-indigo-500"
                                value={ref.contact}
                                onChange={(e) => {
                                  const newRefs = [...(currentCvData.references || [])];
                                  newRefs[idx] = { ...newRefs[idx], contact: e.target.value };
                                  setCurrentCvData({ ...currentCvData, references: newRefs });
                                }}
                              />
                              <button 
                                onClick={() => {
                                  const newRefs = (currentCvData.references || []).filter((_, i) => i !== idx);
                                  setCurrentCvData({ ...currentCvData, references: newRefs });
                                }}
                                className="absolute -right-6 top-0 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </>
                          ) : (
                            <>
                              <p className="text-[11px] font-black uppercase text-slate-900 leading-tight">{highlightKeywords(ref.name)}</p>
                              <p className="text-[10px] font-bold italic text-slate-500">{highlightKeywords(ref.title)}</p>
                              <p className="text-[9px] font-black text-slate-400">{ref.contact}</p>
                            </>
                          )}
                        </div>
                      ))}
                      {isManualEdit && (
                        <button 
                          onClick={() => setCurrentCvData({ ...currentCvData, references: [...(currentCvData.references || []), { name: 'Full Name', title: 'Professional Title', contact: 'Email / Phone' }] })}
                          className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors"
                        >
                          <Plus className="w-3 h-3" /> Add Reference
                        </button>
                      )}
                    </div>
                  </section>
                );
              }

              if (sectionId.startsWith('custom_')) {
                const section = (currentCvData.sidebarCustomSections || []).find(s => s.id === sectionId);
                if (!section) return null;
                return (
                  <section key={sectionId}>
                    {renderSectionHeader(section.title, "sidebar", sectionId)}
                    {isManualEdit ? (
                      <textarea 
                        className="text-[10px] leading-relaxed text-slate-600 w-full bg-slate-50 border border-dashed border-slate-200 rounded p-2 focus:border-indigo-400 outline-none min-h-[50px]"
                        value={section.content}
                        onChange={(e) => {
                          const newSections = [...(currentCvData.sidebarCustomSections || [])];
                          const idx = newSections.findIndex(s => s.title === section.title);
                          if (idx !== -1) {
                            newSections[idx] = { ...newSections[idx], content: e.target.value };
                            setCurrentCvData({ ...currentCvData, sidebarCustomSections: newSections });
                          }
                        }}
                      />
                    ) : (
                      <p className="text-[10px] leading-relaxed text-slate-600">{section.content}</p>
                    )}
                  </section>
                );
              }

              return null;
            })}
          </aside>

          <main className="flex-1 flex flex-col gap-12">
            {(currentCvData.mainOrder || []).map(sectionId => {
              if (sectionId === 'summary') {
                return (
                  <section key={sectionId}>
                    {renderSectionHeader("Profile", "main", "summary")}
                    {isManualEdit ? (
                      <textarea 
                        className="text-[11px] leading-[1.7] text-slate-700 font-medium text-justify italic w-full bg-slate-50 border border-dashed border-slate-200 rounded p-4 focus:border-indigo-400 outline-none h-32"
                        value={currentCvData.tailoredSummary}
                        onChange={(e) => setCurrentCvData({ ...currentCvData, tailoredSummary: e.target.value })}
                      />
                    ) : (
                      <p className="text-[11px] leading-[1.7] text-slate-700 font-medium text-justify italic">{renderFormattedText(currentCvData.tailoredSummary)}</p>
                    )}
                  </section>
                );
              }

              if (sectionId === 'qualifications') {
                return (
                  <section key={sectionId}>
                    {renderSectionHeader("Qualifications", "main", "qualifications")}
                    <div className="space-y-6">
                      {currentCvData.qualifications?.map((qual, idx) => (
                        <div key={idx} className="space-y-2 group relative">
                          {isManualEdit ? (
                            <>
                              <div className="flex gap-4 mb-2">
                                <input 
                                  className="text-sm font-black uppercase italic tracking-tighter text-slate-900 flex-1 bg-transparent border-b border-dashed border-slate-200 outline-none focus:border-indigo-500"
                                  value={qual.name}
                                  onChange={(e) => {
                                    const newQuals = [...(currentCvData.qualifications || [])];
                                    newQuals[idx] = { ...newQuals[idx], name: e.target.value };
                                    setCurrentCvData({ ...currentCvData, qualifications: newQuals });
                                  }}
                                />
                                <input 
                                  className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-transparent border-b border-dashed border-slate-200 outline-none focus:border-indigo-500 text-right"
                                  value={qual.date}
                                  onChange={(e) => {
                                    const newQuals = [...(currentCvData.qualifications || [])];
                                    newQuals[idx] = { ...newQuals[idx], date: e.target.value };
                                    setCurrentCvData({ ...currentCvData, qualifications: newQuals });
                                  }}
                                />
                              </div>
                              <input 
                                className="text-[10px] font-black text-[#FF6321] uppercase tracking-widest w-full bg-transparent border-b border-dashed border-slate-200 outline-none focus:border-indigo-500 mb-2"
                                value={qual.issuer}
                                onChange={(e) => {
                                  const newQuals = [...(currentCvData.qualifications || [])];
                                  newQuals[idx] = { ...newQuals[idx], issuer: e.target.value };
                                  setCurrentCvData({ ...currentCvData, qualifications: newQuals });
                                }}
                              />
                              <ul className="space-y-2 ml-4">
                                {qual.details?.map((detail, dIdx) => (
                                  <li key={dIdx} className="flex gap-2 items-center">
                                    <span className="text-[#FF6321] font-bold">/</span>
                                    <input 
                                      className="text-[10px] text-slate-600 flex-1 bg-transparent border-b border-dashed border-slate-200 outline-none focus:border-indigo-500"
                                      value={detail}
                                      onChange={(e) => {
                                        const newQuals = [...(currentCvData.qualifications || [])];
                                        const newDetails = [...(newQuals[idx].details || [])];
                                        newDetails[dIdx] = e.target.value;
                                        newQuals[idx] = { ...newQuals[idx], details: newDetails };
                                        setCurrentCvData({ ...currentCvData, qualifications: newQuals });
                                      }}
                                    />
                                    <button 
                                      onClick={() => {
                                        const newQuals = [...(currentCvData.qualifications || [])];
                                        const newDetails = (newQuals[idx].details || []).filter((_, i) => i !== dIdx);
                                        newQuals[idx] = { ...newQuals[idx], details: newDetails };
                                        setCurrentCvData({ ...currentCvData, qualifications: newQuals });
                                      }}
                                      className="text-red-300 hover:text-red-500"
                                    >
                                      ×
                                    </button>
                                  </li>
                                ))}
                                <button 
                                  onClick={() => {
                                    const newQuals = [...(currentCvData.qualifications || [])];
                                    const newDetails = [...(newQuals[idx].details || []), 'New Detail'];
                                    newQuals[idx] = { ...newQuals[idx], details: newDetails };
                                    setCurrentCvData({ ...currentCvData, qualifications: newQuals });
                                  }}
                                  className="text-[8px] font-black uppercase text-slate-300 hover:text-indigo-600"
                                >
                                  + Detail
                                </button>
                              </ul>
                              <button 
                                onClick={() => {
                                  const newQuals = (currentCvData.qualifications || []).filter((_, i) => i !== idx);
                                  setCurrentCvData({ ...currentCvData, qualifications: newQuals });
                                }}
                                className="absolute -left-6 top-0 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </>
                          ) : (
                            <>
                              <div className="flex justify-between items-baseline mb-1">
                                <h3 className="text-sm font-black uppercase italic tracking-tighter text-slate-900">{highlightKeywords(qual.name)}</h3>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{qual.date}</span>
                              </div>
                              <p className="text-[10px] font-black text-[#FF6321] uppercase tracking-widest mb-2">{highlightKeywords(qual.issuer)}</p>
                              {qual.details && qual.details.length > 0 && (
                                <ul className="space-y-1 ml-4">
                                  {qual.details.map((detail, dIdx) => (
                                    <li key={dIdx} className="text-[10px] text-slate-600 flex gap-2">
                                      <span className="text-[#FF6321] font-bold">/</span>
                                      {highlightKeywords(detail)}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                      {isManualEdit && (
                        <button 
                          onClick={() => setCurrentCvData({ ...currentCvData, qualifications: [...(currentCvData.qualifications || []), { name: 'Qualification Name', issuer: 'Issuer', date: 'Date', details: [] }] })}
                          className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors"
                        >
                          <Plus className="w-3 h-3" /> Add Qualification
                        </button>
                      )}
                    </div>
                  </section>
                );
              }

              if (sectionId === 'experience') {
                return (
                  <section key={sectionId}>
                    {renderSectionHeader("Professional History", "main", "experience")}
                    <div className="space-y-10">
                      {currentCvData.tailoredExperience.map((exp, idx) => (
                        <div key={idx} className="relative pl-6 before:absolute before:left-0 before:top-2 before:bottom-0 before:w-0.5 before:bg-slate-100 group">
                          {isManualEdit && (
                            <button 
                              onClick={() => removeExperience(idx)}
                              className="absolute -left-3 top-0 bg-white shadow-sm border border-slate-200 rounded-full p-1 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                          <div className="flex justify-between items-baseline mb-4">
                             <div className="flex-1">
                               {isManualEdit ? (
                                 <>
                                   <input 
                                     className="text-sm font-black uppercase italic tracking-tighter text-slate-900 w-full bg-transparent border-b border-dashed border-slate-200 outline-none focus:border-indigo-500"
                                     value={exp.role}
                                     onChange={(e) => updateExperience(idx, 'role', e.target.value)}
                                   />
                                   <input 
                                     className="text-[10px] font-black text-[#FF6321] uppercase tracking-widest w-full bg-transparent border-b border-dashed border-slate-200 outline-none focus:border-indigo-500"
                                     value={exp.company}
                                     onChange={(e) => updateExperience(idx, 'company', e.target.value)}
                                   />
                                 </>
                               ) : (
                                 <>
                                   <h3 className="text-sm font-black uppercase italic tracking-tighter text-slate-900">{highlightKeywords(exp.role)}</h3>
                                   <p className="text-[10px] font-black text-[#FF6321] uppercase tracking-widest">{highlightKeywords(exp.company)}</p>
                                 </>
                               )}
                             </div>
                             {isManualEdit ? (
                               <input 
                                 className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-transparent border-b border-dashed border-slate-200 outline-none focus:border-indigo-500 text-right"
                                 value={exp.period}
                                 onChange={(e) => updateExperience(idx, 'period', e.target.value)}
                               />
                             ) : (
                               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{exp.period}</span>
                             )}
                          </div>
                          <ul className="space-y-3">
                            {exp.description.map((d, i) => (
                              <li key={i} className="text-[10.5px] leading-relaxed text-slate-600 flex gap-3 group/item">
                                <span className="text-[#FF6321] font-bold mt-1">/</span>
                                {isManualEdit ? (
                                  <div className="flex-1 flex gap-2">
                                    <textarea 
                                      className="flex-1 bg-transparent border-b border-dashed border-slate-200 outline-none focus:border-indigo-500 min-h-[20px]"
                                      value={d}
                                      onChange={(e) => {
                                        const newDesc = [...exp.description];
                                        newDesc[i] = e.target.value;
                                        updateExperience(idx, 'description', newDesc);
                                      }}
                                    />
                                    <button 
                                      onClick={() => {
                                        const newDesc = exp.description.filter((_, idx) => idx !== i);
                                        updateExperience(idx, 'description', newDesc);
                                      }}
                                      className="text-red-300 hover:text-red-500 opacity-0 group-hover/item:opacity-100"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ) : (
                                  <span>{renderFormattedText(d)}</span>
                                )}
                              </li>
                            ))}
                            {isManualEdit && (
                              <button 
                                onClick={() => {
                                  const newDesc = [...exp.description, 'Key Achievement or Responsibility'];
                                  updateExperience(idx, 'description', newDesc);
                                }}
                                className="text-[8px] font-black uppercase text-slate-300 hover:text-indigo-600 border border-dashed border-slate-200 px-2 py-1 rounded"
                              >
                                + Add Bullet
                              </button>
                            )}
                          </ul>
                        </div>
                      ))}
                      {isManualEdit && (
                        <button 
                          onClick={addExperience}
                          className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center gap-3 text-slate-400 hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-400 transition-all font-black uppercase italic tracking-widest text-[10px]"
                        >
                          <Plus className="w-4 h-4" /> Add Experience Block
                        </button>
                      )}
                    </div>
                  </section>
                );
              }

              if (sectionId.startsWith('custom_')) {
                const section = (currentCvData.customSections || []).find(s => s.id === sectionId);
                if (!section) return null;
                return (
                  <section key={sectionId}>
                    {renderSectionHeader(section.title, "main", sectionId)}
                    {isManualEdit ? (
                      <textarea 
                        className="text-[11px] leading-[1.7] text-slate-700 w-full bg-slate-50 border border-dashed border-slate-200 rounded p-4 focus:border-indigo-400 outline-none h-32"
                        value={section.content}
                        onChange={(e) => {
                          const newSections = [...(currentCvData.customSections || [])];
                          const idx = newSections.findIndex(s => s.title === section.title);
                          if (idx !== -1) {
                            newSections[idx] = { ...newSections[idx], content: e.target.value };
                            setCurrentCvData({ ...currentCvData, customSections: newSections });
                          }
                        }}
                      />
                    ) : (
                      <div className="text-[11px] leading-[1.7] text-slate-700 whitespace-pre-wrap">{renderFormattedText(section.content)}</div>
                    )}
                  </section>
                );
              }

              return null;
            })}
          </main>
        </div>
      </div>
    </div>
  );
}

const ControlBtn = ({ active, onClick, icon, label, disabled }: any) => (
  <button onClick={onClick} disabled={disabled}
    className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest disabled:opacity-30 ${active ? 'bg-slate-900 text-[#00FF00]' : 'text-slate-500 hover:bg-slate-50'}`}>
    {icon} <span className="hidden md:inline">{label}</span>
  </button>
);
