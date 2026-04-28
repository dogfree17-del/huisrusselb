import express from "express";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

let resendClient: Resend | null = null;

function getResend(): Resend {
  if (!resendClient) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      console.warn('RESEND_API_KEY environment variable is missing.');
    }
    resendClient = new Resend(key || 'placeholder');
  }
  return resendClient;
}

export const app = express();
app.use(express.json());

// Health Check Endpoint
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    supabaseUrlSet: !!process.env.VITE_SUPABASE_URL,
    supabaseKeySet: !!process.env.SUPABASE_SERVICE_ROLE_KEY
  });
});

// Point Awarding Endpoint
app.post("/api/award-points", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const token = authHeader.split('Bearer ')[1];
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const uid = user.id;

      const { actionId, points, targetUid } = req.body;

      if (!actionId || points === undefined) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Define valid actions and their point values
      const VALID_ACTIONS: Record<string, { points: number, once: boolean, allowTarget?: boolean, dynamic?: boolean }> = {
        'profile_completion': { points: 1.0, once: true },
        'profile_picture': { points: 0.5, once: true },
        'daily_session': { points: 0.01, once: false },
        'whatsapp_click': { points: 0.05, once: false },
        'visitor_verify': { points: 0.03, once: false },
        'maintenance_resolved': { points: 0.1, once: false },
        'maintenance_note': { points: 0.1, once: false },
        'vote_cast': { points: 0.07, once: false, allowTarget: true },
        'feedback_report': { points: 0.1, once: false },
        'shop_list': { points: 0.15, once: false },
        'catalog_bonus': { points: 0.5, once: true },
        'welcome_bonus': { points: 2.0, once: true },
        'admin_bonus': { points: 2.0, once: true },
        'system_report': { points: 0.1, once: false },
        'complete_micro_task': { points: 0.1, once: false, allowTarget: true, dynamic: true },
        'study_contribution': { points: 0.5, once: false }
      };

      const action = VALID_ACTIONS[actionId];
      if (!action) {
        return res.status(400).json({ error: "Invalid action" });
      }

      // Verify points match (unless dynamic)
      if (!action.dynamic && Math.abs(points - action.points) > 0.001) {
        return res.status(400).json({ error: "Point mismatch" });
      }

      // If dynamic, still enforce reasonable bounds
      if (action.dynamic && (points < 0 || points > 5.0)) {
        return res.status(400).json({ error: "Dynamic points out of bounds" });
      }

      const recipientUid = (action.allowTarget && targetUid) ? targetUid : uid;
      
      // Prevent self-voting
      if (actionId === 'vote_cast' && recipientUid === uid) {
        return res.status(400).json({ error: "You cannot vote for yourself" });
      }

      // Check daily limit for voting (voter's limit)
      if (actionId === 'vote_cast') {
        const today = new Date().toISOString().split('T')[0];
        const { data: voterData } = await supabase.from('users').select('*').eq('uid', uid).single();
        
        const lastVoteDate = voterData?.lastVoteDate;
        const dailyPointsGiven = lastVoteDate === today ? (voterData?.dailyPointsGiven || 0) : 0;
        
        if (dailyPointsGiven + action.points > 0.3501) { // Using small epsilon for float
          return res.status(400).json({ error: "Daily voting limit reached" });
        }

        // Update voter's daily limit
        await supabase.from('users').update({
          dailyPointsGiven: Number((dailyPointsGiven + action.points).toFixed(2)),
          lastVoteDate: today
        }).eq('uid', uid);
      }

      const awardId = action.once ? `${recipientUid}_${actionId}` : `${recipientUid}_${actionId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      if (action.once) {
        const { data: awardDoc } = await supabase.from('point_awards').select('*').eq('id', awardId).single();
        if (awardDoc) {
          return res.status(400).json({ error: "Points already awarded for this action" });
        }
      }

      // Special handling for daily session (recipient is the user themselves)
      if (actionId === 'daily_session') {
        const today = new Date().toISOString().split('T')[0];
        const dailyAwardId = `${uid}_daily_session_${today}`;
        const { data: dailyAwardDoc } = await supabase.from('point_awards').select('*').eq('id', dailyAwardId).single();
        if (dailyAwardDoc) {
          return res.status(400).json({ error: "Daily session points already awarded" });
        }
        
        await supabase.from('point_awards').insert({
          id: dailyAwardId,
          userId: uid,
          actionId: 'daily_session',
          points: action.points,
          awardedAt: new Date().toISOString(),
          date: today
        });
      } else {
        await supabase.from('point_awards').insert({
          id: awardId,
          userId: recipientUid,
          actionId,
          points: action.points,
          awardedAt: new Date().toISOString(),
          voterId: actionId === 'vote_cast' ? uid : undefined
        });
      }

      // Update recipient points
      const { data: recipientData } = await supabase.from('users').select('points').eq('uid', recipientUid).single();
      const currentPoints = recipientData?.points || 0;
      await supabase.from('users').update({
        points: currentPoints + action.points
      }).eq('uid', recipientUid);

      res.status(200).json({ success: true, awarded: action.points, recipientUid });
    } catch (error) {
      console.error("Error awarding points:", error);
      res.status(500).json({ error: "Failed to award points" });
    }
  });

  // Update Settings Endpoint (Bypasses RLS using Service Role)
  app.post("/api/update-settings", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "Missing authorization header" });

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Verify user is admin
      const { data: userData } = await supabase.from('users').select('role').eq('uid', user.id).single();
      if (!userData || (userData.role !== 'admin' && userData.role !== 'super_admin')) {
        return res.status(403).json({ error: "Forbidden: Admin access required" });
      }

      const { id, ...settings } = req.body;
      if (!id) return res.status(400).json({ error: "Missing setting ID" });

      const { error } = await supabase.from('settings').update(settings).eq('id', id);
      
      if (error) throw error;
      res.status(200).json({ success: true });
    } catch (error: any) {
      console.error("Error updating settings via API:", error);
      res.status(500).json({ error: error.message || "Failed to update settings" });
    }
  });

  // Supabase Config Endpoint
  app.get("/api/config/supabase", (req, res) => {
    res.json({
      url: process.env.VITE_SUPABASE_URL,
      anonKey: process.env.VITE_SUPABASE_ANON_KEY
    });
  });

  // Resend Email Endpoint
  app.post("/api/send-email", async (req, res) => {
    try {
      const { to, subject, text } = req.body;
      
      if (!to || !subject || !text) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HRB Official Communication</title>
</head>
<body style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fdf2f8; margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fdf2f8;">
    <tr>
      <td align="center" style="padding: 40px 10px;">
        
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 650px; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 15px 35px rgba(136, 19, 55, 0.08);">
          
          <tr>
            <td align="center" style="background-color: #881337; padding: 30px 30px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; line-height: 1.2;">
                Huis <span style="font-weight: 300; opacity: 0.9;">Russel Botman</span>
              </h1>
              <div style="margin-top: 10px; height: 2px; width: 40px; background-color: #fda4af; display: inline-block;"></div>
              <p style="color: #fda4af; margin: 10px 0 0 0; font-size: 9px; text-transform: uppercase; letter-spacing: 4px; font-weight: 700;">Official Communication</p>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding: 50px 0 40px 0;">
              
              <table role="presentation" width="80%" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                <tr>
                  <td style="background-color: #fffafa; padding: 35px; border-radius: 12px; border: 1px solid #fce7f3; border-left: 5px solid #881337; text-align: left;">
                    <p style="margin: 0; white-space: pre-wrap; font-size: 16px; line-height: 1.7; color: #4c0519; font-family: inherit;">${text}</p>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="80%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 40px;">
                <tr>
                  <td align="left">
                    <p style="margin: 0; font-size: 15px; color: #64748b; line-height: 1.5;">
                      Best regards,<br>
                      <strong style="color: #881337; font-size: 17px; font-weight: 800;">HRB Administration</strong>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td align="center" style="background-color: #fafafa; padding: 35px 40px; border-top: 1px solid #f1f5f9;">
              <p style="margin: 0 0 10px 0; font-weight: 700; color: #881337; font-size: 13px; letter-spacing: 0.5px;">HUIS RUSSEL BOTMAN</p>
              <p style="margin: 0 0 15px 0; color: #94a3b8; font-size: 12px; line-height: 1.5;">
                Stellenbosch University<br>
                © ${new Date().getFullYear()} All rights reserved.
              </p>
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center">
                <tr>
                  <td style="background-color: #f1f5f9; padding: 6px 12px; border-radius: 4px; font-size: 11px; color: #64748b; font-weight: 500;">
                    Powered by AusinTech
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `;

      const data = await getResend().emails.send({
        from: "Huis Russel <bookings@res-hub.co.za>",
        replyTo: "bookings@res-hub.co.za",
        to: [to],
        subject: subject,
        text: text,
        html: htmlContent,
      });

      if (data.error) {
        console.error("Resend API Error (Send Email):", data.error);
        console.info("HINT: If you are seeing 'You can only send emails to the verified account email', you must verify your domain 'res-hub.co.za' in Resend settings.");
        return res.status(400).json({ error: data.error });
      }

      res.status(200).json(data.data);
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  // Maintenance Notification Endpoint
  app.post("/api/notify-maintenance", async (req, res) => {
    try {
      const { to, issue, location, reporterName, imageUrl } = req.body;
      
      if (!to || !issue || !location) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const toArray = to.split(',').map((e: string) => e.trim()).filter(Boolean);
      console.log("Sending maintenance email to:", toArray);

      const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Maintenance Request</title>
</head>
<body style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; width: 100% !important;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 40px 10px;">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 650px; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 15px 35px rgba(0, 0, 0, 0.05);">
          <tr>
            <td align="center" style="background-color: #f59e0b; padding: 30px 30px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px;">
                Maintenance <span style="font-weight: 300; opacity: 0.9;">Alert</span>
              </h1>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" width="80%" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                <tr>
                  <td style="text-align: left;">
                    <h2 style="color: #334155; margin-top: 0;">New Issue Reported</h2>
                    <p style="color: #64748b; line-height: 1.6;">A new maintenance issue has been reported at <strong>${location}</strong> by ${reporterName || 'a resident'}.</p>
                    
                    <div style="background-color: #fffbeb; padding: 20px; border-radius: 12px; border-left: 4px solid #f59e0b; margin: 20px 0;">
                      <p style="margin: 0; color: #78350f; font-weight: 500;"><strong>Issue Details:</strong><br><br>${issue}</p>
                    </div>

                    ${imageUrl ? `<div style="margin: 20px 0; text-align: center;"><img src="${imageUrl}" alt="Issue Image" style="max-width: 100%; border-radius: 12px; border: 1px solid #e2e8f0;" /></div>` : ''}
                    
                    <div style="text-align: center; margin-top: 30px;">
                      <a href="${process.env.APP_URL || 'https://huis-russel-botman.web.app'}" style="background-color: #f59e0b; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">View in Portal to Resolve</a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `;

      const response = await getResend().emails.send({
        from: "Huis Russel Maintenance <maintenance@res-hub.co.za>",
        replyTo: "maintenance@res-hub.co.za",
        to: toArray,
        subject: `Maintenance Alert: ${location}`,
        text: `New Maintenance Request\n\nLocation: ${location}\nIssue: ${issue}\nReported By: ${reporterName || 'Anonymous'}\n\nPlease check the dashboard for more details.`,
        html: htmlContent,
      });

      if (response.error) {
        console.error("Resend API Error (Maintenance):", response.error);
        console.info("HINT: If you are seeing 'You can only send emails to the verified account email', you must verify your domain 'res-hub.co.za' in Resend settings.");
        return res.status(400).json({ error: response.error });
      }

      res.status(200).json(response.data);
    } catch (error) {
      console.error("Error sending maintenance email:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  // Booking Notification Endpoint
  app.post("/api/notify-booking", async (req, res) => {
    try {
      const { to, venue, date, startTime, endTime, bookerName, purpose } = req.body;
      
      if (!to || !venue || !date) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const toArray = to.split(',').map((e: string) => e.trim()).filter(Boolean);

      const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Booking Request</title>
</head>
<body style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; width: 100% !important;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 40px 10px;">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 650px; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 15px 35px rgba(0, 0, 0, 0.05);">
          <tr>
            <td align="center" style="background-color: #3b82f6; padding: 30px 30px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px;">
                Booking <span style="font-weight: 300; opacity: 0.9;">Request</span>
              </h1>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" width="80%" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                <tr>
                  <td style="text-align: left;">
                    <h2 style="color: #334155; margin-top: 0;">New Venue Booking</h2>
                    <p style="color: #64748b; line-height: 1.6;"><strong>${bookerName}</strong> has requested to book <strong>${venue}</strong>.</p>
                    
                    <div style="background-color: #eff6ff; padding: 20px; border-radius: 12px; border-left: 4px solid #3b82f6; margin: 20px 0;">
                      <p style="margin: 0 0 10px 0; color: #1e3a8a;"><strong>Date:</strong> ${date}</p>
                      <p style="margin: 0 0 10px 0; color: #1e3a8a;"><strong>Time:</strong> ${startTime} - ${endTime}</p>
                      <p style="margin: 0; color: #1e3a8a;"><strong>Purpose:</strong> ${purpose}</p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px;">
                      <a href="${process.env.APP_URL || 'https://huis-russel-botman.web.app'}" style="background-color: #3b82f6; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Review Request in Portal</a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `;

      const response = await getResend().emails.send({
        from: "Huis Russel Bookings <bookings@res-hub.co.za>",
        replyTo: "bookings@res-hub.co.za",
        to: toArray,
        subject: `New Booking Request: ${venue}`,
        text: `New Booking Request\n\nVenue: ${venue}\nDate: ${date}\nTime: ${startTime} - ${endTime}\nBooked By: ${bookerName || 'Anonymous'}\nPurpose: ${purpose}\n\nPlease check the dashboard for more details.`,
        html: htmlContent,
      });

      if (response.error) {
        console.error("Resend API Error (Booking):", response.error);
        console.info("HINT: If you are seeing 'You can only send emails to the verified account email', you must verify your domain 'res-hub.co.za' in Resend settings.");
        return res.status(400).json({ error: response.error });
      }

      res.status(200).json(response.data);
    } catch (error) {
      console.error("Error sending booking email:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  // Status Update Notification Endpoint
  app.post("/api/notify-status-update", async (req, res) => {
    try {
      const { to, type, status, title, details } = req.body;
      
      if (!to || !type || !status || !title) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const isMaintenance = type === 'maintenance';
      const accentColor = isMaintenance ? '#f59e0b' : '#3b82f6';
      const typeLabel = isMaintenance ? 'Maintenance' : 'Booking';

      const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${typeLabel} Status Update</title>
</head>
<body style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; width: 100% !important;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 40px 10px;">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 650px; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 15px 35px rgba(0, 0, 0, 0.05);">
          <tr>
            <td align="center" style="background-color: ${accentColor}; padding: 30px 30px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px;">
                Status <span style="font-weight: 300; opacity: 0.9;">Update</span>
              </h1>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" width="80%" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                <tr>
                  <td style="text-align: left;">
                    <h2 style="color: #334155; margin-top: 0;">Update on your ${typeLabel}</h2>
                    <p style="color: #64748b; line-height: 1.6;">There has been an update regarding your ${typeLabel.toLowerCase()} for <strong>${title}</strong>.</p>
                    
                    <div style="background-color: #f1f5f9; padding: 20px; border-radius: 12px; border-left: 4px solid ${accentColor}; margin: 20px 0;">
                      <p style="margin: 0 0 10px 0; color: #334155;"><strong>New Status:</strong> <span style="text-transform: uppercase; font-weight: 800; color: ${accentColor};">${status.replace('_', ' ')}</span></p>
                      ${details ? `<p style="margin: 0; color: #64748b; font-size: 14px;">${details}</p>` : ''}
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px;">
                      <a href="${process.env.APP_URL || 'https://huis-russel-botman.web.app'}" style="background-color: ${accentColor}; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">View Details in Portal</a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="background-color: #fafafa; padding: 35px 40px; border-top: 1px solid #f1f5f9;">
              <p style="margin: 0 0 10px 0; font-weight: 700; color: #881337; font-size: 13px; letter-spacing: 0.5px;">HUIS RUSSEL BOTMAN</p>
              <p style="margin: 0 0 15px 0; color: #94a3b8; font-size: 12px; line-height: 1.5;">
                Stellenbosch University<br>
                © ${new Date().getFullYear()} All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `;

      const response = await getResend().emails.send({
        from: "Huis Russel Updates <update@res-hub.co.za>",
        replyTo: "update@res-hub.co.za",
        to: [to],
        subject: `${typeLabel} Update: ${status.replace('_', ' ').toUpperCase()}`,
        text: `Update on your ${typeLabel.toLowerCase()} for ${title}.\nNew Status: ${status.replace('_', ' ').toUpperCase()}\n\nPlease check the portal for more details.`,
        html: htmlContent,
      });

      if (response.error) {
        console.error("Resend API Error (Status Update):", response.error);
        console.info("HINT: If you are seeing 'You can only send emails to the verified account email', you must verify your domain 'res-hub.co.za' in Resend settings.");
        return res.status(400).json({ error: response.error });
      }

      res.status(200).json(response.data);
    } catch (error) {
      console.error("Error sending status update email:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  // Account Recovery Quiz Endpoint
  app.post("/api/recovery-quiz", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: "Email is required" });

      // Find user
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('uid, phone_number, room_number, display_name')
        .eq('email', email)
        .single();

      if (userError || !user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Fetch random users for options
      const { data: otherUsers, error: othersError } = await supabase
        .from('users')
        .select('phone_number, room_number, display_name')
        .neq('email', email)
        .limit(10);

      if (othersError || !otherUsers) {
         return res.status(400).json({ error: "Failed to generate quiz" });
      }

      const shuffle = (array: any[]) => array.sort(() => 0.5 - Math.random());

      const getOptions = (correct: string | null, key: 'phone_number' | 'room_number' | 'display_name') => {
        const options = new Set<string>();
        const correctVal = correct ? String(correct).trim() : "";
        if (correctVal) options.add(correctVal);
        else options.add("Not Set");

        for (const u of shuffle(otherUsers)) {
          if (options.size >= 4) break;
          const val = u[key] ? String(u[key]).trim() : "";
          if (val) options.add(val);
        }
        
        // Fill with dummies if not enough
        let i = 1;
        while (options.size < 4) {
           if (key === 'phone_number') options.add(`06${Math.floor(10000000 + Math.random() * 90000000)}`);
           if (key === 'room_number') options.add(`${Math.floor(1000 + Math.random() * 4000)}`);
           if (key === 'display_name') options.add(`User ${i++}`);
        }

        return shuffle(Array.from(options));
      };

      res.status(200).json({
        success: true,
        questions: {
          phoneOptions: getOptions(user.phone_number, 'phone_number'),
          roomOptions: getOptions(user.room_number, 'room_number'),
          nameOptions: getOptions(user.display_name, 'display_name')
        }
      });
    } catch (error) {
      console.error("Error generating recovery quiz:", error);
      res.status(400).json({ error: "Server error" });
    }
  });

  // Verify Answers Endpoint (Before Password Reset)
  app.post("/api/verify-answers", async (req, res) => {
    try {
      const { email, phone, room, name } = req.body;
      
      if (!email || !phone || !room || !name) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Find user
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, uid, phone_number, room_number, display_name')
        .eq('email', email)
        .single();

      if (userError || !user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Verify answers (treat nulls/empty as "Not Set")
      const actualPhone = user.phone_number ? String(user.phone_number).trim() : "Not Set";
      const actualRoom = user.room_number ? String(user.room_number).trim() : "Not Set";
      const actualName = user.display_name ? String(user.display_name).trim() : "Not Set";

      if (phone !== actualPhone || room !== actualRoom || name !== actualName) {
        return res.status(400).json({ error: "Verification failed. Incorrect answers." });
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error verifying answers:", error);
      res.status(400).json({ error: "Server error" });
    }
  });

  // Verify Recovery & Reset Password Endpoint
  app.post("/api/verify-recovery", async (req, res) => {
    try {
      const { email, phone, room, name, newPassword } = req.body;
      
      if (!email || !newPassword) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Find user
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, uid, phone_number, room_number, display_name')
        .eq('email', email)
        .single();

      if (userError || !user) {
        console.error("User lookup error:", userError);
        return res.status(404).json({ error: "User not found" });
      }

      // Verify answers (treat nulls/empty as "Not Set")
      const actualPhone = user.phone_number ? String(user.phone_number).trim() : "Not Set";
      const actualRoom = user.room_number ? String(user.room_number).trim() : "Not Set";
      const actualName = user.display_name ? String(user.display_name).trim() : "Not Set";

      if (phone !== actualPhone || room !== actualRoom || name !== actualName) {
        return res.status(400).json({ error: "Verification failed. Incorrect answers." });
      }

      // Check if already verified
      const { data: userData, error: userFetchError } = await supabase
        .from('users')
        .select('verified')
        .eq('email', email)
        .single();
      
      if (userData?.verified) {
        return res.status(400).json({ error: "Account is already verified and password has been set." });
      }

      // Reset password using Admin API
      try {
        console.log(`Attempting to reset password for user ID: ${user.id} (${email})`);
        
        if (!user.id) {
          throw new Error("User UUID (id) is missing from database record");
        }

        const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
          user.id,
          { 
            password: newPassword,
            email_confirm: true
          }
        );

        if (updateError) {
          console.error("Auth update error:", updateError);
          const errorMessage = updateError.message || '';
          const errorStatus = (updateError as any).status;

          // If user doesn't exist in Auth, try to create them
          if (errorMessage.includes('User not found') || errorStatus === 404) {
             console.log("User not found in Auth. Attempting to create user...");
             const { data: createData, error: createError } = await supabase.auth.admin.createUser({
               email,
               password: newPassword,
               email_confirm: true
             });
             if (createError) {
               console.error("Auth create error:", createError);
               return res.status(400).json({ error: `Failed to create auth account: ${createError.message}` });
             }
             console.log("User created in Auth successfully.");
             
             // Update public.users with the new ID if it changed
             if (createData?.user?.id && createData.user.id !== user.id) {
               console.log(`Updating public.users ID from ${user.id} to ${createData.user.id}`);
               await supabase.from('users').update({ id: createData.user.id, verified: true }).eq('email', email);
             } else {
               await supabase.from('users').update({ verified: true }).eq('email', email);
             }
          } else {
            return res.status(400).json({ error: `Failed to update password: ${errorMessage}` });
          }
        } else {
          // Update verified status
          await supabase.from('users').update({ verified: true }).eq('email', email);
        }
      } catch (innerError: any) {
        console.error("Inner Auth error:", innerError);
        return res.status(400).json({ error: `Internal Auth error: ${innerError.message}` });
      }

      return res.status(200).json({ success: true });
    } catch (error: any) {
      console.error("Error verifying recovery:", error);
      return res.status(400).json({ error: `Server error: ${error.message || 'Unknown error'}` });
    }
  });

  // Catch-all for undefined API routes to prevent falling through to HTML fallback
  app.all(/^\/api\/.*/, (req, res) => {
    console.warn(`404: API route not found: ${req.method} ${req.url}`);
    res.status(404).json({ 
      error: "API route not found",
      method: req.method,
      path: req.url
    });
  });

  // Global error handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Global error handler caught:", err);
    res.status(500).json({ 
      error: "Internal server error", 
      message: err.message || "An unexpected error occurred" 
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const vitePkg = "vite";
    import(vitePkg).then(async ({ createServer: createViteServer }) => {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    }).catch(err => {
      console.error("Failed to initialize Vite middleware:", err);
    });
  } else if (!process.env.VERCEL) {
    app.use(express.static("dist"));
    app.use((req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  if (!process.env.VERCEL) {
    const PORT = 3000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }

export default app;
