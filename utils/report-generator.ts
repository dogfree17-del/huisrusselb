
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { GoogleGenAI } from "@google/genai";

export interface ReportData {
  title: string;
  subtitle: string;
  columns: string[];
  rows: any[][];
  rawDataForAI: any[];
  promptContext: string; 
  logoUrl?: string;
  preparedBy?: string;
  recipient?: string;
  chartImage?: string;
}

/**
 * Helper to convert image URL to Base64 for PDF embedding
 */
const getBase64ImageFromURL = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.setAttribute("crossOrigin", "anonymous");
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0);
      const dataURL = canvas.toDataURL("image/png");
      resolve(dataURL);
    };
    img.onerror = error => {
        console.warn("Failed to load logo for report", error);
        resolve(""); // Resolve empty to continue without logo
    };
    img.src = url;
  });
};

/**
 * Sanitizes data to prevent circular reference errors during JSON.stringify.
 */
const sanitizeForAI = (data: any[]): any[] => {
  if (!Array.isArray(data)) return [];
  
  return data.map(item => {
    const sanitized: any = {};
    if (!item || typeof item !== 'object') return sanitized;

    for (const key in item) {
      if (Object.prototype.hasOwnProperty.call(item, key)) {
        const val = item[key];
        
        if (key === 'owner' || key === 'parent' || key === 'srcElement' || key === 'target') continue;

        if (val === null || val === undefined) {
          sanitized[key] = val;
        } else if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
          sanitized[key] = val;
        } else if (val instanceof Date) {
          sanitized[key] = val.toISOString();
        } else if (Array.isArray(val)) {
          sanitized[key] = val.map(v => (typeof v === 'object' ? String(v) : v));
        } else {
          sanitized[key] = String(val);
        }
      }
    }
    return sanitized;
  });
};

export const generateSmartReport = async (data: ReportData) => {
  const doc = new jsPDF();
  const date = new Date().toLocaleDateString();

  // --- BRANDED HEADER ---
  // If logo exists, add it
  if (data.logoUrl) {
      try {
          const logoData = await getBase64ImageFromURL(data.logoUrl);
          if (logoData) {
              doc.addImage(logoData, 'PNG', 14, 10, 25, 25);
          }
      } catch (e) {
          console.error("Logo embedding failed", e);
      }
  }

  // Adjust text position based on logo presence
  const textX = data.logoUrl ? 45 : 14;

  doc.setFontSize(24);
  doc.setTextColor(136, 19, 55); // Rose 900
  doc.setFont("helvetica", "bold");
  doc.text("Huis Russel Botman", textX, 20);
  
  doc.setFontSize(14);
  doc.setTextColor(50);
  doc.setFont("helvetica", "normal");
  doc.text(data.title.toUpperCase(), textX, 30);
  
  doc.setFontSize(9);
  doc.setTextColor(150);
  doc.text(`Official System Report | Generated: ${date}`, textX, 38);
  doc.text(data.subtitle, textX, 43);
  
  if (data.recipient) {
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text(`TO: ${data.recipient}`, 14, 53);
  }

  let finalY = data.recipient ? 58 : 48;

  // --- AI ANALYSIS SECTION ---
  try {
    const cleanData = sanitizeForAI(data.rawDataForAI.slice(0, 40)); // Analyze first 40 records
    const jsonString = JSON.stringify(cleanData);
    
    // Updated prompt with specific rules
    const prompt = `
      You are an executive administrator for Huis Russel Botman residence. 
      Analyze the following data for ${data.promptContext}.
      
      ${data.title.toLowerCase().includes('maintenance') ? `
      MAINTENANCE REPORTING RULES & ANALYSIS DIRECTIVES:
      1. Categorization: All issues must be accurately categorized (e.g., electrical, plumbing, furniture, structural, other).
      2. Status Tracking: Evaluate the distribution of 'open', 'in_progress', and 'resolved' statuses to determine operational efficiency.
      3. Resolution Timeframes: Analyze the time taken from reporting to resolution (if available) to identify bottlenecks.
      4. Critical Trends: Highlight recurring faults, specific problematic locations, or systemic infrastructure failures requiring urgent university attention or capital expenditure.
      5. Resource Allocation: Suggest areas where maintenance resources or external contractors should be prioritized.
      6. Professional Tone: The report must be written in a highly professional, objective, and analytical tone suitable for university executives and facilities management.
      ` : `
      CRITICAL VISITOR RULES:
      1. Visitors may only be signed in between 09:00 and 23:00.
      2. On Fridays and Saturdays (Weekends), visitors must physically leave by 01:00 the next morning.
      3. On Sunday through Thursday (Weekdays), visitors must physically leave by 23:00 the same day.
      4. Any visitor still signed in past these times without a "sleepover" status is a violation.
      `}
      
      DATA: ${jsonString}
      
      Provide a formal report summary (no markdown, plain text).
      1. Overview of current status/volume.
      2. Specific violations or trends detected based on the rules above.
      3. Strategic recommendations for the House Committee.
      
      ${data.title.toLowerCase().includes('maintenance') ? 
      'Provide a comprehensive, highly detailed analysis (up to 400 words) suitable for a formal university maintenance audit. Focus on actionable insights, risk assessment, and resource planning.' : 
      'Keep it professional and under 200 words.'}
    `;

    const ai = new GoogleGenAI({ apiKey: (process.env as any).GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    
    const analysis = response.text || "Report analysis currently unavailable.";

    doc.setFontSize(11);
    doc.setTextColor(136, 19, 55);
    doc.text("EXECUTIVE ANALYSIS & TRENDS", 14, 58);
    
    doc.setFontSize(10);
    doc.setTextColor(80);
    const splitText = doc.splitTextToSize(analysis, 180);
    doc.text(splitText, 14, 65);
    
    finalY = 65 + (splitText.length * 5) + 12;

  } catch (error) {
    console.error("Analysis generation failed", error);
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text("Strategic analysis skipped due to processing constraints.", 14, 58);
    finalY = 65;
  }

  // --- CHART IMAGE ---
  if (data.chartImage) {
    try {
      // Add the chart below the analysis
      doc.addImage(data.chartImage, 'PNG', 14, finalY, 180, 80);
      finalY += 90; // Adjust Y position for the table
    } catch (e) {
      console.error("Failed to add chart to PDF", e);
    }
  }

  // --- DATA TABLE ---
  autoTable(doc, {
    startY: finalY,
    head: [data.columns],
    body: data.rows,
    headStyles: { fillColor: [136, 19, 55], textColor: 255, fontSize: 10, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    styles: { fontSize: 8, font: "helvetica" },
    margin: { left: 14, right: 14 }
  });

  const fileName = `HRB_Report_${data.title.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
  
  // Footer with Prepared By
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    const footerY = doc.internal.pageSize.height - 10;
    doc.text(`Page ${i} of ${pageCount}`, 14, footerY);
    if (data.preparedBy) {
      doc.text(`Prepared by: ${data.preparedBy}`, doc.internal.pageSize.width - 60, footerY);
    }
  }

  doc.save(fileName);
};
