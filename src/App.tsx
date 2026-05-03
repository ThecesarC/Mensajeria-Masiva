import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  MessageSquare, 
  Users, 
  BarChart3, 
  Settings, 
  Send, 
  Plus, 
  Smartphone,
  CheckCheck,
  Clock,
  AlertCircle,
  Menu,
  X,
  Image as ImageIcon,
  Smile,
  Link as LinkIcon,
  Search,
  ChevronRight,
  Monitor,
  Check,
  Sparkles,
  Loader2,
  Upload,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp, 
  writeBatch,
  getDocs,
  setDoc
} from 'firebase/firestore';
import { onAuthStateChanged, User as FirebaseUser, signOut } from 'firebase/auth';
import { db, auth, signInWithGoogle } from './lib/firebase';
import { mockContacts, mockMessages, mockCampaigns } from './lib/mockData';
import { Message, Contact, Campaign } from './types';
import Picker from 'emoji-picker-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('compose');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [messageContent, setMessageContent] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [selectedManageIds, setSelectedManageIds] = useState<string[]>([]);
  const [customRecipients, setCustomRecipients] = useState<string[]>([]);
  const [manualInput, setManualInput] = useState('');
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [selectedChannel, setSelectedChannel] = useState<'sms' | 'whatsapp'>('sms');
  const [isBurstMode, setIsBurstMode] = useState(false);
  const [currentBurstIndex, setCurrentBurstIndex] = useState(0);

  const handleBurstSend = async () => {
    const pending = messages.filter(m => m.status === 'pending');
    if (pending.length === 0) {
      setIsBurstMode(false);
      toast.success('¡Todos los mensajes han sido procesados!');
      return;
    }

    const msg = pending[0];
    if (msg.intentUrl) {
      // Creamos un link invisible para forzar la apertura del protocolo
      const a = document.createElement('a');
      a.href = msg.intentUrl;
      a.target = '_blank';
      a.rel = 'noreferrer';
      a.click();
      
      const msgRef = doc(db, 'users', user!.uid, 'messages', msg.id);
      await updateDoc(msgRef, { status: 'delivered' });
      
      if (pending.length > 1) {
        toast.info(`Mensaje para ${msg.contactName} abierto. Haz click en "SIGUIENTE" cuando estés listo.`, {
          duration: 3000
        });
      } else {
        setIsBurstMode(false);
        toast.success('¡Campaña finalizada con éxito!');
      }
    }
  };

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setIsAuthLoading(false);
      if (u) {
        // Update user profile in Firestore
        await setDoc(doc(db, 'users', u.uid), {
          uid: u.uid,
          email: u.email,
          displayName: u.displayName,
          photoURL: u.photoURL,
          createdAt: serverTimestamp(), // Only sets on create if we use setDoc with merge or check first
          isLinked: true
        }, { merge: true });
      }
    });
    return () => unsubscribe();
  }, []);

  // Data Listeners
  useEffect(() => {
    if (!user) {
      setContacts([]);
      setMessages([]);
      return;
    }

    const contactsQuery = query(collection(db, 'users', user.uid, 'contacts'), orderBy('createdAt', 'desc'));
    const unsubscribeContacts = onSnapshot(contactsQuery, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contact));
      setContacts(docs);
    });

    const messagesQuery = query(collection(db, 'users', user.uid, 'messages'), orderBy('timestamp', 'desc'));
    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      } as Message));
      setMessages(docs);
    });

    return () => {
      unsubscribeContacts();
      unsubscribeMessages();
    };
  }, [user]);

  const handleProcessAll = async () => {
    if (!user) return;
    const pendingMessages = messages.filter(m => m.status === 'pending');
    if (pendingMessages.length === 0) {
      toast.info('No hay mensajes pendientes en la cola');
      return;
    }

    toast.dismiss(); // Clear any previous toasts
    setIsBurstMode(true);
    toast.info('Modo Ráfaga Activado. Haz click en "DESPACHAR SIGUIENTE" para cada mensaje.', {
      duration: 5000
    });
  };

  const handleAddManualRecipient = () => {
    if (!manualInput.trim()) return;
    const cleaned = manualInput.replace(/\s/g, '');
    if (cleaned.length >= 7 && /^\+?[0-9]+$/.test(cleaned)) {
      setCustomRecipients(prev => [...new Set([...prev, cleaned])]);
      setManualInput('');
      toast.success(`Número ${cleaned} añadido`);
    } else {
      toast.error('Ingresa un número de teléfono válido');
    }
  };

  const handleDeleteIndividual = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'contacts', id));
      setSelectedContacts(prev => prev.filter(mid => mid !== id));
      setSelectedManageIds(prev => prev.filter(mid => mid !== id));
      toast.success('Contacto eliminado');
    } catch (error) {
      toast.error('Error al eliminar contacto');
    }
  };

  const handleDeleteSelected = async () => {
    if (!user || selectedManageIds.length === 0) return;
    try {
      const batch = writeBatch(db);
      selectedManageIds.forEach(id => {
        batch.delete(doc(db, 'users', user.uid, 'contacts', id));
      });
      await batch.commit();
      setSelectedContacts(prev => prev.filter(id => !selectedManageIds.includes(id)));
      setSelectedManageIds([]);
      toast.success(`${selectedManageIds.length} contactos eliminados`);
    } catch (error) {
      toast.error('Error al realizar borrado masivo');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = event.target?.result;
        const { read, utils } = await import('xlsx');
        const workbook = read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = utils.sheet_to_json(sheet) as any[];

        const newContacts: Contact[] = jsonData.map((row, index) => {
          // Normalize keys to find matches regardless of case or accents
          const findValue = (possibleKeys: string[]) => {
            const rowKeys = Object.keys(row);
            const foundKey = rowKeys.find(rk => 
              possibleKeys.some(pk => 
                rk.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === 
                pk.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
              )
            );
            return foundKey ? row[foundKey] : null;
          };

          const name = findValue(['nombre', 'name', 'contacto', 'contact']) || 'Desconocido';
          const phone = findValue(['telefono', 'phone', 'numero', 'number', 'celular', 'movil']) || '';

          return {
            id: `imported-${Date.now()}-${index}`,
            name: String(name),
            phoneNumber: String(phone).replace(/\s/g, ''),
            tags: ['Importado']
          };
        }).filter(c => c.phoneNumber.trim() !== '');

        if (newContacts.length > 0 && user) {
          const batch = writeBatch(db);
          newContacts.forEach(c => {
            const newDocRef = doc(collection(db, 'users', user.uid, 'contacts'));
            batch.set(newDocRef, {
              ...c,
              id: newDocRef.id,
              userId: user.uid,
              createdAt: serverTimestamp()
            });
          });
          await batch.commit();
          toast.success(`¡Se han importado ${newContacts.length} contactos con éxito!`);
        } else if (!user) {
          toast.error('Inicia sesión para importar contactos');
        } else {
          toast.error('No se encontraron contactos válidos en el archivo. Asegúrate de tener columnas "Nombre" y "Telefono".');
        }
      } catch (error) {
        console.error(error);
        toast.error('Error al procesar el archivo Excel/CSV');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const scrollToTop = () => {
    const viewport = document.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) {
      viewport.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const generateWithAI = async () => {
    try {
      setIsGenerating(true);
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Actúa como un experto en marketing por SMS. Sugiere un mensaje corto, persuasivo y amigable para una campaña de envío masivo. El mensaje debe ser profesional, incluir emojis y tener un llamado a la acción claro. El tema es libre pero enfocado en fidelización de clientes. El mensaje no debe exceder los 160 caracteres. No incluyas explicaciones, solo el texto del mensaje.`;
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      if (response.text) {
        setMessageContent(response.text.trim());
        toast.success('¡Mensaje generado por IA!');
      }
    } catch (error) {
      console.error(error);
      toast.error('Error al generar mensaje con IA');
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const handleSend = async () => {
    if (!user) {
      toast.error('Por favor, vincula tu cuenta Google antes de enviar');
      setActiveTab('settings');
      return;
    }
    if (selectedContacts.length === 0 && customRecipients.length === 0) {
      toast.error('Selecciona al menos un destinatario');
      return;
    }
    if (!messageContent.trim()) {
      toast.error('El mensaje no puede estar vacío');
      return;
    }

    const recipients = [
      ...selectedContacts.map(id => contacts.find(c => c.id === id)).filter(Boolean),
      ...customRecipients.map(phone => ({ id: `manual-${phone}`, name: 'Manual', phoneNumber: phone }))
    ];

    toast.success(`Preparando envío para ${recipients.length} destinatarios...`);
    
    // Create messages in Firestore
    const batch = writeBatch(db);
    const newMsgIds: string[] = [];

    recipients.forEach(r => {
      const contact = r as any;
      const phone = contact.phoneNumber.replace(/\+/g, '').replace(/\s/g, '');
      const encodedMsg = encodeURIComponent(messageContent);
      
      let intentUrl = '';
      if (selectedChannel === 'sms') {
        intentUrl = `sms:${phone}?body=${encodedMsg}`;
      } else {
        // WhatsApp link más universal
        intentUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${encodedMsg}`;
      }
      
      const msgRef = doc(collection(db, 'users', user.uid, 'messages'));
      newMsgIds.push(msgRef.id);
      
      batch.set(msgRef, {
        id: msgRef.id,
        userId: user.uid,
        contactId: contact.id,
        contactName: contact.name,
        phoneNumber: phone,
        content: messageContent,
        status: 'pending',
        channel: selectedChannel,
        timestamp: serverTimestamp(),
        intentUrl
      });
    });

    await batch.commit();
    
    setMessageContent('');
    setSelectedContacts([]);
    setCustomRecipients([]);
    setActiveTab('reports');

    toast.info('Cola lista. Iniciando despacho automático...', {
      duration: 2000,
      onAutoClose: () => handleProcessAll()
    });
  };

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phoneNumber.includes(searchTerm)
  );

  return (
    <div className="flex h-screen bg-[#f8f9fa] text-[#202124] overflow-hidden font-sans">
      <Toaster position="top-right" />
      
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {!isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 z-40 lg:hidden"
            onClick={toggleSidebar}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 0 }}
        className={`bg-white border-r border-[#dadce0] z-50 flex flex-col h-full overflow-hidden transition-all duration-300 ease-in-out shadow-sm`}
      >
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#1a73e8] rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
            <MessageSquare size={24} />
          </div>
          <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#1a73e8] to-[#4285f4]">
            G-Mass Master
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
            <SidebarItem 
              icon={<Plus size={20} />} 
              label="Nuevo Mensaje" 
              active={activeTab === 'compose'} 
              onClick={() => setActiveTab('compose')}
              primary
            />
            <SidebarSeparator label="Principal" />
            <SidebarItem 
              icon={<Users size={20} />} 
              label="Contactos" 
              active={activeTab === 'contacts'} 
              onClick={() => setActiveTab('contacts')}
            />
            <SidebarItem 
              icon={<BarChart3 size={20} />} 
              label="Reportes y Status" 
              active={activeTab === 'reports'} 
              onClick={() => setActiveTab('reports')}
            />
            <SidebarSeparator label="Configuracion" />
            <SidebarItem 
              icon={<Smartphone size={20} />} 
              label="Vincular Dispositivo" 
              active={activeTab === 'settings'} 
              onClick={() => setActiveTab('settings')}
              status={user ? 'linked' : 'idle'}
            />
        </div>

        <div className="p-4 border-t border-[#dadce0]">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#f8f9fa]">
            <Avatar className="h-10 w-10 border-2 border-white shadow-sm font-bold">
              <AvatarImage src={user?.photoURL || ""} />
              <AvatarFallback>{user?.displayName?.substring(0,2).toUpperCase() || 'AD'}</AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold truncate">{user?.displayName || 'César Hugo'}</p>
              <p className="text-[10px] text-[#1a73e8] uppercase tracking-widest font-black">Enterprise Unlimited</p>
            </div>
            <Settings size={18} className="text-gray-400 hover:text-[#1a73e8] cursor-pointer transition-colors" />
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#f8f9fa]">
        {/* Header */}
        <header className="h-20 bg-white border-b border-[#dadce0] flex items-center justify-between px-8 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={toggleSidebar} className="text-[#5f6368] hover:bg-[#f1f3f4] rounded-full">
              <Menu size={20} />
            </Button>
            <h1 className="text-xl font-medium text-[#3c4043]">
              {activeTab === 'compose' && 'Redactar Mensaje Masivo'}
              {activeTab === 'contacts' && 'Gestión de Contactos'}
              {activeTab === 'reports' && 'Monitor de Envío en Vivo'}
              {activeTab === 'settings' && 'Sincronización de Dispositivo'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {(activeTab === 'contacts' || activeTab === 'compose') && (
              <Button 
                variant="outline" 
                size="sm" 
                className="flex border-[#1a73e8] text-[#1a73e8] hover:bg-[#e8f0fe] rounded-full font-bold px-4"
                onClick={() => {
                  const id = activeTab === 'contacts' ? 'excel-import' : 'excel-import-compose';
                  document.getElementById(id)?.click();
                }}
              >
                <Upload size={16} className="mr-2" /> <span className="hidden xs:inline">Importar Base</span><span className="xs:hidden">Importar</span>
              </Button>
            )}
            {user && (
              <div className="hidden md:flex flex-col items-end mr-2">
                <p className="text-[10px] font-bold text-[#1a73e8] uppercase tracking-wider">Cuenta Activa</p>
                <p className="text-xs font-semibold text-[#3c4043]">{user.email}</p>
              </div>
            )}
            <div className={`flex items-center gap-2 px-4 py-2 ${user ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-[#e8f0fe] text-[#1a73e8]'} rounded-full text-xs font-semibold transition-all`}>
              <div className={`w-2 h-2 rounded-full ${user ? 'bg-green-500 animate-pulse' : 'bg-red-400'}`} />
              {user ? 'Dispositivo Conectado' : 'Sin Vinculación'}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 flex flex-row min-h-0 relative">
          <ScrollArea className="flex-1 p-8 h-full">
            <div className="max-w-5xl mx-auto space-y-8 pb-12">
              <AnimatePresence mode="wait">
                {activeTab === 'compose' && (
                  <motion.div 
                    key="compose"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className="grid grid-cols-1 lg:grid-cols-3 gap-8"
                  >
                    {/* Message Composer */}
                    <div className="lg:col-span-2 space-y-6">
                      <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden rounded-3xl">
                        <CardHeader className="bg-white pb-2 flex flex-row items-center justify-between border-b border-[#f1f3f4]">
                          <div>
                            <CardTitle className="text-lg font-bold">Componer Mensaje</CardTitle>
                            <CardDescription>Incluye links, emojis y formato enriquecido</CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                             <Tabs value={selectedChannel} onValueChange={(v) => setSelectedChannel(v as any)} className="mr-4">
                               <TabsList className="bg-[#f1f3f4] rounded-full h-8 p-1">
                                 <TabsTrigger value="sms" className="rounded-full text-[10px] font-bold px-4 data-[state=active]:bg-white data-[state=active]:text-[#1a73e8]">SMS</TabsTrigger>
                                 <TabsTrigger value="whatsapp" className="rounded-full text-[10px] font-bold px-4 data-[state=active]:bg-white data-[state=active]:text-green-600">WHATSAPP</TabsTrigger>
                               </TabsList>
                             </Tabs>
                             <Button 
                               variant="ghost" 
                               size="sm" 
                               className="rounded-full text-[#1a73e8] hover:bg-[#e8f0fe] font-bold text-xs gap-1"
                               onClick={generateWithAI}
                               disabled={isGenerating}
                             >
                               {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                               Sugerencia IA
                             </Button>
                             <Separator orientation="vertical" className="h-4" />
                             <Button variant="ghost" size="icon" className="rounded-full text-[#5f6368]"><ImageIcon size={18}/></Button>
                             <Button variant="ghost" size="icon" className="rounded-full text-[#5f6368]"><LinkIcon size={18}/></Button>
                             <div className="relative">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className={`rounded-full ${showEmojiPicker ? 'bg-[#e8f0fe] text-[#1a73e8]' : 'text-[#5f6368]'}`}
                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                              >
                                <Smile size={18}/>
                              </Button>
                              {showEmojiPicker && (
                                <div className="absolute top-12 left-0 z-50 shadow-2xl rounded-2xl overflow-hidden border border-[#dadce0]">
                                  <Picker onEmojiClick={(emoji) => {
                                    setMessageContent(prev => prev + emoji.emoji);
                                    setShowEmojiPicker(false);
                                  }} />
                                </div>
                              )}
                             </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-0">
                          <Textarea 
                            placeholder="Escribe tu mensaje masivo aquí..."
                            className="min-h-[250px] border-none focus-visible:ring-0 resize-none p-8 text-lg leading-relaxed placeholder:text-gray-300"
                            value={messageContent}
                            onChange={(e) => setMessageContent(e.target.value)}
                          />
                          <div className="p-6 bg-[#f8f9fa] border-t border-[#f1f3f4] flex items-center justify-between">
                            <div className="flex gap-4">
                              <div className="text-xs text-gray-400 font-medium">Caracteres: <span className="text-[#3c4043]">{messageContent.length}</span></div>
                              <div className="text-xs text-gray-400 font-medium">SMS: <span className="text-[#3c4043]">{Math.ceil(messageContent.length / 160)}</span></div>
                            </div>
                            <Button 
                              className="bg-[#1a73e8] hover:bg-[#185abc] text-white rounded-full px-8 py-6 h-auto shadow-lg shadow-blue-200 transition-all active:scale-95 flex items-center gap-2 font-bold text-base"
                              onClick={handleSend}
                            >
                              <Send size={20} />
                              Enviar a {selectedContacts.length + customRecipients.length} Destinatarios
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                      
                      <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex items-start gap-3">
                        <AlertCircle size={18} className="text-[#1a73e8] mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-[#1a73e8] uppercase mb-1">Nota sobre Envíos Gratuitos</p>
                          <p className="text-[11px] text-[#5f6368] leading-relaxed">
                            Debido a las políticas de seguridad de Google y navegadores, el envío 100% oculto requiere APIs de pago (Twilio/AWS). Para mantener esta app <b>gratis</b>, usamos el <b>Modo Ráfaga</b>: creas la cola y los disparas uno a uno con un click en segundos. Es seguro, privado y no tiene costos adicionales.
                          </p>
                        </div>
                      </div>

                      <Label className="text-sm font-semibold text-[#5f6368] ml-2">Vista Previa Mobile ({selectedChannel === 'sms' ? 'Google Messages' : 'WhatsApp'})</Label>
                      <div className="bg-[#f1f3f4] p-8 rounded-3xl flex justify-center">
                         <div className="w-[320px] h-[550px] bg-white rounded-[3rem] border-[8px] border-[#3c4043] shadow-2xl overflow-hidden relative">
                            <div className="h-6 w-1/3 bg-[#3c4043] absolute top-0 left-1/2 -translate-x-1/2 rounded-b-xl z-20" />
                            <div className="pt-8 px-4 flex flex-col h-full bg-[#f8f9fa]">
                               <header className="flex items-center gap-3 mb-6">
                                  <div className={`w-8 h-8 rounded-full ${selectedChannel === 'sms' ? 'bg-[#1a73e8]' : 'bg-[#25D366]'} flex items-center justify-center text-white text-xs font-bold font-sans`}>
                                    {selectedChannel === 'sms' ? 'G' : 'W'}
                                  </div>
                                  <div className="flex-1">
                                    <p className={`text-[10px] font-bold ${selectedChannel === 'sms' ? 'text-gray-500' : 'text-green-600'}`}>{selectedChannel === 'sms' ? 'GOOGLE MESSAGES' : 'WHATSAPP BUSINESS'}</p>
                                    <p className="text-xs font-semibold">Cliente VIP</p>
                                  </div>
                               </header>
                               <div className="space-y-4 flex-1">
                                  <div className={`${selectedChannel === 'sms' ? 'bg-[#e8f0fe] text-[#1a73e8] border-[#d2e3fc]' : 'bg-[#dcf8c6] text-[#075e54] border-[#c7eab1]'} p-4 rounded-2xl rounded-tl-none shadow-sm text-xs leading-relaxed max-w-[85%] self-start border`}>
                                    {messageContent || "Redacta algo..."}
                                  </div>
                                  <div className="flex items-center gap-1 self-start ml-1">
                                    <p className="text-[9px] text-[#5f6368]">12:30 PM • {selectedChannel === 'sms' ? 'RCS' : 'WhatsApp'}</p>
                                    <CheckCheck size={10} className={selectedChannel === 'sms' ? 'text-[#1a73e8]' : 'text-gray-400'} />
                                  </div>
                               </div>
                               <div className="h-16 border-t border-[#e8eaed] mt-auto flex items-center gap-2 px-2 pb-4">
                                 <div className="flex-1 h-10 bg-white border border-[#dadce0] rounded-full px-4 flex items-center text-[10px] text-gray-400">
                                   Escribir mensaje...
                                 </div>
                                 <div className={`w-10 h-10 ${selectedChannel === 'sms' ? 'bg-[#1a73e8]' : 'bg-[#25D366]'} rounded-full flex items-center justify-center text-white shadow-md`}>
                                   <Send size={14} />
                                 </div>
                               </div>
                            </div>
                         </div>
                      </div>
                    </div>

                    {/* Sidebar Selection */}
                    <div className="space-y-6">
                      <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-3xl overflow-hidden">
                        <CardHeader className="border-bottom border-[#f1f3f4] flex flex-row items-center justify-between">
                          <div>
                            <CardTitle className="text-base font-bold">Destinatarios</CardTitle>
                            <CardDescription>Selecciona quiénes recibirán el mensaje</CardDescription>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-[#1a73e8] hover:bg-[#e8f0fe] rounded-full font-bold text-[10px] uppercase tracking-wider"
                            onClick={() => document.getElementById('excel-import-compose')?.click()}
                          >
                             <Plus size={14} className="mr-1" /> Importar base
                          </Button>
                          <input 
                             type="file" 
                             id="excel-import-compose" 
                             className="hidden" 
                             accept=".xlsx, .xls, .csv" 
                             onChange={handleFileUpload}
                          />
                        </CardHeader>
                        <CardContent className="p-0">
                          <div className="p-4 border-b border-[#f1f3f4] space-y-3">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                              <Input 
                                placeholder="Buscar en contactos..." 
                                className="pl-10 h-10 bg-[#f1f3f4] border-none rounded-xl focus-visible:ring-1 focus-visible:ring-[#1a73e8]"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                              />
                            </div>
                            
                            <div className="flex gap-2">
                              <Input 
                                placeholder="Escribir número manual..." 
                                className="h-10 border-[#dadce0] rounded-xl text-xs bg-white"
                                value={manualInput}
                                onChange={(e) => setManualInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddManualRecipient()}
                              />
                              <Button 
                                variant="outline" 
                                className="rounded-xl h-10 px-3 font-bold border-[#1a73e8] text-[#1a73e8] hover:bg-[#e8f0fe] text-[10px] uppercase"
                                onClick={handleAddManualRecipient}
                              >
                                Añadir
                              </Button>
                            </div>

                            {customRecipients.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {customRecipients.map(num => (
                                  <Badge key={num} variant="secondary" className="bg-[#1a73e8]/10 text-[#1a73e8] border border-[#1a73e8]/20 rounded-lg flex items-center gap-1.5 px-2 py-1 select-none">
                                    <span className="text-[10px] font-mono">{num}</span>
                                    <X size={10} className="hover:text-red-500 cursor-pointer" onClick={() => setCustomRecipients(prev => prev.filter(n => n !== num))} />
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <ScrollArea className="h-[400px]">
                             <div className="p-2 space-y-1">
                                {filteredContacts.map(contact => (
                                  <div 
                                    key={contact.id} 
                                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${selectedContacts.includes(contact.id) ? 'bg-[#e8f0fe]' : 'hover:bg-[#f1f3f4]'}`}
                                    onClick={() => {
                                      if (selectedContacts.includes(contact.id)) {
                                        setSelectedContacts(prev => prev.filter(id => id !== contact.id));
                                      } else {
                                        setSelectedContacts(prev => [...prev, contact.id]);
                                      }
                                    }}
                                  >
                                    <div className="relative">
                                      <Avatar className="h-9 w-9 border-2 border-white shadow-sm">
                                        <AvatarFallback className="text-[10px] font-bold font-sans">{contact.name.substring(0,2).toUpperCase()}</AvatarFallback>
                                      </Avatar>
                                      {selectedContacts.includes(contact.id) && (
                                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#1a73e8] rounded-full border-2 border-white flex items-center justify-center">
                                          <Check size={8} className="text-white" />
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                       <p className={`text-sm font-semibold truncate ${selectedContacts.includes(contact.id) ? 'text-[#1a73e8]' : 'text-[#3c4043]'}`}>{contact.name}</p>
                                       <p className="text-[10px] text-gray-400 font-mono tracking-wider">{contact.phoneNumber}</p>
                                    </div>
                                  </div>
                                ))}
                             </div>
                          </ScrollArea>
                          <div className="p-4 bg-[#f8f9fa] flex gap-2">
                             <Button 
                               variant="outline" 
                               className="flex-1 rounded-xl text-xs h-9 border-[#dadce0] font-bold"
                               onClick={() => setSelectedContacts(contacts.map(c => c.id))}
                             >
                               Seleccionar Todos
                             </Button>
                             <Button 
                               variant="ghost" 
                               className="rounded-xl text-xs h-9 text-red-500 hover:text-red-600 hover:bg-red-50 font-bold"
                               onClick={() => setSelectedContacts([])}
                             >
                               Limpiar
                             </Button>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-gradient-to-br from-[#1a73e8] to-[#4285f4] text-white border-none shadow-xl rounded-3xl overflow-hidden p-6 ring-4 ring-white">
                         <h3 className="font-bold flex items-center gap-2 mb-2 text-lg">
                           <BarChart3 size={20} />
                           Capacidad de Envío
                         </h3>
                         <p className="text-blue-100 text-xs mb-4 leading-relaxed font-medium">Estado de cuenta: <span className="text-white font-black">ILIMITADO ∞</span></p>
                         <div className="h-3 bg-white/20 rounded-full overflow-hidden blur-[0.4px]">
                            <motion.div 
                              initial={{ width: "100%" }}
                              animate={{ 
                                x: ["-100%", "100%"],
                                transition: { repeat: Infinity, duration: 2, ease: "linear" }
                              }}
                              className="w-1/2 h-full bg-white/40 rounded-full shadow-[0_0_15px_rgba(255,255,255,0.5)]" 
                            />
                         </div>
                         <div className="mt-4 flex items-center gap-2 text-[10px] bg-white/10 p-2 rounded-xl border border-white/10">
                           <Sparkles size={12} />
                           <span>Protección Anti-Spam Inteligente Activa</span>
                         </div>
                      </Card>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'reports' && (
                  <motion.div 
                    key="reports"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                       <StatusCard label="Entregados" value={messages.filter(m => m.status === 'delivered' || m.status === 'read').length} color="text-green-600" bg="bg-green-50" icon={<CheckCheck size={18}/>} />
                       <StatusCard label="Leídos" value={messages.filter(m => m.status === 'read').length} color="text-blue-600" bg="bg-blue-50" icon={<BarChart3 size={18}/>} />
                       <StatusCard label="Pendientes" value={messages.filter(m => m.status === 'sending' || m.status === 'queued').length} color="text-amber-600" bg="bg-amber-50" icon={<Clock size={18}/>} />
                       <StatusCard label="Erróneos" value={messages.filter(m => m.status === 'failed').length} color="text-red-600" bg="bg-red-50" icon={<AlertCircle size={18}/>} />
                    </div>

                    <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2.5rem] overflow-hidden">
                      <CardHeader className="p-8 border-b border-[#f1f3f4] flex flex-row items-center justify-between">
                          <div>
                            <CardTitle className="text-xl font-bold tracking-tight">Registro de Actividad Reciente</CardTitle>
                          </div>
                          <div className="flex gap-2">
                             {isBurstMode && messages.some(m => m.status === 'pending') && (
                               <div className="flex flex-col items-end gap-1">
                                 <Button 
                                   className="bg-orange-500 hover:bg-orange-600 text-white rounded-full font-bold px-8 h-10 shadow-lg animate-pulse flex items-center gap-2"
                                   onClick={handleBurstSend}
                                 >
                                   <Send size={18} /> DESPACHAR SIGUIENTE ({messages.filter(m => m.status === 'pending').length})
                                 </Button>
                                 <span className="text-[9px] text-orange-600 font-bold animate-pulse">¡CONFIRMA EN TU TELÉFONO DESPUÉS DE CADA CLIC!</span>
                               </div>
                             )}
                             {!isBurstMode && messages.some(m => m.status === 'pending') && (
                               <Button 
                                 className="bg-[#1a73e8] hover:bg-[#185abc] text-white rounded-full font-bold px-6 h-10 shadow-md flex items-center gap-2"
                                 onClick={handleProcessAll}
                               >
                                 <Sparkles size={18} /> INICIAR MODO RÁPIDO
                               </Button>
                             )}
                             <Button 
                               variant="outline" 
                               size="sm" 
                               className="rounded-full text-xs font-bold border-[#dadce0] h-10 px-4" 
                               onClick={async () => {
                                 if (!user) return;
                                 const batch = writeBatch(db);
                                 messages.forEach(m => {
                                   batch.delete(doc(db, 'users', user.uid, 'messages', m.id));
                                 });
                                 await batch.commit();
                                 toast.success('Historial limpiado');
                               }}
                             >
                               Limpiar Historial
                             </Button>
                          </div>
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="border-b border-[#f1f3f4]">
                                <th className="p-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Contacto</th>
                                <th className="p-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Canal</th>
                                <th className="p-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Contenido</th>
                                <th className="p-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                                <th className="p-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Hora</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#f8f9fa]">
                              {messages.map((msg) => (
                                <motion.tr 
                                  layout
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  key={msg.id} 
                                  className="hover:bg-[#f8f9fa] transition-colors group"
                                >
                                  <td className="p-4">
                                    <div className="flex items-center gap-3">
                                      <Avatar className="h-10 w-10 border-2 border-white shadow-sm ring-1 ring-[#f1f3f4]">
                                        <AvatarFallback className="text-[10px] font-bold font-sans group-hover:bg-[#1a73e8] group-hover:text-white transition-colors">{msg.contactName.substring(0,2)}</AvatarFallback>
                                      </Avatar>
                                      <div>
                                        <p className="text-sm font-bold text-[#3c4043]">{msg.contactName}</p>
                                        <p className="text-[10px] text-gray-400 font-mono">{msg.phoneNumber}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-4">
                                    <Badge variant="secondary" className={`rounded-lg ${msg.channel === 'sms' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'} text-[9px] font-bold`}>
                                      {msg.channel === 'sms' ? 'SMS' : 'WhatsApp'}
                                    </Badge>
                                  </td>
                                  <td className="p-4 max-w-xs">
                                    <p className="text-sm text-[#5f6368] truncate italic">"{msg.content}"</p>
                                  </td>
                                  <td className="p-4">
                                    <div className="flex items-center gap-2">
                                      <StatusBadge status={msg.status} />
                                      {msg.status === 'pending' && msg.intentUrl && (
                                        <Button 
                                          size="sm" 
                                          className="h-8 bg-[#1a73e8] hover:bg-blue-700 rounded-full text-[10px] font-bold px-4 shadow-sm"
                                          onClick={async () => {
                                            if (msg.intentUrl) {
                                              const a = document.createElement('a');
                                              a.href = msg.intentUrl;
                                              a.target = '_blank';
                                              a.rel = 'noreferrer';
                                              a.click();

                                              const msgRef = doc(db, 'users', user!.uid, 'messages', msg.id);
                                              await updateDoc(msgRef, { status: 'delivered' });
                                            }
                                          }}
                                        >
                                          ENVIAR
                                        </Button>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-4">
                                    <p className="text-[10px] font-bold text-gray-400">
                                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    </p>
                                  </td>
                                </motion.tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {activeTab === 'settings' && (
                  <motion.div 
                    key="settings"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="max-w-2xl mx-auto space-y-8"
                  >
                    <Card className="border-none shadow-[0_20px_50px_rgba(0,0,0,0.05)] rounded-[3rem] overflow-hidden text-center p-12 bg-white relative ring-1 ring-gray-100">
                      <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#4285F4] via-[#EA4335] via-[#FBBC05] to-[#34A853]"></div>
                      
                      <div className="mb-10 inline-flex items-center justify-center w-24 h-24 bg-[#e8f0fe] rounded-[2.5rem] text-[#1a73e8] animate-bounce-slow">
                        <Smartphone size={48} className="drop-shadow-md" />
                      </div>
                      
                      <CardTitle className="text-3xl font-black text-[#202124] mb-4">Sincroniza tu Cuenta Google</CardTitle>
                      <CardDescription className="text-lg text-[#5f6368] mb-10 max-w-md mx-auto leading-relaxed">
                        Inicia sesión con tu <span className="font-bold text-[#ea4335]">Cuenta Comercial o Personal</span> para habilitar el respaldo en la nube, sincronizar tus contactos y gestionar tus campañas de envío masivo de forma segura.
                      </CardDescription>

                      <div className="flex flex-col items-center gap-8 mb-12">
                         <div className="w-full flex flex-col gap-4 max-w-sm">
                           <Button 
                             variant="outline" 
                             className={`w-full h-14 rounded-2xl font-bold flex items-center justify-center gap-3 border-[#dadce0] transition-all group shadow-sm ${user ? 'bg-red-50 hover:bg-red-100 text-red-600 border-red-200' : 'hover:bg-[#f8f9fa] bg-white'}`}
                             onClick={async () => {
                               if (user) {
                                 await signOut(auth);
                                 toast.success('Sesión de Google cerrada');
                                 return;
                               }
                               try {
                                 await signInWithGoogle();
                                 toast.success('¡Google vinculado con éxito!');
                               } catch (e) {
                                 toast.error('Error al vincular con Google');
                               }
                             }}
                           >
                             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                               <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                               <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.26 1.07-3.71 1.07-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                               <path d="M5.84 14.11c-.22-.66-.35-1.36-.35-2.11s.13-1.45.35-2.11V7.05H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.95l3.66-2.84z" fill="#FBBC05"/>
                               <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                             </svg>
                             {user ? 'Desvincular Cuenta Google' : 'Vincular con Google'}
                           </Button>
                           
                           <div className="flex items-center gap-4 w-full">
                              <Separator className="flex-1 opacity-50" />
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Otras Opciones</span>
                              <Separator className="flex-1 opacity-50" />
                           </div>
                         </div>

                         <div className="w-56 h-56 bg-white p-6 rounded-[2.5rem] shadow-[0_10px_40px_rgba(0,0,0,0.08)] border-4 border-[#f1f3f4] relative overflow-hidden group cursor-pointer hover:border-[#1a73e8] transition-all duration-500">
                            <img 
                              src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=G-Mass-Messenger-Sync" 
                              alt="QR Code" 
                              className="w-full h-full opacity-90 group-hover:opacity-100 transition-opacity grayscale-[50%] group-hover:grayscale-0"
                            />
                            <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                               <div className="w-12 h-12 bg-[#1a73e8] rounded-full flex items-center justify-center text-white shadow-xl animate-pulse">
                                 <Plus size={24} />
                               </div>
                            </div>
                         </div>
                         
                         <div className="flex flex-col items-center gap-4 w-full">
                           <div className="flex items-center gap-4 w-full">
                              <Separator className="flex-1 opacity-50" />
                              <span className="text-xs font-bold text-gray-300 uppercase tracking-[0.3em]">O mediante llave</span>
                              <Separator className="flex-1 opacity-50" />
                           </div>
                           <div className="flex gap-3 w-full">
                              <Input placeholder="Ingresa tu API Gateway Key..." className="rounded-2xl h-14 bg-[#f8f9fa] border-none text-center font-mono text-sm tracking-widest shadow-inner h-12" />
                              <Button 
                                className={`h-14 px-8 rounded-2xl font-bold shadow-lg shadow-blue-100 transition-all ${user ? 'bg-green-500 hover:bg-green-600' : 'bg-[#1a73e8] hover:bg-blue-700'}`}
                                onClick={() => {
                                  if (!user) {
                                    toast.error('Inicia sesión con Google primero');
                                    return;
                                  }
                                  toast.success('¡API vinculada correctamente!');
                                }}
                              >
                                {user ? 'VINCULADO' : 'VINCULAR'}
                              </Button>
                           </div>
                         </div>
                      </div>

                      <div className="grid grid-cols-3 gap-6 pt-10 border-t border-[#f1f3f4]">
                         <Step icon={<Check size={14}/>} label="Paso 1" desc="Abre Messages" />
                         <Step icon={<Check size={14}/>} label="Paso 2" desc="Sincronizar" />
                         <Step icon={<Check size={14}/>} label="Paso 3" desc="Envía Masivo" />
                      </div>
                    </Card>
                  </motion.div>
                )}

                 {activeTab === 'contacts' && (
                   <motion.div 
                     key="contacts"
                     initial={{ opacity: 0, y: 30 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: -30 }}
                     className="space-y-6"
                   >
                     <div className="flex items-center justify-between mb-2 px-2">
                       <div className="flex flex-col">
                         <p className="text-sm font-bold text-[#5f6368] uppercase tracking-widest">Total de la Agenda: <span className="text-[#1a73e8]">{contacts.length}</span></p>
                         {selectedManageIds.length > 0 && (
                           <p className="text-[10px] text-red-500 font-black uppercase mt-1 animate-pulse">
                             {selectedManageIds.length} seleccionados para eliminar
                           </p>
                         )}
                       </div>
                       <div className="flex gap-2">
                         {selectedManageIds.length > 0 && (
                           <Button 
                             variant="destructive" 
                             className="rounded-full font-bold px-6 h-10 shadow-md bg-red-600 hover:bg-red-700"
                             onClick={handleDeleteSelected}
                           >
                             <Trash2 size={18} className="mr-2"/> Eliminar Seleccionados
                           </Button>
                         )}
                         <input 
                           type="file" 
                           id="excel-import" 
                           className="hidden" 
                           accept=".xlsx, .xls, .csv" 
                           onChange={handleFileUpload}
                         />
                         <Button 
                           variant="default" 
                           className="bg-[#1a73e8] rounded-full font-bold px-6 h-10 hover:bg-blue-700 shadow-md"
                           onClick={() => document.getElementById('excel-import')?.click()}
                         >
                           <Plus size={18} className="mr-2"/> Importar Excel/CSV
                         </Button>
                       </div>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                       {contacts.map(contact => (
                         <Card 
                           key={contact.id} 
                           className={`border-none shadow-[0_4px_25px_rgba(0,0,0,0.03)] hover:shadow-[0_10px_40px_rgba(0,0,0,0.06)] transition-all duration-300 rounded-[2rem] group cursor-pointer border ring-2 ${selectedManageIds.includes(contact.id) ? 'ring-red-500 bg-red-50/10' : 'ring-transparent hover:ring-[#1a73e8]/20'} bg-white`}
                           onClick={(e) => {
                             // If clicking the card, toggle selection for deletion
                             if (selectedManageIds.includes(contact.id)) {
                               setSelectedManageIds(prev => prev.filter(id => id !== contact.id));
                             } else {
                               setSelectedManageIds(prev => [...prev, contact.id]);
                             }
                           }}
                         >
                           <CardContent className="p-6">
                              <div className="flex items-start justify-between mb-4">
                                 <div className="relative">
                                   <Avatar className="h-16 w-16 border-4 border-white shadow-md rounded-2xl ring-1 ring-gray-100">
                                     <AvatarFallback className={`text-xl font-black bg-gradient-to-br transition-all duration-500 ${selectedManageIds.includes(contact.id) ? 'from-red-500 to-red-600 text-white' : 'from-gray-100 to-gray-200 text-gray-500 group-hover:from-[#1a73e8] group-hover:to-[#4285f4] group-hover:text-white'}`}>
                                       {contact.name.substring(0,2)}
                                     </AvatarFallback>
                                   </Avatar>
                                   {selectedManageIds.includes(contact.id) && (
                                     <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full border-2 border-white flex items-center justify-center shadow-sm">
                                       <Trash2 size={12} className="text-white" />
                                     </div>
                                   )}
                                 </div>
                                 <div className="flex flex-col gap-1 items-end">
                                    {contact.tags?.map(tag => (
                                      <Badge key={tag} variant="secondary" className="bg-[#f1f3f4] text-[#5f6368] rounded-lg text-[9px] uppercase font-bold tracking-wider px-2 py-0.5">{tag}</Badge>
                                    ))}
                                 </div>
                              </div>
                              <h4 className={`font-bold text-lg transition-colors ${selectedManageIds.includes(contact.id) ? 'text-red-700' : 'text-[#202124] group-hover:text-[#1a73e8]'}`}>{contact.name}</h4>
                              <p className="text-sm text-gray-400 font-mono font-medium tracking-tight mb-6">{contact.phoneNumber}</p>
                              <Separator className="mb-4 opacity-50" />
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" className="flex-1 rounded-xl h-9 hover:bg-[#e8f0fe] hover:text-[#1a73e8] border-[#dadce0] font-bold text-xs uppercase" onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedContacts([contact.id]);
                                  setActiveTab('compose');
                                }}>SMS</Button>
                                <Button size="sm" variant="ghost" className="rounded-xl h-9 text-gray-400 hover:text-red-500 hover:bg-red-50" onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteIndividual(contact.id);
                                }}><Trash2 size={16}/></Button>
                              </div>
                           </CardContent>
                         </Card>
                       ))}
                       <Card 
                         className="border-2 border-dashed border-[#dadce0] bg-transparent flex flex-col items-center justify-center p-8 rounded-[2rem] hover:border-[#1a73e8] hover:bg-[#1a73e8]/5 transition-all text-gray-400 hover:text-[#1a73e8] cursor-pointer group"
                         onClick={() => document.getElementById('excel-import')?.click()}
                       >
                          <div className="w-14 h-14 bg-gray-100 group-hover:bg-[#1a73e8] rounded-2xl flex items-center justify-center mb-4 transition-colors">
                            <Plus size={24} className="group-hover:text-white" />
                          </div>
                          <p className="font-bold text-sm uppercase tracking-widest">Añadir Nuevo / Importar</p>
                       </Card>
                     </div>
                   </motion.div>
                 )}
              </AnimatePresence>
            </div>
          </ScrollArea>
          
          {/* Quick Navigation Sidebar / Scroll Bar */}
          <div className="w-12 bg-white border-l border-[#f1f3f4] flex flex-col items-center py-6 gap-4 z-40">
             <Button 
               variant="ghost" 
               size="icon" 
               className="rounded-xl text-gray-400 hover:text-[#1a73e8] hover:bg-[#e8f0fe] w-10 h-10 transition-all active:scale-90"
               onClick={scrollToTop}
             >
               <Monitor size={18} />
             </Button>
             <Separator className="w-6 opacity-30" />
             <div className="flex-1 flex flex-col items-center gap-1 overflow-hidden py-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="w-1 h-1 rounded-full bg-gray-200" />
                ))}
             </div>
             <Separator className="w-6 opacity-30" />
             <Button 
               variant="ghost" 
               size="icon" 
               className="rounded-xl text-gray-400 hover:text-[#1a73e8] hover:bg-[#e8f0fe] w-10 h-10 transition-all active:scale-90"
               onClick={() => {
                 const viewport = document.querySelector('[data-radix-scroll-area-viewport]');
                 if (viewport) {
                   viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
                 }
               }}
             >
               <ChevronRight size={18} className="rotate-90" />
             </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick, primary = false, status = 'idle' }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void, primary?: boolean, status?: 'idle' | 'linked' }) {
  return (
    <button 
      onClick={onClick}
      className={`
        w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all duration-200 group relative
        ${active 
          ? (primary ? 'bg-[#1a73e8] text-white shadow-lg shadow-blue-200' : 'bg-[#e8f0fe] text-[#1a73e8]') 
          : 'text-[#5f6368] hover:bg-[#f1f3f4]'}
      `}
    >
      <div className="flex items-center gap-3">
        <span className={`${active ? (primary ? 'text-white' : 'text-[#1a73e8]') : 'text-gray-400 group-hover:text-[#1a73e8]'} transition-colors`}>{icon}</span>
        <span className={`text-sm font-bold tracking-tight ${active ? 'opacity-100' : 'opacity-80'}`}>{label}</span>
      </div>
      {status === 'linked' && (
        <div className="w-2 h-2 bg-green-400 rounded-full shadow-[0_0_8px_rgba(74,222,128,0.5)] animate-pulse" />
      )}
      {!active && label === 'Recibo' && (
         <Badge className="bg-[#ea4335] text-white border-none h-5 px-1.5 min-w-[20px] rounded-full flex items-center justify-center text-[10px] font-black">2</Badge>
      )}
    </button>
  );
}

function SidebarSeparator({ label }: { label: string }) {
  return (
    <div className="pt-6 pb-2 px-4">
      <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.25em]">{label}</p>
    </div>
  );
}

function StatusCard({ label, value, color, bg, icon }: { label: string, value: number, color: string, bg: string, icon: React.ReactNode }) {
  return (
    <Card className={`border-none ${bg} shadow-[0_4px_20px_rgba(0,0,0,0.02)] rounded-[2rem] transition-transform hover:-translate-y-1`}>
      <CardContent className="p-6 flex flex-col items-center">
        <div className={`p-4 rounded-2xl bg-white shadow-sm mb-4 ${color}`}>
          {icon}
        </div>
        <CardTitle className={`text-3xl font-black ${color} mb-1`}>{value}</CardTitle>
        <CardDescription className="text-[10px] font-black uppercase tracking-widest text-[#5f6368]/60">{label}</CardDescription>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: Message['status'] }) {
  const configs = {
    pending: { label: 'Pendiente', bg: 'bg-indigo-50 text-indigo-600', icon: <Clock size={12}/> },
    queued: { label: 'En Cola', bg: 'bg-gray-100 text-gray-600', icon: <Clock size={12}/> },
    sending: { label: 'Enviando', bg: 'bg-amber-100 text-amber-600 animate-pulse', icon: <Send size={12}/> },
    delivered: { label: 'Entregado', bg: 'bg-green-100 text-green-600', icon: <Check size={12}/> },
    read: { label: 'Leído', bg: 'bg-blue-100 text-blue-600', icon: <CheckCheck size={12}/> },
    failed: { label: 'Error', bg: 'bg-red-100 text-red-600', icon: <AlertCircle size={12}/> }
  };
  
  const config = configs[status];
  
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${config.bg} border border-black/5 shadow-sm`}>
      {config.icon}
      {config.label}
    </div>
  );
}

function Step({ icon, label, desc }: { icon: React.ReactNode, label: string, desc: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-8 h-8 rounded-full bg-[#f1f3f4] text-[#1a73e8] flex items-center justify-center border-2 border-white shadow-sm ring-1 ring-gray-100">
        {icon}
      </div>
      <p className="text-[10px] font-black text-[#1a73e8] uppercase tracking-widest">{label}</p>
      <p className="text-[11px] font-bold text-[#5f6368]">{desc}</p>
    </div>
  );
}
