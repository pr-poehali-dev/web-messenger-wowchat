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

const API_AUTH = 'https://functions.poehali.dev/85caea8f-a640-4a5a-96d5-e6848e6f4007';
const API_MESSENGER = 'https://functions.poehali.dev/5fdc83e2-4a82-43c9-a13e-054fa298259c';

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
        toast({ title: authMode === 'login' ? 'Welcome back!' : 'Account created!' });
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Connection failed', variant: 'destructive' });
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
      toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' });
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
      toast({ title: 'Error', description: 'Failed to create chat', variant: 'destructive' });
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
        toast({ title: 'Success', description: 'Contact added!' });
        setNewContactUsername('');
        setShowAddContact(false);
        loadContacts();
      } else {
        const data = await response.json();
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to add contact', variant: 'destructive' });
    }
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

      toast({ title: 'Calling...', description: `${type === 'video' ? 'Video' : 'Audio'} call to ${user.first_name}` });
    } catch (error) {
      toast({ title: 'Error', description: 'Cannot access camera/microphone', variant: 'destructive' });
    }
  };

  const endCall = () => {
    if (callState.stream) {
      callState.stream.getTracks().forEach(track => track.stop());
    }
    setCallState({ active: false, type: null, incoming: false });
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
    
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const getInitials = (user?: User) => {
    if (!user) return '?';
    return `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase();
  };

  if (!token || !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-primary/5">
        <Card className="w-full max-w-md p-8 animate-scale-in">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="Video" size={32} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold">VneChat</h1>
            <p className="text-muted-foreground mt-2">Connect with video & audio calls</p>
          </div>

          <Tabs value={authMode} onValueChange={(v) => setAuthMode(v as 'login' | 'register')} className="mb-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={handleAuth} className="space-y-4">
            {authMode === 'register' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    placeholder="First name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    required
                  />
                  <Input
                    placeholder="Last name"
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
              placeholder="Username"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
            />
            <Input
              placeholder="Password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              minLength={8}
            />
            <Button type="submit" className="w-full">
              {authMode === 'login' ? 'Login' : 'Create Account'}
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      {/* Left Sidebar */}
      <div className="w-80 border-r flex flex-col bg-card">
        {/* User Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={currentUser.avatar_url} />
              <AvatarFallback className="bg-primary text-white">{getInitials(currentUser)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{currentUser.first_name} {currentUser.last_name}</p>
              <p className="text-xs text-muted-foreground">{currentUser.status || 'Available'}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <Icon name="LogOut" size={20} />
          </Button>
        </div>

        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <Icon name="Search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search..." className="pl-10" />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="chats">Chats</TabsTrigger>
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
            <TabsTrigger value="calls">Calls</TabsTrigger>
          </TabsList>

          {/* Chats List */}
          {activeTab === 'chats' && (
            <ScrollArea className="flex-1">
              {chats.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Icon name="MessageCircle" size={48} className="mx-auto mb-2 opacity-50" />
                  <p>No chats yet</p>
                </div>
              ) : (
                chats.map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => setSelectedChat(chat)}
                    className={`p-4 border-b cursor-pointer hover:bg-accent transition-colors ${
                      selectedChat?.id === chat.id ? 'bg-accent' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={chat.other_user?.avatar_url} />
                        <AvatarFallback className="bg-primary/20">{getInitials(chat.other_user)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold truncate">{chat.name}</p>
                          {chat.last_message_time && (
                            <span className="text-xs text-muted-foreground">{formatTime(chat.last_message_time)}</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{chat.last_message || 'No messages yet'}</p>
                      </div>
                      {chat.other_user?.online && (
                        <div className="w-2 h-2 rounded-full bg-success" />
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
              <div className="p-4 border-b">
                <Button onClick={() => setShowAddContact(true)} className="w-full">
                  <Icon name="UserPlus" size={18} className="mr-2" />
                  Add Contact
                </Button>
              </div>
              <ScrollArea className="flex-1">
                {contacts.map((contact) => (
                  <div key={contact.id} className="p-4 border-b hover:bg-accent cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={contact.avatar_url} />
                        <AvatarFallback className="bg-primary/20">{getInitials(contact)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-semibold">{contact.first_name} {contact.last_name}</p>
                        <p className="text-sm text-muted-foreground">@{contact.username}</p>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" onClick={() => createChat(contact.id)}>
                          <Icon name="MessageCircle" size={18} />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => startCall(contact, 'audio')}>
                          <Icon name="Phone" size={18} />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => startCall(contact, 'video')}>
                          <Icon name="Video" size={18} />
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
              <div className="p-8 text-center text-muted-foreground">
                <Icon name="Phone" size={48} className="mx-auto mb-2 opacity-50" />
                <p>No call history yet</p>
              </div>
            </ScrollArea>
          )}
        </Tabs>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b flex items-center justify-between bg-card">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={selectedChat.other_user?.avatar_url} />
                  <AvatarFallback className="bg-primary/20">{getInitials(selectedChat.other_user)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{selectedChat.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedChat.other_user?.online ? 'Online' : 'Offline'}
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
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((msg) => {
                  const isOwn = msg.sender_id === currentUser.id;
                  return (
                    <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                      <div className={`max-w-md ${isOwn ? 'order-2' : 'order-1'}`}>
                        <div
                          className={`rounded-2xl px-4 py-2 ${
                            isOwn ? 'bg-primary text-white' : 'bg-accent'
                          }`}
                        >
                          {!isOwn && (
                            <p className="text-xs font-semibold mb-1">{msg.sender.first_name}</p>
                          )}
                          <p>{msg.text}</p>
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
            <form onSubmit={sendMessage} className="p-4 border-t bg-card">
              <div className="flex gap-2">
                <Button type="button" size="icon" variant="ghost">
                  <Icon name="Paperclip" size={20} />
                </Button>
                <Button type="button" size="icon" variant="ghost">
                  <Icon name="Smile" size={20} />
                </Button>
                <Input
                  placeholder="Type a message..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" size="icon">
                  <Icon name="Send" size={20} />
                </Button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Icon name="MessageSquare" size={64} className="mx-auto mb-4 opacity-50" />
              <p className="text-lg">Select a chat to start messaging</p>
            </div>
          </div>
        )}
      </div>

      {/* Add Contact Dialog */}
      <Dialog open={showAddContact} onOpenChange={setShowAddContact}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
            <DialogDescription>Enter username to add as contact</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Username"
              value={newContactUsername}
              onChange={(e) => setNewContactUsername(e.target.value)}
            />
            <Button onClick={addContact} className="w-full">Add Contact</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Call Dialog */}
      {callState.active && (
        <Dialog open={callState.active} onOpenChange={() => endCall()}>
          <DialogContent className="max-w-4xl h-[600px] p-0">
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
                    className="absolute bottom-4 right-4 w-48 h-36 object-cover rounded-lg border-2 border-white"
                  />
                </>
              )}
              {callState.type === 'audio' && (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center text-white">
                    <Avatar className="w-32 h-32 mx-auto mb-4">
                      <AvatarImage src={callState.otherUser?.avatar_url} />
                      <AvatarFallback className="text-4xl">{getInitials(callState.otherUser)}</AvatarFallback>
                    </Avatar>
                    <p className="text-2xl font-semibold mb-2">
                      {callState.otherUser?.first_name} {callState.otherUser?.last_name}
                    </p>
                    <p className="text-muted-foreground">Audio call in progress...</p>
                  </div>
                </div>
              )}
              
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4">
                <Button size="icon" variant="secondary" className="h-14 w-14 rounded-full">
                  <Icon name="Mic" size={24} />
                </Button>
                {callState.type === 'video' && (
                  <Button size="icon" variant="secondary" className="h-14 w-14 rounded-full">
                    <Icon name="Video" size={24} />
                  </Button>
                )}
                <Button
                  size="icon"
                  onClick={endCall}
                  className="h-14 w-14 rounded-full bg-danger hover:bg-danger/90"
                >
                  <Icon name="PhoneOff" size={24} />
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default Index;
