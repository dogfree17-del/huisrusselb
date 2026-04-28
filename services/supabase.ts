import { createClient } from '@supabase/supabase-js';
import { User, Notice, VisitorLog, UserRole, MaintenanceRequest, Booking, Cause, Feedback, Poll, Post, Photo, FileEntry, Review, AnonymousReportEntry, AppNotification, MicroTask, CVData } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const SUPER_ADMIN_EMAILS = ['ausin100@gmail.com', '26210436@sun.ac.za'];

export const AuthService = {
  getCurrentUser: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
  },

  signUp: async (email: string, password: string, displayName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName || email.split('@')[0] }
      }
    });
    if (error) throw error;
    
    if (data.user) {
      // Create user profile in users table
      const role: UserRole = SUPER_ADMIN_EMAILS.includes(email) ? 'super_admin' : 'general';
      await supabase.from('users').insert({
        uid: data.user.id,
        email: email,
        display_name: displayName || email.split('@')[0],
        role: role,
        points: 0,
        warning_count: 0,
        visitor_restricted: false,
        createdAt: new Date().toISOString()
      });
    }
    
    return data.user;
  },

  signOut: async () => {
    await supabase.auth.signOut();
  },

  logout: async () => {
    await supabase.auth.signOut();
  },

  onAuthStateChanged: (callback: (user: any, event: string) => void) => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      callback(session?.user ?? null, event);
    });
    return () => subscription.unsubscribe();
  },

  resetPassword: async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });
    if (error) throw error;
  },

  updatePassword: async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }
};

export const DataService = {
  testConnection: async () => {
    try {
      const { data, error } = await supabase.from('stats').select('*').limit(1);
      if (error) throw error;
      console.log("Supabase connection verified.");
    } catch (error) {
      console.error("Supabase connection failed:", error);
    }
  },

  subscribeToNotifications: (userId: string, callback: (notifications: AppNotification[]) => void) => {
    const fetchNotifications = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('userId', userId)
        .order('createdAt', { ascending: false })
        .limit(50);
      if (data) callback(data as AppNotification[]);
    };

    const channel = supabase
      .channel(`notifications_changes_${Date.now()}_${Math.random().toString(36).substring(7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `userId=eq.${userId}` }, fetchNotifications)
      .subscribe();

    fetchNotifications();

    return () => supabase.removeChannel(channel);
  },

  subscribeToUser: (uid: string, callback: (user: User | null) => void) => {
    const fetchUser = async () => {
      const { data: d } = await supabase
        .from('users')
        .select('*')
        .eq('uid', uid)
        .single();
      
      if (d) {
        callback({
          ...d,
          displayName: d.display_name || d.displayName,
          visitorRestricted: d.visitor_restricted ?? d.visitorRestricted,
          roomNumber: d.room_number || d.roomNumber,
          phoneNumber: d.phone_number || d.phoneNumber,
          warningCount: d.warning_count ?? d.warningCount,
          lastSeen: d.last_seen || d.lastSeen,
          iceBreakerQuestion: d.ice_breaker_question || d.iceBreakerQuestion,
          relationshipStatus: d.relationship_status || d.relationshipStatus,
          instagramUrl: d.instagram_url || d.instagramUrl,
          profileImageUrl: d.profile_image_url || d.profileImageUrl,
          linkedinUrl: d.linkedin_url || d.linkedinUrl,
          serviceType: d.service_type || d.serviceType,
          businessDescription: d.business_description || d.businessDescription,
          lastVoteDate: d.last_vote_date || d.lastVoteDate,
          dailyPointsGiven: d.daily_points_given ?? d.dailyPointsGiven,
          plansForNextYear: d.plans_for_next_near || d.plans_for_next_year || d.plansForNextYear,
          isServiceProvider: d.is_service_provider ?? d.isServiceProvider
        } as User);
      } else {
        callback(null);
      }
    };

    const channel = supabase
      .channel(`user_${uid}_${Date.now()}_${Math.random().toString(36).substring(7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `uid=eq.${uid}` }, fetchUser)
      .subscribe();

    fetchUser();

    return () => supabase.removeChannel(channel);
  },

  subscribeToUsers: (callback: (users: User[]) => void) => {
    const fetchUsers = async () => {
      const { data } = await supabase.from('users').select('*').limit(1000);
      if (data) callback(data.map(u => ({
        ...u,
        displayName: u.display_name,
        roomNumber: u.room_number,
        profileImageUrl: u.profile_image_url,
        warningCount: u.warning_count,
        visitorRestricted: u.visitor_restricted || false,
        phoneNumber: u.phone_number,
        verified: u.verified || false
      })) as User[]);
    };

    const channel = supabase
      .channel(`users_all_${Date.now()}_${Math.random().toString(36).substring(7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchUsers)
      .subscribe();

    fetchUsers();

    return () => supabase.removeChannel(channel);
  },

  subscribeToNotices: (callback: (notices: Notice[]) => void) => {
    const fetchNotices = async () => {
      const { data } = await supabase.from('notices').select('*').order('date', { ascending: false }).limit(50);
      if (data) callback(data.map(n => ({
          ...n,
          content: n.content || n.description || '',
          priority: n.priority || 'low'
      })) as Notice[]);
    };

    const channel = supabase
      .channel(`notices_all_${Date.now()}_${Math.random().toString(36).substring(7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, fetchNotices)
      .subscribe();

    fetchNotices();

    return () => supabase.removeChannel(channel);
  },

  subscribeToBookings: (callback: (bookings: Booking[]) => void, userId?: string) => {
    const fetchBookings = async () => {
      let query = supabase.from('bookings').select('*').limit(50);
      if (userId) {
        query = query.eq('bookedBy', userId);
      } else {
        query = query.order('date', { ascending: true });
      }
      const { data } = await query;
      callback((data || []).map(d => ({
        ...d,
        isExternal: d.is_external ?? d.isExternal ?? false
      })) as Booking[]);
    };

    const channel = supabase
      .channel(`bookings_changes_${Date.now()}_${Math.random().toString(36).substring(7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, fetchBookings)
      .subscribe();

    fetchBookings();

    return () => supabase.removeChannel(channel);
  },

  subscribeToMaintenance: (callback: (requests: MaintenanceRequest[]) => void, userId?: string) => {
    const fetchMaintenance = async () => {
      let query = supabase.from('maintenance').select('*').limit(50);
      if (userId) {
        query = query.eq('reported_by', userId);
      } else {
        query = query.order('date', { ascending: false });
      }
      const { data } = await query;
      callback((data || []).map(d => ({
        ...d,
        reportedBy: d.reported_by,
        reporterName: d.reporter_name,
        reporterPhone: d.reporter_phone,
        imageUrl: d.image_url,
        resolvedBy: d.resolved_by,
        resolvedByName: d.resolved_by_name,
        resolvedDate: d.resolved_date,
        adminNotes: d.admin_notes
      })) as MaintenanceRequest[]);
    };

    const channel = supabase
      .channel(`maintenance_changes_${Date.now()}_${Math.random().toString(36).substring(7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance' }, fetchMaintenance)
      .subscribe();

    fetchMaintenance();

    return () => supabase.removeChannel(channel);
  },

  subscribeToVisitors: (callback: (visitors: VisitorLog[]) => void, userId?: string) => {
    const fetchVisitors = async () => {
      let query = supabase.from('visitors').select('*').limit(50);
      if (userId) {
        query = query.eq('hostId', userId);
      } else {
        query = query.order('signInTime', { ascending: false });
      }
      const { data } = await query;
      callback((data || []) as VisitorLog[]);
    };

    const channel = supabase
      .channel(`visitors_changes_${Date.now()}_${Math.random().toString(36).substring(7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visitors' }, fetchVisitors)
      .subscribe();

    fetchVisitors();

    return () => supabase.removeChannel(channel);
  },

  subscribeToStats: (callback: (stats: any) => void) => {
    const fetchStats = async () => {
      const { data } = await supabase.from('stats').select('*').eq('id', 'counters').single();
      if (data) callback(data);
    };

    const channel = supabase
      .channel(`stats_counters_${Date.now()}_${Math.random().toString(36).substring(7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stats', filter: 'id=eq.counters' }, fetchStats)
      .subscribe();

    fetchStats();

    return () => supabase.removeChannel(channel);
  },

  awardPoints: async (actionId: string, points?: number, targetUid?: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const response = await fetch('/api/award-points', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ actionId, points, targetUid })
      });
      
      if (!response.ok) {
        let errorMsg = "Point award failed";
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch (e) {
          errorMsg = `Server returned ${response.status} ${response.statusText}`;
        }
        console.warn('Point award failed:', errorMsg);
      }
    } catch (error) {
      console.error('Error awarding points:', error);
    }
  },

  syncSchema: async (tableName: string, expectedColumns: string[]) => {
    const { data, error } = await supabase.from(tableName).select('*').limit(1);
    if (error) {
      console.error(`Error checking schema for ${tableName}:`, error);
      return { success: false, error: error.message };
    }
    
    const actualColumns = data && data.length > 0 ? Object.keys(data[0]) : [];
    const missingColumns = expectedColumns.filter(col => !actualColumns.includes(col));
    
    if (missingColumns.length > 0) {
      console.warn(`Missing columns in ${tableName}:`, missingColumns);
      return { success: false, missingColumns };
    }
    
    return { success: true };
  },

  addBooking: async (booking: Omit<Booking, 'id'>) => {
    const { error } = await supabase.from('bookings').insert(booking);
    return !error;
  },

  addMaintenanceRequest: async (request: Omit<MaintenanceRequest, 'id'>) => {
    const { error } = await supabase.from('maintenance').insert({
      type: request.type,
      description: request.description,
      location: request.location,
      status: request.status,
      reported_by: request.reportedBy,
      reporter_name: request.reporterName,
      reporter_phone: request.reporterPhone,
      date: request.date,
      image_url: request.imageUrl
    });
    return !error;
  },

  updateUser: async (uid: string, data: Partial<User>) => {
    const updateData: any = { ...data };
    if (data.displayName !== undefined) updateData.display_name = data.displayName;
    if (data.visitorRestricted !== undefined) updateData.visitor_restricted = data.visitorRestricted;
    if (data.roomNumber !== undefined) updateData.room_number = data.roomNumber;
    if (data.phoneNumber !== undefined) updateData.phone_number = data.phoneNumber;
    if (data.warningCount !== undefined) updateData.warning_count = data.warningCount;
    if (data.lastSeen !== undefined) updateData.last_seen = data.lastSeen;
    if (data.iceBreakerQuestion !== undefined) updateData.ice_breaker_question = data.iceBreakerQuestion;
    if (data.relationshipStatus !== undefined) updateData.relationship_status = data.relationshipStatus;
    if (data.instagramUrl !== undefined) updateData.instagram_url = data.instagramUrl;
    if (data.profileImageUrl !== undefined) updateData.profile_image_url = data.profileImageUrl;
    if (data.linkedinUrl !== undefined) updateData.linkedin_url = data.linkedinUrl;
    if (data.serviceType !== undefined) updateData.service_type = data.serviceType;
    if (data.businessDescription !== undefined) updateData.business_description = data.businessDescription;
    if (data.lastVoteDate !== undefined) updateData.last_vote_date = data.lastVoteDate;
    if (data.dailyPointsGiven !== undefined) updateData.daily_points_given = data.dailyPointsGiven;
    if (data.plansForNextYear !== undefined) updateData.plans_for_next_near = data.plansForNextYear;
    if (data.isServiceProvider !== undefined) updateData.is_service_provider = data.isServiceProvider;

    // Remove camelCase versions to avoid errors if they don't exist in DB
    delete updateData.displayName;
    delete updateData.visitorRestricted;
    delete updateData.roomNumber;
    delete updateData.phoneNumber;
    delete updateData.warningCount;
    delete updateData.lastSeen;
    delete updateData.iceBreakerQuestion;
    delete updateData.relationshipStatus;
    delete updateData.instagramUrl;
    delete updateData.profileImageUrl;
    delete updateData.linkedinUrl;
    delete updateData.serviceType;
    delete updateData.businessDescription;
    delete updateData.lastVoteDate;
    delete updateData.dailyPointsGiven;
    delete updateData.plansForNextYear;
    delete updateData.isServiceProvider;

    const { error } = await supabase.from('users').update(updateData).eq('uid', uid);
    return !error;
  },

  uploadFile: async (path: string, file: File) => {
    try {
      const bucketName = 'uploads';
      const { data, error } = await supabase.storage.from(bucketName).upload(path, file, {
        upsert: true,
        contentType: file.type,
        cacheControl: '3600'
      });
      
      if (error) {
        console.error(`Supabase Upload Error [${bucketName}]:`, error);
        // Try fallback bucket if initial one fails with "not found"
        if (error.message?.includes('bucket not found') || error.message?.includes('not found')) {
            const { data: fallbackData, error: fallbackError } = await supabase.storage.from('public').upload(path, file, {
                upsert: true,
                contentType: file.type
            });
            if (fallbackError) throw fallbackError;
            if (fallbackData) {
                const { data: { publicUrl } } = supabase.storage.from('public').getPublicUrl(fallbackData.path);
                return publicUrl;
            }
        }
        throw error;
      }

      if (!data) throw new Error("Upload failed: No data returned from Supabase");

      const { data: { publicUrl } } = supabase.storage.from(bucketName).getPublicUrl(data.path);
      return publicUrl;
    } catch (err: any) {
      console.error("Critical Upload Failure:", err);
      // Construct a meaningful error for the UI
      let message = err.message || "Unknown upload error";
      if (message.includes("bucket not found")) {
        message = "Supabase Storage bucket 'uploads' not found. Please create it in your Supabase dashboard and set it to public.";
      }
      throw new Error(message);
    }
  },

  uploadImage: async (file: File, path: string) => {
    return DataService.uploadFile(path, file);
  },

  updateUserProfile: async (uid: string, data: Partial<User>) => {
    return DataService.updateUser(uid, data);
  },

  getUser: async (uid: string, email?: string) => {
    let { data: d, error } = await supabase.from('users').select('*').eq('uid', uid).single();
    
    // Fallback: If not found by UID but we have an email, try finding by email
    if ((!d || error) && email) {
      const { data: byEmail, error: emailError } = await supabase.from('users').select('*').eq('email', email).single();
      if (byEmail) {
        d = byEmail;
        // Automatically link this record to the new Supabase UID for future logins
        await supabase.from('users').update({ uid: uid }).eq('email', email);
      }
    }

    if (!d) return null;
    return {
      ...d,
      displayName: d.display_name || d.displayName,
      visitorRestricted: d.visitor_restricted ?? d.visitorRestricted,
      roomNumber: d.room_number || d.roomNumber,
      phoneNumber: d.phone_number || d.phoneNumber,
      warningCount: d.warning_count ?? d.warningCount,
      lastSeen: d.last_seen || d.lastSeen,
      iceBreakerQuestion: d.ice_breaker_question || d.iceBreakerQuestion,
      relationshipStatus: d.relationship_status || d.relationshipStatus,
      instagramUrl: d.instagram_url || d.instagramUrl,
      profileImageUrl: d.profile_image_url || d.profileImageUrl,
      linkedinUrl: d.linkedin_url || d.linkedinUrl,
      serviceType: d.service_type || d.serviceType,
      businessDescription: d.business_description || d.businessDescription,
      lastVoteDate: d.last_vote_date || d.lastVoteDate,
      dailyPointsGiven: d.daily_points_given ?? d.dailyPointsGiven,
      plansForNextYear: d.plans_for_next_near || d.plans_for_next_year || d.plansForNextYear,
      isServiceProvider: d.is_service_provider ?? d.isServiceProvider
    } as User;
  },

  getAllUsers: async () => {
    const { data, error } = await supabase.from('users').select('*').limit(1000);
    if (error) throw error;
    return (data || []).map(d => ({
      ...d,
      displayName: d.display_name || d.displayName,
      visitorRestricted: d.visitor_restricted ?? d.visitorRestricted,
      roomNumber: d.room_number || d.roomNumber,
      phoneNumber: d.phone_number || d.phoneNumber,
      warningCount: d.warning_count ?? d.warningCount,
      lastSeen: d.last_seen || d.lastSeen,
      iceBreakerQuestion: d.ice_breaker_question || d.iceBreakerQuestion,
      relationshipStatus: d.relationship_status || d.relationshipStatus,
      instagramUrl: d.instagram_url || d.instagramUrl,
      profileImageUrl: d.profile_image_url || d.profileImageUrl,
      linkedinUrl: d.linkedin_url || d.linkedinUrl,
      serviceType: d.service_type || d.serviceType,
      businessDescription: d.business_description || d.businessDescription,
      lastVoteDate: d.last_vote_date || d.lastVoteDate,
      dailyPointsGiven: d.daily_points_given ?? d.dailyPointsGiven,
      plansForNextYear: d.plans_for_next_near || d.plans_for_next_year || d.plansForNextYear,
      isServiceProvider: d.is_service_provider ?? d.isServiceProvider
    })) as User[];
  },

  updateUserRole: async (uid: string, role: UserRole) => {
    return DataService.updateUser(uid, { role });
  },

  updateUserRestriction: async (uid: string, restricted: boolean) => {
    return DataService.updateUser(uid, { visitorRestricted: restricted });
  },

  incrementUserWarning: async (uid: string) => {
    const user = await DataService.getUser(uid);
    if (user) {
      const newWarningCount = (user.warningCount || 0) + 1;
      const restricted = newWarningCount >= 3;
      await DataService.updateUser(uid, { 
        warningCount: newWarningCount,
        visitorRestricted: restricted
      });
      return { warnings: newWarningCount, restricted };
    }
    return null;
  },

  getNotices: async () => {
    const { data, error } = await supabase.from('notices').select('*').order('date', { ascending: false });
    if (error) throw error;
    return data as Notice[];
  },

  addNotice: async (notice: Omit<Notice, 'id'>) => {
    const { error } = await supabase.from('notices').insert(notice);
    return !error;
  },

  deleteNotice: async (id: string) => {
    const { error } = await supabase.from('notices').delete().eq('id', id);
    return !error;
  },

  getBookings: async (userId?: string) => {
    let query = supabase.from('bookings').select('*');
    if (userId) query = query.eq('bookedBy', userId);
    const { data, error } = await query.order('date', { ascending: true });
    if (error) throw error;
    return data as Booking[];
  },

  updateBookingStatus: async (id: string, status: Booking['status'], adminInfo?: { uid: string, name: string }) => {
    const updateData: any = { status };
    if (adminInfo) {
      updateData.approvedBy = adminInfo.uid;
      updateData.approvedByName = adminInfo.name;
      updateData.approvedDate = new Date().toISOString();
    }
    const { error } = await supabase.from('bookings').update(updateData).eq('id', id);
    return !error;
  },

  getMaintenanceRequests: async (userId?: string) => {
    let query = supabase.from('maintenance').select('*');
    if (userId) query = query.eq('reported_by', userId);
    const { data, error } = await query.order('date', { ascending: false });
    if (error) throw error;
    return data.map(d => ({
      ...d,
      reportedBy: d.reported_by,
      reporterName: d.reporter_name,
      reporterPhone: d.reporter_phone,
      imageUrl: d.image_url,
      resolvedBy: d.resolved_by,
      resolvedByName: d.resolved_by_name,
      resolvedDate: d.resolved_date,
      adminNotes: d.admin_notes
    })) as MaintenanceRequest[];
  },

  updateMaintenanceStatus: async (id: string, status: MaintenanceRequest['status'], adminInfo?: { uid: string, name: string }) => {
    const updateData: any = { status };
    if (adminInfo) {
      updateData.resolved_by = adminInfo.uid;
      updateData.resolved_by_name = adminInfo.name;
      updateData.resolved_date = new Date().toISOString();
    }
    const { error } = await supabase.from('maintenance').update(updateData).eq('id', id);
    return !error;
  },

  addMaintenanceNote: async (id: string, note: string, adminInfo: { uid: string, name: string }) => {
    const { data } = await supabase.from('maintenance').select('admin_notes').eq('id', id).single();
    const adminNotes = data?.admin_notes || [];
    const newNote = {
      note,
      adminName: adminInfo.name,
      adminId: adminInfo.uid,
      timestamp: new Date().toISOString()
    };
    const { error } = await supabase.from('maintenance').update({ admin_notes: [...adminNotes, newNote] }).eq('id', id);
    return !error;
  },

  getVisitors: async (userId?: string) => {
    let query = supabase.from('visitors').select('*');
    if (userId) query = query.eq('hostId', userId);
    const { data, error } = await query.order('signInTime', { ascending: false });
    if (error) throw error;
    return data as VisitorLog[];
  },

  signInVisitor: async (visitorData: Omit<VisitorLog, 'id' | 'pin' | 'signInTime'>) => {
    const pin = Math.floor(100 + Math.random() * 900).toString();
    const signInTime = new Date().toISOString();
    const { error } = await supabase.from('visitors').insert({ 
      ...visitorData, 
      pin,
      signInTime
    });
    if (error) return { success: false, message: error.message };
    return { success: true, pin };
  },

  verifyVisitorEntry: async (pin: string, monitorInfo: { uid: string, name: string }) => {
    const { data, error } = await supabase
      .from('visitors')
      .select('*')
      .eq('pin', pin)
      .is('signOutTime', null)
      .single();
    
    if (error || !data) return { success: false, message: "Invalid or already used PIN." };

    if (!data.entryTime) {
      // Entry
      const { error: updateError } = await supabase
        .from('visitors')
        .update({ 
          entryTime: new Date().toISOString(),
          entryVerifiedBy: monitorInfo.uid,
          entryVerifiedByName: monitorInfo.name
        })
        .eq('id', data.id);
      
      if (updateError) return { success: false, message: updateError.message };
      return { success: true, type: 'entry' };
    } else {
      // Exit
      const { error: updateError } = await supabase
        .from('visitors')
        .update({ 
          signOutTime: new Date().toISOString()
        })
        .eq('id', data.id);
      
      if (updateError) return { success: false, message: updateError.message };
      return { success: true, type: 'exit' };
    }
  },

  signOutVisitor: async (visitorId: string) => {
    const { error } = await supabase
      .from('visitors')
      .update({ signOutTime: new Date().toISOString() })
      .eq('id', visitorId);
    if (error) return { success: false, message: error.message };
    return { success: true };
  },

  resolveViolation: async (id: string) => {
    const { error } = await supabase.from('visitors').update({ violationResolved: true }).eq('id', id);
    return !error;
  },

  submitFeedback: async (feedback: Omit<Feedback, 'id'>) => {
    const { error } = await supabase.from('feedback').insert(feedback);
    return !error;
  },

  getFeedback: async () => {
    const { data, error } = await supabase.from('feedback').select('*').order('date', { ascending: false });
    if (error) throw error;
    return data as Feedback[];
  },

  deleteFeedback: async (id: string) => {
    const { error } = await supabase.from('feedback').delete().eq('id', id);
    return !error;
  },

  addAnonymousReport: async (report: Omit<AnonymousReportEntry, 'id'>, imageFile?: File) => {
    let imageUrl = report.imageUrl || '';
    if (imageFile) {
      imageUrl = await DataService.uploadFile(`reports/${Date.now()}_${imageFile.name}`, imageFile);
    }
    const { error } = await supabase.from('anonymous_reports').insert({ ...report, imageUrl });
    return !error;
  },

  getAnonymousReports: async () => {
    const { data, error } = await supabase.from('anonymous_reports').select('*').order('date', { ascending: false });
    if (error) throw error;
    return data as AnonymousReportEntry[];
  },

  updateAnonymousReportStatus: async (id: string, status: AnonymousReportEntry['status']) => {
    const { error } = await supabase.from('anonymous_reports').update({ status }).eq('id', id);
    return !error;
  },

  deleteAnonymousReport: async (id: string) => {
    const { error } = await supabase.from('anonymous_reports').delete().eq('id', id);
    return !error;
  },

  getAppSettings: async () => {
    const { data, error } = await supabase.from('settings').select('*').eq('id', 'appConfig').single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  updateAppSettings: async (settings: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const response = await fetch('/api/update-settings', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ id: 'appConfig', ...settings })
    });

    if (!response.ok) {
      let errorMsg = "Failed to update settings";
      try {
        const error = await response.json();
        errorMsg = error.error || errorMsg;
      } catch (e) {
        errorMsg = `Server returned ${response.status} ${response.statusText}`;
      }
      console.error("Error updating settings:", errorMsg);
      throw new Error(errorMsg);
    }
    return true;
  },

  updateAllowedEmails: async (emails: string[]) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const response = await fetch('/api/update-settings', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ id: 'accessControl', allowedEmails: emails })
    });

    if (!response.ok) {
      let errorMsg = "Failed to update allowed emails";
      try {
        const error = await response.json();
        errorMsg = error.error || errorMsg;
      } catch (e) {
        errorMsg = `Server returned ${response.status} ${response.statusText}`;
      }
      console.error("Error updating allowed emails:", errorMsg);
      throw new Error(errorMsg);
    }
    return true;
  },

  addAllowedEmail: async (email: string) => {
    const { data } = await supabase.from('settings').select('allowedEmails').eq('id', 'accessControl').single();
    const emails = data?.allowedEmails || [];
    if (!emails.includes(email)) {
      return DataService.updateAllowedEmails([...emails, email]);
    }
    return true;
  },

  getGlobalStats: async () => {
    const { data, error } = await supabase.from('stats').select('*').eq('id', 'counters').single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  incrementAppVisits: async () => {
    const { data } = await supabase.from('stats').select('appVisits').eq('id', 'counters').single();
    const visits = data?.appVisits || 0;
    await supabase.from('stats').upsert({ id: 'counters', appVisits: visits + 1 });
  },

  recalculateStats: async () => {
    // This would normally be a server-side function, but we can do a basic version here
    const { count: users } = await supabase.from('users').select('*', { count: 'exact', head: true });
    const { count: notices } = await supabase.from('notices').select('*', { count: 'exact', head: true });
    const { count: bookings } = await supabase.from('bookings').select('*', { count: 'exact', head: true });
    
    const stats = {
      id: 'counters',
      totalUsers: users || 0,
      totalNotices: notices || 0,
      totalBookings: bookings || 0,
      updatedAt: new Date().toISOString()
    };

    await supabase.from('stats').upsert(stats);
    return stats;
  },

  submitIceBreakerAnswer: async (userId: string, answerData: any) => {
    const { error } = await supabase.from('ice_breaker_answers').insert({
      ...answerData,
      userId,
      isRead: false
    });
    return !error;
  },

  markIceBreakerAnswerAsRead: async (userId: string, answerId: string) => {
    const { error } = await supabase.from('ice_breaker_answers').update({ isRead: true }).eq('id', answerId);
    return !error;
  },

  markAllIceBreakerAnswersAsRead: async (userId: string) => {
    const { error } = await supabase.from('ice_breaker_answers').update({ isRead: true }).eq('userId', userId).eq('isRead', false);
    return !error;
  },

  addReview: async (review: Omit<Review, 'id'>) => {
    const { error } = await supabase.from('reviews').insert(review);
    return !error;
  },

  subscribeToReviews: (providerId: string, callback: (reviews: Review[]) => void) => {
    const fetchReviews = async () => {
      const { data } = await supabase.from('reviews').select('*').eq('providerId', providerId).order('createdAt', { ascending: false });
      if (data) callback(data as Review[]);
    };

    const channel = supabase
      .channel(`reviews_${providerId}_${Date.now()}_${Math.random().toString(36).substring(7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews', filter: `providerId=eq.${providerId}` }, fetchReviews)
      .subscribe();

    fetchReviews();

    return () => supabase.removeChannel(channel);
  },

  subscribeToServiceProviders: (callback: (providers: User[]) => void) => {
    const fetchProviders = async () => {
      const { data } = await supabase.from('users').select('*').eq('role', 'service_provider');
      if (data) callback(data as User[]);
    };

    const channel = supabase
      .channel(`service_providers_${Date.now()}_${Math.random().toString(36).substring(7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: 'role=eq.service_provider' }, fetchProviders)
      .subscribe();

    fetchProviders();

    return () => supabase.removeChannel(channel);
  },

  subscribeToCauses: (callback: (causes: Cause[]) => void) => {
    const fetchCauses = async () => {
      const { data } = await supabase.from('causes').select('*').order('createdAt', { ascending: false });
      if (data) callback(data as Cause[]);
    };

    const channel = supabase
      .channel(`causes_all_${Date.now()}_${Math.random().toString(36).substring(7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'causes' }, fetchCauses)
      .subscribe();

    fetchCauses();

    return () => supabase.removeChannel(channel);
  },

  subscribeToPolls: (callback: (polls: Poll[]) => void) => {
    const fetchPolls = async () => {
      const { data } = await supabase.from('polls').select('*').order('createdAt', { ascending: false });
      if (data) callback(data as Poll[]);
    };

    const channel = supabase
      .channel(`polls_all_${Date.now()}_${Math.random().toString(36).substring(7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, fetchPolls)
      .subscribe();

    fetchPolls();

    return () => supabase.removeChannel(channel);
  },

  subscribeToPosts: (callback: (posts: Post[]) => void) => {
    const fetchPosts = async () => {
      const { data } = await supabase.from('post').select('*').order('createdAt', { ascending: false });
      if (data) callback(data.map(d => ({
        ...d,
        userId: d.user_id // Map user_id to userId for the frontend Post interface
      })) as Post[]);
    };

    const channel = supabase
      .channel(`posts_all_${Date.now()}_${Math.random().toString(36).substring(7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post' }, fetchPosts)
      .subscribe();

    fetchPosts();

    return () => supabase.removeChannel(channel);
  },

  subscribeToPhotos: (callback: (photos: Photo[]) => void) => {
    const fetchPhotos = async () => {
      const { data } = await supabase.from('photos').select('id, url, caption, createdAt, userId, userName').order('createdAt', { ascending: false });
      if (data) callback(data as Photo[]);
    };

    const channel = supabase
      .channel(`photos_all_${Date.now()}_${Math.random().toString(36).substring(7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'photos' }, fetchPhotos)
      .subscribe();

    fetchPhotos();

    return () => supabase.removeChannel(channel);
  },

  subscribeToFiles: (callback: (files: FileEntry[]) => void) => {
    const fetchFiles = async () => {
      const { data } = await supabase.from('files').select('id, name, url, type, size, createdAt, userId, userName').order('createdAt', { ascending: false });
      if (data) callback(data as FileEntry[]);
    };

    const channel = supabase
      .channel(`files_all_${Date.now()}_${Math.random().toString(36).substring(7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'files' }, fetchFiles)
      .subscribe();

    fetchFiles();

    return () => supabase.removeChannel(channel);
  },

  subscribeToFeedback: (callback: (feedback: Feedback[]) => void) => {
    const fetchFeedback = async () => {
      const { data } = await supabase.from('feedback').select('*').order('date', { ascending: false });
      if (data) callback(data as Feedback[]);
    };

    const channel = supabase
      .channel(`feedback_all_${Date.now()}_${Math.random().toString(36).substring(7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback' }, fetchFeedback)
      .subscribe();

    fetchFeedback();

    return () => supabase.removeChannel(channel);
  },

  subscribeToAnonymousReports: (callback: (reports: AnonymousReportEntry[]) => void) => {
    const fetchReports = async () => {
      const { data } = await supabase.from('anonymous_reports').select('*').order('date', { ascending: false });
      if (data) callback(data as AnonymousReportEntry[]);
    };

    const channel = supabase
      .channel(`reports_all_${Date.now()}_${Math.random().toString(36).substring(7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'anonymous_reports' }, fetchReports)
      .subscribe();

    fetchReports();

    return () => supabase.removeChannel(channel);
  },

  subscribeToMicroTasks: (callback: (tasks: MicroTask[]) => void) => {
    const fetchTasks = async () => {
      const { data } = await supabase.from('micro_tasks').select('*').order('createdAt', { ascending: false });
      if (data) callback(data as MicroTask[]);
    };

    const channel = supabase
      .channel(`micro_tasks_all_${Date.now()}_${Math.random().toString(36).substring(7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'micro_tasks' }, fetchTasks)
      .subscribe();

    fetchTasks();

    return () => supabase.removeChannel(channel);
  },

  addMicroTask: async (task: Omit<MicroTask, 'id' | 'createdAt'>) => {
    const { error } = await supabase.from('micro_tasks').insert({
      ...task,
      status: task.status || 'open'
    });
    if (error) throw error;
    return true;
  },

  claimMicroTask: async (taskId: string, userId: string, userName: string) => {
    const { error } = await supabase.from('micro_tasks').update({
      status: 'claimed',
      claimedBy: userId,
      claimedByName: userName
    }).eq('id', taskId);
    return !error;
  },

  reopenMicroTask: async (taskId: string) => {
    const { error } = await supabase.from('micro_tasks').update({
      status: 'open',
      claimedBy: null,
      claimedByName: null
    }).eq('id', taskId);
    return !error;
  },

  updateMicroTaskStatus: async (taskId: string, status: MicroTask['status']) => {
    const { error } = await supabase.from('micro_tasks').update({ status }).eq('id', taskId);
    return !error;
  },

  completeMicroTask: async (taskId: string, points: number, userId: string) => {
    const { error: taskError } = await supabase.from('micro_tasks').update({
      status: 'completed'
    }).eq('id', taskId);
    
    if (!taskError) {
      await DataService.awardPoints('complete_micro_task', points, userId);
    }
    return !taskError;
  },

  deleteMicroTask: async (taskId: string) => {
    const { error } = await supabase.from('micro_tasks').delete().eq('id', taskId);
    return !error;
  },

  subscribeToPointAwards: (callback: (awards: any[]) => void) => {
    const fetchAwards = async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { data } = await supabase
        .from('point_awards')
        .select('*')
        .gte('awardedAt', sevenDaysAgo.toISOString())
        .order('awardedAt', { ascending: false });
      
      callback(data || []);
    };

    const channel = supabase
      .channel(`point_awards_changes_${Date.now()}_${Math.random().toString(36).substring(7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'point_awards' }, fetchAwards)
      .subscribe();

    fetchAwards();

    return () => supabase.removeChannel(channel);
  },

  subscribeToAppConfig: (callback: (config: any) => void) => {
    const normalize = (d: any) => {
      if (!d) return d;
      return {
        ...d,
        logoUrl: d.logoUrl || d.logo_url,
        dashboardImages: d.dashboardImages || d.dashboard_images,
        maintenanceEmail: d.maintenanceEmail || d.maintenance_email,
        bookingEmail: d.bookingEmail || d.booking_email
      };
    };

    const fetchConfig = async () => {
      const { data } = await supabase.from('settings').select('*').eq('id', 'appConfig').single();
      if (data) callback(normalize(data));
    };

    const channel = supabase
      .channel(`app_config_${Date.now()}_${Math.random().toString(36).substring(7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings', filter: 'id=eq.appConfig' }, fetchConfig)
      .subscribe();

    fetchConfig();

    return () => supabase.removeChannel(channel);
  },

  saveCV: async (cvData: any, userId: string) => {
    // Attempt local-first or simplified upsert to minimize lock contention
    // We try user_id first as per standard feature SQL, but might need userId fallback
    const payload = {
        id: cvData.id, 
        user_id: userId,
        data: cvData,
        updatedAt: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('cvs')
      .upsert(payload)
      .select()
      .single();
    
    if (error) {
      console.error("Error saving CV:", error);
      // Fallback for older schemas
      if (error.message.includes('user_id')) {
          const fallbackPayload = {
              id: cvData.id,
              userId: userId,
              data: cvData,
              updatedAt: new Date().toISOString()
          };
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('cvs')
            .upsert(fallbackPayload)
            .select()
            .single();
          if (fallbackError) throw fallbackError;
          return fallbackData;
      }
      throw error;
    }
    return data;
  },

  getUserCVs: async (userId: string) => {
    // Basic select, no complex sorting to reduce DB lock time
    const { data, error } = await supabase
      .from('cvs')
      .select('id, user_id, updatedAt, data') 
      .eq('user_id', userId);
    
    if (error) {
      console.error("Error fetching CVs:", error);
      return [];
    }
    return data || [];
  },

  getCVById: async (id: string) => {
    const { data, error } = await supabase
      .from('cvs')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error("Error fetching CV:", error);
      return null;
    }
    return data;
  },

  canGenerateCV: async (userId: string) => {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    const { count, error } = await supabase
      .from('cv_generations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gt('created_at', oneMonthAgo.toISOString());
      
    if (error) {
        console.error("Error checking generation limit:", error);
        return false;
    }
    
    return (count || 0) < 1;
  },

  logCVGeneration: async (userId: string) => {
    const { error } = await supabase
      .from('cv_generations')
      .insert({ user_id: userId });
      
    if (error) {
        console.error("Error logging CV generation:", error);
    }
    return !error;
  }
};
