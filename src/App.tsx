/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Search, History, BookOpen, Trash2, ArrowRight, Info, Plus, Edit2, X, Save, Settings, LogIn, LogOut, Upload, Download, FileSpreadsheet, Loader2, Bell, BellOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { initialWords, type WordEntry } from './data/initialWords.ts';
import { 
  db, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, limit, onSnapshot, getDocFromServer,
  OperationType, handleFirestoreError 
} from './lib/firebase.ts';

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [words, setWords] = useState<WordEntry[]>([]);
  const [result, setResult] = useState<WordEntry | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginCreds, setLoginCreds] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Admin Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<WordEntry>({ word: '', category: 'Nomina', definition: '', examples: ['', ''] });

  // Auth Helper (Local)
  const verifyAdmin = (email: string, pass: string) => {
    // Basic verification without Firebase
    return email === 'yokotenkaizen@gmail.com' && pass === 'leksikonyokoten123';
  };

  // Listen for Auth Changes (Manual/Local)
  useEffect(() => {
    const savedUser = localStorage.getItem('leksikon_admin_session');
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        if (u.email === 'yokotenkaizen@gmail.com') {
          setUser(u);
          setIsAdmin(true);
        }
      } catch (e) {
        localStorage.removeItem('leksikon_admin_session');
      }
    }

    // Load Notification Preference
    const notifPref = localStorage.getItem('leksikon_notifications');
    if (notifPref === 'enabled') {
      setNotificationsEnabled(true);
    }
  }, []);

  const toggleNotifications = async () => {
    if (notificationsEnabled) {
      setNotificationsEnabled(false);
      localStorage.setItem('leksikon_notifications', 'disabled');
    } else {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationsEnabled(true);
        localStorage.setItem('leksikon_notifications', 'enabled');
        
        new Notification('Leksikon Digital', {
          body: 'Notifikasi harian Leksikon telah diaktifkan! Anda akan menerima kata baru setiap hari pukul 08.00 WIB.',
          icon: '/android-chrome-192x192.png'
        });
      } else {
        alert('Mohon izinkan notifikasi pada browser untuk fitur ini.');
      }
    }
  };

  // Simulated daily notification logic
  useEffect(() => {
    if (!notificationsEnabled) return;

    const checkDailyNotif = () => {
      const now = new Date();
      // WIB Offset (UTC+7)
      const hour = now.getUTCHours() + 7;
      const displayHour = hour >= 24 ? hour - 24 : hour;
      
      const today = now.toISOString().split('T')[0];
      const lastSent = localStorage.getItem('last_notif_sent');

      if (displayHour >= 8 && lastSent !== today && words.length > 0) {
        const index = Math.floor(Math.random() * words.length);
        const randomWord = words[index];
        
        new Notification('Kata Hari Ini: ' + randomWord.word, {
          body: randomWord.definition,
          icon: '/android-chrome-192x192.png'
        });
        localStorage.setItem('last_notif_sent', today);
      }
    };

    const interval = setInterval(checkDailyNotif, 1000 * 60); // Check every minute
    checkDailyNotif(); // Run once on load
    return () => clearInterval(interval);
  }, [notificationsEnabled, words]);

  // Listen for Firestore updates - Limited to prevent over-fetching thousands of words
  useEffect(() => {
    // Only fetch limited number of words for initial display/metadata
    const q = query(collection(db, 'words'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const wordsData: WordEntry[] = [];
      snapshot.forEach((doc) => {
        wordsData.push(doc.data() as WordEntry);
      });
      console.log(`Loaded ${wordsData.length} words from Firestore (preview)`);
      setWords(wordsData);
    }, (err) => {
      // Jika error karena permission, mungkin user belum login
      console.warn("Firestore listener error:", err.message);
      if (err.message.includes("permissions")) {
        // Jangan throw error keras ke UI, cukup log
      } else {
        handleFirestoreError(err, OperationType.LIST, 'words');
      }
    });

    return () => unsubscribe();
  }, []);

  // Excel Export Template
  const downloadTemplate = () => {
    const templateData = [
      ["Kata", "Kategori", "Definisi", "Contoh Kalimat"],
      ["Integritas", "Nomina", "Mutu, sifat, atau keadaan yang menunjukkan kesatuan yang utuh sehingga memiliki potensi dan kemampuan yang memancarkan kewibawaan; kejujuran.", "Setiap pemimpin harus memiliki integritas yang tinggi.;Integritas bangsa harus tetap terjaga."],
      ["Resiliensi", "Nomina", "Kemampuan untuk beradaptasi dan tetap teguh dalam situasi sulit; daya kenyal; daya lentur.", "Resiliensi masyarakat pesisir diuji saat menghadapi banjir rob.;Pendidikan karakter membangun resiliensi mental."]
    ];

    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Kamus");
    XLSX.writeFile(wb, "Template_Kamus_Pintar.xlsx");
  };

  // Excel Import Logic
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!user) {
      alert("Harap login sebagai admin untuk mengunggah file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      setIsProcessing(true);
      setError("Sedang memproses file Excel...");
      
      try {
        const bstr = evt.target?.result as string;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        // Validasi header (baris pertama)
        // A: Kata, B: Kategori, C: Definisi, D: Contoh Kalimat
        const validRows = data.slice(1).filter(row => row[0] && row[2]); // Minimal ada kata dan definisi
        
        let successCount = 0;
        for (const row of validRows) {
          const word = String(row[0]).trim();
          const category = String(row[1] || 'Nomina').trim();
          const definition = String(row[2]).trim();
          // Contoh kalimat dipisahkan dengan titik koma (;)
          const examples = row[3] ? String(row[3]).split(';').map(s => s.trim()) : [];
          
          const wordEntry: WordEntry = {
            word,
            category,
            definition,
            examples
          };

          const wordId = word.toLowerCase();
          await setDoc(doc(db, 'words', wordId), {
            ...wordEntry,
            updatedAt: new Date().toISOString()
          });
          successCount++;
        }

        alert(`Berhasil mengimpor ${successCount} kosakata ke database.`);
        setError(null);
      } catch (err) {
        console.error(err);
        setError("Gagal membaca file Excel. Pastikan format kolom sesuai: Kata, Kategori, Definisi, Contoh Kalimat.");
      } finally {
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  // Load history
  useEffect(() => {
    const savedHistory = localStorage.getItem('kamus_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Failed to load history', e);
      }
    }
  }, []);

  // Save history
  useEffect(() => {
    localStorage.setItem('kamus_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    // Cek apakah mobile
    const checkMobile = () => {
      return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    };
    setIsMobile(checkMobile());

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };
    
    window.addEventListener('beforeinstallprompt', handler);
    
    // Jika PWA sudah terinstal
    window.addEventListener('appinstalled', () => {
      setShowInstallBtn(false);
      setDeferredPrompt(null);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) {
      // Jika prompt otomatis tidak tersedia, beri instruksi manual
      alert("Untuk memasang aplikasi di Android:\n1. Klik ikon titik tiga di pojok kanan atas browser.\n2. Pilih 'Tambahkan ke Layar Utama' atau 'Instal Aplikasi'.");
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBtn(false);
    }
    setDeferredPrompt(null);
  };

  const handleSearch = async (queryStr: string = searchQuery) => {
    const trimmedQuery = queryStr.trim().toLowerCase();
    if (!trimmedQuery) return;

    setError(null);
    setIsProcessing(true);
    setSearchQuery(trimmedQuery);

    try {
      // Direct lookup from Firestore for scalability (up to 5000+ words)
      const cached = words.find(w => w.word.toLowerCase() === trimmedQuery);
      if (cached) {
        setResult(cached);
        addToHistory(trimmedQuery);
        setIsProcessing(false);
        return;
      }

      const docRef = doc(db, 'words', trimmedQuery);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const found = docSnap.data() as WordEntry;
        setResult(found);
        addToHistory(trimmedQuery);
      } else {
        setError('Maaf, kata tersebut tidak ditemukan dalam basis data.');
        setResult(null);
      }
    } catch (err) {
      console.error("Search error:", err);
      setError("Terjadi kesalahan saat mencari. Silakan coba lagi.");
    } finally {
      setIsProcessing(false);
    }
  };

  const addToHistory = (word: string) => {
    setHistory(prev => {
      const filtered = prev.filter(item => item !== word);
      return [word, ...filtered].slice(0, 10);
    });
  };

  const handleSaveWord = async () => {
    if (!editForm.word || !editForm.definition) return;
    if (!user) {
      alert("Harap login untuk menyimpan perubahan.");
      return;
    }
    
    const wordId = editForm.word.toLowerCase();
    try {
      await setDoc(doc(db, 'words', wordId), {
        ...editForm,
        updatedAt: new Date().toISOString()
      });
      setIsEditing(false);
      setResult(editForm);
      setSearchQuery(editForm.word.toLowerCase());
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `words/${wordId}`);
    }
  };

  const handleDeleteWord = async (word: string) => {
    if (!user) return;
    if (window.confirm(`Hapus kata "${word}" dari database?`)) {
      const wordId = word.toLowerCase();
      try {
        await deleteDoc(doc(db, 'words', wordId));
        setResult(null);
        setHistory(prev => prev.filter(w => w.toLowerCase() !== word.toLowerCase()));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `words/${wordId}`);
      }
    }
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    const email = loginCreds.email.trim();
    const password = loginCreds.password;

    setLoginError(null);
    setIsProcessing(true);
    
    // Simulating a small delay
    await new Promise(resolve => setTimeout(resolve, 500));

    if (verifyAdmin(email, password)) {
      const adminUser = { 
        email, 
        uid: 'local-admin', 
        displayName: 'Administrator',
        isManual: true 
      };
      setUser(adminUser);
      setIsAdmin(true);
      localStorage.setItem('leksikon_admin_session', JSON.stringify(adminUser));
      setShowLoginModal(false);
      setLoginCreds({ email: '', password: '' });
      setIsProcessing(false);
    } else {
      setLoginError('Email atau kata sandi admin salah.');
      setIsProcessing(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setIsAdmin(false);
    localStorage.removeItem('leksikon_admin_session');
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('kamus_history');
  };

  const removeFromHistory = (word: string) => {
    setHistory(prev => prev.filter(item => item !== word));
  };

  return (
    <div className="min-h-screen bg-[#fdfbf7] text-[#1a1a1a] font-serif selection:bg-gray-200 pb-20">
      {/* Header */}
      <header className="max-w-6xl mx-auto px-6 py-8 md:py-12 flex flex-col md:flex-row md:items-end justify-between border-b border-[#1a1a1a]/10 mb-8 md:mb-12">
        <div className="cursor-pointer group" onClick={() => { setResult(null); setSearchQuery(''); }}>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase font-sans group-hover:text-gray-700 transition-colors">Leksikon</h1>
          <p className="text-[9px] md:text-[10px] font-sans uppercase tracking-[0.2em] opacity-50 mt-1">Kamus Besar Bahasa Indonesia Digital</p>
        </div>
          <div className="flex flex-wrap gap-3 md:gap-4 text-[11px] font-sans font-bold uppercase tracking-widest mt-8 md:mt-0 items-center">
            <button 
              onClick={toggleNotifications}
              className={`flex items-center gap-2 px-3 py-1.5 border rounded-sm transition-all ${notificationsEnabled ? 'bg-amber-50 border-amber-200 text-amber-700' : 'border-gray-200 text-gray-400 hover:border-[#1a1a1a] hover:text-[#1a1a1a]'}`}
              title={notificationsEnabled ? 'Matikan Notifikasi' : 'Aktifkan Notifikasi Harian (08:00 WIB)'}
            >
              {notificationsEnabled ? <Bell size={12} className="fill-current" /> : <BellOff size={12} />}
              <span className="hidden sm:inline">Harian</span>
            </button>
            {user ? (
            <div className="flex items-center gap-4">
              <button 
                onClick={handleInstallApp}
                className="flex items-center gap-2 px-3 py-1.5 border border-[#1a1a1a] text-[#1a1a1a] rounded-sm hover:bg-[#1a1a1a] hover:text-white transition-all"
                title="Pasang Aplikasi (PWA)"
              >
                <Download size={12} /> Instal App
              </button>
              <button 
                onClick={() => setIsAdmin(!isAdmin)}
                className={`flex items-center gap-2 px-3 py-1.5 border transition-all ${isAdmin ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]' : 'border-gray-200 text-gray-400 hover:border-[#1a1a1a] hover:text-[#1a1a1a]'}`}
              >
                <Settings size={12} />
                {isAdmin ? 'Admin Aktif' : 'Mode Admin'}
              </button>
              <button onClick={handleLogout} className="text-gray-400 hover:text-red-500 flex items-center gap-1">
                <LogOut size={12} /> Keluar
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <button 
                onClick={handleInstallApp}
                className="flex items-center gap-2 px-3 py-1.5 border border-[#1a1a1a] text-[#1a1a1a] rounded-sm hover:bg-[#1a1a1a] hover:text-white transition-all"
                title="Pasang Aplikasi (PWA)"
              >
                <Download size={12} /> Instal App
              </button>
              <button onClick={() => setShowLoginModal(true)} className="flex items-center gap-1 text-gray-400 hover:text-[#1a1a1a]">
                <LogIn size={12} /> Masuk Admin
              </button>
            </div>
          )}
          <span className="opacity-40 hidden lg:inline">Mutakhir</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12">
        {/* Left Column: Search & Admin Actions */}
        <div className="md:col-span-4 space-y-12">
          {/* Search Bar */}
          <div className="relative">
            <p className="text-[10px] font-sans uppercase tracking-widest mb-4 opacity-50">Cari Kata</p>
            <div className="border-b-2 border-[#1a1a1a] py-2 flex items-center group transition-colors focus-within:border-gray-400">
              <Search className="mr-4 text-gray-300 group-focus-within:text-[#1a1a1a] transition-colors" size={24} />
              <input
                id="word-search"
                type="text"
                placeholder="Ketuk untuk mencari..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="bg-transparent text-2xl focus:outline-none w-full italic font-light placeholder:text-gray-300"
              />
            </div>
          </div>

          {isAdmin && (
            <div className="space-y-4">
              <button 
                onClick={() => {
                  setEditForm({ word: '', category: 'Nomina', definition: '', examples: ['', ''] });
                  setIsEditing(true);
                }}
                className="w-full py-4 border-2 border-dashed border-gray-200 rounded-sm text-gray-400 hover:border-[#1a1a1a] hover:text-[#1a1a1a] transition-all flex items-center justify-center gap-2 font-sans font-bold uppercase tracking-widest text-xs"
              >
                <Plus size={16} /> Tambah Kosakata Baru
              </button>
              
              <div className="grid grid-cols-1 gap-2">
                <button 
                  onClick={downloadTemplate}
                  className="w-full py-3 border border-gray-200 rounded-sm text-[10px] font-sans font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white hover:border-[#1a1a1a] transition-all"
                >
                  <Download size={14} /> Unduh Template Excel
                </button>
                
                <label className="w-full py-3 bg-[#f3f4f6] text-[#1a1a1a] border border-gray-200 rounded-sm text-[10px] font-sans font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-gray-200 cursor-pointer transition-all">
                  <Upload size={14} /> 
                  {isProcessing ? 'Mengimpor...' : 'Impor dari Excel'}
                  <input 
                    type="file" 
                    accept=".xlsx, .xls"
                    className="hidden"
                    onChange={handleFileUpload}
                    ref={fileInputRef}
                    disabled={isProcessing}
                  />
                </label>

                {words.length === 0 && (
                  <button 
                    onClick={() => {
                      if(window.confirm('Impor 150 kata contoh ke database?')) {
                        const seed = async () => {
                          setIsProcessing(true);
                          try {
                            for(const w of initialWords) {
                              await setDoc(doc(db, 'words', w.word.toLowerCase()), w);
                            }
                          } finally {
                            setIsProcessing(false);
                          }
                        };
                        seed();
                      }
                    }}
                    disabled={isProcessing}
                    className="w-full py-3 bg-amber-50 text-amber-700 border border-amber-200 rounded-sm text-[10px] font-sans font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-amber-100 disabled:opacity-50"
                  >
                    Impor 150 Kata Awal
                  </button>
                )}

                {/* Notification Preview for Admin */}
                <div className="p-6 bg-[#1a1a1a] text-white rounded-sm space-y-4 shadow-xl mt-6">
                  <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                    <Bell size={14} className="text-amber-400" />
                    <h3 className="text-[10px] font-sans font-bold uppercase tracking-widest text-amber-400">Pratinjau Notifikasi Harian (08:00 WIB)</h3>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="bg-white/5 p-4 rounded-sm border border-white/5">
                      <p className="text-[10px] font-sans uppercase tracking-[0.2em] opacity-40 mb-2">Simulasi Pengunjung</p>
                      <h4 className="text-lg font-bold font-sans tracking-tight mb-1">Kata Hari Ini: Berdikari</h4>
                      <p className="text-xs text-gray-400 line-clamp-2 italic font-serif">
                        Berdiri di atas kaki sendiri; tidak bergantung pada bantuan orang lain.
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-3 text-[9px] font-sans uppercase tracking-widest opacity-50 px-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                      Sistem Otomatis Aktif
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* History/Featured */}
          <div className="space-y-8">
            {history.length > 0 ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[10px] font-sans font-bold uppercase tracking-widest opacity-50 flex items-center gap-2">
                    <History size={12} /> Pencarian Terakhir
                  </h3>
                  <button onClick={clearHistory} className="text-[10px] font-sans font-bold uppercase tracking-widest hover:text-red-500 transition-colors">
                    Hapus
                  </button>
                </div>
                <div className="space-y-2 border-l border-gray-200 pl-4">
                  {history.map((word, idx) => (
                    <button 
                      key={idx}
                      onClick={() => handleSearch(word)}
                      className="block text-lg italic hover:text-gray-500 transition-colors w-full text-left capitalize"
                    >
                      {word}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-8 border border-[#1a1a1a] rounded-sm relative overflow-hidden bg-white shadow-[10px_10px_0px_#e5e2da]">
                <span className="inline-block px-2 py-1 bg-[#1a1a1a] text-[#fdfbf7] text-[9px] uppercase tracking-widest mb-6">Informasi</span>
                <h3 className="text-4xl mb-4 leading-none italic">Kamus Pintar</h3>
                <p className="text-sm leading-relaxed opacity-80 font-serif">
                  Jelajahi kekayaan kosakata Indonesia dengan definisi akurat dan contoh penggunaan yang tepat.
                </p>
                <div className="mt-8 text-[9px] font-sans font-bold uppercase tracking-widest opacity-30">
                  Sistem Basis Data Leksikon
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Definition View */}
        <div className="md:col-span-8">
          <AnimatePresence mode="wait">
            {isEditing ? (
              <motion.div 
                key="edit-form"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="bg-white p-12 shadow-[20px_20px_0px_#e5e2da] border border-[#e5e2da] flex flex-col space-y-8"
              >
                <div className="flex justify-between items-center border-b border-gray-100 pb-6">
                  <h2 className="text-3xl font-black uppercase tracking-tighter font-sans">
                    {editForm.word ? `Edit: ${editForm.word}` : 'Tambah Kata Baru'}
                  </h2>
                  <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-[#1a1a1a]">
                    <X size={24} />
                  </button>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-sans font-bold uppercase tracking-widest mb-2 opacity-50">Kata (Entri)</label>
                    <input 
                      type="text" 
                      value={editForm.word}
                      onChange={(e) => setEditForm(prev => ({ ...prev, word: e.target.value }))}
                      className="w-full text-2xl font-serif italic border-b border-gray-200 focus:border-[#1a1a1a] focus:outline-none py-2 bg-transparent"
                      placeholder="Masukkan kata..."
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-sans font-bold uppercase tracking-widest mb-2 opacity-50">Kategori</label>
                    <select 
                      value={editForm.category}
                      onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full font-sans font-bold uppercase text-[11px] tracking-widest border border-gray-200 p-2 focus:border-[#1a1a1a] focus:outline-none cursor-pointer"
                    >
                      <option value="Nomina">Nomina (n)</option>
                      <option value="Verba">Verba (v)</option>
                      <option value="Adjektiva">Adjektiva (adj)</option>
                      <option value="Adverbia">Adverbia (adv)</option>
                      <option value="Pronomina">Pronomina (pron)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-sans font-bold uppercase tracking-widest mb-2 opacity-50">Definisi</label>
                    <textarea 
                      value={editForm.definition}
                      onChange={(e) => setEditForm(prev => ({ ...prev, definition: e.target.value }))}
                      className="w-full text-lg font-serif leading-snug border border-gray-200 p-4 focus:border-[#1a1a1a] focus:outline-none min-h-[120px] bg-[#fdfbf7]"
                      placeholder="Tulis definisi lengkap sesuai gaya KBBI..."
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-sans font-bold uppercase tracking-widest mb-2 opacity-50">Contoh Kalimat (Pisahkan dengan baris baru)</label>
                    <textarea 
                      value={editForm.examples.join('\n')}
                      onChange={(e) => setEditForm(prev => ({ ...prev, examples: e.target.value.split('\n') }))}
                      className="w-full text-lg italic font-serif border border-gray-200 p-4 focus:border-[#1a1a1a] focus:outline-none min-h-[100px] bg-transparent"
                      placeholder="Gunakan tanda kutip jika perlu..."
                    />
                  </div>
                </div>

                <div className="pt-8 border-t border-gray-100 flex gap-4">
                  <button 
                    onClick={handleSaveWord}
                    className="flex-1 bg-[#1a1a1a] text-white py-4 font-sans font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-gray-800 transition-all"
                  >
                    <Save size={16} /> Simpan ke Basis Data
                  </button>
                </div>
              </motion.div>
            ) : error ? (
              <motion.div 
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-red-50 border border-red-200 p-12 rounded-sm text-center"
              >
                <div className="max-w-xs mx-auto">
                  <h3 className="font-sans font-bold text-xs uppercase tracking-widest text-red-900 mb-4">Tidak Ditemukan</h3>
                  <p className="text-red-800 italic text-2xl mb-8 leading-relaxed">"{searchQuery}" belum terdaftar dalam leksikon kami.</p>
                  {isAdmin && (
                    <button 
                      onClick={() => {
                        setEditForm({ word: searchQuery, category: 'Nomina', definition: '', examples: ['', ''] });
                        setIsEditing(true);
                        setError(null);
                      }}
                      className="font-sans font-bold uppercase tracking-widest text-[10px] border border-red-300 px-4 py-2 hover:bg-red-100 transition-all"
                    >
                      Tambah Kata Ini
                    </button>
                  )}
                </div>
              </motion.div>
            ) : result ? (
              <motion.div 
                key="result"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white p-8 md:p-12 shadow-[15px_15px_0px_#e5e2da] md:shadow-[20px_20px_0px_#e5e2da] border border-[#e5e2da] flex flex-col min-h-[500px]"
              >
                <div className="mb-8 md:mb-12 flex justify-between items-start">
                  <div>
                    <div className="flex items-baseline gap-4 md:gap-6 mb-4 flex-wrap">
                      <h2 className="text-5xl md:text-7xl font-light italic tracking-tight capitalize">{result.word}</h2>
                      <span className="text-lg md:text-xl font-serif italic opacity-40">/{result.word.toLowerCase().split('').join('·')}/</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="px-3 py-1 border border-[#1a1a1a] text-[10px] font-sans font-bold uppercase tracking-widest leading-none flex items-center">{result.category}</span>
                      <span className="px-3 py-1 border border-[#1a1a1a] text-[10px] font-sans font-bold uppercase tracking-widest leading-none flex items-center">Leksikon DB</span>
                    </div>
                  </div>
                  
                  {isAdmin && (
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => {
                          setEditForm(result);
                          setIsEditing(true);
                        }}
                        className="p-3 border border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-100 hover:bg-blue-50 transition-all"
                        title="Edit Kata"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDeleteWord(result.word)}
                        className="p-3 border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-100 hover:bg-red-50 transition-all"
                        title="Hapus Kata"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex-grow space-y-8 md:space-y-12">
                  <section>
                    <h4 className="text-[10px] md:text-[11px] font-sans font-bold uppercase tracking-widest border-b border-gray-100 pb-3 mb-4 md:mb-6">Definisi</h4>
                    <p className="text-2xl md:text-3xl leading-snug font-serif text-gray-900">
                      {result.definition}
                    </p>
                  </section>

                  <section>
                    <h4 className="text-[10px] md:text-[11px] font-sans font-bold uppercase tracking-widest border-b border-gray-100 pb-3 mb-4 md:mb-6">Contoh Penggunaan</h4>
                    <div className="space-y-6 md:space-y-8">
                      {result.examples.map((example, idx) => example && (
                        <p key={idx} className="text-lg md:text-xl italic leading-relaxed text-gray-700 relative pl-8 md:pl-10">
                          <span className="absolute left-0 top-0 text-3xl md:text-5xl opacity-20 font-serif leading-none">“</span>
                          {example}
                        </p>
                      ))}
                    </div>
                  </section>
                </div>

                <div className="mt-16 pt-8 flex border-t border-gray-100 justify-between items-center">
                  <div className="flex gap-4">
                    <button 
                      onClick={() => {
                        setResult(null);
                        setSearchQuery('');
                      }}
                      className="px-6 py-2 bg-[#1a1a1a] text-white text-[10px] font-sans font-bold uppercase tracking-widest hover:bg-gray-800 transition-all"
                    >
                      Tutup
                    </button>
                  </div>
                  <div className="text-[10px] font-sans italic opacity-40">Terakhir diperbarui: {new Date().toLocaleDateString('id-ID')}</div>
                </div>
              </motion.div>
            ) : (
              <div className="h-full flex items-center justify-center border-2 border-dashed border-gray-200 rounded-sm p-12 text-center">
                <div className="max-w-xs">
                  <BookOpen className="mx-auto mb-6 text-gray-200" size={64} />
                  <p className="text-xl italic text-gray-400">Pilih kata di sebelah kiri atau masukkan kata baru untuk melihat definisi lengkap.</p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Login Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLoginModal(false)}
              className="absolute inset-0 bg-[#1a1a1a]/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="relative bg-white w-full max-w-md p-8 shadow-2xl border border-[#1a1a1a] rounded-sm"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black uppercase tracking-tighter font-sans">Masuk Admin</h2>
                <button onClick={() => setShowLoginModal(false)} className="text-gray-400 hover:text-[#1a1a1a]">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleLogin} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-sans font-bold uppercase tracking-widest mb-2 opacity-50">Email</label>
                  <input 
                    type="email" 
                    required
                    value={loginCreds.email}
                    onChange={(e) => setLoginCreds(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full text-lg border-b border-gray-200 focus:border-[#1a1a1a] focus:outline-none py-2 bg-transparent font-sans"
                    placeholder="nama@email.com"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-sans font-bold uppercase tracking-widest mb-2 opacity-50">Password</label>
                  <input 
                    type="password" 
                    required
                    value={loginCreds.password}
                    onChange={(e) => setLoginCreds(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full text-lg border-b border-gray-200 focus:border-[#1a1a1a] focus:outline-none py-2 bg-transparent font-sans"
                    placeholder="••••••••"
                  />
                </div>

                {loginError && (
                  <p className="text-xs text-red-500 font-sans italic">{loginError}</p>
                )}

                <button 
                  type="submit"
                  disabled={isProcessing}
                  className="w-full bg-[#1a1a1a] text-white py-4 font-sans font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-gray-800 transition-all disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                  Masuk Sistem
                </button>
                
                <div className="pt-4 text-center">
                  <p className="text-[9px] font-sans uppercase tracking-[0.1em] opacity-40">
                    Akses terbatas untuk administrator sistem
                  </p>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Decorative BG element */}
      <div className="fixed top-0 right-0 p-8 pointer-events-none opacity-[0.03] overflow-hidden select-none">
        <span className="text-[300px] font-sans font-black leading-none">KBBI</span>
      </div>
    </div>
  );
}

