import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixSettings() {
  const { data: files, error: listError } = await supabase.storage.from('uploads').list('branding');
  if (listError) {
    console.error("Error listing files:", listError);
    return;
  }

  const getLatest = (prefix: string) => {
    const filtered = files
      .filter(f => f.name.startsWith(prefix))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (filtered.length > 0) {
      const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(`branding/${filtered[0].name}`);
      return publicUrl;
    }
    return null;
  };

  const visitorsUrl = getLatest('dashboard_visitors_');
  const maintenanceUrl = getLatest('dashboard_maintenance_');
  const bookingsUrl = getLatest('dashboard_bookings_');

  console.log("Latest URLs:", { visitorsUrl, maintenanceUrl, bookingsUrl });

  const dashboardImages = {
    visitors: visitorsUrl || "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&q=80&w=600",
    maintenance: maintenanceUrl || "https://images.unsplash.com/photo-1581092921461-eab62e97a782?auto=format&fit=crop&q=80&w=600",
    bookings: bookingsUrl || "https://images.unsplash.com/photo-1519167791981-d174ed53a83b?auto=format&fit=crop&q=80&w=600"
  };

  // Also fix logoUrl and authBackgroundUrl if they are Firebase
  const { data: currentSettings } = await supabase.from('settings').select('*').eq('id', 'appConfig').single();
  
  let logoUrl = currentSettings?.logoUrl;
  if (logoUrl && logoUrl.includes('firebasestorage')) {
     // Try to find a logo in Supabase
     const logoFile = files.find(f => f.name.startsWith('logo_'));
     if (logoFile) {
        const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(`branding/${logoFile.name}`);
        logoUrl = publicUrl;
     } else {
        logoUrl = null; // Reset if no Supabase logo found
     }
  }

  let authBackgroundUrl = currentSettings?.authBackgroundUrl;
  if (authBackgroundUrl && authBackgroundUrl.includes('firebasestorage')) {
     const bgFile = files.find(f => f.name.startsWith('auth_bg_'));
     if (bgFile) {
        const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(`branding/${bgFile.name}`);
        authBackgroundUrl = publicUrl;
     } else {
        authBackgroundUrl = null;
     }
  }

  const { error: updateError } = await supabase
    .from('settings')
    .update({ 
      dashboardImages,
      logoUrl,
      authBackgroundUrl
    })
    .eq('id', 'appConfig');

  if (updateError) {
    console.error("Error updating settings:", updateError);
  } else {
    console.log("Settings updated successfully!");
  }
}

fixSettings();
