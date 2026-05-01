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
  Dice6,
  Trash2
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
  limit,
  getDocs,
  getDoc,
  deleteDoc,
  doc,
  writeBatch
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
  shouldNotify?: boolean;
  mentionedUserIds?: string[];
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
  isGM?: boolean;
}

export default function SessionChat({ sessionId, senderOverride, isGM }: SessionChatProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = React.useState('');
  const [mentionQuery, setMentionQuery] = React.useState('');
  const [showMentions, setShowMentions] = React.useState(false);
  const [mentionIndex, setMentionIndex] = React.useState(0);
  const [sessionUsers, setSessionUsers] = React.useState<{id: string, name: string, photo?: string, isGM?: boolean}[]>([]);
  const [userCharacter, setUserCharacter] = React.useState<any>(null);
  const [imageUrl, setImageUrl] = React.useState('');
  const [showImageInput, setShowImageInput] = React.useState(false);
  const [lastReadCount, setLastReadCount] = React.useState(0);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!sessionId) return;

    // Fetch participants - Session info and Characters
    const unsubscribeCharacters = onSnapshot(
      query(collection(db, 'characters'), where('sessionId', '==', sessionId)),
      async (charsSnap) => {
        const sessionDoc = await getDoc(doc(db, 'gameSessions', sessionId));
        if (!sessionDoc.exists()) return;
        
        const data = sessionDoc.data();
        const users: {id: string, name: string, photo?: string, isGM?: boolean}[] = [];
        
        // Add GM
        if (data.gmId) {
          const gmDoc = await getDoc(doc(db, 'users', data.gmId));
          if (gmDoc.exists()) {
            const gmData = gmDoc.data();
            const gmPhoto = gmData.photoURL || '';
            users.push({ id: data.gmId, name: 'GM', photo: gmPhoto, isGM: true });
            users.push({ id: data.gmId, name: 'Mestre', photo: gmPhoto, isGM: true });
            users.push({ id: data.gmId, name: gmData.displayName || 'Mestre', photo: gmPhoto, isGM: true });
          }
        }

        // Add Players from Characters
        charsSnap.docs.forEach(c => {
          const charData = c.data();
          if (charData.ownerId !== auth.currentUser?.uid) {
            users.push({
              id: charData.ownerId,
              name: charData.name,
              photo: charData.portrait || ''
            });
          }
        });

        // Unique by name to avoid pollution
        const uniqueUsers = users.filter((u, index, self) => 
          index === self.findIndex(t => t.name.toLowerCase() === u.name.toLowerCase())
        );
        
        setSessionUsers(uniqueUsers);

        // Fetch current user's character for rolls
        const myChar = charsSnap.docs.find(d => d.data().ownerId === auth.currentUser?.uid);
        if (myChar) {
          setUserCharacter(myChar.data());
        }
      },
      (error) => {
        import('../firebase').then(({ handleFirestoreError, OperationType }) => {
          handleFirestoreError(error, OperationType.LIST, 'characters');
        });
      }
    );

    const q = query(
      collection(db, 'chatMessages'),
      where('sessionId', '==', sessionId),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
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
    }, (error) => {
      import('../firebase').then(({ handleFirestoreError, OperationType }) => {
        handleFirestoreError(error, OperationType.LIST, 'chatMessages');
      });
    });

    return () => {
      unsubscribeCharacters();
      unsubscribeMessages();
    };
  }, [sessionId]);

  // Update last read count when opening chat or receiving new messages while open
  // Also scroll to bottom when opening
  React.useEffect(() => {
    if (isOpen) {
      setLastReadCount(messages.length);
      
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

  const [isConfirmingClear, setIsConfirmingClear] = React.useState(false);
  const [isClearing, setIsClearing] = React.useState(false);

  const handleClearChat = async () => {
    if (!isGM) return;
    
    if (!isConfirmingClear) {
      setIsConfirmingClear(true);
      setTimeout(() => setIsConfirmingClear(false), 3000); // Reset after 3 seconds
      return;
    }

    try {
      setIsClearing(true);
      setIsConfirmingClear(false);

      const q = query(collection(db, 'chatMessages'), where('sessionId', '==', sessionId));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        setIsClearing(false);
        return;
      }

      // Delete in batches of 500
      const docs = snapshot.docs;
      for (let i = 0; i < docs.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = docs.slice(i, i + 500);
        chunk.forEach((document) => {
          batch.delete(doc(db, 'chatMessages', document.id));
        });
        await batch.commit();
      }
    } catch (err) {
      console.error('Error clearing chat:', err);
    } finally {
      setIsClearing(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !imageUrl.trim()) || !auth.currentUser) return;

    const messageText = newMessage.trim();

    // Handle Roll Command /r
    if (messageText.startsWith('/r ')) {
      const formula = messageText.substring(3).trim();
      const stats = userCharacter ? { 
        ...userCharacter.stats, 
        ...userCharacter.statsMods,
        ...userCharacter.talentMods 
      } : {};
      
      const { rollDiceFormula } = await import('../lib/utils');
      const result = rollDiceFormula(formula, stats);

      try {
        await addDoc(collection(db, 'chatMessages'), {
          sessionId,
          senderId: auth.currentUser.uid,
          senderName: senderOverride?.name || auth.currentUser.displayName || 'Anônimo',
          senderPhoto: senderOverride?.photo || auth.currentUser.photoURL || '',
          text: `Rolou: ${formula}`,
          type: 'roll',
          rollData: {
            total: result.total,
            formula: formula,
            details: result.detail,
            rolls: result.rolls
          },
          createdAt: new Date().toISOString()
        });
        setNewMessage('');
        return;
      } catch (err) {
        console.error('Error sending roll message:', err);
      }
    }

    // Extract mentions
    const mentionRegex = /@([\wÀ-ü]+)/g;
    const mentionedUserIds: string[] = [];
    let match;
    while ((match = mentionRegex.exec(newMessage)) !== null) {
      const mentionName = match[1].toLowerCase();
      const user = sessionUsers.find(u => 
        u.name.toLowerCase().replace(/\s/g, '') === mentionName || 
        (u.isGM && (mentionName === 'gm' || mentionName === 'mestre'))
      );
      if (user) {
        mentionedUserIds.push(user.id);
      }
    }

    try {
      await addDoc(collection(db, 'chatMessages'), {
        sessionId,
        senderId: auth.currentUser.uid,
        senderName: senderOverride?.name || auth.currentUser.displayName || 'Anônimo',
        senderPhoto: senderOverride?.photo || auth.currentUser.photoURL || '',
        text: newMessage.trim(),
        image: imageUrl.trim(),
        shouldNotify: mentionedUserIds.length > 0,
        mentionedUserIds,
        createdAt: new Date().toISOString()
      });
      setNewMessage('');
      setImageUrl('');
      setShowImageInput(false);
      setShowMentions(false);
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const insertMention = (userName: string) => {
    const lastAtPos = newMessage.lastIndexOf('@');
    if (lastAtPos === -1) return;
    
    const beforeAt = newMessage.substring(0, lastAtPos);
    const textAfterAt = newMessage.substring(lastAtPos + 1);
    const spaceIndex = textAfterAt.search(/\s/);
    const afterMention = spaceIndex === -1 ? '' : textAfterAt.substring(spaceIndex);
    
    const updatedName = userName.replace(/\s/g, ''); 
    setNewMessage(beforeAt + '@' + updatedName + ' ' + afterMention);
    setShowMentions(false);
    setMentionQuery('');
    setMentionIndex(0);
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const cursorPosition = e.target.selectionStart || val.length;
    setNewMessage(val);
    
    const textBeforeCursor = val.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const afterAt = textBeforeCursor.substring(lastAtIndex + 1);
      if (!afterAt.includes(' ')) {
        setMentionQuery(afterAt);
        setShowMentions(true);
        setMentionIndex(0);
        return;
      }
    }
    
    setShowMentions(false);
    setMentionQuery('');
  };

  const formatText = (text: string, isMe: boolean, mentionedUserIds?: string[]) => {
    const currentUserId = auth.currentUser?.uid;
    const amIMentioned = mentionedUserIds?.includes(currentUserId || '');

    const parts = text.split(/((?:https?:\/\/[^\s]+)|(?:@[\wÀ-ü]+))/g);

    return parts.map((part, i) => {
      if (!part) return null;

      // URL detection
      if (part.startsWith('http')) {
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
      
      // Mention detection
      if (part.startsWith('@')) {
        const mentionName = part.substring(1).toLowerCase();
        
        const matchedUser = sessionUsers.find(u => {
          const normalizedName = u.name.toLowerCase().replace(/\s/g, '');
          const isGMTag = u.isGM && (mentionName === 'gm' || mentionName === 'mestre');
          return normalizedName === mentionName || normalizedName.startsWith(mentionName) || isGMTag;
        });

        if (matchedUser) {
          const isMentioningMe = matchedUser.id === currentUserId;
          
          return (
            <span 
              key={i} 
              className={cn(
                "font-bold px-1.5 py-0.5 rounded-md transition-all shadow-sm cursor-help",
                isMe 
                  ? "bg-obsidian/20 text-obsidian border border-obsidian/10" 
                  : isMentioningMe || amIMentioned
                    ? "bg-ember text-white animate-pulse shadow-lg shadow-ember/30" 
                    : "text-arcane bg-arcane/10 border border-arcane/20"
              )}
              title={matchedUser.name}
            >
              {part}
            </span>
          );
        }
      }

      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="fixed bottom-[13.5rem] right-4 lg:bottom-28 lg:right-10 z-[100]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20, transformOrigin: 'bottom right' }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={cn(
              "absolute bottom-14 right-0 glass rounded-3xl shadow-2xl border border-white/10 flex flex-col overflow-hidden transition-all duration-300",
              isExpanded 
                ? "w-[calc(100vw-2rem)] lg:w-[600px] h-[calc(100vh-12rem)]" 
                : "w-[calc(100vw-2rem)] sm:w-[400px] h-[500px] max-h-[calc(100vh-10rem)]"
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
                {isGM && (
                  <button 
                    onClick={handleClearChat}
                    disabled={isClearing}
                    className={cn(
                      "p-2 rounded-xl transition-all duration-300 flex items-center gap-2",
                      isClearing 
                        ? "bg-white/5 text-parchment/20 cursor-wait" 
                        : isConfirmingClear
                          ? "bg-ember text-white px-3"
                          : "hover:bg-ember/10 text-parchment/40 hover:text-ember"
                    )}
                    title={isConfirmingClear ? "Clique novamente para confirmar" : "Limpar Chat"}
                  >
                    <Trash2 size={18} className={cn(isConfirmingClear && "animate-pulse")} />
                    {isConfirmingClear && <span className="text-[10px] font-bold uppercase tracking-wider">Confirmar?</span>}
                  </button>
                )}
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
                          {formatText(msg.text, isMe, msg.mentionedUserIds)}
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
                {showMentions && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="bg-obsidian/95 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden mb-2 max-h-60 overflow-y-auto w-full z-50 absolute bottom-full left-0 shadow-2xl"
                  >
                    {sessionUsers
                      .filter(u => 
                        u.name.toLowerCase().includes(mentionQuery.toLowerCase()) || 
                        (u.isGM && (mentionQuery.toLowerCase() === 'gm' || mentionQuery.toLowerCase() === 'mestre'))
                      )
                      .length === 0 ? (
                        <div className="p-4 text-center">
                          <p className="text-parchment/40 text-xs italic">Nenhum aventureiro ou mestre encontrado</p>
                          <p className="text-[10px] text-parchment/20 font-mono uppercase mt-1">Tente outro nome</p>
                        </div>
                      ) : sessionUsers
                        .filter(u => 
                          u.name.toLowerCase().includes(mentionQuery.toLowerCase()) || 
                          (u.isGM && (mentionQuery.toLowerCase() === 'gm' || mentionQuery.toLowerCase() === 'mestre'))
                        )
                        .map((u, i) => (
                          <button
                            key={u.id + u.name}
                            type="button"
                            onMouseEnter={() => setMentionIndex(i)}
                            onClick={() => insertMention(u.name)}
                            className={cn(
                              "w-full flex items-center gap-3 p-3 transition-colors text-left border-b border-white/5 last:border-0",
                              mentionIndex === i ? "bg-white/10" : "hover:bg-white/5"
                            )}
                          >
                            <div className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden shrink-0 border-2",
                              u.isGM ? "bg-ember/20 border-ember text-ember" : "bg-arcane/20 border-arcane text-arcane"
                            )}>
                              {u.photo ? (
                                <img src={u.photo} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                u.isGM ? 'GM' : u.name.substring(0, 2).toUpperCase()
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold text-parchment truncate">{u.name}</div>
                              <div className="text-[10px] text-parchment/40 font-mono uppercase tracking-widest truncate">
                                {u.isGM ? 'Mestre da Masmorra' : 'Jogador'}
                              </div>
                            </div>
                            {mentionIndex === i && (
                              <div className="text-[10px] bg-white/10 px-2 py-0.5 rounded font-mono text-parchment/40 transform -rotate-12 translate-x-2">
                                ENTER
                              </div>
                            )}
                          </button>
                        ))
                    }
                  </motion.div>
                )}
              </AnimatePresence>

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

              <div className="flex items-end gap-2 relative">
                <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-2 flex flex-col">
                  <textarea 
                    placeholder="Sua mensagem..."
                    value={newMessage}
                    onChange={handleMessageChange}
                    onKeyDown={(e) => {
                      if (showMentions) {
                        const filtered = sessionUsers.filter(u => 
                          u.name.toLowerCase().includes(mentionQuery.toLowerCase()) || 
                          (u.isGM && (mentionQuery.toLowerCase() === 'gm' || mentionQuery.toLowerCase() === 'mestre'))
                        );
                        
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setMentionIndex(prev => (prev + 1) % filtered.length);
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setMentionIndex(prev => (prev - 1 + filtered.length) % filtered.length);
                        } else if (e.key === 'Enter' || e.key === 'Tab') {
                          if (filtered.length > 0) {
                            e.preventDefault();
                            insertMention(filtered[mentionIndex].name);
                          }
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          setShowMentions(false);
                        }
                        return;
                      }

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
          "w-12 h-12 rounded-2xl shadow-xl flex items-center justify-center transition-all duration-300 relative border border-white/10",
          isOpen 
            ? "bg-white/10 text-parchment backdrop-blur-xl border-white/20" 
            : "bg-arcane text-obsidian shadow-arcane/20"
        )}
      >
        {isOpen ? <X size={20} /> : <MessageSquare size={20} />}
        {!isOpen && unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-ember text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-obsidian">
            {unreadCount > 99 ? '99+' : unreadCount}
          </div>
        )}
      </motion.button>
    </div>
  );
}
