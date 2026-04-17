import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, 
  Send, 
  Image as ImageIcon, 
  Link as LinkIcon, 
  X, 
  ChevronDown,
  User,
  ExternalLink,
  Maximize2,
  Minimize2,
  Dice6
} from 'lucide-react';
import { 
  db, 
  auth, 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  limit
} from '../firebase';
import { cn } from '../lib/utils';

interface ChatMessage {
  id: string;
  sessionId: string;
  senderId: string;
  senderName: string;
  senderPhoto: string;
  text: string;
  image?: string;
  createdAt: string;
  type?: 'text' | 'roll';
  rollData?: {
    total: number;
    formula: string;
    details?: string;
    rolls?: { die: string, values: number[] }[];
    success?: boolean;
  };
}

interface SessionChatProps {
  sessionId: string;
  senderOverride?: {
    name: string;
    photo: string;
  };
}

export default function SessionChat({ sessionId, senderOverride }: SessionChatProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = React.useState('');
  const [imageUrl, setImageUrl] = React.useState('');
  const [showImageInput, setShowImageInput] = React.useState(false);
  const [lastReadCount, setLastReadCount] = React.useState(0);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!sessionId) return;

    const q = query(
      collection(db, 'chatMessages'),
      where('sessionId', '==', sessionId),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChatMessage[];
      setMessages(msgs);
      
      // Scroll to bottom on new messages
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 100);
    });

    return () => unsubscribe();
  }, [sessionId]);

  // Update last read count when opening chat or receiving new messages while open
  // Also scroll to bottom when opening
  React.useEffect(() => {
    if (isOpen) {
      setLastReadCount(messages.length);
      
      // Scroll to bottom when chat is opened
      // We use a slightly longer timeout to ensure the Framer Motion animation has started/completed
      const timer = setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, messages.length]);

  const unreadCount = Math.max(0, messages.length - lastReadCount);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !imageUrl.trim()) || !auth.currentUser) return;

    try {
      await addDoc(collection(db, 'chatMessages'), {
        sessionId,
        senderId: auth.currentUser.uid,
        senderName: senderOverride?.name || auth.currentUser.displayName || 'Anônimo',
        senderPhoto: senderOverride?.photo || auth.currentUser.photoURL || '',
        text: newMessage.trim(),
        image: imageUrl.trim(),
        createdAt: new Date().toISOString()
      });
      setNewMessage('');
      setImageUrl('');
      setShowImageInput(false);
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const formatText = (text: string, isMe: boolean) => {
    // Basic link detection
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a 
            key={i} 
            href={part} 
            target="_blank" 
            rel="noopener noreferrer"
            className={cn(
              "hover:underline inline-flex items-center gap-1 font-medium",
              isMe ? "text-obsidian underline decoration-obsidian/30" : "text-arcane"
            )}
          >
            {part} <ExternalLink size={10} />
          </a>
        );
      }
      return part;
    });
  };

  return (
    <div className="fixed bottom-40 right-6 lg:bottom-28 lg:right-10 z-[100]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20, transformOrigin: 'bottom right' }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={cn(
              "absolute bottom-20 right-0 glass rounded-3xl shadow-2xl border border-white/10 flex flex-col overflow-hidden transition-all duration-300",
              isExpanded 
                ? "w-[calc(100vw-3rem)] lg:w-[600px] h-[calc(100vh-12rem)]" 
                : "w-[calc(100vw-3rem)] sm:w-[400px] h-[500px] max-h-[calc(100vh-10rem)]"
            )}
          >
            {/* Header */}
            <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-arcane/20 text-arcane rounded-xl">
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h3 className="font-serif text-lg leading-none">Chat da Sessão</h3>
                  <p className="text-[10px] text-parchment/40 font-mono uppercase tracking-widest mt-1">Tempo Real</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors text-parchment/40 hover:text-parchment hidden sm:block"
                  title={isExpanded ? "Reduzir" : "Aumentar"}
                >
                  {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors text-parchment/40 hover:text-parchment"
                >
                  <ChevronDown size={20} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar"
            >
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <MessageSquare size={48} className="text-parchment/10 mb-4" />
                  <p className="text-parchment/40 font-serif">Nenhuma mensagem ainda.</p>
                  <p className="text-[10px] text-parchment/20 font-mono uppercase tracking-widest mt-2">Seja o primeiro a falar!</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.senderId === auth.currentUser?.uid;
                  return (
                    <div 
                      key={msg.id}
                      className={cn(
                        "flex flex-col max-w-[85%]",
                        isMe ? "ml-auto items-end" : "items-start"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn(
                          "text-[10px] font-mono uppercase tracking-widest",
                          isMe ? "text-arcane/60" : "text-parchment/40"
                        )}>
                          {msg.senderName}
                        </span>
                        <span className="text-[8px] font-mono text-parchment/20 uppercase">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className={cn(
                        "p-3 rounded-2xl text-sm transition-colors",
                        isMe 
                          ? cn(
                              "bg-arcane text-obsidian rounded-tr-none",
                              msg.rollData?.success === true && "bg-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.3)]",
                              msg.rollData?.success === false && "bg-ember text-white shadow-[0_0_15px_rgba(244,63,94,0.3)]"
                            ) 
                          : cn(
                              "bg-white/5 border border-white/10 text-parchment rounded-tl-none",
                              msg.rollData?.success === true && "border-green-500/50 bg-green-500/10 text-green-100 shadow-[0_0_15px_rgba(34,197,94,0.1)]",
                              msg.rollData?.success === false && "border-ember/50 bg-ember/10 text-ember-100 shadow-[0_0_15px_rgba(244,63,94,0.1)]"
                            )
                      )}>
                        {msg.image && (
                          <div className="mb-2 rounded-lg overflow-hidden border border-black/10">
                            <img 
                              src={msg.image} 
                              alt="Enviada" 
                              className="w-full h-auto max-h-48 object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        )}
                        <p className="whitespace-pre-wrap break-words">
                          {formatText(msg.text, isMe)}
                        </p>
                        {msg.type === 'roll' && msg.rollData && (
                          <div className={cn(
                            "mt-2 p-2 rounded-xl border flex flex-col gap-1",
                            isMe ? "bg-obsidian/10 border-obsidian/20" : "bg-arcane/10 border-arcane/20"
                          )}>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-[10px] font-mono uppercase tracking-widest opacity-60">
                                {msg.rollData.formula}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <Dice6 size={12} className={isMe ? "text-obsidian/60" : "text-arcane"} />
                                <span className={cn("font-serif text-lg", isMe ? "text-obsidian" : "text-arcane text-glow-arcane")}>
                                  {msg.rollData.total}
                                </span>
                              </div>
                            </div>
                            {msg.rollData.details && (
                              <div className="text-[9px] font-mono opacity-40 break-all">
                                {msg.rollData.details}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input */}
            <form 
              onSubmit={handleSendMessage}
              className="p-4 border-t border-white/10 bg-white/5 space-y-3"
            >
              <AnimatePresence>
                {showImageInput && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-2 mb-2">
                      <ImageIcon size={16} className="text-parchment/40 shrink-0" />
                      <input 
                        type="text"
                        placeholder="URL da imagem..."
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        className="flex-1 bg-transparent border-none focus:ring-0 text-xs text-parchment placeholder:text-parchment/20"
                      />
                      <button 
                        type="button"
                        onClick={() => setShowImageInput(false)}
                        className="p-1 hover:bg-white/10 rounded-lg text-parchment/40"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-end gap-2">
                <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-2 flex flex-col">
                  <textarea 
                    placeholder="Sua mensagem..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e);
                      }
                    }}
                    className="w-full bg-transparent border-none focus:ring-0 text-sm text-parchment placeholder:text-parchment/20 resize-none min-h-[40px] max-h-[120px] no-scrollbar"
                  />
                  <div className="flex items-center gap-2 mt-1 px-1">
                    <button 
                      type="button"
                      onClick={() => setShowImageInput(!showImageInput)}
                      className={cn(
                        "p-1.5 rounded-lg transition-colors",
                        showImageInput ? "bg-arcane/20 text-arcane" : "text-parchment/40 hover:text-parchment hover:bg-white/10"
                      )}
                      title="Adicionar Imagem"
                    >
                      <ImageIcon size={16} />
                    </button>
                    <button 
                      type="button"
                      className="p-1.5 text-parchment/40 hover:text-parchment hover:bg-white/10 rounded-lg transition-colors"
                      title="Adicionar Link"
                      onClick={() => {
                        if (!newMessage.includes('http')) {
                          setNewMessage(prev => prev + ' https://');
                        }
                      }}
                    >
                      <LinkIcon size={16} />
                    </button>
                  </div>
                </div>
                <button 
                  type="submit"
                  disabled={!newMessage.trim() && !imageUrl.trim()}
                  className="p-3 bg-arcane text-obsidian rounded-2xl hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100 shadow-lg shadow-arcane/20"
                >
                  <Send size={20} />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 relative",
          isOpen 
            ? "bg-white/10 text-parchment backdrop-blur-xl border border-white/20" 
            : "bg-arcane text-obsidian shadow-arcane/40"
        )}
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
        {!isOpen && unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-ember text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-obsidian">
            {unreadCount > 99 ? '99+' : unreadCount}
          </div>
        )}
      </motion.button>
    </div>
  );
}
