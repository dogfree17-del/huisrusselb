import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { DataService } from '../services/supabase';
import { User, Notice, VisitorLog, MaintenanceRequest, Booking, Cause, Feedback, Poll, Post, Photo, FileEntry, AppNotification, MicroTask } from '../types';

interface DataContextType {
  users: User[];
  notices: Notice[];
  bookings: Booking[];
  maintenanceRequests: MaintenanceRequest[];
  visitors: VisitorLog[];
  causes: Cause[];
  polls: Poll[];
  posts: Post[];
  photos: Photo[];
  files: FileEntry[];
  feedback: Feedback[];
  anonymousReports: any[];
  notifications: AppNotification[];
  microTasks: MicroTask[];
  pointAwards: any[];
  stats: any;
  appConfig: any;
  setAppConfig: React.Dispatch<React.SetStateAction<any>>;
  loading: boolean;
  refreshVisitors: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider = ({ children, currentUser }: { children: ReactNode, currentUser: User | null }) => {
  const [users, setUsers] = useState<User[]>(() => {
    const cached = localStorage.getItem('cache_users');
    return cached ? JSON.parse(cached) : [];
  });
  const [notices, setNotices] = useState<Notice[]>(() => {
    const cached = localStorage.getItem('cache_notices');
    return cached ? JSON.parse(cached) : [];
  });
  const [bookings, setBookings] = useState<Booking[]>(() => {
    const cached = localStorage.getItem('cache_bookings');
    return cached ? JSON.parse(cached) : [];
  });
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>(() => {
    const cached = localStorage.getItem('cache_maintenance');
    return cached ? JSON.parse(cached) : [];
  });
  const [visitors, setVisitors] = useState<VisitorLog[]>(() => {
    const cached = localStorage.getItem('cache_visitors');
    return cached ? JSON.parse(cached) : [];
  });
  const [causes, setCauses] = useState<Cause[]>(() => {
    const cached = localStorage.getItem('cache_causes');
    return cached ? JSON.parse(cached) : [];
  });
  const [polls, setPolls] = useState<Poll[]>(() => {
    const cached = localStorage.getItem('cache_polls');
    return cached ? JSON.parse(cached) : [];
  });
  const [posts, setPosts] = useState<Post[]>(() => {
    const cached = localStorage.getItem('cache_posts');
    return cached ? JSON.parse(cached) : [];
  });
  const [photos, setPhotos] = useState<Photo[]>(() => {
    const cached = localStorage.getItem('cache_photos');
    return cached ? JSON.parse(cached) : [];
  });
  const [files, setFiles] = useState<FileEntry[]>(() => {
    const cached = localStorage.getItem('cache_files');
    return cached ? JSON.parse(cached) : [];
  });
  const [feedback, setFeedback] = useState<Feedback[]>(() => {
    const cached = localStorage.getItem('cache_feedback');
    return cached ? JSON.parse(cached) : [];
  });
  const [anonymousReports, setAnonymousReports] = useState<any[]>(() => {
    const cached = localStorage.getItem('cache_reports');
    return cached ? JSON.parse(cached) : [];
  });
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    const cached = localStorage.getItem('cache_notifications');
    return cached ? JSON.parse(cached) : [];
  });
  const [microTasks, setMicroTasks] = useState<MicroTask[]>(() => {
    const cached = localStorage.getItem('cache_microTasks');
    return cached ? JSON.parse(cached) : [];
  });
  const [pointAwards, setPointAwards] = useState<any[]>(() => {
    const cached = localStorage.getItem('cache_pointAwards');
    return cached ? JSON.parse(cached) : [];
  });
  const [stats, setStats] = useState<any>(() => {
    const cached = localStorage.getItem('cache_stats');
    return cached ? JSON.parse(cached) : {};
  });
  const [appConfig, setAppConfig] = useState<any>(() => {
    const cached = localStorage.getItem('cache_appConfig');
    return cached ? JSON.parse(cached) : { logoUrl: '' };
  });

  const [loading, setLoading] = useState(true);

  // Cache helper
  useEffect(() => {
    if (users.length > 0) localStorage.setItem('cache_users', JSON.stringify(users));
  }, [users]);
  useEffect(() => {
    if (notices.length > 0) localStorage.setItem('cache_notices', JSON.stringify(notices));
  }, [notices]);
  useEffect(() => {
    if (bookings.length > 0) localStorage.setItem('cache_bookings', JSON.stringify(bookings));
  }, [bookings]);
  useEffect(() => {
    if (maintenanceRequests.length > 0) localStorage.setItem('cache_maintenance', JSON.stringify(maintenanceRequests));
  }, [maintenanceRequests]);
  useEffect(() => {
    if (visitors.length > 0) localStorage.setItem('cache_visitors', JSON.stringify(visitors));
  }, [visitors]);
  useEffect(() => {
    if (causes.length > 0) localStorage.setItem('cache_causes', JSON.stringify(causes));
  }, [causes]);
  useEffect(() => {
    if (polls.length > 0) localStorage.setItem('cache_polls', JSON.stringify(polls));
  }, [polls]);
  useEffect(() => {
    if (posts.length > 0) localStorage.setItem('cache_posts', JSON.stringify(posts));
  }, [posts]);
  useEffect(() => {
    if (photos.length > 0) localStorage.setItem('cache_photos', JSON.stringify(photos));
  }, [photos]);
  useEffect(() => {
    if (files.length > 0) localStorage.setItem('cache_files', JSON.stringify(files));
  }, [files]);
  useEffect(() => {
    if (feedback.length > 0) localStorage.setItem('cache_feedback', JSON.stringify(feedback));
  }, [feedback]);
  useEffect(() => {
    if (anonymousReports.length > 0) localStorage.setItem('cache_reports', JSON.stringify(anonymousReports));
  }, [anonymousReports]);
  useEffect(() => {
    if (notifications.length > 0) localStorage.setItem('cache_notifications', JSON.stringify(notifications));
  }, [notifications]);
  useEffect(() => {
    if (microTasks.length > 0) localStorage.setItem('cache_microTasks', JSON.stringify(microTasks));
  }, [microTasks]);
  useEffect(() => {
    if (pointAwards.length > 0) localStorage.setItem('cache_pointAwards', JSON.stringify(pointAwards));
  }, [pointAwards]);
  useEffect(() => {
    if (Object.keys(stats).length > 0) localStorage.setItem('cache_stats', JSON.stringify(stats));
  }, [stats]);
  useEffect(() => {
    if (appConfig.logoUrl) localStorage.setItem('cache_appConfig', JSON.stringify(appConfig));
  }, [appConfig]);

  const refreshVisitors = async () => {
    const data = await DataService.getVisitors();
    setVisitors(data);
  };

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const unsubscribes: (() => void)[] = [];

    // Set up all subscriptions
    unsubscribes.push(DataService.subscribeToUsers(setUsers));
    unsubscribes.push(DataService.subscribeToNotices(setNotices));
    unsubscribes.push(DataService.subscribeToBookings(setBookings));
    unsubscribes.push(DataService.subscribeToMaintenance(setMaintenanceRequests));
    unsubscribes.push(DataService.subscribeToVisitors(setVisitors));
    unsubscribes.push(DataService.subscribeToCauses(setCauses));
    unsubscribes.push(DataService.subscribeToPolls(setPolls));
    unsubscribes.push(DataService.subscribeToPosts(setPosts));
    unsubscribes.push(DataService.subscribeToPhotos(setPhotos));
    unsubscribes.push(DataService.subscribeToFiles(setFiles));
    unsubscribes.push(DataService.subscribeToFeedback(setFeedback));
    unsubscribes.push(DataService.subscribeToAnonymousReports(setAnonymousReports));
    unsubscribes.push(DataService.subscribeToNotifications(currentUser.uid, setNotifications));
    unsubscribes.push(DataService.subscribeToMicroTasks(setMicroTasks));
    unsubscribes.push(DataService.subscribeToPointAwards(setPointAwards));
    unsubscribes.push(DataService.subscribeToStats(setStats));
    unsubscribes.push(DataService.subscribeToAppConfig(setAppConfig));

    // We consider loading finished once we have some basic data or after a short delay
    const timer = setTimeout(() => setLoading(false), 1000);

    return () => {
      unsubscribes.forEach(unsub => unsub());
      clearTimeout(timer);
    };
  }, [currentUser]);

  return (
    <DataContext.Provider value={{
      users,
      notices,
      bookings,
      maintenanceRequests,
      visitors,
      causes,
      polls,
      posts,
      photos,
      files,
      feedback,
      anonymousReports,
      notifications,
      microTasks,
      pointAwards,
      stats,
      appConfig,
      setAppConfig,
      loading,
      refreshVisitors
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
