import React from 'react';
import { Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  db, 
  auth, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  limit,
  OperationType,
  handleFirestoreError
} from '../firebase';
import { cn } from '../lib/utils';

interface Notification {
  id: string;
  text: string;
  senderName: string;
  createdAt: string;
  sessionId: string;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [isOpen, setIsOpen] = React.useState(false);
  const user = auth.currentUser;

  React.useEffect(() => {
    if (!user) return;

    const path = 'chatMessages';
    // Listen for messages that mention the current user
    const q = query(
      collection(db, path),
      where('mentionedUserIds', 'array-contains', user.uid),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newNotifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];
      setNotifications(newNotifications);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [user]);

  const unreadCount = notifications.length; // Simplified: all fetched are "new" for now

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-white/5 rounded-full transition-colors relative"
      >
        <Bell size={20} className={cn(unreadCount > 0 ? "text-arcane" : "text-parchment/60")} />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 w-2 h-2 bg-ember rounded-full border-2 border-obsidian animate-ping"></span>
        )}
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 w-2 h-2 bg-ember rounded-full border-2 border-obsidian"></span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute top-full right-0 mt-2 w-72 glass border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="p-4 border-b border-white/10 bg-white/5">
                <h3 className="font-serif text-sm">Notificações</h3>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-xs text-parchment/40 font-mono uppercase">Silêncio Absoluto...</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div 
                      key={n.id}
                      className="p-4 border-b border-white/10 hover:bg-white/5 transition-colors cursor-default"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-arcane uppercase tracking-widest">{n.senderName}</span>
                        <span className="text-[8px] text-parchment/20 font-mono uppercase">
                          {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-parchment/80 line-clamp-2 italic">
                        "{n.text}"
                      </p>
                      <div className="mt-2 flex justify-end">
                        <button className="text-[9px] text-arcane/60 hover:text-arcane font-bold uppercase tracking-tighter">
                          Ver no Chat
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
