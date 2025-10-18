import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import Icon from '@/components/ui/icon';

import { ProfileEdit } from '@/components/ProfileEdit';
import { Settings } from '@/components/Settings';

const API_AUTH = 'https://functions.poehali.dev/85caea8f-a640-4a5a-96d5-e6848e6f4007';
const API_MESSENGER = 'https://functions.poehali.dev/5fdc83e2-4a82-43c9-a13e-054fa298259c';
const API_WEBRTC = 'https://functions.poehali.dev/949639de-58dd-4469-8caa-4bd64a7307ca';

interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url?: string;
  status?: string;
  online?: boolean;
  last_seen?: string;
}

interface Chat {
  id: number;
  name: string;
  is_group: boolean;
  other_user?: User;
  last_message?: string;
  last_message_time?: string;
}

interface Message {
  id: number;
  text: string;
  timestamp: string;
  sender_id: number;
  sender: {
    username: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  };
}

interface CallState {
  active: boolean;
  type: 'audio' | 'video' | null;
  incoming: boolean;
  otherUser?: User;
  stream?: MediaStream;
}

const Index = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [chats, setChats] = useState<Chat[]>([]);
  const [contacts, setContacts] = useState<User[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [activeTab, setActiveTab] = useState<'chats' | 'contacts' | 'calls'>('chats');
  const [callState, setCallState] = useState<CallState>({ active: false, type: null, incoming: false });
  const [newContactUsername, setNewContactUsername] = useState('');
  const [showAddContact, setShowAddContact] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  
  const { toast } = useToast();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    first_name: '',
    last_name: '',
  });

  useEffect(() => {
    const savedToken = localStorage.getItem('vnechat_token');
    const savedUser = localStorage.getItem('vnechat_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  useEffect(() => {
    if (token && currentUser) {
      loadChats();
      loadContacts();
    }
  }, [token, currentUser]);

  useEffect(() => {
    if (selectedChat) {
      loadMessages();
      setIsMobileMenuOpen(false);
    }
  }, [selectedChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(API_AUTH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: authMode,
          ...formData,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setToken(data.token);
        setCurrentUser(data.user);
        localStorage.setItem('vnechat_token', data.token);
        localStorage.setItem('vnechat_user', JSON.stringify(data.user));
        toast({ title: authMode === 'login' ? 'Добро пожаловать!' : 'Аккаунт создан!' });
      } else {
        toast({ title: 'Ошибка', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось подключиться', variant: 'destructive' });
    }
  };

  const loadChats = async () => {
    try {
      const response = await fetch(API_MESSENGER, {
        headers: { 'X-Auth-Token': token! },
      });
      const data = await response.json();
      if (response.ok) {
        setChats(data.chats || []);
      }
    } catch (error) {
      console.error('Failed to load chats:', error);
    }
  };

  const loadContacts = async () => {
    try {
      const response = await fetch(`${API_MESSENGER}?action=contacts`, {
        headers: { 'X-Auth-Token': token! },
      });
      const data = await response.json();
      if (response.ok) {
        setContacts(data.contacts || []);
      }
    } catch (error) {
      console.error('Failed to load contacts:', error);
    }
  };

  const loadMessages = async () => {
    if (!selectedChat) return;
    try {
      const response = await fetch(`${API_MESSENGER}?action=messages&chat_id=${selectedChat.id}`, {
        headers: { 'X-Auth-Token': token! },
      });
      const data = await response.json();
      if (response.ok) {
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedChat) return;

    try {
      const response = await fetch(API_MESSENGER, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token!,
        },
        body: JSON.stringify({
          action: 'send_message',
          chat_id: selectedChat.id,
          text: messageText,
        }),
      });

      if (response.ok) {
        setMessageText('');
        loadMessages();
        loadChats();
      }
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось отправить сообщение', variant: 'destructive' });
    }
  };

  const createChat = async (userId: number) => {
    try {
      const response = await fetch(API_MESSENGER, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token!,
        },
        body: JSON.stringify({
          action: 'create_chat',
          user_id: userId,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        loadChats();
        const newChat = chats.find(c => c.id === data.chat_id);
        if (newChat) setSelectedChat(newChat);
        setActiveTab('chats');
      }
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось создать чат', variant: 'destructive' });
    }
  };

  const addContact = async () => {
    if (!newContactUsername.trim()) return;
    try {
      const response = await fetch(API_MESSENGER, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token!,
        },
        body: JSON.stringify({
          action: 'add_contact',
          username: newContactUsername,
        }),
      });

      if (response.ok) {
        toast({ title: 'Успешно', description: 'Контакт добавлен!' });
        setNewContactUsername('');
        setShowAddContact(false);
        loadContacts();
      } else {
        const data = await response.json();
        toast({ title: 'Ошибка', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось добавить контакт', variant: 'destructive' });
    }
  };

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    pc.onicecandidate = async (event) => {
      if (event.candidate && callState.otherUser) {
        try {
          await fetch(API_WEBRTC, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'ice-candidate',
              from: currentUser!.id.toString(),
              to: callState.otherUser.id.toString(),
              candidate: event.candidate.toJSON(),
            }),
          });
        } catch (error) {
          console.error('Failed to send ICE candidate:', error);
        }
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    return pc;
  };

  const startCall = async (user: User, type: 'audio' | 'video') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video',
      });

      setCallState({
        active: true,
        type,
        incoming: false,
        otherUser: user,
        stream,
      });

      if (localVideoRef.current && type === 'video') {
        localVideoRef.current.srcObject = stream;
      }

      const pc = createPeerConnection();
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await fetch(API_WEBRTC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'offer',
          from: currentUser!.id.toString(),
          to: user.id.toString(),
          offer: offer,
          callType: type,
        }),
      });

      setPeerConnection(pc);

      toast({ 
        title: 'Звоним...', 
        description: `${type === 'video' ? 'Видеозвонок' : 'Аудиозвонок'} ${user.first_name}` 
      });
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Нет доступа к камере/микрофону', variant: 'destructive' });
    }
  };

  const endCall = () => {
    if (callState.stream) {
      callState.stream.getTracks().forEach(track => track.stop());
    }
    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
    }
    setCallState({ active: false, type: null, incoming: false });
  };

  const handleUserUpdate = (updatedUser: User) => {
    setCurrentUser(updatedUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('vnechat_token');
    localStorage.removeItem('vnechat_user');
    setToken(null);
    setCurrentUser(null);
    setChats([]);
    setContacts([]);
    setSelectedChat(null);
    setMessages([]);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'сейчас';
    if (diffMins < 60) return `${diffMins} мин`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} ч`;
    return date.toLocaleDateString('ru-RU');
  };

  const getInitials = (user?: User) => {
    if (!user) return '?';
    return `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase();
  };

  if (!token || !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-primary/5 p-4">
        <Card className="w-full max-w-md p-6 md:p-8 animate-scale-in">
          <div className="text-center mb-6 md:mb-8">
            <div className="w-14 h-14 md:w-16 md:h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="Video" size={28} className="text-white md:w-8 md:h-8" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold">VneChat</h1>
            <p className="text-muted-foreground mt-2 text-sm md:text-base">Видео и аудио звонки</p>
          </div>

          <Tabs value={authMode} onValueChange={(v) => setAuthMode(v as 'login' | 'register')} className="mb-4 md:mb-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Вход</TabsTrigger>
              <TabsTrigger value="register">Регистрация</TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={handleAuth} className="space-y-3 md:space-y-4">
            {authMode === 'register' && (
              <>
                <div className="grid grid-cols-2 gap-2 md:gap-4">
                  <Input
                    placeholder="Имя"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    required
                  />
                  <Input
                    placeholder="Фамилия"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    required
                  />
                </div>
                <Input
                  placeholder="Email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </>
            )}
            <Input
              placeholder="Имя пользователя"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
            />
            <Input
              placeholder="Пароль"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              minLength={8}
            />
            <Button type="submit" className="w-full">
              {authMode === 'login' ? 'Войти' : 'Создать аккаунт'}
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      {/* Mobile Header - Показывается только на мобильных когда выбран чат */}
      {selectedChat && (
        <div className="md:hidden fixed top-0 left-0 right-0 z-20 p-3 border-b flex items-center justify-between bg-card">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setSelectedChat(null)}
            className="h-9 w-9"
          >
            <Icon name="ArrowLeft" size={20} />
          </Button>
          <div className="flex items-center gap-2 flex-1 mx-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={selectedChat.other_user?.avatar_url} />
              <AvatarFallback className="bg-primary/20 text-xs">{getInitials(selectedChat.other_user)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{selectedChat.name}</p>
              <p className="text-xs text-muted-foreground">
                {selectedChat.other_user?.online ? 'Онлайн' : 'Оффлайн'}
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={() => startCall(selectedChat.other_user!, 'audio')}
              className="h-9 w-9"
            >
              <Icon name="Phone" size={18} />
            </Button>
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={() => startCall(selectedChat.other_user!, 'video')}
              className="h-9 w-9"
            >
              <Icon name="Video" size={18} />
            </Button>
          </div>
        </div>
      )}

      {/* Left Sidebar - Скрывается на мобильных когда выбран чат */}
      <div className={`${selectedChat ? 'hidden md:flex' : 'flex'} w-full md:w-80 border-r flex-col bg-card`}>
        {/* User Header */}
        <div className="p-3 md:p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => setShowProfileEdit(true)}>
            <Avatar className="h-9 w-9 md:h-10 md:w-10">
              <AvatarImage src={currentUser.avatar_url} />
              <AvatarFallback className="bg-primary text-white text-sm">{getInitials(currentUser)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm md:text-base truncate">{currentUser.first_name} {currentUser.last_name}</p>
              <p className="text-xs text-muted-foreground truncate">{currentUser.status || 'Доступен'}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)} className="h-9 w-9 flex-shrink-0">
            <Icon name="Settings" size={18} />
          </Button>
        </div>

        {/* Search */}
        <div className="p-3 md:p-4 border-b">
          <div className="relative">
            <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Поиск..." className="pl-9 h-9 text-sm" />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col">
          <TabsList className="w-full grid grid-cols-3 m-0 h-10">
            <TabsTrigger value="chats" className="text-xs md:text-sm">Чаты</TabsTrigger>
            <TabsTrigger value="contacts" className="text-xs md:text-sm">Контакты</TabsTrigger>
            <TabsTrigger value="calls" className="text-xs md:text-sm">Звонки</TabsTrigger>
          </TabsList>

          {/* Chats List */}
          {activeTab === 'chats' && (
            <ScrollArea className="flex-1">
              {chats.length === 0 ? (
                <div className="p-6 md:p-8 text-center text-muted-foreground">
                  <Icon name="MessageCircle" size={40} className="mx-auto mb-2 opacity-50 md:w-12 md:h-12" />
                  <p className="text-sm md:text-base">Нет чатов</p>
                </div>
              ) : (
                chats.map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => setSelectedChat(chat)}
                    className={`p-3 md:p-4 border-b cursor-pointer hover:bg-accent transition-colors active:bg-accent ${
                      selectedChat?.id === chat.id ? 'bg-accent' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 md:gap-3">
                      <Avatar className="h-10 w-10 md:h-12 md:w-12 flex-shrink-0">
                        <AvatarImage src={chat.other_user?.avatar_url} />
                        <AvatarFallback className="bg-primary/20">{getInitials(chat.other_user)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold truncate text-sm md:text-base">{chat.name}</p>
                          {chat.last_message_time && (
                            <span className="text-xs text-muted-foreground flex-shrink-0">{formatTime(chat.last_message_time)}</span>
                          )}
                        </div>
                        <p className="text-xs md:text-sm text-muted-foreground truncate">{chat.last_message || 'Нет сообщений'}</p>
                      </div>
                      {chat.other_user?.online && (
                        <div className="w-2 h-2 rounded-full bg-success flex-shrink-0" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>
          )}

          {/* Contacts List */}
          {activeTab === 'contacts' && (
            <div className="flex-1 flex flex-col">
              <div className="p-3 md:p-4 border-b">
                <Button onClick={() => setShowAddContact(true)} className="w-full h-9 text-sm">
                  <Icon name="UserPlus" size={16} className="mr-2" />
                  Добавить контакт
                </Button>
              </div>
              <ScrollArea className="flex-1">
                {contacts.map((contact) => (
                  <div key={contact.id} className="p-3 md:p-4 border-b hover:bg-accent active:bg-accent cursor-pointer group">
                    <div className="flex items-center gap-2 md:gap-3">
                      <Avatar className="h-10 w-10 md:h-12 md:w-12 flex-shrink-0">
                        <AvatarImage src={contact.avatar_url} />
                        <AvatarFallback className="bg-primary/20">{getInitials(contact)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm md:text-base truncate">{contact.first_name} {contact.last_name}</p>
                        <p className="text-xs md:text-sm text-muted-foreground truncate">@{contact.username}</p>
                      </div>
                      <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <Button size="icon" variant="ghost" onClick={() => createChat(contact.id)} className="h-8 w-8">
                          <Icon name="MessageCircle" size={16} />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => startCall(contact, 'audio')} className="h-8 w-8">
                          <Icon name="Phone" size={16} />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => startCall(contact, 'video')} className="h-8 w-8">
                          <Icon name="Video" size={16} />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </ScrollArea>
            </div>
          )}

          {/* Calls Tab */}
          {activeTab === 'calls' && (
            <ScrollArea className="flex-1">
              <div className="p-6 md:p-8 text-center text-muted-foreground">
                <Icon name="Phone" size={40} className="mx-auto mb-2 opacity-50 md:w-12 md:h-12" />
                <p className="text-sm md:text-base">Нет истории звонков</p>
              </div>
            </ScrollArea>
          )}
        </Tabs>
      </div>

      {/* Main Chat Area */}
      <div className={`${selectedChat ? 'flex' : 'hidden md:flex'} flex-1 flex-col`}>
        {selectedChat ? (
          <>
            {/* Desktop Chat Header */}
            <div className="hidden md:flex p-4 border-b items-center justify-between bg-card">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={selectedChat.other_user?.avatar_url} />
                  <AvatarFallback className="bg-primary/20">{getInitials(selectedChat.other_user)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{selectedChat.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedChat.other_user?.online ? 'Онлайн' : 'Оффлайн'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="icon" variant="ghost" onClick={() => startCall(selectedChat.other_user!, 'audio')}>
                  <Icon name="Phone" size={20} />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => startCall(selectedChat.other_user!, 'video')}>
                  <Icon name="Video" size={20} />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-3 md:p-4 mt-14 md:mt-0">
              <div className="space-y-3 md:space-y-4">
                {messages.map((msg) => {
                  const isOwn = msg.sender_id === currentUser.id;
                  return (
                    <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                      <div className={`max-w-[85%] md:max-w-md ${isOwn ? 'order-2' : 'order-1'}`}>
                        <div
                          className={`rounded-2xl px-3 py-2 md:px-4 md:py-2 ${
                            isOwn ? 'bg-primary text-white' : 'bg-accent'
                          }`}
                        >
                          {!isOwn && (
                            <p className="text-xs font-semibold mb-1">{msg.sender.first_name}</p>
                          )}
                          <p className="text-sm md:text-base break-words">{msg.text}</p>
                          <p className={`text-xs mt-1 ${isOwn ? 'text-white/70' : 'text-muted-foreground'}`}>
                            {formatTime(msg.timestamp)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input */}
            <form onSubmit={sendMessage} className="p-3 md:p-4 border-t bg-card">
              <div className="flex gap-2">
                <Button type="button" size="icon" variant="ghost" className="h-9 w-9 flex-shrink-0">
                  <Icon name="Paperclip" size={18} />
                </Button>
                <Input
                  placeholder="Введите сообщение..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="flex-1 h-9 text-sm"
                />
                <Button type="submit" size="icon" className="h-9 w-9 flex-shrink-0">
                  <Icon name="Send" size={18} />
                </Button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground p-4">
            <div className="text-center">
              <Icon name="MessageSquare" size={48} className="mx-auto mb-4 opacity-50 md:w-16 md:h-16" />
              <p className="text-sm md:text-lg">Выберите чат для начала общения</p>
            </div>
          </div>
        )}
      </div>

      {/* Add Contact Dialog */}
      <Dialog open={showAddContact} onOpenChange={setShowAddContact}>
        <DialogContent className="w-[90vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Добавить контакт</DialogTitle>
            <DialogDescription>Введите имя пользователя</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Имя пользователя"
              value={newContactUsername}
              onChange={(e) => setNewContactUsername(e.target.value)}
            />
            <Button onClick={addContact} className="w-full">Добавить</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Call Dialog */}
      {callState.active && (
        <Dialog open={callState.active} onOpenChange={() => endCall()}>
          <DialogContent className="w-[95vw] h-[85vh] md:max-w-4xl md:h-[600px] p-0">
            <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
              {callState.type === 'video' && (
                <>
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute bottom-4 right-4 w-24 h-32 md:w-48 md:h-36 object-cover rounded-lg border-2 border-white"
                  />
                </>
              )}
              {callState.type === 'audio' && (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center text-white px-4">
                    <Avatar className="w-24 h-24 md:w-32 md:h-32 mx-auto mb-4">
                      <AvatarImage src={callState.otherUser?.avatar_url} />
                      <AvatarFallback className="text-2xl md:text-4xl">{getInitials(callState.otherUser)}</AvatarFallback>
                    </Avatar>
                    <p className="text-xl md:text-2xl font-semibold mb-2">
                      {callState.otherUser?.first_name} {callState.otherUser?.last_name}
                    </p>
                    <p className="text-sm md:text-base text-muted-foreground">Аудиозвонок...</p>
                  </div>
                </div>
              )}
              
              <div className="absolute bottom-6 md:bottom-8 left-1/2 -translate-x-1/2 flex gap-3 md:gap-4">
                <Button size="icon" variant="secondary" className="h-12 w-12 md:h-14 md:w-14 rounded-full">
                  <Icon name="Mic" size={20} className="md:w-6 md:h-6" />
                </Button>
                {callState.type === 'video' && (
                  <Button size="icon" variant="secondary" className="h-12 w-12 md:h-14 md:w-14 rounded-full">
                    <Icon name="Video" size={20} className="md:w-6 md:h-6" />
                  </Button>
                )}
                <Button
                  size="icon"
                  onClick={endCall}
                  className="h-12 w-12 md:h-14 md:w-14 rounded-full bg-danger hover:bg-danger/90"
                >
                  <Icon name="PhoneOff" size={20} className="md:w-6 md:h-6" />
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Profile Edit Dialog */}
      {currentUser && token && (
        <ProfileEdit
          open={showProfileEdit}
          onOpenChange={setShowProfileEdit}
          user={currentUser}
          token={token}
          onUpdate={handleUserUpdate}
        />
      )}

      {/* Settings Dialog */}
      {currentUser && token && (
        <Settings
          open={showSettings}
          onOpenChange={setShowSettings}
          user={currentUser}
          token={token}
          onLogout={handleLogout}
          onUpdate={handleUserUpdate}
        />
      )}
    </div>
  );
};

export default Index;