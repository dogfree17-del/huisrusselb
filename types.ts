export type UserRole = 'super_admin' | 'admin' | 'maintenance_admin' | 'door_monitor' | 'general';

export interface PrivacySettings {
  showRoomNumber: boolean;
  showRelationshipStatus: boolean;
}

export interface Qualification {
  name: string;
  issuer: string;
  date: string;
  details: string[];
}

export interface Award {
  name: string;
  issuer: string;
  date: string;
  details: string[];
}

export interface Experience {
  role: string;
  company: string;
  period: string;
  location: string;
  description: string[];
}

export interface Education {
  degree: string;
  institution: string;
  year: string;
}

export interface CVData {
  id?: string;
  userId?: string;
  jobTitle: string;
  tailoredSummary: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedIn?: string;
  portfolio?: string;
  qualifications?: Qualification[];
  awards?: Award[];
  tailoredSkills?: {
    technical: string[];
    soft: string[];
  };
  tailoredExperience: Experience[];
  education?: Education[];
  certificates?: { title: string; issuer: string; year: string }[];
  customSections?: { id: string; title: string; content: string }[];
  sidebarCustomSections?: { id: string; title: string; content: string }[];
  references?: { name: string; title: string; contact: string }[];
  sidebarOrder?: string[];
  mainOrder?: string[];
  atsAnalysis?: {
    score: number;
    matchedKeywords: string[];
    missingKeywords: string[];
    feedback: string[];
  };
  formatting?: {
    fontFamily: string;
    fontSize: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface UserCV {
  id: string;
  userId: string;
  data: CVData;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  uid: string;
  email: string;
  displayName: string;
  verified?: boolean;
  role: UserRole;
  residenceId?: string;
  roomNumber?: string;
  section?: string;
  course?: string;
  interests?: string[];
  sports?: string[];
  bio?: string;
  profileImageUrl?: string;
  linkedinUrl?: string;
  instagramUrl?: string;
  assignedParkingBay?: string;
  phoneNumber?: string;
  gender?: string;
  relationshipStatus?: string;
  privacySettings?: PrivacySettings;
  iceBreakerQuestion?: string;
  iceBreakerAnswers?: {
    id: string;
    userId: string;
    userName: string;
    userPhone?: string;
    userAvatar?: string;
    answer: string;
    createdAt: string;
    isRead?: boolean;
  }[];
  warningCount: number;
  visitorRestricted: boolean;
  lastSeen?: string;
  fcmTokens?: string[];
  status?: {
    text: string;
    timestamp: string;
  };
  icebreaker?: {
    date: string;
    question: string;
    answer: string;
  };
  reason?: string; // AI Matchmaker reason
  sharedKeyword?: string; // AI Matchmaker shared keyword
  points?: number;
  dailyPointsGiven?: number;
  lastVoteDate?: string;
  cvUrl?: string;
  professionalSummary?: string;
  skills?: string[];
  education?: {
    institution: string;
    degree: string;
    year: string;
  }[];
  experience?: {
    company: string;
    position: string;
    duration: string;
  }[];
  isServiceProvider?: boolean;
  businessDescription?: string;
  serviceType?: string; // max 10 chars
  plansForNextYear?: string;
  courseName?: string; // Academic course name
  createdAt?: string;
  updatedAt?: string;
}

export interface Cause {
  id: string;
  title: string;
  description: string;
  ownerId: string;
  ownerName: string;
  participants: { uid: string; name: string }[];
  missions: string[];
  createdAt: string;
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  date: string;
  time?: string;
  priority: 'low' | 'high';
  type?: 'announcement' | 'event';
  eventDate?: string;
  location?: string;
}

export interface Booking {
  id: string;
  venue: string;
  date: string;
  startTime: string;
  endTime: string;
  bookedBy: string;
  bookerName: string;
  bookerEmail: string;
  status: 'Reviewing' | 'Granted' | 'Denied';
  isExternal: boolean;
  purpose: string;
  attendeeCount?: number;
  externalVisitors?: number; // Count of non-residents
  equipmentNeeds?: string;
  donationOffer?: string; // Pantry donation
  contactPhone?: string;
  approvedBy?: string; // UID
  approvedByName?: string; // Display Name
  approvedDate?: string;
  guestIdUrl?: string; // Proof of ID for external bookings
}

export interface MaintenanceRequest {
  id: string;
  type: 'electrical' | 'plumbing' | 'furniture' | 'other';
  description: string;
  location: string;
  status: 'open' | 'in_progress' | 'resolved';
  reportedBy: string;
  reporterId?: string; // Alias for reportedBy
  reporterName?: string;
  reporterPhone?: string;
  date: string;
  imageUrl?: string;
  resolvedBy?: string; // UID
  resolvedByName?: string; // Display Name
  resolvedDate?: string;
  adminNotes?: {
    note: string;
    adminName: string;
    adminId: string;
    timestamp: string;
  }[];
}

export interface Review {
  id: string;
  providerId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface VisitorLog {
  id: string;
  visitorName: string;
  visitorIdNumber: string;
  hostId: string;
  hostName: string;
  hostPhone: string;
  hostRoomNumber: string;
  signInTime: string; // Authorization time
  entryTime?: string;  // Physical arrival at door
  signOutTime?: string;
  sleepoverStatus: 'none' | 'pending' | 'approved' | 'rejected';
  nights: number;
  expectedSignOutTime: string;
  pin: string;
  entryVerifiedBy?: string; // UID of door monitor/admin
  entryVerifiedByName?: string;
  violationResolved?: boolean;
}

export interface ChatMessage {
  id: string;
  channel: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
}

export interface Transcription {
  text: string;
  sender: 'user' | 'model';
  isFinal: boolean;
  timestamp: Date;
}

export interface Feedback {
  id: string;
  userId: string;
  userName: string;
  text: string;
  description?: string;
  type?: string;
  date: string;
  status: 'new' | 'reviewed';
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  createdBy: string;
  creatorName: string;
  createdAt: string;
  expiresAt: string;
  voters: string[]; // List of UIDs who voted
  isOpen: boolean;
}

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface Post {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  type: 'text' | 'poll' | 'photo' | 'file';
  poll?: Poll;
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
  createdAt: string;
  likes: string[]; // UIDs
  commentsCount: number;
}

export interface Photo {
  id: string;
  url: string;
  userId: string;
  userName: string;
  createdAt: string;
  description?: string;
}

export interface FileEntry {
  id: string;
  url: string;
  name: string;
  size: number;
  type: string;
  userId: string;
  userName: string;
  createdAt: string;
}

export interface AnonymousReportEntry {
  id: string;
  description: string;
  date: string;
  status: 'new' | 'reviewed' | 'resolved';
  imageUrl?: string;
}

export interface MicroTask {
  id: string;
  title: string;
  description: string;
  points: 0.1 | 0.35 | 0.5 | 1;
  motivation?: string; // Required if points is 1
  status: 'open' | 'claimed' | 'completed' | 'pending_review';
  claimedBy?: string; // User ID
  claimedByName?: string;
  createdAt: string;
  createdBy?: string; // User ID of who submitted
  createdByName?: string;
  createdByPhone?: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
}

export interface AppSettings {
  logoUrl?: string;
  houseName?: string;
  maintenanceEmail?: string;
  bookingEmail?: string;
  lastUpdated?: string;
}