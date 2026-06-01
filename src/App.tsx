/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, ErrorInfo, ReactNode } from 'react';
import { Search, History, BookOpen, Trash2, ArrowRight, Plus, Edit2, X, Save, Settings, LogIn, LogOut, Upload, Download, Loader2, Bell, BellOff, Volume2, VolumeX, WifiOff, Cloud, FileText, Copy, RefreshCw, Check, AlertCircle, ShieldAlert, Clock, CreditCard, CheckCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { initialWords, type WordEntry } from './data/initialWords.ts';
import { 
  db, collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, limit, onSnapshot, increment,
  OperationType, handleFirestoreError 
} from './lib/firebase.ts';

// Simple Error Boundary
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("CRITICAL ERROR:", error, errorInfo);
  }

  render() {
    const { hasError, error } = this.state;
    if (hasError) {
      return (
        <div style={{ padding: '20px', textAlign: 'center', background: '#fdfbf7', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
          <h1 style={{ fontFamily: 'sans-serif', textTransform: 'uppercase' }}>Sepertinya ada masalah teknis</h1>
          <p style={{ fontStyle: 'italic', opacity: 0.6 }}>{error?.message}</p>
          <button 
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            style={{ padding: '10px 20px', background: '#1a1a1a', color: 'white', border: 'none', cursor: 'pointer', marginTop: '20px' }}
          >
            Reset dan Muat Ulang
          </button>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}

interface CheckedWord {
  text: string;
  isWord: boolean;
  isTypo: boolean;
  bestSuggestion?: string;
  suggestions?: string[];
}

function MainApp() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [words, setWords] = useState<WordEntry[]>([]);
  const [result, setResult] = useState<WordEntry | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginCreds, setLoginCreds] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [lastUpload, setLastUpload] = useState<{timestamp: string, count: number} | null>(null);
  const [stats, setStats] = useState({ totalSearches: 0, totalInstalls: 0 });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'info' | 'error' | 'success'>('info');

  // Tab navigation state
  const [activeTab, setActiveTab] = useState<'kamus' | 'pemeriksa'>('kamus');

  // Pemeriksa Typo State variables
  const [typoText, setTypoText] = useState('');
  const [checkedResults, setCheckedResults] = useState<CheckedWord[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedWordIdx, setSelectedWordIdx] = useState<number | null>(null);
  const [fileLoading, setFileLoading] = useState(false);

  // New States for Email, Limits, Payments and Admin logs
  const [typoEmail, setTypoEmail] = useState<string>(() => localStorage.getItem('user_typo_email') || '');
  const [showEmailPromptModal, setShowEmailPromptModal] = useState<boolean>(false);
  const [tempEmailInput, setTempEmailInput] = useState<string>('');
  const [emailInputError, setEmailInputError] = useState<string>('');
  const [currentUserData, setCurrentUserData] = useState<any>(null);
  const [paymentSettings, setPaymentSettings] = useState<{ gopayNumber: string; qrisImageUrl: string }>({
    gopayNumber: '081234567890',
    qrisImageUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=gopay://payment?to=081234567890'
  });
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);
  const [allPayments, setAllPayments] = useState<any[]>([]);
  const [allEvaluations, setAllEvaluations] = useState<any[]>([]);
  const [payStatus, setPayStatus] = useState<string>('');
  const [payUsageCount, setPayUsageCount] = useState<number>(0);
  const [gopayInput, setGopayInput] = useState<string>('');
  const [qrisImageInput, setQrisImageInput] = useState<string>('');
  const [qrisOption, setQrisOption] = useState<'url' | 'upload'>('url');
  const [selectedAdminSubTab, setSelectedAdminSubTab] = useState<'rekap_bayar' | 'riwayat_eval' | 'pengaturan_bayar'>('rekap_bayar');
  const [adminTypoMode, setAdminTypoMode] = useState<'checker' | 'admin'>('checker');

  const showStatus = (msg: string, type: 'info' | 'error' | 'success' = 'info', duration = 5000) => {
    setStatusMessage(msg);
    setStatusType(type);
    setTimeout(() => {
      setStatusMessage(current => current === msg ? null : current);
    }, duration);
  };

  // Word distance algorithm (Levenshtein)
  const getDistance = (a: string, b: string): number => {
    const tmp = [];
    let i, j;
    for (i = 0; i <= a.length; i++) {
      tmp[i] = [i];
    }
    for (j = 0; j <= b.length; j++) {
      tmp[0][j] = j;
    }
    for (i = 1; i <= a.length; i++) {
      for (j = 1; j <= b.length; j++) {
        tmp[i][j] = Math.min(
          tmp[i - 1][j] + 1,
          tmp[i][j - 1] + 1,
          tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
    }
    return tmp[a.length][b.length];
  };

  // Load global configurations (GoPay & QRIS)
  useEffect(() => {
    if (!db) return;
    const docRef = doc(db, 'settings', 'global');
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setPaymentSettings({
          gopayNumber: data.gopayNumber || '081234567890',
          qrisImageUrl: data.qrisImageUrl || 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=gopay://payment?to=081234567890'
        });
      }
    }, (err) => {
      console.warn("Settings listener error:", err);
    });
    return () => unsubscribe();
  }, [db]);

  // Load current typo user's profile
  useEffect(() => {
    if (!db || !typoEmail) {
      setCurrentUserData(null);
      setPayStatus('');
      setPayUsageCount(0);
      return;
    }
    const emailKey = typoEmail.toLowerCase().trim();
    const bypassEmails = ['admin1@gmail.com', 'admin2@gmail.com', 'user1@gmail.com', 'user2@gmail.com'];
    if (bypassEmails.includes(emailKey)) {
      setPayStatus('approved');
      setPayUsageCount(0);
      setCurrentUserData({ email: emailKey, usageCount: 0, paymentStatus: 'approved' });
      return;
    }

    const docRef = doc(db, 'users', emailKey);
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const uData = snapshot.data();
        setCurrentUserData(uData);
        setPayStatus(uData.paymentStatus || 'none');
        setPayUsageCount(uData.usageCount || 0);
      } else {
        const initUser = { email: emailKey, usageCount: 0, paymentStatus: 'none' };
        setDoc(docRef, initUser).catch(e => console.warn("Failed to create users record:", e));
        setCurrentUserData(initUser);
        setPayStatus('none');
        setPayUsageCount(0);
      }
    }, (err) => {
      console.warn("User listener error:", err);
    });
    return () => unsubscribe();
  }, [db, typoEmail]);

  // Read payments & evaluations (Admin only)
  useEffect(() => {
    if (!db || !isAdmin) {
      setAllPayments([]);
      setAllEvaluations([]);
      return;
    }
    const qPay = collection(db, 'payments');
    const unsubscribePay = onSnapshot(qPay, (snapshot) => {
      const payList: any[] = [];
      snapshot.forEach((doc) => {
        payList.push({ id: doc.id, ...doc.data() });
      });
      payList.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
      setAllPayments(payList);
    }, (err) => {
      console.warn("Payment log listener error:", err);
    });

    const qEval = collection(db, 'evaluations');
    const unsubscribeEval = onSnapshot(qEval, (snapshot) => {
      const evalList: any[] = [];
      snapshot.forEach((doc) => {
        evalList.push({ id: doc.id, ...doc.data() });
      });
      evalList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setAllEvaluations(evalList);
    }, (err) => {
      console.warn("Evaluation log listener error:", err);
    });

    return () => {
      unsubscribePay();
      unsubscribeEval();
    };
  }, [db, isAdmin]);

  // Sync settings input controls
  useEffect(() => {
    setGopayInput(paymentSettings.gopayNumber);
    setQrisImageInput(paymentSettings.qrisImageUrl);
    if (paymentSettings.qrisImageUrl && paymentSettings.qrisImageUrl.startsWith('data:')) {
      setQrisOption('upload');
    } else {
      setQrisOption('url');
    }
  }, [paymentSettings]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emailKey = tempEmailInput.toLowerCase().trim();

    if (!emailKey || !emailRegex.test(emailKey)) {
      setEmailInputError("Harap masukkan format email yang valid.");
      return;
    }

    try {
      localStorage.setItem('user_typo_email', emailKey);
      setTypoEmail(emailKey);
      setShowEmailPromptModal(false);
      showStatus(`Sesi email terdaftar: ${emailKey}`, "success");

      // Auto check after set
      setTimeout(() => {
        handleTriggerCheck(typoText);
      }, 500);
    } catch (err) {
      console.error(err);
      setEmailInputError("Gagal menyimpan email.");
    }
  };

  const handleRegisterPayment = async () => {
    if (!typoEmail) return;
    const emailKey = typoEmail.toLowerCase().trim();
    setIsSubmittingPayment(true);
    try {
      if (!db) {
        showStatus("Basis data tidak tersedia. Periksa internet Anda.", "error");
        return;
      }
      const paymentRef = doc(collection(db, 'payments'));
      await setDoc(paymentRef, {
        email: emailKey,
        amount: 5000,
        status: 'pending',
        requestedAt: new Date().toISOString()
      });

      await setDoc(doc(db, 'users', emailKey), {
        paymentStatus: 'pending'
      }, { merge: true });

      showStatus("Berhasil mendaftarkan bukti pembayaran!", "success");
      setShowPaymentModal(false);
    } catch (e) {
      console.error(e);
      showStatus("Gagal mendaftarkan pembayaran.", "error");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleApprovePayment = async (payId: string, emailStr: string) => {
    if (!db) return;
    try {
      setIsProcessing(true);
      await setDoc(doc(db, 'payments', payId), {
        status: 'approved',
        approvedAt: new Date().toISOString()
      }, { merge: true });

      await setDoc(doc(db, 'users', emailStr.toLowerCase().trim()), {
        paymentStatus: 'approved'
      }, { merge: true });

      showStatus(`Pembayaran untuk ${emailStr} disetujui!`, "success");
    } catch (e) {
      console.error(e);
      showStatus("Gagal memproses persetujuan.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQrisFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      showStatus("Format file tidak didukung! Pastikan berformat PNG, JPG, atau JPEG.", "error");
      return;
    }

    // Limit to 1MB to prevent Firestore document size overflow
    if (file.size > 1024 * 1024) {
      showStatus("File terlalu besar! Maksimal ukuran gambar adalah 1MB agar bisa disimpan.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setQrisImageInput(event.target.result as string);
        showStatus("Gambar QRIS berhasil diunggah secara lokal!", "success");
      }
    };
    reader.onerror = () => {
      showStatus("Gagal membaca file gambar.", "error");
    };
    reader.readAsDataURL(file);
  };

  const handleSavePaymentSettings = async () => {
    if (!db) return;
    if (!gopayInput.trim()) {
      showStatus("Nomor GoPay tidak boleh kosong.", "error");
      return;
    }
    try {
      setIsProcessing(true);
      await setDoc(doc(db, 'settings', 'global'), {
        gopayNumber: gopayInput.trim(),
        qrisImageUrl: qrisImageInput.trim()
      }, { merge: true });
      showStatus("Penggantian detail GoPay & QRIS disimpan!", "success");
    } catch (e) {
      console.error(e);
      showStatus("Gagal menyimpan.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadTypoEvaluations = () => {
    if (allEvaluations.length === 0) {
      showStatus("Tidak ada riwayat evaluasi untuk diunduh.", "info");
      return;
    }
    const exportData = [
      ["Email Pengguna", "Waktu Pemeriksaan", "Total Kata", "Typo Terdeteksi", "Skor Presisi", "Teks Input"]
    ];
    allEvaluations.forEach(e => {
      exportData.push([
        e.email,
        new Date(e.timestamp).toLocaleString("id-ID"),
        String(e.totalWords),
        String(e.typosCount),
        e.precision,
        e.inputText
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Riwayat Evaluasi");
    XLSX.writeFile(wb, "Riwayat_Evaluasi_Pemeriksa_Typo.xlsx");
    showStatus("Data riwayat periksa berhasil diunduh!", "success");
  };

  const handleTriggerCheck = async (rawText = typoText) => {
    if (!rawText.trim()) {
      showStatus("Ketik atau masukkan teks terlebih dahulu.", "info");
      return;
    }

    const savedEmail = localStorage.getItem('user_typo_email') || typoEmail;
    if (!savedEmail) {
      setTempEmailInput('');
      setEmailInputError('');
      setShowEmailPromptModal(true);
      return;
    }

    const emailKey = savedEmail.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailKey)) {
      showStatus("Email cache tidak valid, harap ketik ulang.", "error");
      localStorage.removeItem('user_typo_email');
      setTypoEmail('');
      setTempEmailInput('');
      setShowEmailPromptModal(true);
      return;
    }

    if (typoEmail !== emailKey) {
      setTypoEmail(emailKey);
    }

    const bypassEmails = ['admin1@gmail.com', 'admin2@gmail.com', 'user1@gmail.com', 'user2@gmail.com'];
    if (bypassEmails.includes(emailKey)) {
      runStandardCheckAndSave(rawText, emailKey, true);
      return;
    }

    if (!db) {
      runStandardCheckAndSave(rawText, emailKey, false);
      return;
    }

    setIsAnalyzing(true);
    try {
      const userDocRef = doc(db, 'users', emailKey);
      const userSnap = await getDoc(userDocRef);
      
      let usageCount = 0;
      let paymentStatus = 'none';

      if (userSnap.exists()) {
        const uData = userSnap.data();
        usageCount = uData.usageCount || 0;
        paymentStatus = uData.paymentStatus || 'none';
      } else {
        const initUser = { email: emailKey, usageCount: 0, paymentStatus: 'none' };
        await setDoc(userDocRef, initUser);
      }

      if (usageCount >= 10) {
        if (paymentStatus === 'approved') {
          runStandardCheckAndSave(rawText, emailKey, false);
        } else if (paymentStatus === 'pending') {
          setIsAnalyzing(false);
          setShowPaymentModal(true);
          showStatus("Pembayaran Anda sedang menunggu persetujuan Admin.", "info");
        } else {
          setIsAnalyzing(false);
          setShowPaymentModal(true);
        }
      } else {
        runStandardCheckAndSave(rawText, emailKey, false);
      }
    } catch (e: any) {
      console.error(e);
      runStandardCheckAndSave(rawText, emailKey, false);
    }
  };

  const runStandardCheckAndSave = async (rawText: string, emailStr: string, isBypass: boolean) => {
    setIsAnalyzing(true);
    const validWordsSet = new Set<string>();
    words.forEach(w => validWordsSet.add(w.word.toLowerCase().trim()));
    initialWords.forEach(w => validWordsSet.add(w.word.toLowerCase().trim()));

    const COMMON_INDONESIAN = [
      'dan', 'atau', 'di', 'ke', 'dari', 'yang', 'yg', 'ini', 'itu', 'dengan', 
      'untuk', 'pada', 'bagi', 'oleh', 'tentang', 'sebagai', 'ia', 'mereka', 
      'kami', 'kita', 'saya', 'aku', 'kamu', 'engkau', 'anda', 'dia', 'nya', 
      'adalah', 'yaitu', 'yakni', 'karena', 'juga', 'saja', 'telah', 'sudah', 
      'sedang', 'akan', 'bisa', 'dapat', 'namun', 'tetapi', 'bahwa', 'apakah', 
      'siapa', 'apa', 'sejak', 'hanya', 'serta', 'jika', 'bila', 'pula', 
      'pun', 'lah', 'kah', 'tapi', 'tidak', 'tak', 'belum', 'ada', 'dalam', 
      'luar', 'atas', 'bawah', 'sangat', 'amat', 'sekali', 'lebih', 'paling',
      'bukan', 'maupun', 'secara', 'setiap', 'banyak', 'beberapa', 'semua',
      'bagaimana', 'mengapa', 'kenapa', 'sebab', 'maka', 'sehingga', 'lalu',
      'kemudian', 'kok', 'sih', 'dong', 'kan', 'deh', 'loh', 'oh', 'ah', 'wah', 'hal'
    ];
    COMMON_INDONESIAN.forEach(w => validWordsSet.add(w.toLowerCase().trim()));

    const tokens = rawText.split(/([a-zA-ZáéíóúÁÉÍÓÚ'-]+)/);
    
    const results: CheckedWord[] = tokens.map((token) => {
      const isWord = /^[a-zA-ZáéíóúÁÉÍÓÚ'-]+$/.test(token) && token.length > 1;
      if (!isWord) {
        return { text: token, isWord: false, isTypo: false };
      }

      const stripped = token.toLowerCase();
      if (validWordsSet.has(stripped)) {
        return { text: token, isWord: true, isTypo: false };
      }

      const candidates: { word: string; dist: number }[] = [];
      validWordsSet.forEach(vWord => {
        if (Math.abs(vWord.length - stripped.length) <= 3) {
          const dist = getDistance(stripped, vWord);
          if (dist <= 3) {
            candidates.push({ word: vWord, dist });
          }
        }
      });

      candidates.sort((x, y) => {
        if (x.dist !== y.dist) return x.dist - y.dist;
        return Math.abs(x.word.length - stripped.length) - Math.abs(y.word.length - stripped.length);
      });

      const listSugg = candidates.slice(0, 3).map(c => {
        if (token === token.toUpperCase()) {
          return c.word.toUpperCase();
        } else if (token[0] === token[0].toUpperCase()) {
          return c.word.charAt(0).toUpperCase() + c.word.slice(1);
        }
        return c.word;
      });

      return {
        text: token,
        isWord: true,
        isTypo: true,
        bestSuggestion: listSugg[0] || undefined,
        suggestions: listSugg
      };
    });

    setCheckedResults(results);
    setIsAnalyzing(false);
    setSelectedWordIdx(null);

    const totalWords = results.filter(r => r.isWord).length;
    const typosCount = results.filter(r => r.isTypo).length;
    const precisionCount = totalWords === 0 ? '100%' : `${Math.round(((totalWords - typosCount) / totalWords) * 100)}%`;

    if (!db) {
      showStatus("Analisis selesai offline.", "info");
      return;
    }

    try {
      const evalRef = doc(collection(db, 'evaluations'));
      await setDoc(evalRef, {
        email: emailStr,
        totalWords,
        typosCount,
        precision: precisionCount,
        inputText: rawText.substring(0, 100000),
        timestamp: new Date().toISOString()
      });

      if (!isBypass) {
        const userDocRef = doc(db, 'users', emailStr);
        await setDoc(userDocRef, {
          email: emailStr,
          usageCount: increment(1)
        }, { merge: true });
      }
      showStatus("Pemeriksaan selesai, log tersimpan di cloud!", "success");
    } catch (error: any) {
      console.warn("Format error writing stats:", error);
    }
  };

  // Run Typo Check Analyzers (Deterministic / Offline / Non-AI)
  const handleCheckText = (rawText = typoText) => {
    if (!rawText.trim()) {
      setCheckedResults([]);
      return;
    }
    
    setIsAnalyzing(true);
    const validWordsSet = new Set<string>();
    
    // Add dictionary words
    words.forEach(w => validWordsSet.add(w.word.toLowerCase().trim()));
    initialWords.forEach(w => validWordsSet.add(w.word.toLowerCase().trim()));

    // Standard Indonesian connecting structures
    const COMMON_INDONESIAN = [
      'dan', 'atau', 'di', 'ke', 'dari', 'yang', 'yg', 'ini', 'itu', 'dengan', 
      'untuk', 'pada', 'bagi', 'oleh', 'tentang', 'sebagai', 'ia', 'mereka', 
      'kami', 'kita', 'saya', 'aku', 'kamu', 'engkau', 'anda', 'dia', 'nya', 
      'adalah', 'yaitu', 'yakni', 'karena', 'juga', 'saja', 'telah', 'sudah', 
      'sedang', 'akan', 'bisa', 'dapat', 'namun', 'tetapi', 'bahwa', 'apakah', 
      'siapa', 'apa', 'sejak', 'hanya', 'serta', 'jika', 'bila', 'pula', 
      'pun', 'lah', 'kah', 'tapi', 'tidak', 'tak', 'belum', 'ada', 'dalam', 
      'luar', 'atas', 'bawah', 'sangat', 'amat', 'sekali', 'lebih', 'paling',
      'bukan', 'maupun', 'secara', 'setiap', 'banyak', 'beberapa', 'semua',
      'bagaimana', 'mengapa', 'kenapa', 'sebab', 'maka', 'sehingga', 'lalu',
      'kemudian', 'kok', 'sih', 'dong', 'kan', 'deh', 'loh', 'oh', 'ah', 'wah', 'hal'
    ];
    COMMON_INDONESIAN.forEach(w => {
      validWordsSet.add(w.toLowerCase().trim());
    });

    // Handle tokenization preserving spaces & formatting
    const tokens = rawText.split(/([a-zA-ZáéíóúÁÉÍÓÚ'-]+)/);
    
    const results: CheckedWord[] = tokens.map((token) => {
      const isWord = /^[a-zA-ZáéíóúÁÉÍÓÚ'-]+$/.test(token) && token.length > 1;
      if (!isWord) {
        return { text: token, isWord: false, isTypo: false };
      }

      const stripped = token.toLowerCase();
      if (validWordsSet.has(stripped)) {
        return { text: token, isWord: true, isTypo: false };
      }

      // Find best recommendations
      const candidates: { word: string; dist: number }[] = [];
      validWordsSet.forEach(vWord => {
        if (Math.abs(vWord.length - stripped.length) <= 3) {
          const dist = getDistance(stripped, vWord);
          if (dist <= 3) {
            candidates.push({ word: vWord, dist });
          }
        }
      });

      candidates.sort((x, y) => {
        if (x.dist !== y.dist) return x.dist - y.dist;
        return Math.abs(x.word.length - stripped.length) - Math.abs(y.word.length - stripped.length);
      });

      const listSugg = candidates.slice(0, 3).map(c => {
        // Restore capitalizations
        if (token === token.toUpperCase()) {
          return c.word.toUpperCase();
        } else if (token[0] === token[0].toUpperCase()) {
          return c.word.charAt(0).toUpperCase() + c.word.slice(1);
        }
        return c.word;
      });

      return {
        text: token,
        isWord: true,
        isTypo: true,
        bestSuggestion: listSugg[0] || undefined,
        suggestions: listSugg
      };
    });

    setCheckedResults(results);
    setIsAnalyzing(false);
    setSelectedWordIdx(null);
  };

  // Auto Correct All
  const handleAutoCorrectAll = () => {
    let correctedText = '';
    const newResults = checkedResults.map(item => {
      if (item.isTypo && item.bestSuggestion) {
        correctedText += item.bestSuggestion;
        return {
          ...item,
          text: item.bestSuggestion,
          isTypo: false,
          bestSuggestion: undefined,
          suggestions: []
        };
      }
      correctedText += item.text;
      return item;
    });
    setTypoText(correctedText);
    setCheckedResults(newResults);
    showStatus("Seluruh kesalahan ketik berhasil diperbaiki otomatis!", 'success');
  };

  // Correct Single Token
  const handleCorrectSingleWord = (idx: number, replacement: string) => {
    const newResults = [...checkedResults];
    newResults[idx] = {
      ...newResults[idx],
      text: replacement,
      isTypo: false,
      bestSuggestion: undefined,
      suggestions: []
    };
    setCheckedResults(newResults);
    
    const newText = newResults.map(r => r.text).join('');
    setTypoText(newText);
    setSelectedWordIdx(null);
    showStatus(`Kata berhasil dikoreksi menjadi "${replacement}"`, 'success');
  };

  // Document script client loader
  const loadExternalScript = (url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const existingScript = document.querySelector(`script[src="${url}"]`);
      if (existingScript) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = url;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Gagal memuat pustaka parser: ${url}`));
      document.head.appendChild(script);
    });
  };

  // PDF client reader
  const extractTextFromPDF = async (arrayBuffer: ArrayBuffer): Promise<string> => {
    await loadExternalScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js');
    const pdfjsLib = (window as any)['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
    
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await loadingTask.promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n';
    }
    return fullText;
  };

  // DOCX client reader
  const extractTextFromDOCX = async (arrayBuffer: ArrayBuffer): Promise<string> => {
    await loadExternalScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');
    const mammoth = (window as any).mammoth;
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  };

  // Document import
  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileLoading(true);
    showStatus(`Membaca dokumen: ${file.name}...`, 'info');

    try {
      const arrayBuffer = await file.arrayBuffer();
      let extractedText = '';

      if (file.name.endsWith('.pdf')) {
        extractedText = await extractTextFromPDF(arrayBuffer);
      } else if (file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
        extractedText = await extractTextFromDOCX(arrayBuffer);
      } else if (file.name.endsWith('.txt')) {
        extractedText = new TextDecoder().decode(arrayBuffer);
      } else {
        throw new Error("Format tidak didukung. Unggah berkas .pdf, .docx, atau .txt");
      }

      if (!extractedText.trim()) {
        throw new Error("Gagal mengekstrak teks atau berkas kosong.");
      }

      setTypoText(extractedText);
      showStatus("Dokumen berhasil diunggah!", 'success');
      handleTriggerCheck(extractedText);
    } catch (err: any) {
      console.error(err);
      showStatus(err.message || "Gagal memproses dokumen.", 'error');
    } finally {
      setFileLoading(false);
      if (e.target) e.target.value = '';
    }
  };
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Admin Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<WordEntry>({ word: '', category: 'Nomina', etymology: '', definition: '', examples: ['', ''] });
  const [suggestions, setSuggestions] = useState<WordEntry[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

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
        if (u && u.email === 'yokotenkaizen@gmail.com') {
          setUser(u);
          setIsAdmin(true);
        }
      } catch {
        localStorage.removeItem('leksikon_admin_session');
      }
    }

    // Load Notification Preference
    const notifPref = localStorage.getItem('leksikon_notifications');
    if (notifPref === 'enabled') {
      setNotificationsEnabled(true);
    }

    const savedUpload = localStorage.getItem('leksikon_last_upload');
    if (savedUpload) {
      try {
        setLastUpload(JSON.parse(savedUpload));
      } catch (e) {
        console.warn("Error loading last upload:", e);
      }
    }

    // Offline detection
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Handle word links from notifications/URL
  useEffect(() => {
    const handleInboundWord = (word: string) => {
      if (word) {
        handleSearch(word);
      }
    };

    // 1. Handle URL parameter
    const params = new URLSearchParams(window.location.search);
    const urlWord = params.get('word');
    if (urlWord) {
      handleInboundWord(urlWord);
      // Clean up URL without refreshing
      window.history.replaceState({}, '', '/');
    }

    // 2. Handle Message from Service Worker
    const messageHandler = (event: MessageEvent) => {
      if (event.data && event.data.type === 'OPEN_WORD') {
        handleInboundWord(event.data.word);
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', messageHandler);
    }

    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', messageHandler);
      }
    };
  }, [words, db]); // Re-run if words or db changes to ensure handleSearch has context if needed

  // Speech Voices Pre-loading & Synthesis Cleanup
  useEffect(() => {
    if (!window.speechSynthesis) return;

    const loadVoices = () => {
      if (window.speechSynthesis) window.speechSynthesis.getVoices();
    };
    
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  const sendNotification = async (title: string, options?: NotificationOptions) => {
    if (!("Notification" in window)) return;
    
    if (Notification.permission === "granted") {
      try {
        // Try using Service Worker registration (preferred for PWAs/Mobile)
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          if (registration && registration.showNotification) {
            await registration.showNotification(title, options);
            return;
          }
        }
        // Fallback to standard constructor (if available and not failing)
        try {
          new Notification(title, options);
        } catch (e) {
          console.warn("Notification constructor failed (Illegal constructor?), falling back to console:", e);
        }
      } catch (err) {
        console.error("Critical Notification error:", err);
      }
    }
  };

  const toggleNotifications = async () => {
    if (!("Notification" in window)) {
      showStatus("Perangkat Anda tidak mendukung notifikasi. Gunakan Chrome untuk pengalaman terbaik.", 'info');
      return;
    }

    if (notificationsEnabled) {
      setNotificationsEnabled(false);
      localStorage.setItem('leksikon_notifications', 'disabled');
      showStatus("Notifikasi harian dimatikan.", 'info');
    } else {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          setNotificationsEnabled(true);
          localStorage.setItem('leksikon_notifications', 'enabled');
          
          showStatus("Notifikasi Aktif! Anda akan menerima kata baru pukul 08:00 WIB.", 'success');
          
          await sendNotification('Leksikon Digital', {
            body: 'Notifikasi harian Leksikon telah diaktifkan!',
            icon: '/logo.png'
          });
        } else {
          showStatus("Izin ditolak. Harap izinkan notifikasi di pengaturan browser Anda.", 'error');
        }
      } catch (e) {
        console.error("Error requesting notification permission:", e);
        showStatus("Gagal meminta izin. Cek koneksi Anda.", 'error');
      }
    }
  };

  // Simulated daily notification logic
  useEffect(() => {
    if (!notificationsEnabled) return;

    const checkDailyNotif = async () => {
      const now = new Date();
      // WIB Offset (UTC+7)
      const hour = now.getUTCHours() + 7;
      const displayHour = hour >= 24 ? hour - 24 : hour;
      
      const today = now.toISOString().split('T')[0];
      const lastSent = localStorage.getItem('last_notif_sent');

      if (displayHour >= 8 && lastSent !== today && words.length > 0) {
        const index = Math.floor(Math.random() * words.length);
        const randomWord = words[index];
        
        await sendNotification('📖 Leksikon: Kata Hari Ini', {
          body: `${randomWord.word.toUpperCase()}: ${randomWord.definition}`,
          icon: '/logo.png',
          badge: '/logo.png',
          tag: 'daily-word',
          data: { word: randomWord.word.toLowerCase() }
        });

        localStorage.setItem('last_notif_sent', today);
      }
    };

    const interval = setInterval(checkDailyNotif, 1000 * 60); // Check every minute
    checkDailyNotif(); // Run once on load
    return () => {
      clearInterval(interval);
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, [notificationsEnabled, words]);

  // Listen for Firestore updates - Limited to prevent over-fetching thousands of words
  useEffect(() => {
    if (!db) return;
    // Only fetch limited number of words for initial display/metadata
    // Using a larger limit for better offline search coverage
    const q = query(collection(db, 'words'), limit(5000));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const wordsData: WordEntry[] = [];
      snapshot.forEach((doc) => {
        wordsData.push(doc.data() as WordEntry);
      });
      console.log(`Loaded ${wordsData.length} words from Firestore (cache/online)`);
      setWords(wordsData);
    }, (err) => {
      console.warn("Firestore listener error:", err.message);
      // In offline mode, Firestore will still emit snapshot from cache if available
    });

    return () => unsubscribe();
  }, []);

  // Listen for global stats
  useEffect(() => {
    if (!db) return;
    const docRef = doc(db, 'stats', 'global');
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        setStats(snapshot.data() as any);
      }
    }, (err) => {
      console.warn("Stats listener error:", err);
    });
    return () => unsubscribe();
  }, []);

  // Excel Export Template
  const downloadTemplate = () => {
    const templateData = [
      ["Kata", "Kategori", "Etimologi", "Definisi", "Contoh Kalimat", "Jumlah Pencarian"],
      ["Integritas", "Nomina", "Dari bahasa Latin 'integritas'.", "Mutu, sifat, atau keadaan yang menunjukkan kesatuan yang utuh sehingga memiliki potensi dan kemampuan yang memancarkan kewibawaan; kejujuran.", "Setiap pemimpin harus memiliki integritas yang tinggi.;Integritas bangsa harus tetap terjaga.", 0],
      ["Resiliensi", "Nomina", "Dari bahasa Inggris 'resilience'.", "Kemampuan untuk beradaptasi dan tetap teguh dalam situasi sulit; daya kenyal; daya lentur.", "Resiliensi masyarakat pesisir diuji saat menghadapi banjir rob.;Pendidikan karakter membangun resiliensi mental.", 0]
    ];

    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Kamus");
    XLSX.writeFile(wb, "Template_Kamus_Pintar.xlsx");
  };

  // Excel Export Current Data
  const downloadCurrentData = async () => {
    if (!db) {
      showStatus("Basis data tidak tersedia.", 'error');
      return;
    }
    setIsProcessing(true);
    try {
      // Fetch all words for export
      const querySnapshot = await getDocs(collection(db, 'words'));
      const exportData: any[][] = [
        ["Kata", "Kategori", "Etimologi", "Definisi", "Contoh Kalimat", "Jumlah Pencarian"]
      ];

      querySnapshot.forEach((doc) => {
        const w = doc.data() as WordEntry;
        exportData.push([
          w.word,
          w.category,
          w.etymology || '',
          w.definition,
          (w.examples || []).join(';'),
          w.searchCount || 0
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Database Leksikon");
      XLSX.writeFile(wb, `Database_Leksikon_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      console.error("Export error:", err);
      showStatus("Gagal mengekspor data.", 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Excel Import Logic
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!user) {
      showStatus("Harap login sebagai admin untuk mengunggah file.", 'info');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      if (!db) {
        showStatus("Basis data tidak tersedia.", 'error');
        return;
      }
      setIsProcessing(true);
      setError("Sedang memproses file Excel...");
      
      try {
        const bstr = evt.target?.result as string;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        // Validasi header (baris pertama)
        // A: Kata, B: Kategori, C: Etimologi, D: Definisi, E: Contoh Kalimat, F: Jumlah Pencarian
        const validRows = data.slice(1).filter(row => row[0] && row[3]); // Minimal ada kata dan definisi
        
        let successCount = 0;
        for (const row of validRows) {
          const word = String(row[0]).trim();
          const category = String(row[1] || 'Nomina').trim();
          const etymology = String(row[2] || '').trim();
          const definition = String(row[3]).trim();
          // Contoh kalimat dipisahkan dengan titik koma (;)
          const examples = row[4] ? String(row[4]).split(';').map(s => s.trim()) : [];
          const searchCount = row[5] ? Number(row[5]) : 0;
          
          const wordEntry: WordEntry = {
            word,
            category,
            etymology,
            definition,
            examples,
            searchCount
          };

          const wordId = word.toLowerCase();
          await setDoc(doc(db, 'words', wordId), {
            ...wordEntry,
            updatedAt: new Date().toISOString()
          });
          successCount++;
        }

        const uploadInfo = {
          timestamp: new Date().toLocaleString('id-ID'),
          count: successCount
        };
        setLastUpload(uploadInfo);
        localStorage.setItem('leksikon_last_upload', JSON.stringify(uploadInfo));

        showStatus(`Berhasil mengimpor ${successCount} kosakata ke database.`, 'success');
        setError(null);
      } catch (err) {
        console.error(err);
        setError("Gagal membaca file Excel. Pastikan format kolom sesuai: Kata, Kategori, Etimologi, Definisi, Contoh Kalimat, Jumlah Pencarian.");
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
    localStorage.setItem('kamus_history', JSON.stringify([]));
  }, []);

  // Increment global install count
  const incrementInstall = async () => {
    if (!db) return;
    try {
      await setDoc(doc(db, 'stats', 'global'), {
        totalInstalls: increment(1)
      }, { merge: true });
    } catch (e) {
      console.warn("Failed to increment install count:", e);
    }
  };

  useEffect(() => {
    // Cek apakah mobile
    const checkMobile = () => {
      return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    };
    checkMobile();
    
    // Jika PWA sudah terinstal
    window.addEventListener('appinstalled', () => {
      incrementInstall();
    });

    return () => {};
  }, []);

  const handleInstallApp = () => {
    // Cek apakah sudah dalam mode PWA/Standalone
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                  (window.navigator as any).standalone || 
                  navigator.userAgent.includes('wv');

    if (isPWA) {
      showStatus("Aplikasi sudah terinstal. Download hanya tersedia di browser. Terima kasih!", 'info', 6000);
      return;
    }

    // Tautan langsung ke Google Drive untuk download otomatis
    const driveFileId = '1BXwIvwRnMTT8W7N5Sfxy9xNKWRhi2-kr';
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${driveFileId}`;
    
    showStatus("Menyiapkan unduhan APK Leksikon...", 'success');
    incrementInstall();

    // Mencoba membuka di jendela baru untuk download, jika gagal gunakan redirect
    try {
      const win = window.open(downloadUrl, '_blank');
      if (!win || win.closed || typeof win.closed === 'undefined') {
        window.location.href = downloadUrl;
      }
    } catch {
      window.location.href = downloadUrl;
    }
  };

  const handleSearch = async (queryStr: string = searchQuery) => {
    const trimmedQuery = queryStr.trim().toLowerCase();
    if (!trimmedQuery) return;

    setError(null);
    setIsProcessing(true);
    setSearchQuery(trimmedQuery);
    setShowSuggestions(false);

    try {
      // 1. Check local state 'words' (already contains some cached/synced words)
      let found = words.find(w => w.word.toLowerCase() === trimmedQuery);
      
      // 2. Fetch from Firestore (will use local cache if offline)
      if (!found && db) {
        const docRef = doc(db, 'words', trimmedQuery);
        try {
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            found = docSnap.data() as WordEntry;
          }
        } catch (getErr: any) {
          console.warn("Failed to fetch from Firestore:", getErr.message);
          // If completely offline and not in cache, 'getDoc' might throw 
        }
      }

      if (found) {
        setResult(found);
        addToHistory(trimmedQuery);
        
        // 3. Increment global search count & specific word searchCount (Backgrounded, Firestore handles offline queueing)
        if (found && db) {
          const wordId = found.word.toLowerCase();
          
          // Increment word specific searchCount
          setDoc(doc(db, 'words', wordId), {
            searchCount: increment(1)
          }, { merge: true }).catch(e => {
            console.warn("Word search count increment queued or failed:", e.message);
          });

          // Increment global stats searches
          setDoc(doc(db, 'stats', 'global'), {
            totalSearches: increment(1)
          }, { merge: true }).catch(e => {
            console.warn("Search count increment queued or failed:", e.message);
          });
        }
      } else {
        if (isOffline) {
          setError('Maaf, kata ini belum ada di memori offline. Hubungkan ke internet untuk mencarinya.');
        } else {
          setError('Maaf, kata tersebut tidak ditemukan dalam basis data.');
        }
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
      showStatus("Harap login untuk menyimpan perubahan.", 'info');
      return;
    }

    if (!db) {
      showStatus("Basis data tidak tersedia. Perubahan tidak dapat disimpan.", 'error');
      return;
    }
    
    const wordId = editForm.word.toLowerCase();
    try {
      if (isOffline) {
        showStatus("Anda sedang offline. Perubahan telah disimpan secara lokal dan akan disinkronkan saat internet kembali.", 'info');
      }
      
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
    if (!db) {
      showStatus("Basis data tidak tersedia.", 'error');
      return;
    }
    if (window.confirm(`Hapus kata "${word}" dari database?`)) {
      const wordId = word.toLowerCase();
      try {
        if (isOffline) {
          showStatus("Anda sedang offline. Penghapusan telah dijadwalkan dan akan disinkronkan saat internet kembali.", 'info');
        }
        await deleteDoc(doc(db, 'words', wordId));
        setResult(null);
        setHistory(prev => prev.filter(w => w.toLowerCase() !== word.toLowerCase()));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `words/${wordId}`);
      }
    }
  };

  const handleSpeak = (text: string, subText: string) => {
    if (!window.speechSynthesis) {
      showStatus("Modul suara tidak tersedia/aktif di perangkat ini.", 'error');
      return;
    }

    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();

      if (isSpeaking) {
        setIsSpeaking(false);
        return;
      }

      setTimeout(() => {
        const UtteranceClass = window.SpeechSynthesisUtterance || (window as any).webkitSpeechSynthesisUtterance;
        if (!UtteranceClass) return;

        const utterance = new UtteranceClass(`${text}. Definisi: ${subText}`);
        utterance.lang = 'id-ID';
        
        const setVoice = () => {
          if (!window.speechSynthesis) return;
          const voices = window.speechSynthesis.getVoices();
          
          const idVoice = voices.find(v => v.lang === 'id-ID' || v.lang === 'id_ID' || v.lang.startsWith('id')) || 
                          voices.find(v => v.name.toLowerCase().includes('indonesia'));
          
          if (idVoice) {
            utterance.voice = idVoice;
          }
          
          utterance.rate = 0.9; 
          utterance.pitch = 1.0;
          utterance.volume = 1.0;

          utterance.onstart = () => setIsSpeaking(true);
          utterance.onend = () => setIsSpeaking(false);
          utterance.onerror = (event: any) => {
            setIsSpeaking(false);
            if (event.error === 'language-unavailable') {
              utterance.lang = ''; 
              window.speechSynthesis.speak(utterance);
            } else if (event.error === 'network') {
              showStatus("Koneksi internet diperlukan untuk memuat suara.", 'info');
            }
          };

          window.speechSynthesis.speak(utterance);
        };

        const currentVoices = window.speechSynthesis.getVoices();
        if (currentVoices.length === 0) {
          const timeout = setTimeout(() => setVoice(), 1000);
          window.speechSynthesis.onvoiceschanged = () => {
            clearTimeout(timeout);
            setVoice();
            window.speechSynthesis.onvoiceschanged = null;
          };
        } else {
          setVoice();
        }
      }, 150);
    } catch (err) {
      console.error("Speech Failure:", err);
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
      console.log("Login successful, setting admin state...");
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
      <header className="max-w-6xl mx-auto px-6 py-6 md:py-8 flex flex-col md:flex-row md:items-center justify-between border-b border-[#1a1a1a]/10 mb-8 md:mb-12">
        <div className="cursor-pointer group flex items-center gap-4" onClick={() => { setResult(null); setSearchQuery(''); }}>
          <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-[#1a1a1a] to-gray-700 rounded-xl flex items-center justify-center shadow-lg transform group-hover:scale-105 transition-all">
            <span className="text-white text-2xl md:text-3xl font-black font-sans">L</span>
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase font-sans group-hover:text-gray-700 transition-colors leading-none">Leksikon</h1>
            <p className="text-[8px] md:text-[9px] font-sans uppercase tracking-[0.2em] opacity-50 mt-1">Kamus Besar Bahasa Indonesia Digital</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 md:gap-4 text-[10px] font-sans font-bold uppercase tracking-widest mt-6 md:mt-0 items-center justify-center md:justify-end">
            {isOffline && (
        <div className="flex items-center gap-2 px-3 py-1.5 border border-red-100 bg-red-50 text-red-600 rounded-sm">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
          <span className="text-[9px]">Offline</span>
        </div>
      )}
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
                title="Pasang Aplikasi"
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
                title="Pasang Aplikasi"
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

      {/* Tab Navigation */}
      <div className="max-w-6xl mx-auto px-6 mb-8 flex border-b border-[#1a1a1a]/10 gap-8">
        <button
          id="tab-kamus"
          onClick={() => { setActiveTab('kamus'); }}
          className={`pb-4 text-xs font-sans font-bold uppercase tracking-widest border-b-2 transition-all ${
            activeTab === 'kamus'
              ? 'border-[#1a1a1a] text-[#1a1a1a]'
              : 'border-transparent text-gray-400 hover:text-[#1a1a1a]'
          }`}
        >
          Kamus Leksikon
        </button>
        <button
          id="tab-pemeriksa"
          onClick={() => { setActiveTab('pemeriksa'); }}
          className={`pb-4 text-xs font-sans font-bold uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'pemeriksa'
              ? 'border-[#1a1a1a] text-[#1a1a1a]'
              : 'border-transparent text-gray-400 hover:text-[#1a1a1a]'
          }`}
        >
          Pemeriksa Typo (KBBI) <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[9px] font-sans font-black uppercase">Fitur Baru</span>
        </button>
      </div>

      {activeTab === 'kamus' ? (
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
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchQuery(val);
                  if (val.trim().length > 0) {
                    const filtered = words.filter(w => 
                      w.word.toLowerCase().startsWith(val.toLowerCase())
                    ).slice(0, 5);
                    setSuggestions(filtered);
                    setShowSuggestions(true);
                  } else {
                    setShowSuggestions(false);
                  }
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="bg-transparent text-2xl focus:outline-none w-full italic font-light placeholder:text-gray-300"
              />
            </div>
            
            {/* Autocomplete Suggestions */}
            {showSuggestions && suggestions.length > 0 && (
              <div 
                className="absolute z-40 left-0 right-0 top-full mt-2 bg-white border border-gray-200 shadow-xl rounded-sm overflow-hidden"
              >
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSearch(s.word)}
                    className="w-full text-left px-4 py-3 hover:bg-[#fdfbf7] flex items-center justify-between group transition-colors"
                  >
                    <span className="font-serif italic text-lg capitalize">{s.word}</span>
                    <ArrowRight size={14} className="opacity-0 group-hover:opacity-30 transform -translate-x-2 group-hover:translate-x-0 transition-all" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {isAdmin && (
            <div className="space-y-4">
              <button 
                onClick={() => {
                  setEditForm({ word: '', category: 'Nomina', etymology: '', definition: '', examples: ['', ''] });
                  setIsEditing(true);
                }}
                className="w-full py-4 border-2 border-dashed border-gray-200 rounded-sm text-gray-400 hover:border-[#1a1a1a] hover:text-[#1a1a1a] transition-all flex items-center justify-center gap-2 font-sans font-bold uppercase tracking-widest text-xs"
              >
                <Plus size={16} /> Tambah Kosakata Baru
              </button>

              <div className="p-4 bg-white border border-gray-200 rounded-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[9px] font-sans font-bold uppercase tracking-[0.2em] opacity-40">Statistik Data</h4>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                    <span className="text-[9px] font-sans font-bold text-green-600 uppercase">Live</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs opacity-60">Total Kata:</span>
                    <span className="text-xl font-bold font-sans tracking-tight">{words.length}+</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 border-t border-gray-50 pt-3">
                    <div>
                      <p className="text-[8px] font-sans font-bold uppercase tracking-[0.2em] opacity-40 mb-1">Total Pencarian</p>
                      <p className="text-lg font-bold font-sans">{(stats?.totalSearches || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[8px] font-sans font-bold uppercase tracking-[0.2em] opacity-40 mb-1">Total Instalasi</p>
                      <p className="text-lg font-bold font-sans">{(stats?.totalInstalls || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
                {lastUpload && (
                  <div className="space-y-2 pt-2 border-t border-gray-50">
                    <div className="flex justify-between text-[9px] font-sans uppercase tracking-widest opacity-50">
                      <span>Upload Terakhir:</span>
                      <span>{lastUpload.timestamp}</span>
                    </div>
                    <div className="flex justify-between text-[9px] font-sans uppercase tracking-widest opacity-50">
                      <span>Jumlah Baris:</span>
                      <span>{lastUpload.count} Kata</span>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-1 gap-2">
                <button 
                  onClick={downloadCurrentData}
                  disabled={isProcessing}
                  className="w-full py-3 border border-gray-200 rounded-sm text-[10px] font-sans font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white hover:border-[#1a1a1a] transition-all disabled:opacity-50"
                >
                  <Download size={14} /> Unduh Data Terbaru (Excel)
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
                      if (!db) {
                        showStatus("Basis data tidak tersedia.", 'error');
                        return;
                      }
                      if(window.confirm('Impor 150 kata contoh ke database?')) {
                        const seed = async () => {
                          setIsProcessing(true);
                          try {
                            for(const w of initialWords) {
                              await setDoc(doc(db, 'words', w.word.toLowerCase()), {
                                ...w,
                                searchCount: w.searchCount || 0
                              });
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
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2">
                      <Bell size={14} className="text-amber-400" />
                      <h3 className="text-[10px] font-sans font-bold uppercase tracking-widest text-amber-400">Pratinjau Notifikasi (08:00 WIB)</h3>
                    </div>
                    <span className="text-[8px] bg-white/10 px-2 py-0.5 rounded-full text-white/50 tracking-widest uppercase">Real-time</span>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="bg-white/5 p-4 rounded-sm border border-white/5 hover:bg-white/10 transition-colors group">
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-[10px] font-sans uppercase tracking-[0.2em] opacity-40">📱 Notifikasi Ponsel</p>
                        <span className="text-[8px] opacity-20">Baru Saja</span>
                      </div>
                      <h4 className="text-lg font-bold font-sans tracking-tight mb-1 text-white border-l-2 border-amber-400 pl-3">
                        📖 Leksikon: {words.length > 0 ? words[Math.floor(Date.now()/1000/60/60/24) % words.length]?.word.toUpperCase() : 'BERDIKARI'}
                      </h4>
                      <p className="text-xs text-gray-400 line-clamp-2 italic font-serif pl-3 mt-2">
                        {words.length > 0 ? words[Math.floor(Date.now()/1000/60/60/24) % words.length]?.definition : 'Berdiri di atas kaki sendiri; tidak bergantung pada bantuan.'}
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
                <span className="inline-block px-2 py-1 bg-[#1a1a1a] text-[#fdfbf7] text-[9px] uppercase tracking-widest mb-6 font-sans font-bold">Informasi</span>
                <h3 className="text-4xl mb-4 leading-none italic">Kamus Pintar</h3>
                <p className="text-sm leading-relaxed opacity-80 font-serif mb-8">
                  Jelajahi kekayaan kosakata Indonesia dengan definisi akurat dan contoh penggunaan yang tepat.
                </p>

                <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-[#fdfbf7] border border-gray-100 rounded-sm">
                      <Bell size={14} className="text-[#1a1a1a]" />
                    </div>
                    <div>
                      <h4 className="text-[10px] font-sans font-bold uppercase tracking-wider mb-1">Automated Notification</h4>
                      <p className="text-[10px] opacity-60 leading-tight">Dapatkan kosakata baru setiap hari pukul 08:00 WIB.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-[#fdfbf7] border border-gray-100 rounded-sm">
                      <BookOpen size={14} className="text-[#1a1a1a]" />
                    </div>
                    <div>
                      <h4 className="text-[10px] font-sans font-bold uppercase tracking-wider mb-1">Etimologi Kosa Kata</h4>
                      <p className="text-[10px] opacity-60 leading-tight">Pelajari asal-usul dari setiap kosakata bahasa Indonesia.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-[#fdfbf7] border border-gray-100 rounded-sm">
                      <WifiOff size={14} className="text-[#1a1a1a]" />
                    </div>
                    <div>
                      <h4 className="text-[10px] font-sans font-bold uppercase tracking-wider mb-1">Offline Access</h4>
                      <p className="text-[10px] opacity-60 leading-tight">Tetap bisa mencari meskipun tanpa koneksi internet data.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-[#fdfbf7] border border-gray-100 rounded-sm">
                      <Cloud size={14} className="text-[#1a1a1a]" />
                    </div>
                    <div>
                      <h4 className="text-[10px] font-sans font-bold uppercase tracking-wider mb-1">Cloud Sync</h4>
                      <p className="text-[10px] opacity-60 leading-tight">Data disinkronkan secara otomatis ketika kembali online.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Definition View */}
        <div className="md:col-span-8">
          <React.Fragment>
            {isEditing ? (
              <div 
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
                    <label className="block text-[10px] font-sans font-bold uppercase tracking-widest mb-2 opacity-50">Asal Usul (Etimologi)</label>
                    <textarea 
                      value={editForm.etymology}
                      onChange={(e) => setEditForm(prev => ({ ...prev, etymology: e.target.value }))}
                      className="w-full text-lg font-serif italic border border-gray-200 p-4 focus:border-[#1a1a1a] focus:outline-none min-h-[80px] bg-transparent"
                      placeholder="Contoh: Dari bahasa Sanskerta '...' atau bahasa Arab '...'"
                    />
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
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 p-12 rounded-sm text-center">
                <div className="max-w-xs mx-auto">
                  <h3 className="font-sans font-bold text-xs uppercase tracking-widest text-red-900 mb-4">Tidak Ditemukan</h3>
                  <p className="text-red-800 italic text-2xl mb-8 leading-relaxed">"{searchQuery}" belum terdaftar dalam leksikon kami.</p>
                  {isAdmin && (
                    <button 
                      onClick={() => {
                        setEditForm({ word: searchQuery, category: 'Nomina', etymology: '', definition: '', examples: ['', ''] });
                        setIsEditing(true);
                        setError(null);
                      }}
                      className="font-sans font-bold uppercase tracking-widest text-[10px] border border-red-300 px-4 py-2 hover:bg-red-100 transition-all"
                    >
                      Tambah Kata Ini
                    </button>
                  )}
                </div>
              </div>
            ) : result ? (
              <div
                className="bg-white p-6 md:p-8 shadow-[15px_15px_0px_#e5e2da] md:shadow-[20px_20px_0px_#e5e2da] border border-[#e5e2da] flex flex-col min-h-[400px]"
              >
                <div className="mb-6 md:mb-8 flex justify-between items-start">
                  <div>
                    <div className="flex items-baseline gap-4 md:gap-6 mb-2 flex-wrap">
                      <h2 className="text-4xl md:text-6xl font-light italic tracking-tight capitalize">{result.word}</h2>
                      <button 
                        onClick={() => handleSpeak(result.word, result.definition)}
                        className={`p-2 rounded-full border transition-all ${isSpeaking ? 'bg-[#1a1a1a] text-white border-[#1a1a1a] animate-pulse' : 'bg-white text-[#1a1a1a] border-gray-100 hover:border-[#1a1a1a]'}`}
                        title="Dengarkan Pengucapan"
                      >
                        {isSpeaking ? <VolumeX size={20} /> : <Volume2 size={20} />}
                      </button>
                      <span className="text-base md:text-lg font-serif italic opacity-40">/{result.word.toLowerCase().split('').join('·')}/</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="px-2 py-0.5 border border-[#1a1a1a] text-[9px] font-sans font-bold uppercase tracking-widest leading-none flex items-center">{result.category}</span>
                      <span className="px-2 py-0.5 border border-[#1a1a1a] text-[9px] font-sans font-bold uppercase tracking-widest leading-none flex items-center">Leksikon DB</span>
                    </div>
                  </div>
                  
                  {isAdmin && (
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => {
                          setEditForm(result);
                          setIsEditing(true);
                        }}
                        className="p-2 border border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-100 hover:bg-blue-50 transition-all"
                        title="Edit Kata"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteWord(result.word)}
                        className="p-2 border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-100 hover:bg-red-50 transition-all"
                        title="Hapus Kata"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex-grow space-y-6 md:space-y-8">
                  <section>
                    <h4 className="text-[9px] md:text-[10px] font-sans font-bold uppercase tracking-widest border-b border-gray-100 pb-2 mb-3 md:mb-4">Asal Usul Kata</h4>
                    <p className="text-lg md:text-xl italic font-serif text-gray-600">
                      {result.etymology || 'Informasi etimologi belum tersedia.'}
                    </p>
                  </section>

                  <section>
                    <h4 className="text-[9px] md:text-[10px] font-sans font-bold uppercase tracking-widest border-b border-gray-100 pb-2 mb-3 md:mb-4">Definisi</h4>
                    <p className="text-xl md:text-2xl leading-snug font-serif text-gray-900">
                      {result.definition}
                    </p>
                  </section>

                  <section>
                    <h4 className="text-[9px] md:text-[10px] font-sans font-bold uppercase tracking-widest border-b border-gray-100 pb-2 mb-3 md:mb-4">Contoh Penggunaan</h4>
                    <div className="space-y-4 md:space-y-6">
                      {result.examples.map((example, idx) => example && (
                        <p key={idx} className="text-base md:text-lg italic leading-relaxed text-gray-700 relative pl-6 md:pl-8">
                          <span className="absolute left-0 top-0 text-2xl md:text-4xl opacity-20 font-serif leading-none">“</span>
                          {example}
                        </p>
                      ))}
                    </div>
                  </section>
                </div>

                <div className="mt-8 pt-6 flex border-t border-gray-100 justify-between items-center">
                  <div className="flex gap-4">
                    <button 
                      onClick={() => {
                        setResult(null);
                        setSearchQuery('');
                      }}
                      className="px-5 py-2 bg-[#1a1a1a] text-white text-[9px] font-sans font-bold uppercase tracking-widest hover:bg-gray-800 transition-all"
                    >
                      Tutup
                    </button>
                  </div>
                  <div className="text-[9px] font-sans italic opacity-40">Terakhir diperbarui: {new Date().toLocaleDateString('id-ID')}</div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center border-2 border-dashed border-gray-200 rounded-sm p-12 text-center">
                <div className="max-w-xs">
                  <BookOpen className="mx-auto mb-6 text-gray-200" size={64} />
                  <p className="text-xl italic text-gray-400">Pilih kata di sebelah kiri atau masukkan kata baru untuk melihat definisi lengkap.</p>
                </div>
              </div>
            )}
          </React.Fragment>
        </div>
      </main>
      ) : (
        <main className="max-w-6xl mx-auto px-6 space-y-6">
          {isAdmin && (
            <div className="bg-amber-50 border border-amber-200/60 p-3 rounded-sm flex flex-col sm:flex-row items-baseline sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <ShieldAlert size={14} className="text-amber-600" />
                <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-[#1a1a1a]">
                  Akses Admin Terdeteksi: Manajemen Leksikon &amp; Pembayaran
                </span>
              </div>
              <div className="flex bg-amber-150 p-0.5 rounded-[2px] border border-amber-200">
                <button
                  onClick={() => setAdminTypoMode('checker')}
                  className={`px-3 py-1 text-[9px] uppercase font-sans font-bold tracking-wider transition-all rounded-[2px] ${adminTypoMode === 'checker' ? 'bg-[#1a1a1a] text-white' : 'text-amber-805 hover:text-[#1a1a1a]'}`}
                >
                  Alat Pemeriksa (Klien)
                </button>
                <button
                  onClick={() => setAdminTypoMode('admin')}
                  className={`px-3 py-1 text-[9px] uppercase font-sans font-bold tracking-wider transition-all rounded-[2px] ${adminTypoMode === 'admin' ? 'bg-[#1a1a1a] text-white' : 'text-amber-805 hover:text-[#1a1a1a]'}`}
                >
                  Panel Manajemen Admin (Realtime)
                </button>
              </div>
            </div>
          )}

          {adminTypoMode === 'admin' && isAdmin ? (
            <div className="bg-white border border-[#1a1a1a]/10 rounded-sm p-6 md:p-8 space-y-8 shadow-[10px_10px_0px_#f5f5f5] w-full">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-100 pb-6 gap-4">
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tight font-sans text-gray-800">Panel Manajemen Admin Typo</h2>
                  <p className="text-xs text-gray-500 font-serif mt-1">Konfirmasi pembayaran GOPAY/QRIS pengguna, unduh riwayat evaluasi kata, dan konfigurasikan saluran pembayaran.</p>
                </div>
                <div className="flex bg-gray-50 p-1 border border-gray-100 rounded-sm">
                  <button
                    onClick={() => setSelectedAdminSubTab('rekap_bayar')}
                    className={`px-4 py-2 text-[10px] uppercase font-sans font-bold tracking-wider transition-all rounded-sm ${selectedAdminSubTab === 'rekap_bayar' ? 'bg-[#1a1a1a] text-white shadow-md' : 'text-gray-500 hover:text-[#1a1a1a]'}`}
                  >
                    Rekapitulasi Pembayaran
                  </button>
                  <button
                    onClick={() => setSelectedAdminSubTab('riwayat_eval')}
                    className={`px-4 py-2 text-[10px] uppercase font-sans font-bold tracking-wider transition-all rounded-sm ${selectedAdminSubTab === 'riwayat_eval' ? 'bg-[#1a1a1a] text-white shadow-md' : 'text-gray-500 hover:text-[#1a1a1a]'}`}
                  >
                    Riwayat Pemeriksaan
                  </button>
                  <button
                    onClick={() => setSelectedAdminSubTab('pengaturan_bayar')}
                    className={`px-4 py-2 text-[10px] uppercase font-sans font-bold tracking-wider transition-all rounded-sm ${selectedAdminSubTab === 'pengaturan_bayar' ? 'bg-[#1a1a1a] text-white shadow-md' : 'text-gray-500 hover:text-[#1a1a1a]'}`}
                  >
                    Pengaturan Saluran
                  </button>
                </div>
              </div>

              {/* REKAPITULASI PEMBAYARAN */}
              {selectedAdminSubTab === 'rekap_bayar' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-sans font-black uppercase tracking-widest text-[#1a1a1a]">Manajemen Status Pengguna &amp; Pembayaran</h3>
                    <span className="text-[10px] bg-amber-50 border border-amber-200 text-amber-850 px-2.5 py-1 font-mono rounded-sm font-bold">
                      Total Permohonan: {allPayments.length}
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-gray-200 rounded-sm font-sans">
                    <table className="w-full text-left font-sans text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-widest text-[9px] font-black">
                          <th className="px-6 py-4">Nomor Email Masuk</th>
                          <th className="px-6 py-4">Status Layanan</th>
                          <th className="px-6 py-4">Jumlah Transfer</th>
                          <th className="px-6 py-4">Waktu Pengajuan</th>
                          <th className="px-6 py-4 text-right">Aksi Tindak</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-150">
                        {allPayments.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-serif italic text-sm">
                              Tidak ada daftar pengajuan pembayaran yang masuk saat ini.
                            </td>
                          </tr>
                        ) : (
                          allPayments.map((pay, idx) => (
                            <tr key={idx} className="hover:bg-[#fdfbf7]/50 transition-colors">
                              <td className="px-6 py-4 font-mono font-bold text-gray-750">{pay.email}</td>
                              <td className="px-6 py-4">
                                {pay.status === 'pending' ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest bg-amber-50 text-amber-800 border border-amber-200 animate-pulse">
                                    <Clock size={10} /> Pending
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest bg-green-50 text-green-800 border border-green-200">
                                    <Check size={10} /> Disetujui
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 font-mono text-gray-950 font-bold">
                                Rp. {String(pay.amount || 5000).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
                              </td>
                              <td className="px-6 py-4 text-gray-400">
                                {pay.requestedAt ? new Date(pay.requestedAt).toLocaleString("id-ID") : "-"}
                              </td>
                              <td className="px-6 py-4 text-right">
                                {pay.status === 'pending' && (
                                  <button
                                    onClick={() => handleApprovePayment(pay.id, pay.email)}
                                    className="px-3 py-1.5 bg-[#1a1a1a] hover:bg-gray-800 text-white rounded-[2px] transition-all text-[9px] uppercase font-sans font-black tracking-widest flex items-center justify-center gap-1 ml-auto"
                                  >
                                    <Check size={10} /> Setujui Pembayaran
                                  </button>
                                )}
                                {pay.status === 'approved' && (
                                  <span className="text-[10px] text-gray-400 font-serif italic">Terverifikasi</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* RIWAYAT PEMERIKSAAN */}
              {selectedAdminSubTab === 'riwayat_eval' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h3 className="text-xs font-sans font-black uppercase tracking-widest text-[#1a1a1a]">Riwayat Pemeriksaan / Evaluasi Typo Pengguna</h3>
                      <p className="text-[11px] text-gray-400 font-serif mt-1">Seluruh kata, deteksi kesalahan, teks masukan, dan presisi akurasi pengguna direkam secara deterministik.</p>
                    </div>
                    <button
                      onClick={downloadTypoEvaluations}
                      className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[2px] text-[10px] uppercase font-sans font-black tracking-widest flex items-center gap-2 transition-all shadow-md shrink-0 font-sans"
                    >
                      <Download size={12} /> Unduh Riwayat (Excel)
                    </button>
                  </div>

                  <div className="overflow-x-auto border border-gray-200 rounded-sm">
                    <table className="w-full text-left font-sans text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-widest text-[9px] font-black font-sans">
                          <th className="px-6 py-4">Email</th>
                          <th className="px-6 py-4">Total Kata</th>
                          <th className="px-6 py-4">Typo Terdeteksi</th>
                          <th className="px-6 py-4">Skor Presisi</th>
                          <th className="px-6 py-4">Hasil Teks</th>
                          <th className="px-6 py-4">Waktu Check</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-150">
                        {allEvaluations.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-gray-400 font-serif italic text-sm">
                              Belum ada riwayat hasil pemeriksaan terdeteksi.
                            </td>
                          </tr>
                        ) : (
                          allEvaluations.map((ev, idx) => (
                            <tr key={idx} className="hover:bg-[#fdfbf7]/50 transition-colors">
                              <td className="px-6 py-4 font-mono font-bold text-gray-750">{ev.email}</td>
                              <td className="px-6 py-4 font-mono">{ev.totalWords || 0} kata</td>
                              <td className="px-6 py-4 font-mono text-red-500 font-bold">{ev.typosCount || 0} kata</td>
                              <td className="px-6 py-4 font-mono text-emerald-600 font-bold">{ev.precision || '100%'}</td>
                              <td className="px-6 py-4 font-serif text-gray-500 truncate max-w-[150px]" title={ev.inputText}>{ev.inputText}</td>
                              <td className="px-6 py-4 text-gray-400 font-mono">
                                {ev.timestamp ? new Date(ev.timestamp).toLocaleString("id-ID") : "-"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* PENGATURAN SALURAN GOPAY / QRIS */}
              {selectedAdminSubTab === 'pengaturan_bayar' && (
                <div className="space-y-6 max-w-xl animate-in fade-in duration-300">
                  <div>
                    <h3 className="text-xs font-sans font-black uppercase tracking-widest text-[#1a1a1a]">Konfigurasi Gopay &amp; QRIS</h3>
                    <p className="text-[11px] text-gray-400 font-serif mt-1">Ubah nomor pengantaran gopay dan tautan QRIS bayar. Perubahan disimpan ke Firestore dan langsung berefek pada pop-up transaksi klien secara realtime.</p>
                  </div>

                  <div className="space-y-6 pt-4">
                    <div className="space-y-2">
                      <label className="block text-[9px] font-sans font-bold uppercase tracking-widest text-[#1a1a1a] opacity-55 font-sans">Nomor Handphone GoPay</label>
                      <input
                        type="text"
                        value={gopayInput}
                        onChange={(e) => setGopayInput(e.target.value)}
                        placeholder="Contoh: 081234567890"
                        className="w-full text-base font-mono border-b border-gray-200 focus:border-[#1a1a1a] focus:outline-none py-2 bg-transparent text-gray-800"
                      />
                    </div>

                    <div className="space-y-4">
                      <label className="block text-[9px] font-sans font-bold uppercase tracking-widest text-[#1a1a1a] opacity-55 font-sans">Opsi Model Gambar QRIS</label>
                      <div className="flex border border-gray-200 p-0.5 rounded-sm bg-gray-50/50">
                        <button
                          type="button"
                          onClick={() => setQrisOption('url')}
                          className={`flex-1 py-2 text-[10px] uppercase font-sans font-bold tracking-wider transition-all rounded-[2px] ${qrisOption === 'url' ? 'bg-[#1a1a1a] text-white shadow-sm' : 'text-gray-500 hover:text-[#1a1a1a]'}`}
                        >
                          Pakai Link URL
                        </button>
                        <button
                          type="button"
                          onClick={() => setQrisOption('upload')}
                          className={`flex-1 py-2 text-[10px] uppercase font-sans font-bold tracking-wider transition-all rounded-[2px] ${qrisOption === 'upload' ? 'bg-[#1a1a1a] text-white shadow-sm' : 'text-gray-500 hover:text-[#1a1a1a]'}`}
                        >
                          Upload Foto QRIS
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start pt-2">
                        <div className="space-y-4">
                          {qrisOption === 'url' ? (
                            <div className="space-y-2 animate-in fade-in duration-200">
                              <label className="block text-[9px] font-sans font-bold uppercase tracking-widest text-[#1a1a1a] opacity-55 font-sans">Tautan / URL Gambar QRIS</label>
                              <input
                                type="text"
                                value={qrisImageInput}
                                onChange={(e) => setQrisImageInput(e.target.value)}
                                placeholder="Contoh: https://example.com/qris.png"
                                className="w-full text-base font-mono border-b border-gray-200 focus:border-[#1a1a1a] focus:outline-none py-2 bg-transparent text-gray-800"
                              />
                              <p className="text-[10px] text-gray-400 font-serif italic">Ketik atau tempel URL gambar QRIS langsung.</p>
                            </div>
                          ) : (
                            <div className="space-y-2 animate-in fade-in duration-200">
                              <label className="block text-[9px] font-sans font-bold uppercase tracking-widest text-[#1a1a1a] opacity-55 font-sans">Unggah Gambar QRIS (.png, .jpg, .jpeg)</label>
                              <div className="border border-dashed border-gray-300 hover:border-[#1a1a1a] bg-gray-50/50 rounded-sm p-4 text-center cursor-pointer relative transition-all">
                                <input
                                  id="qris-file-upload-input"
                                  type="file"
                                  accept="image/png, image/jpeg, image/jpg"
                                  onChange={handleQrisFileUpload}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <div className="flex flex-col items-center justify-center gap-1 text-gray-400">
                                  <Upload size={18} />
                                  <span className="text-[10px] font-sans font-semibold uppercase tracking-wider text-gray-500">Pilih File QRIS</span>
                                  <span className="text-[9px] font-serif italic text-gray-400">klik atau seret ke sini (Maks 1MB)</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Visual Preview */}
                        <div className="border border-gray-100 rounded-sm p-4 bg-gray-50/50 flex flex-col items-center justify-center min-h-[160px] text-center border-dashed">
                          <span className="text-[9px] font-sans font-bold uppercase tracking-widest text-gray-400 mb-2">Pratinjau QRIS Aktif</span>
                          {qrisImageInput ? (
                            <div className="relative">
                              <img
                                src={qrisImageInput}
                                alt="Pratinjau QRIS"
                                className="w-28 h-28 object-contain border border-gray-200 p-1 bg-white rounded-[2px]"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = "https://placehold.co/150?text=Invalid+Image+URL";
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => setQrisImageInput('')}
                                className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md transition-all flex items-center justify-center"
                                title="Hapus Gambar"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-400 font-serif italic">Belum ada gambar QRIS terpasang. Unggah file gambar atau masukkan URL.</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="pt-4">
                      <button
                        onClick={handleSavePaymentSettings}
                        className="px-6 py-3.5 bg-[#1a1a1a] hover:bg-gray-800 text-white rounded-sm text-[10px] uppercase font-sans font-black tracking-widest flex items-center justify-center gap-2 transition-all shadow-md w-full sm:w-auto font-sans"
                      >
                        <Settings size={12} /> Simpan Pengaturan Saluran
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 w-full">
            {/* Left Column: Input Panel */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-white p-6 md:p-8 border border-gray-200 rounded-sm relative shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-[10px] font-sans font-bold uppercase tracking-widest opacity-50">Teks Input</h3>
                    <p className="text-xs text-gray-500 font-sans">Tulis manual, salin-tempel (copy-paste), atau unggah dokumen.</p>
                  </div>
                  {typoText && (
                    <button
                      onClick={() => {
                        setTypoText('');
                        setCheckedResults([]);
                        setSelectedWordIdx(null);
                      }}
                      className="text-xs text-red-500 font-sans font-bold hover:underline"
                    >
                      Bersihkan
                    </button>
                  )}
                </div>

                <textarea
                  id="typed-input-field"
                  value={typoText}
                  onChange={(e) => {
                    const txt = e.target.value;
                    setTypoText(txt);
                    // Reset results if text is cleared
                    if (!txt.trim()) {
                      setCheckedResults([]);
                    }
                  }}
                  placeholder="Ketik atau tempel teks di sini..."
                  rows={8}
                  className="w-full text-lg border border-gray-100 rounded-sm focus:border-[#1a1a1a] focus:outline-none p-4 bg-[#fdfbf7] font-serif leading-relaxed placeholder:opacity-50 resize-y"
                />

                <div className="flex flex-wrap items-center justify-between gap-4 mt-4">
                  {/* Document Uploader */}
                  <div className="flex items-center gap-2">
                    <label className={`px-4 py-2 bg-white text-[#1a1a1a] border border-gray-200 rounded-sm text-[10px] font-sans font-bold uppercase tracking-widest flex items-center gap-2 ${fileLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 hover:border-[#1a1a1a] cursor-pointer'} transition-all`}>
                      {fileLoading ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          <span>Membaca...</span>
                        </>
                      ) : (
                        <>
                          <FileText size={12} />
                          <span>Unggah PDF / DOC / TXT</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept=".pdf, .docx, .doc, .txt"
                        className="hidden"
                        onChange={handleDocumentUpload}
                        disabled={fileLoading}
                      />
                    </label>
                  </div>

                  {/* Submit Button */}
                  <button
                    id="analyze-typo-button"
                    onClick={() => handleTriggerCheck()}
                    disabled={isAnalyzing || !typoText.trim()}
                    className="px-6 py-2.5 bg-[#1a1a1a] text-white hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-[#1a1a1a] transition-all text-[10px] font-sans font-bold uppercase tracking-widest flex items-center gap-2"
                  >
                    {isAnalyzing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    Periksa Kesalahan
                  </button>
                </div>
              </div>

              {/* Informational Guidelines Card */}
              <div className="p-6 border border-amber-200/60 bg-amber-50/30 rounded-sm flex gap-4">
                <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={18} />
                <div className="space-y-1">
                  <h4 className="text-[10px] font-sans font-bold uppercase tracking-wider text-amber-900">Petunjuk Pemeriksa Typo</h4>
                  <p className="text-xs text-amber-800 font-serif leading-relaxed">
                    Sistem akan memecah teks Anda dan menganalisis setiap kata terhadap kamus KBBI di database serta daftar kosakata yang telah diimpor. Untuk dokumen <strong>PDF</strong> dan <strong>DOC/DOCX</strong>, teks akan terbaca otomatis di browser Anda tanpa perlu koneksi internet ataupun API AI pihak ketiga.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Dynamic Results Panel */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white border border-gray-200 rounded-sm p-6 md:p-8 shadow-sm space-y-6">
                <div>
                  <h3 className="text-[10px] font-sans font-bold uppercase tracking-widest opacity-50 mb-1">Hasil Evaluasi & Koreksi</h3>
                  <p className="text-xs text-gray-500 font-sans">Koreksi otomatis atau ketuk kata yang dihias merah untuk melihat saran.</p>
                </div>

                {checkedResults.length > 0 ? (
                  <div className="space-y-6">
                    {/* Metrics Banner */}
                    <div className="grid grid-cols-3 gap-2 py-4 px-4 bg-[#fdfbf7] border border-gray-100 rounded-sm text-center">
                      <div>
                        <p className="text-[8px] font-sans font-bold uppercase tracking-[0.15em] opacity-40 mb-0.5">Total Kata</p>
                        <p className="text-lg font-black font-sans text-[#1a1a1a]">
                          {checkedResults.filter(r => r.isWord).length}
                        </p>
                      </div>
                      <div>
                        <p className="text-[8px] font-sans font-bold uppercase tracking-[0.15em] opacity-40 mb-0.5">Typo Terdeteksi</p>
                        <p className={`text-lg font-black font-sans ${checkedResults.some(r => r.isTypo) ? 'text-amber-600' : 'text-green-600'}`}>
                          {checkedResults.filter(r => r.isTypo).length}
                        </p>
                      </div>
                      <div>
                        <p className="text-[8px] font-sans font-bold uppercase tracking-[0.15em] opacity-40 mb-0.5">Skor Presisi</p>
                        <p className="text-lg font-black font-sans text-green-600">
                          {(() => {
                            const totWords = checkedResults.filter(r => r.isWord).length;
                            if (totWords === 0) return '100%';
                            const typos = checkedResults.filter(r => r.isTypo).length;
                            return `${Math.round(((totWords - typos) / totWords) * 100)}%`;
                          })()}
                        </p>
                      </div>
                    </div>

                    {/* Interactive Editor View */}
                    <div className="border border-gray-100 rounded-sm p-4 bg-[#fdfbf7] max-h-60 overflow-y-auto leading-relaxed text-lg font-serif">
                      {checkedResults.map((item, idx) => {
                        if (!item.isWord) {
                          // Preserve tabs, newlines, spaces
                          if (item.text.includes('\n')) {
                            return (
                              <span key={idx}>
                                {item.text.split('\n').map((line, lIdx) => (
                                  <React.Fragment key={lIdx}>
                                    {lIdx > 0 && <br />}
                                    <span>{line}</span>
                                  </React.Fragment>
                                ))}
                              </span>
                            );
                          }
                          return <span key={idx}>{item.text}</span>;
                        }

                        if (item.isTypo) {
                          const isSelected = selectedWordIdx === idx;
                          return (
                            <span key={idx} className="relative inline-block">
                              <span
                                onClick={() => {
                                  setSelectedWordIdx(isSelected ? null : idx);
                                }}
                                className={`cursor-pointer underline decoration-wavy decoration-amber-500 font-bold ${
                                  isSelected ? 'bg-amber-100 text-amber-950' : 'text-amber-700 hover:bg-amber-50'
                                } px-1 rounded-sm transition-all`}
                                title="Ketuk untuk melihat saran perbaikan"
                              >
                                {item.text}
                              </span>
                              {isSelected && item.suggestions && item.suggestions.length > 0 && (
                                <span className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-2 bg-white border border-[#1a1a1a] shadow-xl p-3 rounded-sm w-48 text-left space-y-2">
                                  <span className="block text-[8px] font-sans font-bold uppercase tracking-wider opacity-40">Saran Perbaikan</span>
                                  <span className="flex flex-col gap-1">
                                    {item.suggestions.map((sugg, sIdx) => (
                                      <button
                                        key={sIdx}
                                        onClick={() => handleCorrectSingleWord(idx, sugg)}
                                        className="text-xs text-[#1a1a1a] hover:bg-amber-50 text-left px-2 py-1 rounded-sm font-sans font-semibold border border-transparent hover:border-amber-200 transition-colors"
                                      >
                                        {sugg}
                                      </button>
                                    ))}
                                  </span>
                                  <button
                                    onClick={() => setSelectedWordIdx(null)}
                                    className="block text-[8px] font-sans font-bold text-center w-full uppercase text-gray-400 pt-1 border-t hover:text-[#1a1a1a]"
                                  >
                                    Tutup
                                  </button>
                                </span>
                              )}
                            </span>
                          );
                        }

                        return <span key={idx}>{item.text}</span>;
                      })}
                    </div>

                    {/* Suggestions Box */}
                    {checkedResults.some(r => r.isTypo) && (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <h4 className="text-[10px] font-sans font-bold uppercase tracking-wider opacity-50">Koreksi Cepat</h4>
                          <button
                            id="autocorrect-all-button"
                            onClick={handleAutoCorrectAll}
                            className="text-xs font-sans font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1.5 transition-colors"
                          >
                            <Check size={12} /> Perbaiki Semua Typo
                          </button>
                        </div>
                        
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {checkedResults.map((item, idx) => {
                            if (!item.isTypo) return null;
                            return (
                              <div key={idx} className="flex items-center justify-between p-3 bg-[#fdfbf7] border border-gray-100 rounded-sm text-xs font-sans">
                                <div>
                                  <span className="text-red-500 line-through mr-2 font-serif">{item.text}</span>
                                  <span className="text-gray-400">→</span>
                                  <span className="text-green-600 font-bold ml-2 font-serif">{item.bestSuggestion || '(Tidak ada saran)'}</span>
                                </div>
                                {item.bestSuggestion && (
                                  <button
                                    onClick={() => handleCorrectSingleWord(idx, item.bestSuggestion!)}
                                    className="px-2 py-1 text-[9px] bg-white border border-gray-200 rounded hover:border-[#1a1a1a] font-bold uppercase tracking-wide transition-colors"
                                  >
                                    Terapkan
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Copy Corrected Text panel */}
                    <div className="pt-4 border-t border-gray-100 flex gap-2">
                      <button
                        onClick={() => {
                          const fullCorrected = checkedResults.map(r => r.text).join('');
                          navigator.clipboard.writeText(fullCorrected);
                          showStatus("Teks hasil koreksi disalin ke clipboard!", "success");
                        }}
                        className="w-full py-3 border border-[#1a1a1a] hover:bg-[#1a1a1a] hover:text-white text-[#1a1a1a] transition-all rounded-sm text-[10px] font-sans font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                      >
                        <Copy size={12} /> Salin Hasil Teks
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-20 text-center border-2 border-dashed border-gray-200 rounded-sm">
                    <div className="bg-green-50 text-green-500 rounded-full w-12 h-12 flex items-center justify-center border border-green-200 mx-auto mb-4">
                      <Check size={20} />
                    </div>
                    <p className="text-sm italic text-gray-400 px-6 font-serif">Unggah berkas atau ketik teks di sebelah kiri lalu klik "Periksa Kesalahan" untuk memulai analisis kata.</p>
                  </div>
                )}
              </div>
            </div>
          </div> )}
        </main>
      )}

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            onClick={() => setShowLoginModal(false)}
            className="absolute inset-0 bg-[#1a1a1a]/40 backdrop-blur-sm"
          />
          <div 
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
            </div>
          </div>
        )}

      {/* Email Verification Prompt Modal */}
      {showEmailPromptModal && (
        <div id="email-prompt-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div 
            onClick={() => setShowEmailPromptModal(false)}
            className="absolute inset-0 bg-[#1a1a1a]/40 backdrop-blur-sm"
          />
          <div className="relative bg-white w-full max-w-md p-8 shadow-2xl border border-[#1a1a1a] rounded-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black uppercase tracking-tighter font-sans text-[#1a1a1a]">Verifikasi Email</h2>
              <button onClick={() => setShowEmailPromptModal(false)} className="text-gray-400 hover:text-[#1a1a1a]">
                <X size={20} />
              </button>
            </div>
            
            <p className="text-xs text-gray-500 font-serif leading-relaxed mb-6">
              Untuk menggunakan layanan Pemeriksa Typo (KBBI), silahkan masukkan alamat email aktif Anda. Email ini digunakan untuk melacak batas penggunaan gratis (10x pemeriksaan pertama) serta memvalidasi akses bypass bebas biaya.
            </p>

            <form onSubmit={handleEmailSubmit} className="space-y-6">
              <div>
                <label className="block text-[9px] font-sans font-bold uppercase tracking-widest mb-2 opacity-50">Email Aktif</label>
                <input 
                  type="email" 
                  required
                  value={tempEmailInput}
                  onChange={(e) => {
                    setTempEmailInput(e.target.value);
                    setEmailInputError('');
                  }}
                  className="w-full text-lg border-b border-gray-200 focus:border-[#1a1a1a] focus:outline-none py-2 bg-transparent font-sans text-gray-800"
                  placeholder="contoh@gmail.com"
                />
                {emailInputError && (
                  <p className="text-xs text-red-500 font-sans mt-2 italic">{emailInputError}</p>
                )}
              </div>

              <div className="flex gap-4">
                <button 
                  type="button"
                  onClick={() => setShowEmailPromptModal(false)}
                  className="w-1/2 py-3 border border-gray-200 hover:border-[#1a1a1a] font-sans font-bold uppercase tracking-widest text-[10px] text-gray-500 hover:text-[#1a1a1a] transition-all rounded-sm"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="w-1/2 bg-[#1a1a1a] hover:bg-gray-800 text-white py-3 font-sans font-bold uppercase tracking-widest text-[10px] transition-all rounded-sm flex items-center justify-center gap-2"
                >
                  Daftar & Periksa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Gateway Modal (Pay Per Use - Rp 5.000) */}
      {showPaymentModal && (
        <div id="payment-gate-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div 
            onClick={() => setShowPaymentModal(false)}
            className="absolute inset-0 bg-[#1a1a1a]/40 backdrop-blur-sm"
          />
          <div className="relative bg-white w-full max-w-lg p-8 shadow-2xl border border-[#1a1a1a] rounded-sm max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black uppercase tracking-tighter font-sans text-[#1a1a1a]">Batas Gratis Habis</h2>
              <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 hover:text-[#1a1a1a]">
                <X size={20} />
              </button>
            </div>

            {payStatus === 'pending' ? (
              <div className="text-center py-6 space-y-4">
                <div className="inline-flex bg-amber-50 text-amber-500 border border-amber-200 p-3 rounded-full animate-pulse">
                  <Clock size={32} />
                </div>
                <h3 className="font-sans font-bold uppercase tracking-widest text-xs text-amber-800">Menunggu Konfirmasi Admin</h3>
                <p className="text-xs text-gray-600 font-serif leading-relaxed px-4">
                  Permohonan pembayaran Anda untuk email <strong className="font-mono text-[11px] bg-gray-50 px-1 py-0.5 border border-gray-100">{typoEmail}</strong> sedang diverifikasi oleh Admin. Harap tunggu hingga Admin memberikan persetujuan pembayaran di Panel Admin.
                </p>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="px-6 py-2.5 bg-[#1a1a1a] hover:bg-gray-800 text-white text-[10px] uppercase font-sans font-black tracking-widest transition-all rounded-sm"
                >
                  Tutup Jendela
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <p className="text-xs text-gray-500 font-serif leading-relaxed">
                  Batas penggunaan gratis maksimum 10x untuk email terdaftar (<span className="font-mono italic font-bold text-gray-800">{typoEmail}</span>) telah terlapaui. Silakan lakukan pembayaran satu kali (pay-per-use) sebesar <strong>Rp. 5.000,00</strong> ke GOPAY atau QRIS di bawah ini untuk mengaktifkan akses kembali.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-amber-50/40 p-4 border border-amber-100 rounded-sm">
                  <div className="space-y-2">
                    <h4 className="text-[9px] font-sans font-bold uppercase tracking-widest text-amber-900">Saluran Gopay</h4>
                    <div className="space-y-1">
                      <p className="text-xs font-serif text-gray-700">Nomor GoPay:</p>
                      <p className="text-lg font-mono font-black text-[#1a1a1a]">{paymentSettings.gopayNumber}</p>
                    </div>
                    <div className="pt-2 text-[10px] text-amber-800/85 italic leading-relaxed">
                      Catatan pengiriman/nama transfer harap dicantumkan email Anda: <strong>{typoEmail}</strong> agar admin dapat melakukan validasi secara instan.
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center border-l border-amber-200/40 pl-0 md:pl-4">
                    <p className="text-[9px] font-sans font-black uppercase tracking-widest text-[#1a1a1a] mb-2 text-center">Pindai QRIS</p>
                    <img 
                      src={paymentSettings.qrisImageUrl} 
                      alt="QRIS QR Code" 
                      className="w-32 h-32 border border-gray-200 p-1 bg-white rounded-sm"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-[9px] font-sans font-black uppercase tracking-widest text-gray-400">Verifikasi Pembayaran</h4>
                  <p className="text-[11px] text-gray-500 font-serif">
                    Setelah Anda melakukan transfer, klik tombol di bawah untuk meminta validasi dari Administrator. Panel Admin akan mendeteksi pengajuan Anda secara otomatis.
                  </p>
                  <div>
                    <span className="text-[9px] font-sans font-bold uppercase tracking-widest block mb-1 opacity-50">Email Anda</span>
                    <input 
                      type="text" 
                      disabled 
                      value={typoEmail} 
                      className="w-full bg-gray-50 text-gray-400 text-xs font-mono border border-gray-200 px-3 py-2 rounded-sm"
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-2">
                  <button 
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
                    className="w-1/2 py-3 border border-gray-200 hover:border-[#1a1a1a] font-sans font-bold uppercase tracking-widest text-[10px] text-gray-500 hover:text-[#1a1a1a] transition-all rounded-sm"
                  >
                    Batal
                  </button>
                  <button 
                    type="button"
                    onClick={handleRegisterPayment}
                    disabled={isSubmittingPayment}
                    className="w-1/2 bg-[#1a1a1a] hover:bg-gray-800 text-white py-3 font-sans font-bold uppercase tracking-widest text-[10px] transition-all rounded-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSubmittingPayment ? <Loader2 size={12} className="animate-spin" /> : <CreditCard size={12} />}
                    Saya Sudah Bayar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status Toast Notification Dashboard */}
      {statusMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className={`shadow-2xl border px-6 py-4 rounded-xl flex items-center gap-4 ${
            statusType === 'error' ? 'bg-red-50 border-red-200 text-red-700' :
            statusType === 'success' ? 'bg-amber-50 border-amber-200 text-amber-700' :
            'bg-[#1a1a1a] text-white border-white/10'
          }`}>
            <div className={`w-2 h-2 rounded-full shrink-0 ${
              statusType === 'success' ? 'bg-amber-500' : statusType === 'error' ? 'bg-red-500' : 'bg-blue-400'
            }`} />
            <p className="text-xs font-bold font-sans uppercase tracking-widest">{statusMessage}</p>
          </div>
        </div>
      )}

      {/* Decorative BG element */}
      <div className="fixed top-0 right-0 p-8 pointer-events-none opacity-[0.03] overflow-hidden select-none">
        <span className="text-[300px] font-sans font-black leading-none">KBBI</span>
      </div>
    </div>
  );
}

