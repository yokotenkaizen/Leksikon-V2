/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, ErrorInfo, ReactNode, useMemo } from 'react';
import { Search, History, BookOpen, Trash2, ArrowRight, Plus, Edit2, X, Save, Settings, LogIn, LogOut, Upload, Download, Loader2, Bell, BellOff, Volume2, VolumeX, WifiOff, Cloud, FileText, Copy, RefreshCw, Check, AlertCircle, ShieldAlert, Clock, CreditCard, CheckCircle, Sun, Moon, Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { initialWords, type WordEntry } from './data/initialWords.ts';
import { initialTypos, type TypoEntry } from './data/initialTypos.ts';
import { 
  db, collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, limit, onSnapshot, increment,
  OperationType, handleFirestoreError 
} from './lib/firebase.ts';
import { PustakaDigital } from './components/PustakaDigital.tsx';

const getLocalDateString = (d: Date = new Date()) => {
  const offset = d.getTimezoneOffset();
  const localDate = new Date(d.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
};

// Words that should NEVER be suggested as correction candidates (conjunctions, prepositions, particles, and helping verbs/desires like 'ingin')
const EXCLUDED_SUGGESTION_WORDS = new Set<string>();

const RAW_EXCLUDED_WORDS_INPUT = [
  // User supplied comprehensive conjunctions & connectors list
  "dan", "serta", "atau", "tetapi", "melainkan", "sedangkan", "lalu", "kemudian", "setelah", "sebelum", "sehabis", "sejak", "semenjak", "ketika", "tatkala", "sewaktu", "sementara", "seraya", "sambil", "selagi", "selama", "serentak", "boro-boro", "demi", "bagi", "untuk", "guna", "agar", "supaya", "biar", "sebab", "karena", "oleh karena", "oleh sebab", "sehingga", "sampai", "sampai-sampai", "maka", "makanya", "akibatnya", "jika", "jikalau", "apabila", "asalkan", "kalau", "bilamana", "manakala", "sekiranya", "andaikata", "umpamanya", "seandainya", "sungguhpun", "meskipun", "biarpun", "sekalipun", "walaupun", "kendatipun", "bagaimanapun", "seperti", "bagai", "bagaikan", "seolah-olah", "seakan-akan", "penata", "mirip", "serupa", "padahal", "melainkan juga", "bahwa", "jangankan", "malahan", "bahkan", "lagipula", "apalagi", "sesudah itu", "setelah itu", "selanjutnya", "berikutnya", "selain itu", "di samping itu", "sebaliknya", "sebaliknya dari", "kontras dengan", "dalam hal ini", "tambahan pula", "oleh karena itu", "oleh sebab itu", "dengan demikian", "jadi", "maka dari itu", "kesimpulannya", "ringkasnya", "pendek kata", "tatkala", "manakala", "tatkala mana", "seraya dengan", "beriringan dengan", "berbarengan dengan", "selaras dengan", "sejalan dengan", "berhubung", "berhubung karena", "dikarenakan", "gara-gara", "lantaran", "saking", "imbasnya", "dampaknya", "alhasil", "hasilnya", "jadinya", "niscaya", "pastinya", "dampaknya", "makanya", "akibat dari", "jika saja", "kalau saja", "andai", "andai saja", "asalkan bisa", "sekiranya kalau", "andaikata pun", "misal", "misalkan", "semisal", "seumpama", "asalkan mau", "walau", "maski", "biar pun", "sungguh pun", "biar begitu", "walau begitu", "meskipun demikian", "biarpun demikian", "sekalipun demikian", "kendatipun demikian", "bagaimanapun juga", "namun", "namun demikian", "akan tetapi", "sebaliknya justru", "melainkan hanyalah", "melainkan melulu", "ibarat", "ibarat kata", "layaknya", "laksana", "sebagaimana", "sewarna dengan", "sepadan dengan", "persis seperti", "seolah", "seakan", "tampaknya seperti", "nyatanya", "faktanya", "sebenarnya", "sesungguhnya", "bahwasanya", "adapun", "mengenai", "perihal", "tentang", "alih-alih", "bukannya", "daripada", "ketimbang", "jangankan pun", "jangankan jangankan", "boro-boro pula", "jangankan lagi", "malah", "bahkan pun", "malahan pula", "tak hanya", "bukan hanya", "melainkan juga", "tidak cuma", "tetapi juga", "melainkan pula", "lagian", "lebih-lebih", "apa lagi", "malahan lebih", "bahkan lebih", "terlebih", "terlebih lagi", "sesudah", "sehabis itu", "seusai", "seusai itu", "setamat", "setamatnya", "peninggal", "sepeninggal", "sekembalinya", "setelahnya", "lalunya", "lantas", "habis itu", "barulah", "sesudahnya", "berikutnya lagi", "setelah ini", "sesudah ini", "lanjutnya", "seterusnya", "lalu kemudian", "sesudah demikian", "bermula dari", "awalnya", "mula-mula", "pertama-tama", "kedua", "ketiga", "selanjutnya pula", "pada akhirnya", "akhirnya", "pamungkasnya", "sebagai penutup", "menutup hal ini", "pendeknya", "ringkas kata", "walhasil", "konklusinya", "rupa-rupanya", "tampaknya", "kiranya", "sedianya", "seyogianya", "sepatutnya", "seharusnya", "semestinya", "lagipula pula", "tambahan lagi", "di samping hal tersebut", "selain dari itu", "bukan hanya itu", "tak kalah penting", "begitu pula", "begitu juga", "demikian pula", "demikian juga", "sama halnya", "serupa dengan itu", "dalam pada itu", "sementara itu", "pada saat yang sama", "pada waktu yang bersamaan", "dalam waktu bersamaan", "seiring itu", "seiring dengan itu", "sejalan dengan hal itu", "bertepatan dengan", "semenjak itu", "sejak saat itu", "sejak waktu itu", "sehabis kejadian itu", "pasca", "pasca-kejadian", "pra", "sebelum itu", "menjelang", "menjelang itu", "seketika", "seketika itu", "serta-merta", "tiba-tiba", "mendadak", "sekonyong-konyong", "mumpung", "mumpung masih", "selagi bisa", "selama masih", "sepanjang", "sepanjang hayat", "seumur", "seumur-umur", "demi untuk", "buat", "demi menjaga", "guna mencukupi", "agar supaya", "biar tidak", "supaya jangan", "agar jangan", "melainkan hanya", "hanya saja", "akan tetapi justru", "tapi", "melainkan justru", "namun sebaliknya", "sebaliknya malah",
  
  // Other prepositions, auxiliary words, modals, desires & common pronouns
  "di", "ke", "dari", "pada", "dalam", "untuk", "dengan", "oleh", "tentang", "sebagai", 
  "bagi", "atas", "bawah", "kepada", "terhadap", "buat", "guna", "sampai", "hingga", "demi", 
  "menurut", "bagaikan", "seperti", "mengenai", "antara", "melalui", "secara",
  "ingin", "mau", "akan", "bisa", "dapat", "telah", "sudah", "sedang", "belum", "harus", 
  "segera", "agar", "boleh", "patut", "mesti", "perlu", "bukan", "tidak", "tak", "ada",
  "yang", "yg", "ini", "itu", "dia", "ia", "mereka", "saya", "kamu", "aku", "kami", "kita", 
  "anda", "nya", "pun", "lah", "kah", "tapi", "saja", "juga", "hanya", "pula", "dong", "sih", 
  "deh", "kok", "loh", "tah", "siapa", "apa", "mengapa", "bagaimana", "kenapa"
];

RAW_EXCLUDED_WORDS_INPUT.forEach(phrase => {
  const pLower = phrase.toLowerCase().trim();
  EXCLUDED_SUGGESTION_WORDS.add(pLower);
  // Break down multi-word phrases so that their individual component words are also excluded
  pLower.split(/\s+/).forEach(word => {
    if (word) {
      EXCLUDED_SUGGESTION_WORDS.add(word);
    }
  });
});

// Calculate Levenshtein distance between two strings
const levenshteinDistance = (s1: string, s2: string): number => {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,    // deletion
          dp[i][j - 1] + 1,    // insertion
          dp[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }
  return dp[m][n];
};

// Calculate match score for typo entries (100 = exact prefix/substring, high score = close fuzzy match)
const getFuzzyScore = (targetStr: string, queryStr: string): number => {
  const target = targetStr.toLowerCase().trim();
  const query = queryStr.toLowerCase().trim();
  if (!query) return 100;

  // Exact Match
  if (target === query) return 100;

  // Contains exact substring in key positions
  if (target.startsWith(query)) return 95;
  if (target.includes(query)) return 90;

  // Distance similarity
  const maxLen = Math.max(target.length, query.length);
  if (maxLen === 0) return 0;

  const dist = levenshteinDistance(target, query);
  const similarity = 1 - dist / maxLen;

  // Under certain size, restrict Levenshtein to prevent false positives
  if (query.length <= 2) {
    return 0; // If length <= 2 and doesn't match substring/prefix, don't fuzzy-match
  }

  if (similarity >= 0.5) {
    return Math.round(similarity * 80);
  }

  // Subsequence match (e.g. "bku" in "baku" or "aksra" in "aksara")
  let qIdx = 0;
  for (let tIdx = 0; tIdx < target.length && qIdx < query.length; tIdx++) {
    if (target[tIdx] === query[qIdx]) qIdx++;
  }
  if (qIdx === query.length) {
    return 50;
  }

  return 0;
};

// Utility to convert SVG in Recharts to high-resolution PNG for download
const downloadChartAsPng = (containerId: string, filename: string) => {
  const container = document.getElementById(containerId);
  if (!container) return;

  const svgElement = container.querySelector('svg');
  if (!svgElement) return;

  try {
    const clonedSvg = svgElement.cloneNode(true) as SVGElement;
    const width = svgElement.clientWidth || svgElement.getBoundingClientRect().width || 560;
    const height = svgElement.clientHeight || svgElement.getBoundingClientRect().height || 260;
    
    clonedSvg.setAttribute('width', width.toString());
    clonedSvg.setAttribute('height', height.toString());

    // Dynamically retrieve if dark mode is active to apply beautiful visual themes to downloaded files
    const isDark = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
    const bgColor = isDark ? '#1e1c1a' : '#ffffff';
    const textColor = isDark ? '#f4efe8' : '#1a1a1a';
    const gridColor = isDark ? 'rgba(244, 239, 232, 0.1)' : '#cbd5e1';

    clonedSvg.style.backgroundColor = bgColor;
    
    // Inject stylesheet to ensure correct text matching & fonts inside standalone SVG data-url context
    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleEl.textContent = `
      text { fill: ${textColor} !important; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important; font-size: 10px !important; }
      .recharts-cartesian-grid-horizontal line, .recharts-cartesian-grid-vertical line { stroke: ${gridColor} !important; stroke-dasharray: 3 3; }
      .recharts-label { fill: ${textColor} !important; }
    `;
    clonedSvg.appendChild(styleEl);

    const svgString = new XMLSerializer().serializeToString(clonedSvg);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const blobURL = window.URL.createObjectURL(svgBlob);

    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * 2; // high definition scale-up
      canvas.height = height * 2;
      const context = canvas.getContext('2d');
      if (context) {
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.scale(2, 2);

        // Fill background first (transparent SVGs would have artifacts)
        context.fillStyle = bgColor;
        context.fillRect(0, 0, width, height);

        context.drawImage(image, 0, 0, width, height);
        
        const pngURL = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = pngURL;
        downloadLink.download = filename;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      }
      window.URL.revokeObjectURL(blobURL);
    };
    image.src = blobURL;
  } catch (error) {
    console.error('Gagal mengunduh grafik:', error);
  }
};

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
  severity?: 'Low' | 'Medium' | 'High';
}

interface BypassEmail {
  id: string;
  email: string;
  isActive: boolean;
  createdAt: string;
}

interface CustomToast {
  id: string;
  message: string;
  type: 'info' | 'error' | 'success';
  duration: number;
}

const ToastItem: React.FC<{ toast: CustomToast; onClose: (id: string) => void }> = ({ toast, onClose }) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / toast.duration) * 100);
      setProgress(remaining);
      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 30);

    const timeout = setTimeout(() => {
      onClose(toast.id);
    }, toast.duration);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [toast, onClose]);

  const bgStyle = toast.type === 'error'
    ? 'bg-red-50/95 border-red-200 text-red-950 shadow-red-100/10'
    : toast.type === 'success'
    ? 'bg-emerald-50/95 border-emerald-200 text-emerald-950 shadow-emerald-100/10'
    : 'bg-[#1a1a1a]/95 text-white border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.25)]';

  const progressColor = toast.type === 'error'
    ? 'bg-red-500'
    : toast.type === 'success'
    ? 'bg-emerald-500'
    : 'bg-blue-400';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.9, transition: { duration: 0.15 } }}
      className={`relative w-full max-w-sm overflow-hidden rounded-lg border p-4 shadow-xl flex gap-3.5 backdrop-blur-md transition-all ${bgStyle}`}
    >
      <div className="shrink-0 pt-0.5">
        {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-600" />}
        {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-600" />}
        {toast.type === 'info' && <Clock className="w-5 h-5 text-blue-400" />}
      </div>
      
      <div className="flex-1 min-w-0 pr-2">
        <p className="text-xs font-sans font-bold leading-relaxed tracking-wide select-text">{toast.message}</p>
      </div>

      <button
        type="button"
        onClick={() => onClose(toast.id)}
        className={`shrink-0 rounded-full p-1 transition-colors self-start -mt-1 -mr-1 ${
          toast.type === 'info' ? 'hover:bg-white/10 text-gray-400 hover:text-white' : 'hover:bg-black/5 text-gray-500 hover:text-gray-800'
        }`}
      >
        <X size={14} />
      </button>

      {/* Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-black/5">
        <div 
          className={`h-full transition-all duration-300 ${progressColor}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </motion.div>
  );
};

function MainApp() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark';
    }
    return false;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);
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
  const [toasts, setToasts] = useState<CustomToast[]>([]);

  // Tab navigation state
  const [activeTab, setActiveTab] = useState<'kamus' | 'pemeriksa' | 'pustaka'>('kamus');

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
  const [paymentSettings, setPaymentSettings] = useState<{ gopayNumber: string; qrisImageUrl: string; amount: number }>({
    gopayNumber: '081234567890',
    qrisImageUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=gopay://payment?to=081234567890',
    amount: 5000
  });
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);
  const [allPayments, setAllPayments] = useState<any[]>([]);
  const pendingOver24hCount = useMemo(() => {
    const now = new Date().getTime();
    return allPayments.filter(pay => {
      if (pay.status !== 'pending' || !pay.requestedAt) return false;
      const requestedTime = new Date(pay.requestedAt).getTime();
      const ageHours = (now - requestedTime) / (1000 * 60 * 60);
      return ageHours > 24;
    }).length;
  }, [allPayments]);
  const [allEvaluations, setAllEvaluations] = useState<any[]>([]);
  const [hasWarnedEvaluationsLimit, setHasWarnedEvaluationsLimit] = useState<boolean>(false);
  const [dailySearches, setDailySearches] = useState<{ date: string; count: number }[]>([]);
  const [chartStartDate, setChartStartDate] = useState<string>('');
  const [chartStartTime, setChartStartTime] = useState<string>('00:00');
  const [chartEndDate, setChartEndDate] = useState<string>('');
  const [chartEndTime, setChartEndTime] = useState<string>('23:59');
  const [payStatus, setPayStatus] = useState<string>('');
  const [payUsageCount, setPayUsageCount] = useState<number>(0);
  const [allowedLimit, setAllowedLimit] = useState<number>(10);
  const [gopayInput, setGopayInput] = useState<string>('');
  const [qrisImageInput, setQrisImageInput] = useState<string>('');
  const [amountInput, setAmountInput] = useState<number>(5000);
  const [selectedAdminSubTab, setSelectedAdminSubTab] = useState<'rekap_bayar' | 'riwayat_eval' | 'pengaturan_bayar' | 'bypass_emails' | 'kelola_typo' | 'audit_db' | 'impor_kata'>('rekap_bayar');
  const [adminTypoMode, setAdminTypoMode] = useState<'checker' | 'admin'>('checker');
  const [typos, setTypos] = useState<TypoEntry[]>([]);
  const [isSeedingTypos, setIsSeedingTypos] = useState(false);
  const [typoSearchQuery, setTypoSearchQuery] = useState('');
  const [showTypoFormModal, setShowTypoFormModal] = useState(false);
  const [typoFormMode, setTypoFormMode] = useState<'add' | 'edit'>('add');
  const [typoFormFields, setTypoFormFields] = useState<{ typo: string; correction: string; category?: string; originalTypo?: string }>({ typo: '', correction: '', category: 'Pemeriksa Typo' });
  const [typoVisibleCount, setTypoVisibleCount] = useState<number>(50);
  const [typoCategoryFilter, setTypoCategoryFilter] = useState<string>('Semua Kategori');

  // Audit Database States
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditConflicts, setAuditConflicts] = useState<{
    id: string;
    term: string;
    wordSource: WordEntry;
    typoSource: TypoEntry;
    type: 'exact' | 'case_mismatch' | 'whitespace_issue';
  }[]>([]);
  const [selectedConflictIds, setSelectedConflictIds] = useState<string[]>([]);
  const [isAuditDeleting, setIsAuditDeleting] = useState(false);

  // Kamus Excel Import States
  const [importStep, setImportStep] = useState<'select' | 'mapping' | 'progress'>('select');
  const [excelColumns, setExcelColumns] = useState<string[]>([]);
  const [excelRows, setExcelRows] = useState<any[][]>([]);
  const [excelMapping, setExcelMapping] = useState<{
    word: string;
    category: string;
    etymology: string;
    definition: string;
    examples: string;
    searchCount: string;
  }>({
    word: '',
    category: '',
    etymology: '',
    definition: '',
    examples: '',
    searchCount: ''
  });
  const [importProgress, setImportProgress] = useState<number>(-1);
  const [importMessage, setImportMessage] = useState<string>('');

  useEffect(() => {
    setTypoVisibleCount(50);
  }, [typoSearchQuery, typoCategoryFilter, selectedAdminSubTab]);

  // Calculate top typos distribution from allEvaluations dynamically
  const typoDistributionData = useMemo(() => {
    if (allEvaluations.length === 0) return [];

    // Fast set of valid words
    const validWordsSet = new Set<string>();
    words.forEach(w => validWordsSet.add(w.word.toLowerCase().trim()));
    initialWords.forEach(w => validWordsSet.add(w.word.toLowerCase().trim()));

    const typosMap = new Map<string, string>();
    initialTypos.forEach(t => {
      const tKey = t.typo.toLowerCase().trim();
      const cVal = t.correction.toLowerCase().trim();
      typosMap.set(tKey, cVal);
      validWordsSet.add(cVal);
    });
    typos.forEach(t => {
      const tKey = t.typo.toLowerCase().trim();
      const cVal = t.correction.toLowerCase().trim();
      typosMap.set(tKey, cVal);
      validWordsSet.add(cVal);
    });

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

    const typoCounts: { [key: string]: number } = {};

    allEvaluations.forEach(ev => {
      if (!ev.inputText) return;
      const tokens = ev.inputText.split(/[^a-zA-ZáéíóúÁÉÍÓÚ'-]+/);
      tokens.forEach((token: string) => {
        const stripped = token.toLowerCase().trim();
        if (!stripped || stripped.length <= 1) return;

        if (typosMap.has(stripped)) {
          typoCounts[stripped] = (typoCounts[stripped] || 0) + 1;
        } else if (!validWordsSet.has(stripped)) {
          typoCounts[stripped] = (typoCounts[stripped] || 0) + 1;
        }
      });
    });

    const sorted = Object.entries(typoCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    if (sorted.length <= 6) {
      return sorted;
    } else {
      const top = sorted.slice(0, 5);
      const othersCount = sorted.slice(5).reduce((sum, item) => sum + item.value, 0);
      if (othersCount > 0) {
        top.push({ name: 'Lainnya', value: othersCount });
      }
      return top;
    }
  }, [allEvaluations, words, typos]);

  // Filter daily searches based on date range (searches are stored daily)
  const filteredDailySearches = useMemo(() => {
    return dailySearches.filter(item => {
      if (chartStartDate && item.date < chartStartDate) return false;
      if (chartEndDate && item.date > chartEndDate) return false;
      return true;
    });
  }, [dailySearches, chartStartDate, chartEndDate]);

  // Group evaluation logs dynamically by local date incorporating date and time filters
  const filteredDailyEvaluations = useMemo(() => {
    const groups: { [dateStr: string]: number } = {};

    // Build filter threshold bounds
    const startBound = chartStartDate ? new Date(`${chartStartDate}T${chartStartTime || '00:00'}`).getTime() : null;
    const endBound = chartEndDate ? new Date(`${chartEndDate}T${chartEndTime || '23:59'}`).getTime() : null;

    allEvaluations.forEach(ev => {
      if (ev.timestamp) {
        try {
          const d = new Date(ev.timestamp);
          const time = d.getTime();

          // Evaluate boundaries
          if (startBound !== null && time < startBound) return;
          if (endBound !== null && time > endBound) return;

          // Process YYYY-MM-DD grouping
          const dateStr = getLocalDateString(d);
          groups[dateStr] = (groups[dateStr] || 0) + 1;
        } catch {
          // ignore parsing error
        }
      }
    });

    // Convert to sorted array
    return Object.keys(groups)
      .map(date => ({ date, count: groups[date] }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [allEvaluations, chartStartDate, chartStartTime, chartEndDate, chartEndTime]);

  // Bypass whitelist emails state
  const [bypassEmailsList, setBypassEmailsList] = useState<BypassEmail[]>([]);
  const [newBypassEmail, setNewBypassEmail] = useState('');

  const isEmailBypassActive = (email: string) => {
    if (!email) return false;
    const emailKey = email.toLowerCase().trim();
    const match = bypassEmailsList.find(b => b.id === emailKey);
    return match ? match.isActive : false;
  };

  const showStatus = (msg: string, type: 'info' | 'error' | 'success' = 'info', duration = 5000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message: msg, type, duration }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  useEffect(() => {
    if (allEvaluations.length > 250) {
      if (!hasWarnedEvaluationsLimit) {
        showStatus(
          "Peringatan Sistem: Jumlah riwayat log evaluasi telah mencapai " + allEvaluations.length + " data (melebihi batas aman 250 log). Disarankan untuk segera melakukan pembersihan data log secara berkala demi menjaga performa optimal aplikasi.",
          "error",
          10000
        );
        setHasWarnedEvaluationsLimit(true);
      }
    } else {
      setHasWarnedEvaluationsLimit(false);
    }
  }, [allEvaluations.length, hasWarnedEvaluationsLimit]);

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

  // Fuzzy suggestions for Admin when managing typo collection
  const adminFuzzySuggestions = useMemo(() => {
    const queryTypo = typoFormFields.typo.trim().toLowerCase();
    const queryCorrection = typoFormFields.correction.trim().toLowerCase();

    if (!queryTypo && !queryCorrection) return [];

    const list: {
      type: 'warning_duplicate' | 'similar_typo' | 'similar_baku';
      message: string;
      typo: string;
      correction: string;
    }[] = [];

    // Combine loaded words in DB and initialWords
    const allKnownBaku = Array.from(new Set([
      ...words.map(w => w.word.toLowerCase().trim()),
      ...initialWords.map(w => w.word.toLowerCase().trim())
    ]));

    // Check exact or partial duplicates in loaded typos
    typos.forEach(t => {
      const tLower = t.typo.toLowerCase().trim();
      const cLower = t.correction.toLowerCase().trim();

      // If typo is an exact match already
      if (queryTypo && tLower === queryTypo) {
        list.push({
          type: 'warning_duplicate',
          message: `🚨 '${t.typo}' sudah terdaftar dengan bentuk baku: '${t.correction}'`,
          typo: t.typo,
          correction: t.correction
        });
      } else if (queryTypo && getDistance(tLower, queryTypo) <= 2) {
        // Similar typo found
        list.push({
          type: 'similar_typo',
          message: `💡 Typo serupa terdaftar: '${t.typo}' → '${t.correction}'`,
          typo: t.typo,
          correction: t.correction
        });
      }

      // Check if the correction entered by the user is similar to some existing typos/corrections
      if (queryCorrection && cLower === queryCorrection && tLower === queryTypo) {
        // Exact match of both - handled by duplicate
      } else if (queryCorrection && getDistance(cLower, queryCorrection) <= 1) {
        list.push({
          type: 'similar_baku',
          message: `💡 Bentuk baku '${t.correction}' (dari '${t.typo}') mirip dengan yang Anda ketik`,
          typo: t.typo,
          correction: t.correction
        });
      }
    });

    // Also look up words in the standard KBBI dictionary to suggest correct form
    if (queryTypo) {
      allKnownBaku.forEach(kbbiWord => {
        const dist = getDistance(kbbiWord, queryTypo);
        if (dist >= 1 && dist <= 2) {
          list.push({
            type: 'similar_baku',
            message: `🌱 Apakah '${kbbiWord}' maksud Anda sebagai bentuk baku?`,
            typo: queryTypo,
            correction: kbbiWord
          });
        }
      });
    }

    // Deduplicate suggestions based on their message
    const seenMessages = new Set<string>();
    return list.filter(item => {
      if (seenMessages.has(item.message)) return false;
      seenMessages.add(item.message);
      return true;
    }).slice(0, 4); // Limit to top 4 suggestions
  }, [typoFormFields.typo, typoFormFields.correction, typos, words]);

  const applyFuzzySuggestion = (s: { typo: string, correction: string }) => {
    setTypoFormFields(prev => ({
      ...prev,
      typo: s.typo || prev.typo,
      correction: s.correction || prev.correction
    }));
  };

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(val);
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
          qrisImageUrl: data.qrisImageUrl || 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=gopay://payment?to=081234567890',
          amount: typeof data.amount === 'number' ? data.amount : 5000
        });
      }
    }, (err) => {
      console.warn("Settings listener error:", err);
    });
    return () => unsubscribe();
  }, [db]);

  // Load bypass whitelist emails with live listener and offline local state initialization
  useEffect(() => {
    let unsub = () => {};
    const defaultBypasses: BypassEmail[] = [
      { id: 'admin1@gmail.com', email: 'Admin1@gmail.com', isActive: true, createdAt: new Date().toISOString() },
      { id: 'admin2@gmail.com', email: 'Admin2@gmail.com', isActive: true, createdAt: new Date().toISOString() },
      { id: 'user1@gmail.com', email: 'User1@gmail.com', isActive: true, createdAt: new Date().toISOString() },
      { id: 'user2@gmail.com', email: 'User2@gmail.com', isActive: true, createdAt: new Date().toISOString() },
    ];

    const loadLocalBypass = () => {
      const local = localStorage.getItem('typo_bypass_emails');
      if (local) {
        setBypassEmailsList(JSON.parse(local));
      } else {
        setBypassEmailsList(defaultBypasses);
        localStorage.setItem('typo_bypass_emails', JSON.stringify(defaultBypasses));
      }
    };

    if (db) {
      try {
        unsub = onSnapshot(collection(db, 'bypass_emails'), (snapshot) => {
          if (!snapshot.empty) {
            const list: BypassEmail[] = [];
            snapshot.forEach((doc) => {
              list.push({ id: doc.id, ...doc.data() } as BypassEmail);
            });
            setBypassEmailsList(list);
            localStorage.setItem('typo_bypass_emails', JSON.stringify(list));
          } else {
            // Seed defaults to Firestore
            defaultBypasses.forEach(async (b) => {
              await setDoc(doc(db, 'bypass_emails', b.id), b);
            });
            setBypassEmailsList(defaultBypasses);
            localStorage.setItem('typo_bypass_emails', JSON.stringify(defaultBypasses));
          }
        }, (err) => {
          console.warn("Firestore bypass_emails error, using fallback:", err);
          loadLocalBypass();
        });
      } catch (err) {
        console.warn("Bypass emails subscription failed:", err);
        loadLocalBypass();
      }
    } else {
      loadLocalBypass();
    }

    return () => unsub();
  }, [db]);

  // Load current typo user's profile
  useEffect(() => {
    if (!db || !typoEmail) {
      setCurrentUserData(null);
      setPayStatus('');
      setPayUsageCount(0);
      setAllowedLimit(10);
      return;
    }
    const emailKey = typoEmail.toLowerCase().trim();
    if (isEmailBypassActive(emailKey)) {
      setPayStatus('approved');
      setPayUsageCount(0);
      setAllowedLimit(999999);
      setCurrentUserData({ email: emailKey, usageCount: 0, paymentStatus: 'approved', allowedLimit: 999999 });
      return;
    }

    const docRef = doc(db, 'users', emailKey);
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const uData = snapshot.data();
        setCurrentUserData(uData);
        setPayStatus(uData.paymentStatus || 'none');
        setPayUsageCount(uData.usageCount || 0);
        // Automatic migration logic for legacy approved users:
        const legacyLimit = uData.paymentStatus === 'approved' && !uData.allowedLimit 
          ? Math.max(20, (uData.usageCount || 0) + 10) 
          : 10;
        setAllowedLimit(uData.allowedLimit || legacyLimit);
      } else {
        const initUser = { email: emailKey, usageCount: 0, allowedLimit: 10, paymentStatus: 'none' };
        setDoc(docRef, initUser).catch(e => console.warn("Failed to create users record:", e));
        setCurrentUserData(initUser);
        setPayStatus('none');
        setPayUsageCount(0);
        setAllowedLimit(10);
      }
    }, (err) => {
      console.warn("User listener error:", err);
    });
    return () => unsubscribe();
  }, [db, typoEmail, bypassEmailsList]);

  // Read payments & evaluations (Admin only)
  useEffect(() => {
    if (!db || !isAdmin) {
      setAllPayments([]);
      setAllEvaluations([]);
      setDailySearches([]);
      return;
    }
    // High-scalability: limit payments listener to top 200 items to prevent Firestore pricing/memory blow up
    const qPay = query(collection(db, 'payments'), limit(200));
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

    // High-scalability: limit evaluations to top 300 items to optimize read counts
    const qEval = query(collection(db, 'evaluations'), limit(300));
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

    // Listen to daily stats for search count per day
    const qStats = collection(db, 'stats');
    const unsubscribeStats = onSnapshot(qStats, (snapshot) => {
      const statsList: any[] = [];
      snapshot.forEach((doc) => {
        if (doc.id !== 'global' && doc.id !== 'install') {
          const data = doc.data();
          if (data && typeof data.totalSearches === 'number') {
            statsList.push({
              date: doc.id,
              count: data.totalSearches
            });
          }
        }
      });
      // Sort chronologically by date
      statsList.sort((a, b) => a.date.localeCompare(b.date));
      setDailySearches(statsList);
    }, (err) => {
      console.warn("Daily stats list listener error:", err);
    });

    return () => {
      unsubscribePay();
      unsubscribeEval();
      unsubscribeStats();
    };
  }, [db, isAdmin]);

  // Sync settings input controls
  useEffect(() => {
    setGopayInput(paymentSettings.gopayNumber);
    setQrisImageInput(paymentSettings.qrisImageUrl);
    setAmountInput(paymentSettings.amount || 5000);
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
        amount: paymentSettings.amount || 5000,
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
      
      const userRef = doc(db, 'users', emailStr.toLowerCase().trim());
      const userSnap = await getDoc(userRef);
      let newLimit = 20; // default (10 free + 10 paid)
      
      if (userSnap.exists()) {
        const uData = userSnap.data();
        const baseLimit = uData.allowedLimit || (uData.paymentStatus === 'approved' ? Math.max(20, (uData.usageCount || 0) + 10) : 10);
        newLimit = baseLimit + 10;
      }

      // 1. Mark the payment log request as approved
      await setDoc(doc(db, 'payments', payId), {
        status: 'approved',
        approvedAt: new Date().toISOString()
      }, { merge: true });

      // 2. Clear block status to 'none' and increase limit by 10 so they can pay again on next lock!
      await setDoc(userRef, {
        paymentStatus: 'none',
        allowedLimit: newLimit
      }, { merge: true });

      showStatus(`Pembayaran untuk ${emailStr} disetujui! Jumlah batas ditambah 10 pemeriksaan baru.`, "success");
    } catch (e) {
      console.error(e);
      showStatus("Gagal memproses persetujuan.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteEvaluationLog = async (logId: string) => {
    if (!db) return;
    if (!logId) {
      showStatus("ID log tidak ditemukan.", "error");
      return;
    }
    if (!window.confirm("Apakah Anda yakin ingin menghapus log pemeriksaan ini?")) return;
    try {
      setIsProcessing(true);
      // Optimistic state update for instant response feel
      setAllEvaluations(prev => prev.filter(t => t.id !== logId));
      await deleteDoc(doc(db, 'evaluations', logId));
      showStatus("Log pemeriksaan berhasil dihapus.", "success");
    } catch (e) {
      console.error(e);
      showStatus("Gagal menghapus log pemeriksaan.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearAllEvaluationLogs = async () => {
    if (!db) return;
    const validEvals = allEvaluations.filter(ev => ev.id);
    if (validEvals.length === 0) {
      showStatus("Tidak ada log riwayat pemeriksaan untuk dihapus.", "info");
      return;
    }
    if (!window.confirm(`PERINGATAN KRITIS: Apakah Anda yakin ingin menghapus SELURUH (${validEvals.length}) riwayat log pemeriksaan? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      setIsProcessing(true);
      // Clean immediately in the UI state
      setAllEvaluations([]);
      
      // Perform chunked sequential/parallel delete to respect Firestore limit structures and save client socket overload
      const chunkSize = 15;
      for (let i = 0; i < validEvals.length; i += chunkSize) {
        const chunk = validEvals.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (ev) => {
          try {
            await deleteDoc(doc(db, 'evaluations', ev.id));
          } catch (err) {
            console.warn(`Gagal menghapus log: ${ev.id}`, err);
          }
        }));
      }

      showStatus(`Berhasil membersihkan seluruh (${validEvals.length}) log pemeriksaan!`, "success");
    } catch (e) {
      console.error(e);
      showStatus("Gagal membersihkan semua log pemeriksaan.", "error");
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

    // Limit to 5MB before compression
    if (file.size > 5 * 1024 * 1024) {
      showStatus("File terlalu besar! Maksimal ukuran gambar asli adalah 5MB.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        // High quality client-side canvas-based image compressor
        const img = new Image();
        img.src = event.target.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 450;
          const MAX_HEIGHT = 450;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            // Compress to JPEG with 0.7 quality to keep it ~20-55KB
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
            setQrisImageInput(compressedBase64);
            showStatus("Gambar QRIS berhasil diunggah & dikompresi agar muat disimpan!", "success");
          } else {
            setQrisImageInput(event.target.result as string);
            showStatus("Gambar QRIS berhasil diunggah secara lokal!", "success");
          }
        };
        img.onerror = () => {
          setQrisImageInput(event.target.result as string);
          showStatus("Gambar QRIS berhasil diunggah secara lokal!", "success");
        };
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
    if (amountInput <= 0) {
      showStatus("Nominal pembayaran harus lebih besar dari Rp. 0.", "error");
      return;
    }
    try {
      setIsProcessing(true);
      await setDoc(doc(db, 'settings', 'global'), {
        gopayNumber: gopayInput.trim(),
        qrisImageUrl: qrisImageInput.trim(),
        amount: Number(amountInput)
      }, { merge: true });
      showStatus("Penggantian detail GoPay, QRIS & Nominal Pembayaran disimpan!", "success");
    } catch (e) {
      console.error(e);
      showStatus("Gagal menyimpan.", "error");
      handleFirestoreError(e, OperationType.WRITE, 'settings/global');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddBypassEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailKey = newBypassEmail.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailKey || !emailRegex.test(emailKey)) {
      showStatus("Harap masukkan format email yang valid.", "error");
      return;
    }

    if (bypassEmailsList.some(b => b.id === emailKey)) {
      showStatus("Email sudah terdaftar dalam daftar bypass.", "error");
      return;
    }

    const newItem: BypassEmail = {
      id: emailKey,
      email: newBypassEmail.trim(),
      isActive: true,
      createdAt: new Date().toISOString()
    };

    try {
      setIsProcessing(true);
      if (db) {
        await setDoc(doc(db, 'bypass_emails', emailKey), newItem);
      } else {
        const updated = [...bypassEmailsList, newItem];
        setBypassEmailsList(updated);
        localStorage.setItem('typo_bypass_emails', JSON.stringify(updated));
      }
      setNewBypassEmail('');
      showStatus(`Email ${newItem.email} berhasil ditambahkan ke whitelist bypass!`, "success");
    } catch (err: any) {
      console.warn("Gagal menambahkan email bypass:", err);
      showStatus("Gagal menambahkan email bypass ke Firestore.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleBypassEmail = async (id: string, currentStatus: boolean) => {
    try {
      setIsProcessing(true);
      if (db) {
        await setDoc(doc(db, 'bypass_emails', id), {
          isActive: !currentStatus
        }, { merge: true });
      } else {
        const updated = bypassEmailsList.map(b => b.id === id ? { ...b, isActive: !currentStatus } : b);
        setBypassEmailsList(updated);
        localStorage.setItem('typo_bypass_emails', JSON.stringify(updated));
      }
      showStatus(`Status bypass berhasil diubah menjadi ${!currentStatus ? 'AKTIF' : 'NON-AKTIF'}.`, "success");
    } catch (err) {
      console.warn("Gagal mengubah status bypass:", err);
      showStatus("Gagal mengubah status bypass di Firestore.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteBypassEmail = async (id: string, emailStr: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus email ${emailStr} dari whitelist bypass?`)) {
      return;
    }
    try {
      setIsProcessing(true);
      if (db) {
        await deleteDoc(doc(db, 'bypass_emails', id));
      } else {
        const updated = bypassEmailsList.filter(b => b.id !== id);
        setBypassEmailsList(updated);
        localStorage.setItem('typo_bypass_emails', JSON.stringify(updated));
      }
      showStatus(`Email ${emailStr} berhasil dihapus dari whitelist bypass.`, "success");
    } catch (err) {
      console.warn("Gagal menghapus email bypass:", err);
      showStatus("Gagal menghapus email bypass dari Firestore.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadTypoEvaluations = () => {
    if (allEvaluations.length === 0) {
      showStatus("Tidak ada riwayat evaluasi untuk diunduh.", "info");
      return;
    }
    const now = new Date();
    const exportData = [
      ["LAPORAN RIWAYAT PEMERIKSAAN TYPO"],
      ["Waktu Diunduh:", now.toLocaleString("id-ID")],
      [],
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
    
    const dateFormatted = now.toLocaleDateString("id-ID").replace(/\//g, "-");
    const timeFormatted = now.toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' }).replace(/:/g, ".");
    XLSX.writeFile(wb, `Riwayat_Evaluasi_Pemeriksa_Typo_${dateFormatted}_${timeFormatted}.xlsx`);
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

    if (isEmailBypassActive(emailKey)) {
      runStandardCheckAndSave(rawText, emailKey, true);
      return;
    }

    if (!db) {
      runStandardCheckAndSave(rawText, emailKey, false);
      return;
    }

    setIsAnalyzing(true);
    try {
      // High-scalability optimization: check synchronized states in local memory first.
      // This saves a Firestore document read request on every single check submission!
      let usageCount = payUsageCount;
      let paymentStatus = payStatus;
      let uLimit = allowedLimit;

      if (!currentUserData) {
        // Fallback for initial boot or cache reset
        const userDocRef = doc(db, 'users', emailKey);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          const uData = userSnap.data();
          usageCount = uData.usageCount || 0;
          paymentStatus = uData.paymentStatus || 'none';
          uLimit = uData.allowedLimit || (uData.paymentStatus === 'approved' ? Math.max(20, usageCount + 10) : 10);
        } else {
          const initUser = { email: emailKey, usageCount: 0, allowedLimit: 10, paymentStatus: 'none' };
          await setDoc(userDocRef, initUser);
          usageCount = 0;
          paymentStatus = 'none';
          uLimit = 10;
        }
      }

      if (usageCount >= uLimit) {
        if (paymentStatus === 'pending') {
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
    const dictionaryWordsSet = new Set<string>();
    const rootCategories = new Map<string, string>();
    
    // Add dictionary words
    words.forEach(w => {
      const wd = w.word.toLowerCase().trim();
      validWordsSet.add(wd);
      dictionaryWordsSet.add(wd);
      if (w.category) rootCategories.set(wd, w.category);
    });
    initialWords.forEach(w => {
      const wd = w.word.toLowerCase().trim();
      validWordsSet.add(wd);
      dictionaryWordsSet.add(wd);
      if (w.category) rootCategories.set(wd, w.category);
    });

    // Standard Indonesian connecting structures for POS categories
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
      const wd = w.toLowerCase().trim();
      validWordsSet.add(wd);
      dictionaryWordsSet.add(wd);
      if (!rootCategories.has(wd)) {
        if (['di', 'ke', 'dari', 'pada', 'bagi', 'untuk', 'dengan', 'dalam', 'atas', 'bawah'].includes(wd)) {
          rootCategories.set(wd, 'Preposisi');
        } else if (['dan', 'atau', 'karena', 'namun', 'tetapi', 'bahwa', 'jika', 'bila', 'serta', 'maka', 'sehingga', 'lalu', 'kemudian'].includes(wd)) {
          rootCategories.set(wd, 'Konjungsi');
        } else if (['sangat', 'amat', 'sekali', 'lebih', 'paling', 'tidak', 'belum', 'sudah', 'sedang', 'akan', 'bukan'].includes(wd)) {
          rootCategories.set(wd, 'Adverba');
        } else if (['saya', 'aku', 'kamu', 'anda', 'dia', 'ia', 'mereka', 'kami', 'kita'].includes(wd)) {
          rootCategories.set(wd, 'Pronomina');
        }
      }
    });

    // Add standard correction words from typos and initialTypos as valid words
    initialTypos.forEach(t => {
      const corrL = t.correction.toLowerCase().trim();
      validWordsSet.add(corrL);
    });
    typos.forEach(t => {
      const corrL = t.correction.toLowerCase().trim();
      validWordsSet.add(corrL);
    });

    // Build map of typos from both database collection (state) and initialTypos
    const typosMap = new Map<string, string>();
    initialTypos.forEach(t => {
      const typoL = t.typo.toLowerCase().trim();
      const corrL = t.correction.trim();
      if (typoL !== corrL.toLowerCase().trim()) {
        typosMap.set(typoL, corrL);
      }
    });
    typos.forEach(t => {
      const typoL = t.typo.toLowerCase().trim();
      const corrL = t.correction.trim();
      if (typoL !== corrL.toLowerCase().trim()) {
        typosMap.set(typoL, corrL);
      }
    });

    // Explicit 12 Typos with high-priority mappings
    const SPECIFIC_CORRECTIONS: [string, string][] = [
      ['aktifitas', 'aktivitas'],
      ['apotik', 'apotek'],
      ['nasehat', 'nasihat'],
      ['ijin', 'izin'],
      ['resiko', 'risiko'],
      ['kwalitas', 'kualitas'],
      ['analisa', 'analisis'],
      ['nafas', 'napas'],
      ['praktek', 'praktik'],
      ['jadual', 'jadwal'],
      ['survey', 'survei'],
      ['sekedar', 'sekadar']
    ];
    SPECIFIC_CORRECTIONS.forEach(([typo, correction]) => {
      typosMap.set(typo, correction);
    });

    // Trie Node and KBBI_Trie implementation for fast lookup of valid words ("Pengecekan Hash/Trie")
    class TrieNode {
      children: Map<string, TrieNode> = new Map();
      isEndOfWord = false;
    }

    class KBBITrie {
      root = new TrieNode();

      insert(word: string) {
        let node = this.root;
        for (const char of word) {
          if (!node.children.has(char)) {
            node.children.set(char, new TrieNode());
          }
          node = node.children.get(char)!;
        }
        node.isEndOfWord = true;
      }

      search(word: string): boolean {
        let node = this.root;
        for (const char of word) {
          if (!node.children.has(char)) return false;
          node = node.children.get(char)!;
        }
        return node.isEndOfWord;
      }
    }

    const kbbiTrie = new KBBITrie();
    validWordsSet.forEach(word => kbbiTrie.insert(word));

    // Context-Aware Morphological Parser (Indonesian Stemmer / Decomposer)
    const checkWordValidWithMorphology = (w: string, validSet: Set<string>): { isValid: boolean; stem?: string } => {
      const wClean = w.toLowerCase().trim();
      if (validSet.has(wClean) || kbbiTrie.search(wClean)) {
        return { isValid: true, stem: wClean };
      }

      // Check hyphenated/double words (e.g., "buku-buku", "anak-anak")
      if (wClean.includes('-')) {
        const parts = wClean.split('-');
        const partChecks = parts.map(p => checkWordValidWithMorphology(p, validSet));
        if (partChecks.every(pc => pc.isValid)) {
          return { isValid: true, stem: wClean };
        }
      }

      // a) Strip clitics (trailing end)
      const clitics = ['nya', 'lah', 'kah', 'pun', 'ku', 'mu'];
      for (const clitic of clitics) {
        if (wClean.endsWith(clitic) && wClean.length > clitic.length + 2) {
          const stripped = wClean.slice(0, -clitic.length);
          if (validSet.has(stripped) || kbbiTrie.search(stripped)) {
            return { isValid: true, stem: stripped };
          }
          const sub = checkWordValidWithMorphology(stripped, validSet);
          if (sub.isValid) {
            return { isValid: true, stem: sub.stem };
          }
        }
      }

      // b) Strip standard suffixes
      const suffixes = ['kan', 'an', 'i'];
      for (const suffix of suffixes) {
        if (wClean.endsWith(suffix) && wClean.length > suffix.length + 2) {
          const stripped = wClean.slice(0, -suffix.length);
          if (validSet.has(stripped) || kbbiTrie.search(stripped)) {
            return { isValid: true, stem: stripped };
          }
          const sub = checkWordValidWithMorphology(stripped, validSet);
          if (sub.isValid) {
            return { isValid: true, stem: sub.stem };
          }
        }
      }

      // c) Strip simple passive & aspectual prefixes (di-, ter-, se-, ke-)
      const simplePrefixes = ['di', 'ter', 'se', 'ke'];
      for (const pref of simplePrefixes) {
        if (wClean.startsWith(pref) && wClean.length > pref.length + 2) {
          const stripped = wClean.slice(pref.length);
          if (validSet.has(stripped) || kbbiTrie.search(stripped)) {
            return { isValid: true, stem: stripped };
          }
          const sub = checkWordValidWithMorphology(stripped, validSet);
          if (sub.isValid) {
            return { isValid: true, stem: sub.stem };
          }
        }
      }

      // d) Strip ber- / be- / bel- prefixes
      if (wClean.startsWith('ber') && wClean.length > 5) {
        const stripped = wClean.slice(3);
        if (validSet.has(stripped) || kbbiTrie.search(stripped)) return { isValid: true, stem: stripped };
        const sub = checkWordValidWithMorphology(stripped, validSet);
        if (sub.isValid) return { isValid: true, stem: sub.stem };
      }
      if (wClean.startsWith('be') && wClean.length > 4) {
        const stripped = wClean.slice(2);
        if (validSet.has(stripped) || kbbiTrie.search(stripped)) return { isValid: true, stem: stripped };
        const sub = checkWordValidWithMorphology(stripped, validSet);
        if (sub.isValid) return { isValid: true, stem: sub.stem };
      }
      if (wClean.startsWith('bel') && wClean.length > 5) {
        const stripped = wClean.slice(3);
        if (validSet.has(stripped) || kbbiTrie.search(stripped)) return { isValid: true, stem: stripped };
        const sub = checkWordValidWithMorphology(stripped, validSet);
        if (sub.isValid) return { isValid: true, stem: sub.stem };
      }

      // e) Strip active nasal prefixes (me-, pe-) with morphophonemic rules
      const nasals = ['me', 'pe'];
      for (const n of nasals) {
        if (wClean.startsWith(n) && wClean.length > n.length + 2) {
          const base = wClean.slice(n.length);

          if (base.startsWith('nge') && base.length > 3) {
            const stripped = base.slice(3);
            if (validSet.has(stripped) || kbbiTrie.search(stripped)) return { isValid: true, stem: stripped };
          }

          if (base.startsWith('ny') && base.length > 2) {
            const withS = 's' + base.slice(2);
            if (validSet.has(withS) || kbbiTrie.search(withS)) return { isValid: true, stem: withS };
            const sub = checkWordValidWithMorphology(withS, validSet);
            if (sub.isValid) return { isValid: true, stem: sub.stem };
          }

          if (base.startsWith('m') && base.length > 1) {
            const withP = 'p' + base.slice(1);
            if (validSet.has(withP) || kbbiTrie.search(withP)) return { isValid: true, stem: withP };
            const sub1 = checkWordValidWithMorphology(withP, validSet);
            if (sub1.isValid) return { isValid: true, stem: sub1.stem };

            const plainM = base;
            if (validSet.has(plainM) || kbbiTrie.search(plainM)) return { isValid: true, stem: plainM };
            const sub2 = checkWordValidWithMorphology(plainM, validSet);
            if (sub2.isValid) return { isValid: true, stem: sub2.stem };
          }

          if (base.startsWith('n') && base.length > 1) {
            const withT = 't' + base.slice(1);
            if (validSet.has(withT) || kbbiTrie.search(withT)) return { isValid: true, stem: withT };
            const sub1 = checkWordValidWithMorphology(withT, validSet);
            if (sub1.isValid) return { isValid: true, stem: sub1.stem };

            const plainN = base;
            if (validSet.has(plainN) || kbbiTrie.search(plainN)) return { isValid: true, stem: plainN };
            const sub2 = checkWordValidWithMorphology(plainN, validSet);
            if (sub2.isValid) return { isValid: true, stem: sub2.stem };
          }

          if (base.startsWith('ng') && base.length > 2) {
            const withK = 'k' + base.slice(2);
            if (validSet.has(withK) || kbbiTrie.search(withK)) return { isValid: true, stem: withK };
            const sub1 = checkWordValidWithMorphology(withK, validSet);
            if (sub1.isValid) return { isValid: true, stem: sub1.stem };

            const plainNg = base;
            if (validSet.has(plainNg) || kbbiTrie.search(plainNg)) return { isValid: true, stem: plainNg };
            const sub2 = checkWordValidWithMorphology(plainNg, validSet);
            if (sub2.isValid) return { isValid: true, stem: sub2.stem };
          }

          const singleMe = base;
          if (validSet.has(singleMe) || kbbiTrie.search(singleMe)) return { isValid: true, stem: singleMe };
          const sub = checkWordValidWithMorphology(singleMe, validSet);
          if (sub.isValid) return { isValid: true, stem: sub.stem };
        }
      }

      return { isValid: false };
    };

    const tokens = rawText.split(/([a-zA-ZáéíóúÁÉÍÓÚ'-]+)/);
    
    interface WordTokenInfo {
      tokenIndex: number;
      text: string;
      stripped: string;
      isCapitalized: boolean;
      isAllCaps: boolean;
    }
    const wordTokens: WordTokenInfo[] = [];
    tokens.forEach((token, idx) => {
      const isWord = /^[a-zA-ZáéíóúÁÉÍÓÚ'-]+$/.test(token) && token.length > 1;
      if (isWord) {
        wordTokens.push({
          tokenIndex: idx,
          text: token,
          stripped: token.toLowerCase(),
          isCapitalized: token[0] === token[0].toUpperCase(),
          isAllCaps: token === token.toUpperCase()
        });
      }
    });

    const wordTokenIdxMap = new Map<number, number>();
    wordTokens.forEach((wt, i) => {
      wordTokenIdxMap.set(wt.tokenIndex, i);
    });

    const isSentenceStart = (wtIndex: number): boolean => {
      if (wtIndex === 0) return true;
      const prevWt = wordTokens[wtIndex - 1];
      const wt = wordTokens[wtIndex];
      for (let j = prevWt.tokenIndex + 1; j < wt.tokenIndex; j++) {
        if (tokens[j].includes('.') || tokens[j].includes('!') || tokens[j].includes('?')) {
          return true;
        }
      }
      return false;
    };

    const results: CheckedWord[] = tokens.map((token, idx) => {
      if (!wordTokenIdxMap.has(idx)) {
        return { text: token, isWord: false, isTypo: false };
      }

      const wtIdx = wordTokenIdxMap.get(idx)!;
      const wt = wordTokens[wtIdx];
      const stripped = wt.stripped;

      // Ensure that conjunctions, prepositions, particles, or common helper/connector words (including "agar" and "segera") are never marked as typos
      if (EXCLUDED_SUGGESTION_WORDS.has(stripped.toLowerCase().trim())) {
        return { text: token, isWord: true, isTypo: false };
      }

      const formatCase = (suggWord: string) => {
        if (token === token.toUpperCase()) {
          return suggWord.toUpperCase();
        } else if (token[0] === token[0].toUpperCase()) {
          return suggWord.charAt(0).toUpperCase() + suggWord.slice(1);
        }
        return suggWord;
      };

      // 1. Direct typo check from the Admin typos database
      if (typosMap.has(stripped)) {
        const correctForm = typosMap.get(stripped)!;
        const correctFormLower = correctForm.toLowerCase().trim();
        if (dictionaryWordsSet.has(correctFormLower) && !EXCLUDED_SUGGESTION_WORDS.has(correctFormLower)) {
          const formatted = formatCase(correctForm);
          const dist = getDistance(stripped, correctForm);
          const severity: 'Low' | 'Medium' | 'High' = dist <= 1 ? 'Low' : dist === 2 ? 'Medium' : 'High';

          return {
            text: token,
            isWord: true,
            isTypo: true,
            bestSuggestion: formatted,
            suggestions: [formatted],
            severity
          };
        }
      }

      // 2. Proper Noun check
      const startSentence = isSentenceStart(wtIdx);
      let isProperNoun = false;
      if (wt.isCapitalized) {
        if (!startSentence) {
          isProperNoun = true;
        } else {
          const nextWt = wtIdx < wordTokens.length - 1 ? wordTokens[wtIdx + 1] : null;
          if (nextWt && nextWt.isCapitalized) {
            isProperNoun = true;
          }
        }
      }

      if (isProperNoun) {
        return { text: token, isWord: true, isTypo: false };
      }

      // 3. [Pengecekan Hash/Trie] - Ada di Kamus database kamus leksikon
      const isDirectMatch = kbbiTrie.search(stripped) || validWordsSet.has(stripped);
      const morphResult = checkWordValidWithMorphology(stripped, validWordsSet);
      
      if (isDirectMatch || morphResult.isValid) {
        return { text: token, isWord: true, isTypo: false };
      }

      // 4. [Levenshtein Distance] - Cari kata di kamus dengan jarak terdekat (bobot < 3)
      const candidates: { word: string; dist: number }[] = [];
      dictionaryWordsSet.forEach(vWord => {
        const vWordLower = vWord.toLowerCase().trim();
        if (EXCLUDED_SUGGESTION_WORDS.has(vWordLower)) {
          return; // Skip conjunctions, prepositions, or helper/connecting words as suggestions
        }
        if (Math.abs(vWord.length - stripped.length) < 3) {
          const dist = getDistance(stripped, vWord);
          if (dist < 3) { // (bobot < 3)
            candidates.push({ word: vWord, dist });
          }
        }
      });

      if (candidates.length === 0) {
        // Jika tidak ada di kamus dan tidak ada dengan jarak terdekat (bobot < 3) maka tidak perlu diberikan saran koreksi
        return { text: token, isWord: true, isTypo: false };
      }

      candidates.sort((x, y) => {
        if (x.dist !== y.dist) return x.dist - y.dist;
        return Math.abs(x.word.length - stripped.length) - Math.abs(y.word.length - stripped.length);
      });

      const listSugg = candidates.slice(0, 3).map(c => formatCase(c.word));

      // --- QC (QUALITY CONTROL) VALIDATION LAYER ---
      // Ensure no suggestions contain excluded words (conjunctions, prepositions, or specific excluded terms)
      const qcFilteredSuggestions = listSugg.filter(sugg => {
        const suggLower = sugg.toLowerCase().trim();
        return !EXCLUDED_SUGGESTION_WORDS.has(suggLower);
      });

      // Double check that the input word itself is not in the excluded list
      if (EXCLUDED_SUGGESTION_WORDS.has(stripped.toLowerCase().trim())) {
        return { text: token, isWord: true, isTypo: false };
      }

      // If no suggestions survive the QC filter, cancel the typo flagging
      if (qcFilteredSuggestions.length === 0) {
        return { text: token, isWord: true, isTypo: false };
      }

      let severity: 'Low' | 'Medium' | 'High' = 'High';
      const bestDist = candidates[0]?.dist ?? 3;
      if (bestDist === 1) severity = 'Low';
      else if (bestDist === 2) severity = 'Medium';

      return {
        text: token,
        isWord: true,
        isTypo: true,
        bestSuggestion: qcFilteredSuggestions[0] || undefined,
        suggestions: qcFilteredSuggestions,
        severity
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
          usageCount: increment(1),
          allowedLimit: allowedLimit
        }, { merge: true });
      }
      showStatus("Pemeriksaan selesai, log tersimpan di cloud!", "success");
    } catch (error: any) {
      console.warn("Format error writing stats:", error);
    }
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

  // Listen for Firestore typos data updates
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, 'typos'), limit(1500));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const typosData: TypoEntry[] = [];
      snapshot.forEach((doc) => {
        typosData.push(doc.data() as TypoEntry);
      });
      console.log(`Loaded ${typosData.length} typos from Firestore`);
      setTypos(typosData);
    }, (err) => {
      console.warn("Firestore typos listener error:", err.message);
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      const now = new Date();
      const exportData: any[][] = [
        ["DATABASE LEKSIKON KAMUS PINTAR"],
        ["Waktu Diunduh:", now.toLocaleString("id-ID")],
        [],
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
      
      const dateFormatted = now.toLocaleDateString("id-ID").replace(/\//g, "-");
      const timeFormatted = now.toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' }).replace(/:/g, ".");
      XLSX.writeFile(wb, `Database_Leksikon_Kamus_${dateFormatted}_${timeFormatted}.xlsx`);
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
        // Kolom A (Indeks 0): Dianggap sebagai "Kata" (kosakata utama). Kolom ini wajib terisi.
        const validRows = data.slice(1).filter(row => row && row[0] && String(row[0]).trim() !== '');
        
        let successCount = 0;
        for (const row of validRows) {
          const word = String(row[0]).trim();
          const category = row[1] ? String(row[1]).trim() : 'Nomina';
          const etymology = row[2] ? String(row[2]).trim() : '';
          const definition = row[3] ? String(row[3]).trim() : '';
          // Contoh kalimat dipisahkan dengan titik koma (;)
          const examples = row[4] ? String(row[4]).split(';').map(s => s.trim()).filter(Boolean) : [];
          const searchCount = row[5] ? Number(row[5]) || 0 : 0;
          
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
        setError("Gagal membaca file Excel. Pastikan kolom pertama (Kolom A) adalah Kata/Lema (Wajib terisi).");
      } finally {
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  // Seeding typos
  const seedTyposCollection = async () => {
    if (!db) {
      showStatus("Basis data tidak tersedia.", "error");
      return;
    }
    setIsSeedingTypos(true);
    showStatus("Sedang mengimpor 500+ contoh typo awal...", "info");
    try {
      let count = 0;
      for (const t of initialTypos) {
        const typoId = t.typo.toLowerCase().trim();
        await setDoc(doc(db, "typos", typoId), {
          typo: t.typo.trim(),
          correction: t.correction.trim(),
          category: t.category || "Pemeriksa Typo",
          updatedAt: new Date().toISOString()
        });
        count++;
      }
      showStatus(`Berhasil mengimpor ${count} contoh typo ke database cloud!`, "success");
    } catch (err: any) {
      console.error(err);
      showStatus(`Gagal mengimpor typo: ${err.message}`, "error");
    } finally {
      setIsSeedingTypos(false);
    }
  };

  // Download typos (Excel Export)
  const downloadTyposExcel = () => {
    if (typos.length === 0) {
      showStatus("Tidak ada data typo untuk diunduh.", "error");
      return;
    }
    const now = new Date();
    const exportData: any[][] = [
      ["DATABASE KOREKSI TYPO KBBI"],
      ["Waktu Diunduh:", now.toLocaleString("id-ID")],
      [],
      ["Kata Typo", "Koreksi KBBI", "Kategori"]
    ];
    typos.forEach(t => {
      exportData.push([t.typo, t.correction, t.category || "Pemeriksa Typo"]);
    });

    const ws = XLSX.utils.aoa_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Database Typo");
    
    const dateFormatted = now.toLocaleDateString("id-ID").replace(/\//g, "-");
    const timeFormatted = now.toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' }).replace(/:/g, ".");
    XLSX.writeFile(wb, `Database_Typo_${dateFormatted}_${timeFormatted}.xlsx`);
    showStatus("Berhasil mengunduh basis data typo.", "success");
  };

  // Upload typos (Excel Import)
  const handleTypoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!user) {
      showStatus("Harap login sebagai admin untuk mengunggah file.", "info");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      if (!db) {
        showStatus("Basis data tidak tersedia.", "error");
        return;
      }
      showStatus("Sedang membaca file Excel...", "info");
      
      try {
        const bstr = evt.target?.result as string;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        // A: Kata Typo, B: Koreksi KBBI, C: Kategori (optional)
        const validRows = data.slice(1).filter(row => row[0] && row[1]); 
        
        let successCount = 0;
        for (const row of validRows) {
          const typoStr = String(row[0]).trim();
          const correctionStr = String(row[1]).trim();
          const categoryStr = row[2] ? String(row[2]).trim() : "Pemeriksa Typo";
          
          if (typoStr.toLowerCase() === correctionStr.toLowerCase()) continue;

          await setDoc(doc(db, 'typos', typoStr.toLowerCase()), {
            typo: typoStr,
            correction: correctionStr,
            category: categoryStr,
            updatedAt: new Date().toISOString()
          });
          successCount++;
        }

        showStatus(`Berhasil mengimpor ${successCount} data typo ke database.`, "success");
      } catch (err: any) {
        console.error(err);
        showStatus("Gagal membaca file Excel typo. Format kolom: Kata Typo, Koreksi KBBI, [Kategori (Opsional)]", "error");
      } finally {
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  // Manual Add/Edit and Save Typo
  const handleSaveManualTypo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) {
      showStatus("Basis data tidak tersedia.", "error");
      return;
    }

    const tInput = typoFormFields.typo.trim();
    const cInput = typoFormFields.correction.trim();

    if (!tInput || !cInput) {
      showStatus("Mohon isi semua bidang form.", "error");
      return;
    }

    if (tInput.toLowerCase() === cInput.toLowerCase()) {
      showStatus("Kata typo tidak boleh sama dengan kata koreksinya.", "error");
      return;
    }

    if (typoFormMode === 'add') {
      const isDuplicate = typos.some(t => t.typo.toLowerCase().trim() === tInput.toLowerCase().trim());
      if (isDuplicate) {
        showStatus(`Saran Duplikasi: Kata typo '${tInput}' sudah terdaftar dalam sistem!`, "error");
        return;
      }
    }

    try {
      const typoId = tInput.toLowerCase();
      
      // If editing and the typo identifier changed, delete the old document
      if (typoFormMode === 'edit' && typoFormFields.originalTypo && typoFormFields.originalTypo.toLowerCase() !== typoId) {
        await deleteDoc(doc(db, 'typos', typoFormFields.originalTypo.toLowerCase()));
      }

      await setDoc(doc(db, 'typos', typoId), {
        typo: tInput,
        correction: cInput,
        category: typoFormFields.category || "Pemeriksa Typo",
        updatedAt: new Date().toISOString()
      });

      showStatus(typoFormMode === 'add' ? "Berhasil menambahkan typo!" : "Berhasil memperbarui typo!", "success");
      setShowTypoFormModal(false);
      setTypoFormFields({ typo: '', correction: '', category: 'Pemeriksa Typo' });
    } catch (err: any) {
      console.error(err);
      showStatus(`Gagal menyimpan typo: ${err.message}`, "error");
    }
  };

  // Delete Typo
  const handleDeleteTypo = async (typoStr: string) => {
    if (!db) {
      showStatus("Basis data tidak tersedia.", "error");
      return;
    }

    if (window.confirm(`Hapus koreksi typo "${typoStr}"?`)) {
      try {
        await deleteDoc(doc(db, 'typos', typoStr.toLowerCase().trim()));
        showStatus("Koreksi typo berhasil dihapus.", "success");
      } catch (err: any) {
        console.error(err);
        showStatus(`Gagal menghapus typo: ${err.message}`, "error");
      }
    }
  };

  // Run Database Audit to find duplicate entries
  const runDatabaseAudit = async () => {
    if (!db) {
      showStatus("Basis data tidak tersedia.", "error");
      return;
    }
    setIsAuditing(true);
    showStatus("Sedang memproses audit database, memindai duplikasi kata...", "info");
    try {
      const wordsSnap = await getDocs(collection(db, 'words'));
      const typosSnap = await getDocs(collection(db, 'typos'));

      const wordMap = new Map<string, WordEntry>();
      wordsSnap.forEach(docSnap => {
        const w = docSnap.data() as WordEntry;
        wordMap.set(w.word.trim().toLowerCase(), w);
      });

      const conflicts: {
        id: string;
        term: string;
        wordSource: WordEntry;
        typoSource: TypoEntry;
        type: 'exact' | 'case_mismatch' | 'whitespace_issue';
      }[] = [];

      typosSnap.forEach(docSnap => {
        const t = docSnap.data() as TypoEntry;
        const normalizedTypo = t.typo.trim().toLowerCase();
        
        if (wordMap.has(normalizedTypo)) {
          const w = wordMap.get(normalizedTypo)!;
          let issueType: 'exact' | 'case_mismatch' | 'whitespace_issue' = 'exact';
          
          if (w.word !== t.typo) {
            if (w.word.trim() !== t.typo.trim()) {
              issueType = 'whitespace_issue';
            } else {
              issueType = 'case_mismatch';
            }
          }
          
          conflicts.push({
            id: normalizedTypo,
            term: t.typo,
            wordSource: w,
            typoSource: t,
            type: issueType
          });
        }
      });

      setAuditConflicts(conflicts);
      setSelectedConflictIds([]);
      showStatus(`Audit selesai: Menemukan ${conflicts.length} konflik duplikasi kata antara database 'words' dan 'typos'.`, conflicts.length > 0 ? "info" : "success");
    } catch (err: any) {
      console.error(err);
      showStatus(`Gagal menjalankan audit database: ${err.message}`, "error");
    } finally {
      setIsAuditing(false);
    }
  };

  // Bulk audit duplicate deletions
  const handleAuditDeleteSelected = async (target: 'typos' | 'words' | 'both') => {
    if (!db) {
      showStatus("Basis data tidak tersedia.", "error");
      return;
    }
    if (selectedConflictIds.length === 0) {
      showStatus("Mohon pilih setidaknya satu entri konflik.", "error");
      return;
    }

    const confirmMsg = target === 'typos' 
      ? `Hapus ${selectedConflictIds.length} entri terpilih dari Database Typo? Tindakan ini tidak dapat dibatalkan.`
      : target === 'words'
      ? `Hapus ${selectedConflictIds.length} entri terpilih dari Database Kamus Utama 'words'? Tindakan ini tidak dapat dibatalkan.`
      : `Hapus ${selectedConflictIds.length} entri terpilih dari KEDUA database? Tindakan ini tidak dapat dibatalkan.`;

    if (!window.confirm(confirmMsg)) return;

    setIsAuditDeleting(true);
    let successCount = 0;
    try {
      for (const id of selectedConflictIds) {
        const conf = auditConflicts.find(c => c.id === id);
        if (!conf) continue;

        if (target === 'typos' || target === 'both') {
          await deleteDoc(doc(db, 'typos', conf.typoSource.typo.toLowerCase().trim()));
        }
        if (target === 'words' || target === 'both') {
          await deleteDoc(doc(db, 'words', conf.wordSource.word.toLowerCase().trim()));
        }
        successCount++;
      }

      showStatus(`Berhasil menghapus ${successCount} entri duplikat secara massal!`, "success");
      await runDatabaseAudit();
    } catch (err: any) {
      console.error(err);
      showStatus(`Gagal menghapus entri duplikat: ${err.message}`, "error");
    } finally {
      setIsAuditDeleting(false);
    }
  };

  // Handle Custom Excel File Parsing for Kamus Words
  const handleCustomExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result as string;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        if (data.length === 0) {
          showStatus("File Excel kosong atau tidak terbaca.", "error");
          return;
        }

        const headers = (data[0] || []).map(h => String(h || '').trim());
        if (headers.length === 0) {
          showStatus("Header kolom tidak ditemukan di baris pertama.", "error");
          return;
        }

        setExcelColumns(headers);
        setExcelRows(data.slice(1));

        // Auto-match headers based on keywords
        const mapping = {
          word: '',
          category: '',
          etymology: '',
          definition: '',
          examples: '',
          searchCount: ''
        };

        headers.forEach(h => {
          const lh = h.toLowerCase();
          if (!mapping.word && (lh === 'word' || lh === 'kata' || lh === 'kosakata' || lh === 'lema' || lh === 'istilah' || lh === 'entry')) {
            mapping.word = h;
          }
          if (!mapping.category && (lh === 'kategori' || lh === 'category' || lh === 'golongan' || lh === 'jenis' || lh === 'kelas' || lh === 'pos')) {
            mapping.category = h;
          }
          if (!mapping.etymology && (lh === 'etimologi' || lh === 'etymology' || lh === 'asal asal' || lh === 'asal kata' || lh === 'bahasa asal' || lh === 'asal')) {
            mapping.etymology = h;
          }
          if (!mapping.definition && (lh === 'definisi' || lh === 'definition' || lh === 'arti' || lh === 'makna' || lh === 'keterangan' || lh === 'penjelasan' || lh === 'deskripsi')) {
            mapping.definition = h;
          }
          if (!mapping.examples && (lh === 'contoh' || lh === 'contoh kalimat' || lh === 'examples' || lh === 'penggunaan' || lh === 'contoh_kalimat')) {
            mapping.examples = h;
          }
          if (!mapping.searchCount && (lh === 'pencarian' || lh === 'search' || lh === 'searchcount' || lh === 'jumlah pencarian' || lh === 'hits' || lh.includes('jumlah'))) {
            mapping.searchCount = h;
          }
        });

        setExcelMapping(mapping);
        setImportStep('mapping');
        showStatus("Berhasil membaca file Excel. Silakan konfirmasi pemetaan kolom sebelum memulai impor.", "info");
      } catch (err: any) {
        console.error(err);
        showStatus(`Gagal membaca file Excel: ${err.message}`, "error");
      }
    };
    reader.readAsBinaryString(file);
  };

  // Perform custom mapping process mass insert of words
  const handleExecuteImportKamus = async () => {
    if (!db) {
      showStatus("Basis data tidak tersedia.", "error");
      return;
    }
    if (!excelMapping.word) {
      showStatus("Kolom 'Kata' wajib dipetakan.", "error");
      return;
    }

    const wordIdx = excelColumns.indexOf(excelMapping.word);
    const defIdx = excelMapping.definition ? excelColumns.indexOf(excelMapping.definition) : -1;
    const catIdx = excelMapping.category ? excelColumns.indexOf(excelMapping.category) : -1;
    const etyIdx = excelMapping.etymology ? excelColumns.indexOf(excelMapping.etymology) : -1;
    const exIdx = excelMapping.examples ? excelColumns.indexOf(excelMapping.examples) : -1;
    const scIdx = excelMapping.searchCount ? excelColumns.indexOf(excelMapping.searchCount) : -1;

    const validRows = excelRows.filter(row => row[wordIdx] && String(row[wordIdx]).trim() !== '');
    if (validRows.length === 0) {
      showStatus("Tidak ditemukan data valid yang berisi Kata.", "error");
      return;
    }

    setImportStep('progress');
    setImportProgress(0);
    setImportMessage(`Memulai pengunggahan ${validRows.length} kata leksikon...`);

    let successCount = 0;
    try {
      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        const wordStr = String(row[wordIdx]).trim();
        const categoryStr = catIdx !== -1 && row[catIdx] ? String(row[catIdx]).trim() : "Nomina";
        const etymologyStr = etyIdx !== -1 && row[etyIdx] ? String(row[etyIdx]).trim() : "";
        const definitionStr = defIdx !== -1 && row[defIdx] ? String(row[defIdx]).trim() : "";
        const examplesArr = exIdx !== -1 && row[exIdx] ? String(row[exIdx]).split(';').map(s => s.trim()).filter(Boolean) : [];
        const searchCountNum = scIdx !== -1 && row[scIdx] ? Number(row[scIdx]) || 0 : 0;

        const wordId = wordStr.toLowerCase();
        await setDoc(doc(db, 'words', wordId), {
          word: wordStr,
          category: categoryStr,
          etymology: etymologyStr,
          definition: definitionStr,
          examples: examplesArr,
          searchCount: searchCountNum,
          updatedAt: new Date().toISOString()
        });

        successCount++;
        const pct = Math.round(((i + 1) / validRows.length) * 100);
        setImportProgress(pct);
        setImportMessage(`Mengimpor: ${i + 1} / ${validRows.length} kata (${pct}%)...`);
      }

      showStatus(`Sukses mengimpor ${successCount} kata secara massal dengan pemetaan kolom!`, "success");
      setImportStep('select');
      setExcelColumns([]);
      setExcelRows([]);
      setImportProgress(-1);
    } catch (err: any) {
      console.error(err);
      showStatus(`Proses pengimporan berhenti karena kesalahan: ${err.message}`, "error");
      setImportStep('select');
      setImportProgress(-1);
    }
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

          // Increment daily stats searches
          const todayStr = getLocalDateString();
          setDoc(doc(db, 'stats', todayStr), {
            totalSearches: increment(1)
          }, { merge: true }).catch(e => {
            console.warn("Daily search count increment queued or failed:", e.message);
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const removeFromHistory = (word: string) => {
    setHistory(prev => prev.filter(item => item !== word));
  };

  return (
    <div className={`min-h-screen font-serif transition-colors duration-300 pb-20 ${darkMode ? 'dark bg-[#131211] text-[#f4efe8] selection:bg-[#322c22]' : 'bg-[#fdfbf7] text-[#1a1a1a] selection:bg-gray-200'}`}>
      <div className="print:hidden">
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
              onClick={() => setDarkMode(!darkMode)}
              className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 text-gray-500 hover:border-[#1a1a1a] hover:text-[#1a1a1a] dark:text-gray-400 dark:border-gray-700 dark:hover:border-white dark:hover:text-white rounded-sm transition-all"
              title={darkMode ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
            >
              {darkMode ? <Sun size={12} className="text-amber-400" /> : <Moon size={12} />}
              <span className="hidden sm:inline">{darkMode ? 'Terang' : 'Gelap'}</span>
            </button>
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
          Pemeriksa Typo (KBBI)
        </button>
        <button
          id="tab-pustaka"
          onClick={() => { setActiveTab('pustaka'); }}
          className={`pb-4 text-xs font-sans font-bold uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'pustaka'
              ? 'border-[#1a1a1a] text-[#1a1a1a]'
              : 'border-transparent text-gray-400 hover:text-[#1a1a1a]'
          }`}
        >
          Pustaka Digital <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[9px] font-sans font-black uppercase">Gres</span>
        </button>
      </div>

      {activeTab === 'kamus' && (
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
          <AnimatePresence mode="wait">
            {isEditing ? (
              <motion.div 
                key="isEditing"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
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
              </motion.div>
            ) : error ? (
              <motion.div 
                key="error"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="bg-red-50 border border-red-200 p-12 rounded-sm text-center"
              >
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
              </motion.div>
            ) : result ? (
              <motion.div
                key={`result-${result.word}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
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
              </motion.div>
            ) : (
              <motion.div 
                key="empty"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="h-full flex items-center justify-center border-2 border-dashed border-gray-200 rounded-sm p-12 text-center"
              >
                <div className="max-w-xs">
                  <BookOpen className="mx-auto mb-6 text-gray-200" size={64} />
                  <p className="text-xl italic text-gray-400">Pilih kata di sebelah kiri atau masukkan kata baru untuk melihat definisi lengkap.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      )}

      {activeTab === 'pemeriksa' && (
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
                <div className="w-full md:w-auto">
                  <h2 className="text-2xl font-black uppercase tracking-tight font-sans text-gray-800">Panel Manajemen Admin Typo</h2>
                  <p className="text-xs text-gray-500 font-serif mt-1">Konfirmasi pembayaran GOPAY/QRIS pengguna, unduh riwayat evaluasi kata, dan konfigurasikan saluran pembayaran.</p>
                  {pendingOver24hCount > 0 && (
                    <div className="mt-3 flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-sm text-xs font-sans animate-pulse">
                      <ShieldAlert size={14} className="text-red-600 shrink-0" />
                      <span>
                        Peringatan: Terdapat <strong>{pendingOver24hCount}</strong> permohonan pembayaran pending yang telah tertunda lebih dari 24 jam!
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap md:flex-nowrap gap-1 bg-gray-50 p-1 border border-gray-100 rounded-sm max-w-full">
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
                  <button
                    onClick={() => setSelectedAdminSubTab('bypass_emails')}
                    className={`px-4 py-2 text-[10px] uppercase font-sans font-bold tracking-wider transition-all rounded-sm ${selectedAdminSubTab === 'bypass_emails' ? 'bg-[#1a1a1a] text-white shadow-md' : 'text-gray-500 hover:text-[#1a1a1a]'}`}
                  >
                    Bypass Typo (Whitelist)
                  </button>
                  <button
                    onClick={() => setSelectedAdminSubTab('kelola_typo')}
                    className={`px-4 py-2 text-[10px] uppercase font-sans font-bold tracking-wider transition-all rounded-sm ${selectedAdminSubTab === 'kelola_typo' ? 'bg-[#1a1a1a] text-white shadow-md' : 'text-gray-500 hover:text-[#1a1a1a]'}`}
                  >
                    Basis Data Typo (KBBI)
                  </button>
                  <button
                    onClick={() => setSelectedAdminSubTab('audit_db')}
                    className={`px-4 py-2 text-[10px] uppercase font-sans font-bold tracking-wider transition-all rounded-sm ${selectedAdminSubTab === 'audit_db' ? 'bg-[#1a1a1a] text-white shadow-md' : 'text-gray-500 hover:text-[#1a1a1a]'}`}
                  >
                    Audit Database 🔍
                  </button>
                  <button
                    onClick={() => setSelectedAdminSubTab('impor_kata')}
                    className={`px-4 py-2 text-[10px] uppercase font-sans font-bold tracking-wider transition-all rounded-sm ${selectedAdminSubTab === 'impor_kata' ? 'bg-[#1a1a1a] text-white shadow-md' : 'text-gray-500 hover:text-[#1a1a1a]'}`}
                  >
                    Impor Kamus Kata 📘
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
                                Rp. {String(pay.amount || paymentSettings.amount || 5000).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
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
              {selectedAdminSubTab === 'riwayat_eval' && (() => {
                const PIE_COLORS = ['#1a1a1a', '#ef4444', '#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6'];
                return (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                        <h3 className="text-xs font-sans font-black uppercase tracking-widest text-[#1a1a1a]">Riwayat Pemeriksaan / Evaluasi Typo Pengguna</h3>
                        <p className="text-[11px] text-gray-400 font-serif mt-1">Seluruh kata, deteksi kesalahan, teks masukan, dan presisi akurasi pengguna direkam secara deterministik.</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 shrink-0">
                        <button
                          onClick={downloadTypoEvaluations}
                          className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[2px] text-[10px] uppercase font-sans font-black tracking-widest flex items-center gap-2 transition-all shadow-md font-sans"
                        >
                          <Download size={12} /> Unduh Riwayat (Excel)
                        </button>
                        {allEvaluations.length > 0 && (
                          <button
                            onClick={handleClearAllEvaluationLogs}
                            className="px-5 py-3 bg-red-600 hover:bg-red-700 text-white rounded-[2px] text-[10px] uppercase font-sans font-black tracking-widest flex items-center gap-2 transition-all shadow-md font-sans"
                          >
                            <Trash2 size={12} /> Hapus Semua Log
                          </button>
                        )}
                      </div>
                    </div>

                    {/* PIE CHART VISUALIZATION */}
                    {typoDistributionData.length > 0 ? (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-gray-50 p-4 border border-gray-200 rounded-sm">
                        {/* Pie Chart Card */}
                        <div className="bg-white p-4 border border-gray-150 rounded-sm flex flex-col justify-between">
                          <div>
                            <h4 className="text-xs font-sans font-black uppercase tracking-wider text-[#1a1a1a] mb-1">
                              Persentase Distribusi Typo Terbanyak
                            </h4>
                            <p className="text-[10px] text-gray-400 font-serif mb-4">
                              Proporsi visual kesalahan ketik yang paling sering dimasukkan oleh pengguna berdasarkan analisis seluruh teks evaluasi.
                            </p>
                          </div>
                          <div className="h-[260px] w-full flex items-center justify-center font-sans">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                              <PieChart>
                                <Pie
                                  data={typoDistributionData}
                                  cx="50%"
                                  cy="50%"
                                  labelLine={false}
                                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                  outerRadius={80}
                                  fill="#8884d8"
                                  dataKey="value"
                                >
                                  {typoDistributionData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip 
                                  contentStyle={{ fontSize: '11px', fontFamily: 'sans-serif', borderRadius: '4px' }} 
                                  formatter={(value: any) => [`${value} kali`, 'Frekuensi']}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Detail List / Legend Card */}
                        <div className="bg-white p-4 border border-gray-150 rounded-sm flex flex-col justify-between">
                          <div>
                            <h4 className="text-xs font-sans font-black uppercase tracking-wider text-[#1a1a1a] mb-1">
                              Detail Frekuensi Kesalahan Kata
                            </h4>
                            <p className="text-[10px] text-gray-400 font-serif mb-4">
                              Daftar kata tidak baku beserta frekuensi kemunculannya dari {allEvaluations.length} sesi pemeriksaan.
                            </p>
                          </div>
                          <div className="space-y-3 flex-1 overflow-y-auto max-h-[220px] pr-1 font-sans">
                            {typoDistributionData.map((entry, index) => {
                              const total = typoDistributionData.reduce((sum, item) => sum + item.value, 0);
                              const percent = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0.0';
                              return (
                                <div key={index} className="flex justify-between items-center border-b border-gray-50 pb-2">
                                  <div className="flex items-center gap-2">
                                    <div 
                                      className="w-3 h-3 rounded-full shrink-0 animate-pulse" 
                                      style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                                    />
                                    <span className="font-mono text-xs font-bold text-gray-700 uppercase bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                                      {entry.name}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-4 text-right">
                                    <span className="font-mono text-xs text-gray-400">{entry.value} kali</span>
                                    <span className="font-mono text-xs font-black text-gray-800 w-12">{percent}%</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 p-6 border border-gray-200 rounded-sm text-center font-serif italic text-xs text-gray-400">
                        Tidak ada statistik typos yang dapat divisualisasikan. Masukkan teks di pemeriksa terlebih dahulu agar log terekam di sini!
                      </div>
                    )}

                    {/* DATE & TIME FILTER FOR GRAPHICAL ANALYTICS */}
                    <div className="bg-white p-4 border border-gray-250 rounded-sm space-y-3 shadow-sm">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-3">
                        <div>
                          <h4 className="text-xs font-sans font-black uppercase tracking-wider text-[#1a1a1a]">
                            Penyaringan Berdasarkan Tanggal &amp; Waktu Grafik
                          </h4>
                          <p className="text-[10px] text-gray-400 font-serif">
                            Batasi periode data grafik pencarian kamus dan log pemeriksaan teks secara spesifik dan presisi.
                          </p>
                        </div>
                        
                        {/* Quick preset triggers */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-mono">
                          <span className="text-gray-400 font-sans font-bold uppercase mr-1">Preset:</span>
                          <button
                            onClick={() => {
                              const today = getLocalDateString();
                              setChartStartDate(today);
                              setChartStartTime('00:00');
                              setChartEndDate(today);
                              setChartEndTime('23:59');
                            }}
                            className="px-2 py-1 bg-gray-50 border border-gray-150 rounded hover:border-[#1a1a1a] dark:hover:border-white transition-all font-bold"
                          >
                            Hari Ini
                          </button>
                          <button
                            onClick={() => {
                              const end = new Date();
                              const start = new Date();
                              start.setDate(end.getDate() - 7);
                              
                              setChartStartDate(getLocalDateString(start));
                              setChartStartTime('00:00');
                              setChartEndDate(getLocalDateString(end));
                              setChartEndTime('23:59');
                            }}
                            className="px-2 py-1 bg-gray-50 border border-gray-150 rounded hover:border-[#1a1a1a] dark:hover:border-white transition-all font-bold"
                          >
                            7 Hari Terakhir
                          </button>
                          <button
                            onClick={() => {
                              const end = new Date();
                              const start = new Date();
                              start.setDate(end.getDate() - 30);
                              
                              setChartStartDate(getLocalDateString(start));
                              setChartStartTime('00:00');
                              setChartEndDate(getLocalDateString(end));
                              setChartEndTime('23:59');
                            }}
                            className="px-2 py-1 bg-gray-50 border border-gray-150 rounded hover:border-[#1a1a1a] dark:hover:border-white transition-all font-bold"
                          >
                            30 Hari Terakhir
                          </button>
                          <button
                            onClick={() => {
                              setChartStartDate('');
                              setChartStartTime('00:00');
                              setChartEndDate('');
                              setChartEndTime('23:59');
                            }}
                            className="px-2 py-1 bg-red-50 border border-red-150 text-red-700 hover:bg-red-100 dark:bg-red-950/20 dark:border-red-900/40 dark:text-red-400 rounded transition-all font-bold"
                          >
                            Reset
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div>
                          <label className="block text-[9px] font-sans font-bold uppercase tracking-widest text-[#1a1a1a] mb-1">
                            Tanggal Mulai
                          </label>
                          <input
                            type="date"
                            value={chartStartDate}
                            onChange={(e) => setChartStartDate(e.target.value)}
                            className="w-full text-xs px-2.5 py-1.5 border border-gray-200 focus:border-[#1a1a1a] dark:focus:border-white focus:outline-none bg-white text-gray-800 rounded-sm font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-sans font-bold uppercase tracking-widest text-[#1a1a1a] mb-1">
                            Jam Mulai
                          </label>
                          <input
                            type="time"
                            value={chartStartTime}
                            onChange={(e) => setChartStartTime(e.target.value)}
                            className="w-full text-xs px-2.5 py-1.5 border border-gray-200 focus:border-[#1a1a1a] dark:focus:border-white focus:outline-none bg-white text-gray-800 rounded-sm font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-sans font-bold uppercase tracking-widest text-[#1a1a1a] mb-1">
                            Tanggal Selesai
                          </label>
                          <input
                            type="date"
                            value={chartEndDate}
                            onChange={(e) => setChartEndDate(e.target.value)}
                            className="w-full text-xs px-2.5 py-1.5 border border-gray-200 focus:border-[#1a1a1a] dark:focus:border-white focus:outline-none bg-white text-gray-800 rounded-sm font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-sans font-bold uppercase tracking-widest text-[#1a1a1a] mb-1">
                            Jam Selesai
                          </label>
                          <input
                            type="time"
                            value={chartEndTime}
                            onChange={(e) => setChartEndTime(e.target.value)}
                            className="w-full text-xs px-2.5 py-1.5 border border-gray-200 focus:border-[#1a1a1a] dark:focus:border-white focus:outline-none bg-white text-gray-800 rounded-sm font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    {/* DUAL DAILY CHARTS: SEARCHES & TYPO LOGS */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-gray-50 p-4 border border-gray-200 rounded-sm">
                      {/* Daily Searches Chart */}
                      <div id="daily-searches-chart" className="bg-white p-4 border border-gray-150 rounded-sm flex flex-col justify-between relative">
                        <div className="mb-4 flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-xs font-sans font-black uppercase tracking-wider text-[#1a1a1a] mb-1">
                              Grafik Jumlah Pencarian Kamus Harian
                            </h4>
                            <p className="text-[10px] text-gray-400 font-serif">
                              Akumulasi volume kueri istilah yang dicari dalam Kamus Pintar tiap hari.
                            </p>
                          </div>
                          {filteredDailySearches.length > 0 && (
                            <button
                              onClick={() => downloadChartAsPng('daily-searches-chart', 'grafik-pencarian-harian.png')}
                              className="py-1 px-2 border border-gray-200 text-gray-500 hover:border-[#1a1a1a] hover:text-[#1a1a1a] dark:text-gray-400 dark:border-gray-700 dark:hover:border-white dark:hover:text-white rounded-sm text-[9px] font-mono flex items-center gap-1 transition-all"
                              title="Download Grafik PNG"
                            >
                              <Download size={10} />
                              <span>PNG</span>
                            </button>
                          )}
                        </div>
                        {filteredDailySearches.length > 0 ? (
                          <div className="h-[220px] w-full font-mono text-[10px] min-h-[220px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={filteredDailySearches}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} />
                                <YAxis stroke="#9ca3af" fontSize={10} allowDecimals={false} />
                                <Tooltip
                                  contentStyle={{ fontSize: '11px', fontFamily: 'sans-serif', borderRadius: '4px' }}
                                  formatter={(value: any) => [`${value} kali`, 'Pencarian']}
                                />
                                <Bar dataKey="count" fill="#1a1a1a" radius={[2, 2, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div className="h-[220px] flex items-center justify-center font-serif italic text-xs text-gray-400 bg-gray-50/50 rounded-sm border border-dashed border-gray-200">
                            Tidak ada aktivitas pencarian terekam pada filter rentang waktu ini.
                          </div>
                        )}
                      </div>

                      {/* Daily Typo Checker Evaluations Chart */}
                      <div id="daily-evaluations-chart" className="bg-white p-4 border border-gray-150 rounded-sm flex flex-col justify-between relative">
                        <div className="mb-4 flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-xs font-sans font-black uppercase tracking-wider text-[#1a1a1a] mb-1">
                              Grafik Pemeriksaan Typo KBBI Harian
                            </h4>
                            <p className="text-[10px] text-gray-400 font-serif">
                              Jumlah pengujian naskah/teks yang diperiksa kualitas keselarasan typo KBBI per hari.
                            </p>
                          </div>
                          {filteredDailyEvaluations.length > 0 && (
                            <button
                              onClick={() => downloadChartAsPng('daily-evaluations-chart', 'grafik-pemeriksaan-typo.png')}
                              className="py-1 px-2 border border-gray-200 text-gray-500 hover:border-[#1a1a1a] hover:text-[#1a1a1a] dark:text-gray-400 dark:border-gray-700 dark:hover:border-white dark:hover:text-white rounded-sm text-[9px] font-mono flex items-center gap-1 transition-all"
                              title="Download Grafik PNG"
                            >
                              <Download size={10} />
                              <span>PNG</span>
                            </button>
                          )}
                        </div>
                        {filteredDailyEvaluations.length > 0 ? (
                          <div className="h-[220px] w-full font-mono text-[10px] min-h-[220px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={filteredDailyEvaluations}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} />
                                <YAxis stroke="#9ca3af" fontSize={10} allowDecimals={false} />
                                <Tooltip
                                  contentStyle={{ fontSize: '11px', fontFamily: 'sans-serif', borderRadius: '4px' }}
                                  formatter={(value: any) => [`${value} kali`, 'Pemeriksaan']}
                                />
                                <Bar dataKey="count" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div className="h-[220px] flex items-center justify-center font-serif italic text-xs text-gray-400 bg-gray-50/50 rounded-sm border border-dashed border-gray-200">
                            Tidak ada pemeriksaan teks yang dilakukan pada filter rentang waktu ini.
                          </div>
                        )}
                      </div>
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
                            <th className="px-6 py-4 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-150">
                          {allEvaluations.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-6 py-12 text-center text-gray-400 font-serif italic text-sm">
                                Belum ada riwayat hasil pemeriksaan terdeteksi.
                              </td>
                            </tr>
                          ) : (
                            allEvaluations.map((ev, idx) => (
                              <tr key={ev.id || idx} className="hover:bg-[#fdfbf7]/50 transition-colors">
                                <td className="px-6 py-4 font-mono font-bold text-gray-750">{ev.email}</td>
                                <td className="px-6 py-4 font-mono">{ev.totalWords || 0} kata</td>
                                <td className="px-6 py-4 font-mono text-red-500 font-bold">{ev.typosCount || 0} kata</td>
                                <td className="px-6 py-4 font-mono text-emerald-600 font-bold">{ev.precision || '100%'}</td>
                                <td className="px-6 py-4 font-serif text-gray-500 truncate max-w-[150px]" title={ev.inputText}>{ev.inputText}</td>
                                <td className="px-6 py-4 text-gray-400 font-mono">
                                  {ev.timestamp ? new Date(ev.timestamp).toLocaleString("id-ID") : "-"}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <button
                                    onClick={() => handleDeleteEvaluationLog(ev.id)}
                                    title="Hapus log pemeriksaan ini"
                                    className="p-1 px-2.5 text-red-600 hover:bg-red-50 hover:text-red-800 rounded transition-colors text-[9px] uppercase font-sans font-black tracking-widest inline-flex items-center gap-1 border border-transparent hover:border-red-100"
                                  >
                                    <Trash2 size={11} /> Hapus
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* PENGATURAN SALURAN GOPAY / QRIS */}
              {selectedAdminSubTab === 'pengaturan_bayar' && (
                <div className="space-y-6 max-w-xl animate-in fade-in duration-300">
                  <div>
                    <h3 className="text-xs font-sans font-black uppercase tracking-widest text-[#1a1a1a]">Konfigurasi Gopay &amp; QRIS</h3>
                    <p className="text-[11px] text-gray-400 font-serif mt-1">Ubah nomor pengantaran gopay dan unggah QRIS pembayaran. Perubahan disimpan ke Firestore dan langsung berefek pada pop-up transaksi klien secara realtime.</p>
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

                    <div className="space-y-2">
                      <label className="block text-[9px] font-sans font-bold uppercase tracking-widest text-[#1a1a1a] opacity-55 font-sans">Nominal Pembayaran (Rp)</label>
                      <input
                        type="number"
                        value={amountInput}
                        onChange={(e) => setAmountInput(Math.max(0, parseInt(e.target.value) || 0))}
                        placeholder="Contoh: 5000"
                        className="w-full text-base font-mono border-b border-gray-200 focus:border-[#1a1a1a] focus:outline-none py-2 bg-transparent text-gray-800"
                      />
                      <p className="text-[10px] text-gray-400 font-serif italic">Nominal yang dikenakan per 10 kali penggunaan fitur typo check.</p>
                    </div>

                    <div className="space-y-4">
                      <label className="block text-[9px] font-sans font-bold uppercase tracking-widest text-[#1a1a1a] opacity-55 font-sans">Unggah Gambar QRIS</label>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start pt-2">
                        <div className="space-y-4">
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
                            <span className="text-[10px] text-gray-400 font-serif italic">Belum ada gambar QRIS terpasang. Silakan unggah gambar QRIS Anda.</span>
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

              {/* BYPASS TYPO (WHITELIST) */}
              {selectedAdminSubTab === 'bypass_emails' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-4">
                    <div>
                      <h3 className="text-xs font-sans font-black uppercase tracking-widest text-[#1a1a1a]">Manajemen Bypass Pemeriksa Typo</h3>
                      <p className="text-[11px] text-gray-400 font-serif mt-1">Daftar email yang diperbolehkan bypass limit pemeriksaan typo KBBI (berkali-kali gratis). Anda dapat mengaktifkan/menonaktifkan atau menambah email bypass baru di bawah ini.</p>
                    </div>
                  </div>

                  {/* Add New Email Form */}
                  <form onSubmit={handleAddBypassEmail} className="bg-gray-50 border border-gray-200 p-4 rounded-sm space-y-3 max-w-xl">
                    <span className="text-[9px] font-sans font-extrabold uppercase tracking-widest text-gray-600 block">Tambah Email Baru (Akses Bypass)</span>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="relative flex-1">
                        <input
                          type="email"
                          required
                          value={newBypassEmail}
                          onChange={(e) => setNewBypassEmail(e.target.value)}
                          placeholder="Masukkan email, misal: pengguna@gmail.com"
                          className="w-full text-xs border border-gray-200 focus:border-[#1a1a1a] focus:outline-none px-3 py-2 bg-white text-gray-800 rounded-sm font-mono"
                        />
                      </div>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-[#1a1a1a] hover:bg-gray-800 text-white rounded-sm text-[10px] uppercase font-sans font-black tracking-widest transition-all shrink-0 flex items-center justify-center gap-1"
                      >
                        <Plus size={12} /> Tambah Email
                      </button>
                    </div>
                  </form>

                  {/* Display list in a table */}
                  <div className="overflow-x-auto border border-gray-200 rounded-sm font-sans max-w-4xl">
                    <table className="w-full text-left font-sans text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-widest text-[9px] font-black">
                          <th className="px-6 py-4">Alamat Email</th>
                          <th className="px-6 py-4 text-center">Status Bypass</th>
                          <th className="px-6 py-4">Tanggal Ditambahkan</th>
                          <th className="px-6 py-4 text-right">Tindakan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-150">
                        {bypassEmailsList.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-6 py-12 text-center text-gray-400 font-serif italic text-sm">
                              Tidak ada email bypass terdaftar.
                            </td>
                          </tr>
                        ) : (
                          bypassEmailsList.map((entry, idx) => (
                            <tr key={entry.id || idx} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-6 py-4 font-mono font-bold text-gray-750">{entry.email}</td>
                              <td className="px-6 py-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleBypassEmail(entry.id, entry.isActive)}
                                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${
                                    entry.isActive
                                      ? 'bg-green-50 text-green-805 border border-green-200 hover:bg-green-100'
                                      : 'bg-red-50 text-red-850 border border-red-200 hover:bg-red-100'
                                  }`}
                                  title="Klik untuk mengubah status aktif"
                                >
                                  {entry.isActive ? (
                                    <>
                                      <CheckCircle size={10} /> Aktif (Bypass)
                                    </>
                                  ) : (
                                    <>
                                      <X size={10} /> Non-aktif (Dibatasi)
                                    </>
                                  )}
                                </button>
                              </td>
                              <td className="px-6 py-4 text-gray-400 font-mono text-[11px]">
                                {entry.createdAt ? new Date(entry.createdAt).toLocaleString("id-ID") : "-"}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteBypassEmail(entry.id, entry.email)}
                                  className="text-[10px] uppercase font-black font-sans tracking-wide text-red-650 hover:text-red-700 hover:underline px-2 py-1"
                                >
                                  Hapus
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* BASIS DATA TYPO (KBBI) */}
              {selectedAdminSubTab === 'kelola_typo' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-4">
                    <div>
                      <h3 className="text-xs font-sans font-black uppercase tracking-widest text-[#1a1a1a]">Manajemen Koreksi Typo KBBI</h3>
                      <p className="text-[11px] text-gray-400 font-serif mt-1">
                        Kelola data kesalahan penulisan (typo) tidak baku dan pasangkan dengan bentuk baku KBBI agar sistem pemeriksa dapat menyortir dan membetulkannya secara presisi.
                      </p>
                    </div>
                  </div>

                  {/* Operational Toolbar */}
                  <div className="flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-4 bg-gray-50 p-4 border border-gray-200 rounded-sm">
                    {/* Search bar and Category Filter inside the typos tab */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 max-w-xl">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          value={typoSearchQuery}
                          onChange={(e) => setTypoSearchQuery(e.target.value)}
                          placeholder="Cari kata typo atau kata baku..."
                          className="w-full text-xs pl-9 pr-4 py-2 border border-gray-200 focus:border-[#1a1a1a] focus:outline-none bg-white text-gray-800 rounded-sm"
                        />
                      </div>
                      
                      <div className="w-full sm:w-48">
                        <select
                          value={typoCategoryFilter}
                          onChange={(e) => setTypoCategoryFilter(e.target.value)}
                          className="w-full text-xs px-3 py-2 border border-gray-200 focus:border-[#1a1a1a] focus:outline-none bg-white text-gray-800 rounded-sm font-sans cursor-pointer"
                        >
                          <option value="Semua Kategori">📚 Semua Kategori</option>
                          <option value="Kata Kerja">🔨 Kata Kerja</option>
                          <option value="Kata Benda">📦 Kata Benda</option>
                          <option value="Nama Tempat">📍 Nama Tempat</option>
                          <option value="Pemeriksa Typo">🔍 Pemeriksa Typo</option>
                          <option value="Lainnya">💡 Lainnya</option>
                        </select>
                      </div>
                    </div>

                    {/* Action buttons list */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => {
                          setTypoFormMode('add');
                          setTypoFormFields({ typo: '', correction: '', category: 'Pemeriksa Typo' });
                          setShowTypoFormModal(true);
                        }}
                        className="px-4 py-2 bg-[#1a1a1a] hover:bg-gray-800 text-white rounded-sm text-[10px] uppercase font-sans font-black tracking-widest transition-all flex items-center gap-1.5"
                      >
                        <Plus size={12} /> Tambah Koreksi
                      </button>

                      <button
                        onClick={downloadTyposExcel}
                        className="px-3 py-2 border border-gray-200 hover:border-gray-300 hover:bg-white text-gray-700 bg-gray-50 rounded-sm text-[10px] uppercase font-sans font-black tracking-widest transition-all flex items-center gap-1.5"
                        title="Unduh semua data sebagai file XLSX / Excel"
                      >
                        <Download size={12} /> Unduh Excel
                      </button>

                      <label className="px-3 py-2 border border-gray-200 hover:border-gray-300 hover:bg-white text-gray-700 bg-gray-50 rounded-sm text-[10px] uppercase font-sans font-black tracking-widest transition-all flex items-center gap-1.5 cursor-pointer">
                        <Upload size={12} /> Unggah Excel
                        <input
                          type="file"
                          accept=".xlsx, .xls"
                          onChange={handleTypoFileUpload}
                          className="hidden"
                        />
                      </label>

                      <button
                        onClick={seedTyposCollection}
                        disabled={isSeedingTypos}
                        className="px-3 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-sm text-[10px] uppercase font-sans font-black tracking-widest transition-all flex items-center gap-1.5 disabled:opacity-50"
                        title="Impor 500+ data contoh typo bawaan KBBI standard untuk melengkapi database"
                      >
                        {isSeedingTypos ? (
                          <>
                            <Loader2 size={12} className="animate-spin" /> Sedang Proses...
                          </>
                        ) : (
                          <>
                            <RefreshCw size={12} /> Impor 500+ Contoh Typo Awal
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Typo List Table */}
                  <div className="overflow-x-auto border border-gray-200 rounded-sm font-sans max-h-[500px]">
                    <table className="w-full text-left font-sans text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-widest text-[9px] font-black sticky top-0 z-10">
                          <th className="px-6 py-4">Kata Tidak Baku (Typo)</th>
                          <th className="px-6 py-4">Koreksi Sesuai KBBI (Baku)</th>
                          <th className="px-6 py-4">Kategori</th>
                          <th className="px-6 py-4">Waktu Pembaruan</th>
                          <th className="px-6 py-4 text-right">Tindakan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-150">
                        {(() => {
                          const filtered = typos.filter(t => {
                            if (typoCategoryFilter === 'Semua Kategori') return true;
                            const cat = t.category || 'Pemeriksa Typo';
                            return cat === typoCategoryFilter;
                          });

                          const scored = filtered.map(t => {
                            const scoreTypo = getFuzzyScore(t.typo, typoSearchQuery);
                            const scoreCorrection = getFuzzyScore(t.correction, typoSearchQuery);
                            const maxScore = Math.max(scoreTypo, scoreCorrection);
                            return { entry: t, score: maxScore };
                          });

                          // Filter out non-matching (score === 0)
                          const filteredScored = scored.filter(item => item.score > 0);

                          // Sort by score descending if search query is active
                          if (typoSearchQuery.trim()) {
                            filteredScored.sort((a, b) => b.score - a.score);
                          }

                          if (filteredScored.length === 0) {
                            return (
                              <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-serif italic text-sm">
                                  {typos.length === 0 
                                    ? 'Basis data masih kosong. Silakan unggah Excel atau klik tombol "Impor 500+ Contoh Typo Awal" di atas!' 
                                    : 'Tidak ada kata typo yang cocok dengan pencarian dan filter.'}
                                </td>
                              </tr>
                            );
                          }

                          const visibleScored = filteredScored.slice(0, typoVisibleCount);

                          return visibleScored.map(({ entry, score }, idx) => (
                            <tr key={entry.typo + idx} className="hover:bg-gray-50/55 transition-colors">
                              <td className="px-6 py-3">
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-red-50 text-red-700 font-bold font-mono border border-red-100">
                                  {entry.typo}
                                </span>
                              </td>
                              <td className="px-6 py-3">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-50 text-green-800 font-bold font-mono border border-green-100">
                                    {entry.correction}
                                  </span>
                                  {typoSearchQuery.trim() && score < 90 && score > 0 && (
                                    <span className="text-[8px] font-sans font-black text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-100 uppercase tracking-widest leading-none">
                                      Fuzzy: {score}% mirip
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-sans font-bold capitalize border ${
                                  entry.category === 'Kata Kerja' ? 'bg-amber-50 text-amber-800 border-amber-100' :
                                  entry.category === 'Kata Benda' ? 'bg-blue-50 text-blue-800 border-blue-100' :
                                  entry.category === 'Nama Tempat' ? 'bg-purple-50 text-purple-800 border-purple-100' :
                                  entry.category === 'Lainnya' ? 'bg-teal-50 text-teal-800 border-teal-100' :
                                  'bg-gray-50 text-gray-600 border-gray-150'
                                }`}>
                                  {entry.category === 'Kata Kerja' ? '🔨 ' :
                                   entry.category === 'Kata Benda' ? '📦 ' :
                                   entry.category === 'Nama Tempat' ? '📍 ' :
                                   entry.category === 'Lainnya' ? '💡 ' : '🔍 '}
                                  {entry.category || 'Pemeriksa Typo'}
                                </span>
                              </td>
                              <td className="px-6 py-3 text-gray-400 font-mono text-[10px]">
                                {entry.updatedAt ? new Date(entry.updatedAt).toLocaleString("id-ID") : "-"}
                              </td>
                              <td className="px-6 py-3 text-right space-x-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTypoFormMode('edit');
                                    setTypoFormFields({
                                      typo: entry.typo,
                                      correction: entry.correction,
                                      category: entry.category || 'Pemeriksa Typo',
                                      originalTypo: entry.typo
                                    });
                                    setShowTypoFormModal(true);
                                  }}
                                  className="text-[10px] uppercase font-black font-sans tracking-wide text-gray-700 hover:text-[#1a1a1a] hover:underline px-2 py-1"
                                >
                                  Ubah
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTypo(entry.typo)}
                                  className="text-[10px] uppercase font-black font-sans tracking-wide text-red-650 hover:text-red-700 hover:underline px-2 py-1"
                                >
                                  Hapus
                                </button>
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>

                  {/* Lazy Loading load-more controls */}
                  {(() => {
                    const matchedCount = typos.filter(t => {
                      if (typoCategoryFilter !== 'Semua Kategori' && (t.category || 'Pemeriksa Typo') !== typoCategoryFilter) {
                        return false;
                      }
                      const scoreTypo = getFuzzyScore(t.typo, typoSearchQuery);
                      const scoreCorrection = getFuzzyScore(t.correction, typoSearchQuery);
                      return Math.max(scoreTypo, scoreCorrection) > 0;
                    }).length;

                    if (matchedCount > typoVisibleCount) {
                      return (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 border border-gray-200 rounded-sm mt-3 shadow-sm">
                          <p className="text-[11px] font-mono text-gray-500">
                            Menampilkan <strong className="text-gray-800">{typoVisibleCount}</strong> dari <strong className="text-gray-800">{matchedCount}</strong> entri typo terfilter.
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setTypoVisibleCount(prev => prev + 100)}
                              className="px-4 py-2 border border-gray-250 hover:border-[#1a1a1a] bg-white text-gray-800 dark:bg-[#1e1c1a] dark:text-white hover:text-[#1a1a1a] transition-all rounded-sm text-[10px] font-sans font-black uppercase tracking-widest shrink-0 cursor-pointer"
                            >
                              Tampilkan 100 Lagi
                            </button>
                            <button
                              onClick={() => setTypoVisibleCount(matchedCount)}
                              className="px-4 py-2 bg-[#1a1a1a] hover:bg-gray-800 text-white transition-all rounded-sm text-[10px] font-sans font-black uppercase tracking-widest shrink-0 cursor-pointer"
                            >
                              Tampilkan Semua
                            </button>
                          </div>
                        </div>
                      );
                    } else if (matchedCount > 0) {
                      return (
                        <div className="bg-white p-3 border border-gray-200 border-t-0 rounded-b-sm text-center mt-3">
                          <p className="text-[11px] font-mono text-gray-400">
                            Menampilkan seluruh {matchedCount} entri typo yang cocok.
                          </p>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}

              {/* DATABASE AUDIT VIEW */}
              {selectedAdminSubTab === 'audit_db' && (
                <div className="space-y-6 animate-in fade-in duration-300 pointer-events-auto">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-4">
                    <div>
                      <h3 className="text-xs font-sans font-black uppercase tracking-widest text-[#1a1a1a]">Audit Duplikasi Leksikon &amp; Typo</h3>
                      <p className="text-[11px] text-gray-400 font-serif mt-1">
                        Secara otomatis memindai persimpangan antara entri kosakata utama (words) dengan kamus kesalahan penulisan (typos). Duplikasi kata di kedua tempat membingungkan sistem pencari dan wajib dibersihkan.
                      </p>
                    </div>
                    <button
                      id="btn-run-audit"
                      onClick={runDatabaseAudit}
                      disabled={isAuditing}
                      className="px-5 py-2.5 bg-[#1a1a1a] hover:bg-gray-800 disabled:opacity-50 text-white rounded-sm text-[10px] uppercase font-sans font-black tracking-widest transition-all flex items-center gap-2 shadow-md cursor-pointer shrink-0"
                    >
                      {isAuditing ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          <span>Menganalisis...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw size={12} />
                          <span>Mulai Audit Database</span>
                        </>
                      )}
                    </button>
                  </div>

                  {isAuditing ? (
                    <div className="border border-gray-200 bg-gray-50/50 rounded-sm p-12 text-center flex flex-col items-center justify-center space-y-3">
                      <Loader2 size={24} className="animate-spin text-gray-400" />
                      <span className="text-xs font-sans font-bold uppercase tracking-wider text-gray-650">Sedang Memindai Silang Data</span>
                      <span className="text-[11px] font-serif italic text-gray-400">Menghubungi Firebase Firestore, mengumpulkan data kata &amp; typo...</span>
                    </div>
                  ) : auditConflicts.length === 0 ? (
                    <div className="border border-green-200 bg-green-50/30 rounded-sm p-10 text-center flex flex-col items-center justify-center space-y-4">
                      <div className="w-12 h-12 rounded-full bg-green-50/80 border border-green-200 flex items-center justify-center text-green-600">
                        <CheckCircle size={24} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-sans font-black uppercase tracking-wider text-green-900">Database Bersih</h4>
                        <p className="text-xs text-green-800 font-serif max-w-md">
                          Hebat! Tidak ditemukan konflik duplikasi kata antara koleksi basis data kamus utama 'words' dan daftar kesalahan ketik 'typos'.
                        </p>
                      </div>
                      <button
                        onClick={runDatabaseAudit}
                        className="text-[10px] font-sans font-black uppercase tracking-widest text-[#1a1a1a] underline hover:no-underline cursor-pointer"
                      >
                        Pindai Ulang
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Metric & Info Banner */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-sm flex items-start gap-3">
                          <ShieldAlert className="text-amber-600 shrink-0 mt-0.5" size={18} />
                          <div>
                            <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-amber-900 block">Total Temuan Konflik</span>
                            <span className="text-2xl font-black font-sans text-amber-950 block">{auditConflicts.length} Kata</span>
                            <span className="text-[10px] text-amber-800 font-serif leading-tight block mt-0.5">Satu kata terdaftar di kamus baku dan terdaftar sebagai kata typo tidak baku secara bersamaan.</span>
                          </div>
                        </div>

                        <div className="p-4 bg-gray-50 border border-gray-200 rounded-sm flex flex-col xs:flex-row items-start xs:items-center justify-between col-span-1 md:col-span-2 gap-4">
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-gray-400 block">Tindakan Penghapusan Massal</span>
                            <p className="text-[11px] text-gray-500 font-serif leading-tight">Pilih baris di bawah, lalu tentukan tindakan perbaikan massal:</p>
                          </div>
                          
                          <div className="flex flex-wrap gap-2">
                            <button
                              id="btn-audit-del-typo"
                              onClick={() => handleAuditDeleteSelected('typos')}
                              disabled={selectedConflictIds.length === 0 || isAuditDeleting}
                              className="px-3 py-1.5 bg-red-650 hover:bg-red-700 text-white disabled:opacity-40 text-[9px] uppercase font-sans font-black tracking-wider rounded-sm transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                              title="Hapus kata terpilih hanya dari database Typo"
                            >
                              <Trash2 size={11} />
                              Hapus dari Typo ({selectedConflictIds.length})
                            </button>
                            <button
                              id="btn-audit-del-words"
                              onClick={() => handleAuditDeleteSelected('words')}
                              disabled={selectedConflictIds.length === 0 || isAuditDeleting}
                              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-40 text-[9px] uppercase font-sans font-black tracking-wider rounded-sm transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                              title="Hapus kata terpilih dari kamus utama 'words'"
                            >
                              <Trash2 size={11} />
                              Hapus dari Kamus ({selectedConflictIds.length})
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Conflict list Table representation */}
                      <div className="border border-gray-200 rounded-sm overflow-hidden">
                        {/* Selector Controls Bar */}
                        <div className="bg-gray-50 p-3 border-b border-gray-200 flex flex-wrap justify-between items-center gap-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSelectedConflictIds(auditConflicts.map(c => c.id))}
                              className="px-2.5 py-1 border border-gray-300 hover:border-[#1a1a1a] text-[10px] uppercase font-sans font-black tracking-wider rounded-sm bg-white text-gray-700 transition cursor-pointer"
                            >
                              Pilih Semua
                            </button>
                            <button
                              onClick={() => setSelectedConflictIds([])}
                              className="px-2.5 py-1 border border-gray-300 hover:border-[#1a1a1a] text-[10px] uppercase font-sans font-black tracking-wider rounded-sm bg-white text-gray-700 transition cursor-pointer"
                            >
                              Bersihkan Pilihan
                            </button>
                          </div>
                          <span className="text-[10px] font-mono text-gray-400">
                            Terpilih {selectedConflictIds.length} dari {auditConflicts.length} konflik
                          </span>
                        </div>

                        <div className="overflow-x-auto max-h-[400px]">
                          <table className="w-full text-left font-sans text-xs">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-widest text-[9px] font-black sticky top-0 z-10">
                                <th className="px-6 py-3 w-12 text-center">
                                  <input 
                                    type="checkbox"
                                    checked={selectedConflictIds.length === auditConflicts.length && auditConflicts.length > 0}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedConflictIds(auditConflicts.map(c => c.id));
                                      } else {
                                        setSelectedConflictIds([]);
                                      }
                                    }}
                                    className="rounded border-gray-300 focus:ring-[#1a1a1a] h-3.5 w-3.5 text-[#1a1a1a] cursor-pointer"
                                  />
                                </th>
                                <th className="px-6 py-3">Kata Terkonflik</th>
                                <th className="px-6 py-3">Sumber KBBI Utama</th>
                                <th className="px-6 py-3">Koreksi Bentuk Typo Silang</th>
                                <th className="px-6 py-3">Jenis Masalah</th>
                                <th className="px-6 py-3 text-right">Tindakan Cepat</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-150">
                              {auditConflicts.map((c, idx) => {
                                const isChecked = selectedConflictIds.includes(c.id);
                                return (
                                  <tr key={c.id + idx} className={`hover:bg-gray-50/50 transition-colors ${isChecked ? 'bg-amber-50/10' : ''}`}>
                                    <td className="px-6 py-3 text-center">
                                      <input 
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setSelectedConflictIds(prev => [...prev, c.id]);
                                          } else {
                                            setSelectedConflictIds(prev => prev.filter(item => item !== c.id));
                                          }
                                        }}
                                        className="rounded border-gray-300 focus:ring-[#1a1a1a] h-3.5 w-3.5 text-[#1a1a1a] cursor-pointer"
                                      />
                                    </td>
                                    <td className="px-6 py-3 font-mono font-bold text-gray-800">{c.term}</td>
                                    <td className="px-6 py-3">
                                      <span className="inline-flex flex-col">
                                        <strong className="text-[11px] font-sans font-bold text-gray-700 capitalize">{c.wordSource.category || 'Nomina'}</strong>
                                        <span className="text-[10px] text-gray-400 font-serif italic line-clamp-1" title={c.wordSource.definition}>{c.wordSource.definition}</span>
                                      </span>
                                    </td>
                                    <td className="px-6 py-3 font-mono text-gray-500">
                                      <span className="text-[10px] text-red-500 font-bold">&#8594; Koreksi ke: {c.typoSource.correction}</span>
                                    </td>
                                    <td className="px-6 py-3">
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-sans font-extrabold uppercase tracking-widest border ${
                                        c.type === 'exact' ? 'bg-red-50 text-red-700 border-red-200' :
                                        c.type === 'case_mismatch' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                        'bg-blue-50 text-blue-700 border-blue-200'
                                      }`}>
                                        {c.type === 'exact' ? '⚠️ Duplikasi Persis' :
                                         c.type === 'case_mismatch' ? '🔡 Perbedaan Huruf' : '␣ Spasi Kosong'}
                                      </span>
                                    </td>
                                    <td className="px-6 py-3 text-right">
                                      <div className="inline-flex rounded-sm shadow-sm">
                                        <button
                                          onClick={async () => {
                                            if (!db) return;
                                            if (!window.confirm(`Hapus typo "${c.term}" dari Database Typo?`)) return;
                                            try {
                                              await deleteDoc(doc(db, 'typos', c.typoSource.typo.toLowerCase().trim()));
                                              showStatus(`Berhasil menghapus typo "${c.term}"`, "success");
                                              await runDatabaseAudit();
                                            } catch (err: any) {
                                              showStatus(err.message, "error");
                                            }
                                          }}
                                          className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-red-650 bg-red-50/50 hover:bg-red-50 hover:text-red-800 border border-gray-200 hover:border-red-100 rounded-l-sm transition-colors cursor-pointer"
                                        >
                                          Hapus Typo
                                        </button>
                                        <button
                                          onClick={async () => {
                                            if (!db) return;
                                            if (!window.confirm(`Hapus lema "${c.term}" dari Kamus Utama?`)) return;
                                            try {
                                              await deleteDoc(doc(db, 'words', c.wordSource.word.toLowerCase().trim()));
                                              showStatus(`Berhasil menghapus kamus "${c.term}"`, "success");
                                              await runDatabaseAudit();
                                            } catch (err: any) {
                                              showStatus(err.message, "error");
                                            }
                                          }}
                                          className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50/50 hover:bg-amber-50 hover:text-amber-800 border-t border-b border-r border-gray-200 hover:border-amber-100 rounded-r-sm transition-colors cursor-pointer"
                                        >
                                          Hapus Kamus
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* IMPORE KAMUS WORDS FROM EXCEL VIEW */}
              {selectedAdminSubTab === 'impor_kata' && (
                <div className="space-y-6 animate-in fade-in duration-300 pointer-events-auto">
                  <div>
                    <h3 className="text-xs font-sans font-black uppercase tracking-widest text-[#1a1a1a]">Impor Massal Kamus Kata (Leksikon)</h3>
                    <p className="text-[11px] text-gray-400 font-serif mt-1">
                      Unggah file Excel berisi ratusan hingga ribuan entri kosakata baru untuk disuntikkan ke dalam kamus utama 'words'. Sistem mendukung pencocokan pintar dan pemetaan kolom dinamis untuk menyesuaikan header Excel Anda.
                    </p>
                  </div>

                  {importStep === 'select' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
                      {/* Upload Box */}
                      <div className="lg:col-span-2 border border-dashed border-gray-300 hover:border-[#1a1a1a] rounded-sm p-8 bg-gray-50/50 hover:bg-white text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[250px] relative">
                        <input
                          id="excel-kamus-uploader"
                          type="file"
                          accept=".xlsx, .xls"
                          onChange={handleCustomExcelUpload}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="flex flex-col items-center justify-center gap-3 text-gray-400">
                          <Upload size={32} className="text-gray-400" />
                          <span className="text-xs font-sans font-bold uppercase tracking-widest text-[#1a1a1a]">Pilih File Excel Kosakata</span>
                          <p className="text-[11px] text-gray-500 font-serif leading-tight max-w-sm mt-1">
                            Klik atau seret file spreadsheet (.xlsx, .xls) ke sini. <br/>Suntikkan kamus tanpa membatasi format kolom Anda.
                          </p>
                        </div>
                      </div>

                      {/* Structural Guide and Helper */}
                      <div className="border border-amber-200/60 bg-amber-50/20 rounded-sm p-5 space-y-4">
                        <div className="flex gap-2">
                          <AlertCircle size={16} className="text-amber-700 mt-0.5 shrink-0" />
                          <h4 className="text-[10px] font-sans font-black uppercase tracking-wider text-amber-900">Petunjuk Kolom &amp; Format</h4>
                        </div>
                        <div className="text-[11px] text-amber-800 font-serif leading-relaxed space-y-2">
                          <p>Database kamus utama menyimpan skema sebagai berikut:</p>
                          <ul className="list-disc pl-4 space-y-1">
                            <li><strong>Kata</strong> (Wajib): Kosakata baku / kata masukan</li>
                            <li><strong>Definisi</strong> (Opsional): Arti penjelasan sesuai kamus ekstensif</li>
                            <li><strong>Kategori</strong> (Opsional): Misalnya Nomina, Verba, Adjektiva, dll. (Default: Nomina)</li>
                            <li><strong>Etimologi</strong> (Opsional): Jejak asal-usul kata serapan bahasa</li>
                            <li><strong>Contoh Kalimat</strong> (Opsional): Contoh tertulis. Pisahkan multi-kalimat dengan tanda titik koma (<code>;</code>)</li>
                            <li><strong>Pencarian</strong> (Opsional): Angka statistik hits pencarian awal (Default: 0)</li>
                          </ul>
                          <p className="text-[10px] italic pt-1 border-t border-amber-200">Tip: Header tidak harus persis. Sistem akan menebak nama kolom secara otomatis, dan Anda dapat memetakan ulang secara bebas di layar berikutnya.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {importStep === 'mapping' && (
                    <div className="bg-white border border-gray-200 rounded-sm p-6 space-y-6 animate-in slide-in-from-bottom-3 duration-300">
                      <div className="border-b border-gray-100 pb-3 flex justify-between items-center">
                        <div>
                          <h4 className="text-xs font-sans font-black uppercase tracking-wider text-[#1a1a1a]">Pemetaan Kolom Spreadsheet</h4>
                          <p className="text-[11px] text-gray-400 font-serif">Konfirmasi silang header Excel Anda dengan kolom destinasi firestore database.</p>
                        </div>
                        <span className="text-[10px] font-mono bg-gray-100 px-3 py-1 rounded-sm text-gray-650 font-bold">
                          Terdeteksi: {excelRows.length} baris data
                        </span>
                      </div>

                      {/* Drop-down Mappings list */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Word mapping */}
                        <div className="space-y-1">
                          <label className="block text-[10px] font-sans font-bold uppercase tracking-widest text-gray-500">Kolom Kata / Lema (Wajib)</label>
                          <select
                            value={excelMapping.word}
                            onChange={(e) => setExcelMapping(prev => ({ ...prev, word: e.target.value }))}
                            className="w-full text-xs px-3 py-2 border border-gray-200 focus:border-[#1a1a1a] focus:outline-none bg-white text-gray-800 rounded-sm font-sans cursor-pointer font-bold"
                          >
                            <option value="">-- Pilih Kolom Kata --</option>
                            {excelColumns.map(col => (
                              <option key={col} value={col}>{col}</option>
                            ))}
                          </select>
                        </div>

                        {/* Definition mapping */}
                        <div className="space-y-1">
                          <label className="block text-[10px] font-sans font-bold uppercase tracking-widest text-gray-500 font-sans">Kolom Definisi / Makna (Opsional)</label>
                          <select
                            value={excelMapping.definition}
                            onChange={(e) => setExcelMapping(prev => ({ ...prev, definition: e.target.value }))}
                            className="w-full text-xs px-3 py-2 border border-gray-200 focus:border-[#1a1a1a] focus:outline-none bg-white text-gray-800 rounded-sm font-sans cursor-pointer font-bold"
                          >
                            <option value="">-- Pilih Kolom Makna --</option>
                            {excelColumns.map(col => (
                              <option key={col} value={col}>{col}</option>
                            ))}
                          </select>
                        </div>

                        {/* Category mapping */}
                        <div className="space-y-1">
                          <label className="block text-[10px] font-sans font-bold uppercase tracking-widest text-gray-500 font-sans font-semibold">Kolom Jenis Kategori (Opsional)</label>
                          <select
                            value={excelMapping.category}
                            onChange={(e) => setExcelMapping(prev => ({ ...prev, category: e.target.value }))}
                            className="w-full text-xs px-3 py-2 border border-gray-200 focus:border-[#1a1a1a] focus:outline-none bg-white text-gray-800 rounded-sm font-sans cursor-pointer"
                          >
                            <option value="">-- Gunakan Default "Nomina" --</option>
                            {excelColumns.map(col => (
                              <option key={col} value={col}>{col}</option>
                            ))}
                          </select>
                        </div>

                        {/* Etymology mapping */}
                        <div className="space-y-1">
                          <label className="block text-[10px] font-sans font-bold uppercase tracking-widest text-gray-500 font-sans font-semibold font-sans">Kolom Etimologi / Asal (Opsional)</label>
                          <select
                            value={excelMapping.etymology}
                            onChange={(e) => setExcelMapping(prev => ({ ...prev, etymology: e.target.value }))}
                            className="w-full text-xs px-3 py-2 border border-gray-200 focus:border-[#1a1a1a] focus:outline-none bg-white text-gray-800 rounded-sm font-sans cursor-pointer"
                          >
                            <option value="">-- Hiraukan / Kosongkan --</option>
                            {excelColumns.map(col => (
                              <option key={col} value={col}>{col}</option>
                            ))}
                          </select>
                        </div>

                        {/* Examples mapping */}
                        <div className="space-y-1">
                          <label className="block text-[10px] font-sans font-bold uppercase tracking-widest text-gray-500 font-sans font-semibold font-sans">Kolom Contoh Kalimat (Opsional)</label>
                          <select
                            value={excelMapping.examples}
                            onChange={(e) => setExcelMapping(prev => ({ ...prev, examples: e.target.value }))}
                            className="w-full text-xs px-3 py-2 border border-gray-200 focus:border-[#1a1a1a] focus:outline-none bg-white text-gray-800 rounded-sm font-sans cursor-pointer"
                          >
                            <option value="">-- Hiraukan / Kosongkan --</option>
                            {excelColumns.map(col => (
                              <option key={col} value={col}>{col}</option>
                            ))}
                          </select>
                        </div>

                        {/* Search count mapping */}
                        <div className="space-y-1">
                          <label className="block text-[10px] font-sans font-bold uppercase tracking-widest text-gray-500 font-sans font-semibold font-sans">Kolom Jumlah Pencarian (Opsional)</label>
                          <select
                            value={excelMapping.searchCount}
                            onChange={(e) => setExcelMapping(prev => ({ ...prev, searchCount: e.target.value }))}
                            className="w-full text-xs px-3 py-2 border border-gray-200 focus:border-[#1a1a1a] focus:outline-none bg-white text-gray-800 rounded-sm font-sans cursor-pointer"
                          >
                            <option value="">-- Setel "0" (Garis Awal) --</option>
                            {excelColumns.map(col => (
                              <option key={col} value={col}>{col}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Operation Actions */}
                      <div className="flex items-center gap-3 pt-4 border-t border-gray-150">
                        <button
                          id="btn-confirm-import-excel"
                          onClick={handleExecuteImportKamus}
                          disabled={!excelMapping.word || !excelMapping.definition}
                          className="px-6 py-3 bg-[#1a1a1a] hover:bg-gray-800 disabled:opacity-40 text-white rounded-sm text-[10px] uppercase font-sans font-black tracking-widest transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
                        >
                          <CheckCircle size={12} />
                          <span>Mulai Impor Leksikon</span>
                        </button>
                        <button
                          onClick={() => {
                            setImportStep('select');
                            setExcelColumns([]);
                            setExcelRows([]);
                          }}
                          className="px-4 py-3 border border-gray-200 hover:border-gray-300 text-gray-600 rounded-sm text-[10px] uppercase font-sans font-black tracking-widest transition-all cursor-pointer"
                        >
                          Batal / Pilih File Lain
                        </button>
                      </div>
                    </div>
                  )}

                  {importStep === 'progress' && (
                    <div className="border border-gray-200 bg-white rounded-sm p-8 space-y-6 text-center animate-in scale-in duration-200 max-w-xl mx-auto">
                      <div className="flex flex-col items-center space-y-3">
                        <Loader2 size={32} className="animate-spin text-gray-700" />
                        <h4 className="text-xs font-sans font-black uppercase tracking-wider text-gray-800">Sinkronisasi Kosakata ke Firestore</h4>
                        <p className="text-[11px] font-mono text-gray-500">{importMessage}</p>
                      </div>

                      {/* Real Progress Bar */}
                      <div className="space-y-1">
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div 
                            className="bg-[#1a1a1a] h-full transition-all duration-300 ease-out" 
                            style={{ width: `${importProgress}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono font-bold text-gray-600 block text-right">{importProgress}% Selesai</span>
                      </div>

                      <div className="pt-2">
                        <p className="text-[10px] text-gray-400 font-serif italic">Harap lapang dada menunggu dan jangan tutup browser tab sebelum proses transmisi Firestore selesai selesai sepenuhnya.</p>
                      </div>
                    </div>
                  )}
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

                <AnimatePresence mode="wait">
                  {checkedResults.length > 0 ? (
                    <motion.div
                      key="results-active"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                      className="space-y-6"
                    >
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
                          let severityStyles = 'decoration-amber-500 text-amber-700 hover:bg-amber-50';
                          let glowColor = 'rgba(245, 158, 11, 0.25)'; // Default Medium (Amber)
                          if (item.severity === 'Low') {
                            severityStyles = 'decoration-yellow-400 text-yellow-800 hover:bg-yellow-50/55';
                            glowColor = 'rgba(250, 204, 21, 0.3)'; // Low (Yellow)
                          } else if (item.severity === 'High') {
                            severityStyles = 'decoration-red-500 text-red-600 font-black hover:bg-red-50';
                            glowColor = 'rgba(239, 68, 68, 0.35)'; // High (Red)
                          }

                          return (
                            <span key={idx} className="relative inline-block">
                              <motion.span
                                initial={{ backgroundColor: glowColor, scale: 0.96, opacity: 0.8 }}
                                animate={{ backgroundColor: "rgba(255, 255, 255, 0)", scale: 1, opacity: 1 }}
                                transition={{ duration: 1.4, ease: "easeOut" }}
                                onClick={() => {
                                  setSelectedWordIdx(isSelected ? null : idx);
                                }}
                                className={`cursor-pointer underline decoration-wavy font-bold ${severityStyles} ${
                                  isSelected ? 'bg-amber-100 text-amber-950' : ''
                                } px-1 rounded-sm transition-all`}
                                title={`Ketuk untuk melihat saran perbaikan (${item.severity || 'Medium'} severity)`}
                              >
                                {item.text}
                                {item.severity === 'High' && <span className="ml-0.5 text-red-500 text-xs inline-block animate-bounce">⚠️</span>}
                              </motion.span>
                              {isSelected && item.suggestions && item.suggestions.length > 0 && (
                                <span className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-2 bg-white border border-[#1a1a1a] shadow-xl p-3 rounded-sm w-52 text-left space-y-2">
                                  <div className="flex items-center justify-between border-b border-gray-100 pb-1">
                                    <span className="block text-[8px] font-sans font-bold uppercase tracking-wider opacity-40">Saran Perbaikan</span>
                                    {item.severity && (
                                      <span className={`text-[7px] px-1 py-0.5 rounded-sm font-sans font-bold uppercase tracking-wider border ${
                                        item.severity === 'Low' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                        item.severity === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                        'bg-red-50 text-red-700 border-red-200 animate-pulse font-black'
                                      }`}>
                                        {item.severity === 'Low' ? 'RINGAN' : item.severity === 'Medium' ? 'SEDANG' : 'BERAT!'}
                                      </span>
                                    )}
                                  </div>
                                  {item.severity === 'High' && (
                                    <div className="bg-red-50 border border-red-100 p-1.5 rounded-xs text-[9px] text-red-800 font-sans leading-tight">
                                      ⚠️ <strong>Typo Berat:</strong> Memerlukan perhatian lebih karena perubahan ejaan signifikan.
                                    </div>
                                  )}
                                  {item.severity === 'Low' && (
                                    <div className="bg-emerald-50/70 border border-emerald-100 p-1.5 rounded-xs text-[9px] text-emerald-800 font-sans leading-tight">
                                      ✨ <strong>Typo Ringan:</strong> Jarak ejaan minim. Disarankan otomatis.
                                    </div>
                                  )}
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
                        
                        <motion.div 
                          variants={{
                            hidden: { opacity: 0 },
                            show: {
                              opacity: 1,
                              transition: {
                                staggerChildren: 0.05
                              }
                            }
                          }}
                          initial="hidden"
                          animate="show"
                          className="space-y-2 max-h-48 overflow-y-auto pr-1"
                        >
                          {checkedResults.map((item, idx) => {
                            if (!item.isTypo) return null;
                            return (
                              <motion.div 
                                key={idx}
                                variants={{
                                  hidden: { opacity: 0, y: 12, scale: 0.97 },
                                  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 25 } }
                                }}
                                whileHover={{ y: -1, boxShadow: "0 4px 12px rgba(0,0,0,0.03)" }}
                                className="flex items-center justify-between p-3 bg-[#fdfbf7] border border-gray-100 rounded-sm text-xs font-sans transition-shadow"
                              >
                                <div className="flex items-center gap-2">
                                  {item.severity && (
                                    <span className={`text-[7px] px-1.5 py-0.5 rounded-sm font-bold uppercase tracking-wider border shrink-0 ${
                                      item.severity === 'Low' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                      item.severity === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                      'bg-red-50 text-red-700 border-red-200 font-black'
                                    }`}>
                                      {item.severity === 'Low' ? 'RINGAN' : item.severity === 'Medium' ? 'SEDANG' : 'BERAT'}
                                    </span>
                                  )}
                                  <div className="leading-tight">
                                    <span className="text-red-500 line-through mr-2 font-serif">{item.text}</span>
                                    <span className="text-gray-400">→</span>
                                    <span className="text-green-600 font-bold ml-2 font-serif">{item.bestSuggestion || '(Tidak ada saran)'}</span>
                                  </div>
                                </div>
                                {item.bestSuggestion && (
                                  <button
                                    onClick={() => handleCorrectSingleWord(idx, item.bestSuggestion!)}
                                    className="px-2 py-1 text-[9px] bg-white border border-gray-200 rounded hover:border-[#1a1a1a] font-bold uppercase tracking-wide transition-colors shrink-0"
                                  >
                                    Terapkan
                                  </button>
                                )}
                              </motion.div>
                            );
                          })}
                        </motion.div>
                      </div>
                    )}

                    {/* Copy & Print Corrected Text panel */}
                    <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={() => {
                          const fullCorrected = checkedResults.map(r => r.text).join('');
                          navigator.clipboard.writeText(fullCorrected);
                          showStatus("Teks hasil koreksi disalin ke clipboard!", "success");
                        }}
                        className="flex-1 py-3 border border-[#1a1a1a] hover:bg-[#1a1a1a] hover:text-white text-[#1a1a1a] transition-all rounded-sm text-[10px] font-sans font-bold uppercase tracking-widest flex items-center justify-center gap-2 font-black"
                      >
                        <Copy size={12} /> Salin Hasil Teks
                      </button>
                      <button
                        onClick={() => {
                          window.print();
                        }}
                        className="flex-1 py-3 bg-[#1a1a1a] hover:bg-gray-800 text-white transition-all rounded-sm text-[10px] font-sans font-bold uppercase tracking-widest flex items-center justify-center gap-2 font-black shadow-sm"
                      >
                        <Printer size={12} /> Cetak Laporan
                      </button>
                    </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="results-empty"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="py-20 text-center border-2 border-dashed border-gray-200 rounded-sm"
                    >
                      <div className="bg-green-50 text-green-500 rounded-full w-12 h-12 flex items-center justify-center border border-green-200 mx-auto mb-4">
                        <Check size={20} />
                      </div>
                      <p className="text-sm italic text-gray-400 px-6 font-serif">Unggah berkas atau ketik teks di sebelah kiri lalu klik "Periksa Kesalahan" untuk memulai analisis kata.</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
          )
        }
        </main>
      )}

      {activeTab === 'pustaka' && (
        <main className="max-w-6xl mx-auto px-6">
          <PustakaDigital 
            isAdmin={isAdmin}
            userEmail={typoEmail}
            paymentSettings={paymentSettings}
            showStatus={showStatus}
            formatRupiah={formatRupiah}
          />
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
                  Batas penggunaan Anda ({allowedLimit}x pemeriksaan) untuk email terdaftar (<span className="font-mono italic font-bold text-gray-800">{typoEmail}</span>) telah terlampaui. Silakan lakukan pembayaran sebesar <strong>{formatRupiah(paymentSettings.amount || 5000)}</strong> ke GOPAY atau QRIS di bawah ini untuk membuka akses tambahan <strong>10x pemeriksaan berikutnya</strong>.
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

      {/* Manual Typo Add/Edit Form Modal */}
      {showTypoFormModal && (
        <div id="typo-form-modal" className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div 
            onClick={() => setShowTypoFormModal(false)}
            className="absolute inset-0 bg-[#1a1a1a]/40 backdrop-blur-sm"
          />
          <form 
            onSubmit={handleSaveManualTypo}
            className="relative bg-white w-full max-w-sm p-8 shadow-2xl border border-[#1a1a1a] rounded-sm space-y-6"
          >
            <div className="flex justify-between items-center border-b border-gray-150 pb-4">
              <h3 className="text-sm font-sans font-black uppercase tracking-widest text-[#1a1a1a]">
                {typoFormMode === 'add' ? 'Tambah Koreksi Typo Baru' : 'Ubah Koreksi Typo'}
              </h3>
              <button 
                type="button" 
                onClick={() => setShowTypoFormModal(false)} 
                className="text-gray-400 hover:text-[#1a1a1a]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-sans font-bold uppercase tracking-widest mb-1 opacity-60">Kata Typo / Tidak Baku</label>
                <input
                  type="text"
                  required
                  value={typoFormFields.typo}
                  onChange={(e) => setTypoFormFields(prev => ({ ...prev, typo: e.target.value }))}
                  placeholder="Misal: apotik"
                  disabled={typoFormMode === 'edit'}
                  className="w-full text-xs font-mono border border-gray-200 focus:border-[#1a1a1a] focus:outline-none px-3 py-2 bg-white text-gray-800 rounded-sm disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-[10px] font-sans font-bold uppercase tracking-widest mb-1 opacity-60">Koreksi Sesuai KBBI (Baku)</label>
                <input
                  type="text"
                  required
                  value={typoFormFields.correction}
                  onChange={(e) => setTypoFormFields(prev => ({ ...prev, correction: e.target.value }))}
                  placeholder="Misal: apotek"
                  className="w-full text-xs font-mono border border-gray-200 focus:border-[#1a1a1a] focus:outline-none px-3 py-2 bg-white text-gray-800 rounded-sm hover:border-[#131212]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-sans font-bold uppercase tracking-widest mb-1 opacity-60">Kategori Kelompok</label>
                <select
                  value={typoFormFields.category || 'Pemeriksa Typo'}
                  onChange={(e) => setTypoFormFields(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full text-xs border border-gray-200 focus:border-[#1a1a1a] focus:outline-none px-3 py-2 bg-white text-gray-800 rounded-sm font-sans cursor-pointer hover:border-[#131212]"
                >
                  <option value="Pemeriksa Typo">🔍 Pemeriksa Typo (Umum)</option>
                  <option value="Kata Kerja">🔨 Kata Kerja</option>
                  <option value="Kata Benda">📦 Kata Benda</option>
                  <option value="Nama Tempat">📍 Nama Tempat</option>
                  <option value="Lainnya">💡 Lainnya</option>
                </select>
              </div>

              {/* Fuzzy Suggestions Panel */}
              {adminFuzzySuggestions.length > 0 && (
                <div className="bg-amber-50/60 border border-amber-200/80 rounded-sm p-3.5 space-y-2 animate-in fade-in duration-200">
                  <span className="block text-[9px] font-sans font-black uppercase tracking-widest text-amber-800">
                    Saran & Deteksi Duplikasi (Fuzzy Search):
                  </span>
                  <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                    {adminFuzzySuggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => applyFuzzySuggestion(suggestion)}
                        className={`w-full text-left text-[11px] p-2 rounded transition-all flex flex-col gap-1 border ${
                          suggestion.type === 'warning_duplicate' 
                            ? 'bg-red-50/70 border-red-200 hover:bg-red-100/80 text-red-800 font-medium' 
                            : 'bg-white border-dashed border-gray-200 hover:border-[#1a1a1a] hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <span className="font-serif leading-snug">{suggestion.message}</span>
                        <span className="text-[9px] font-mono opacity-60 uppercase tracking-wider block">
                          Klik untuk menerapkan koreksi otomatis → ({suggestion.typo} → {suggestion.correction})
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-4 border-t border-gray-150 pt-4">
              <button
                type="button"
                onClick={() => setShowTypoFormModal(false)}
                className="w-1/2 border border-gray-200 hover:bg-gray-50 py-2.5 font-sans font-bold uppercase tracking-widest text-[9px] transition-all rounded-sm text-gray-500"
              >
                Batal
              </button>
              <button
                type="submit"
                className="w-1/2 bg-[#1a1a1a] hover:bg-gray-800 text-white py-2.5 font-sans font-bold uppercase tracking-widest text-[9px] transition-all rounded-sm"
              >
                {typoFormMode === 'add' ? 'Tambah Koreksi' : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        </div>
      )}

      </div>

      {/* LAPORAN CETAK - Hanya muncul saat mencetak */}
      <div className="hidden print:block bg-white text-black font-sans p-10 max-w-4xl mx-auto border border-gray-250">
        <div className="flex justify-between items-start border-b-2 border-[#1a1a1a] pb-6 mb-8">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-[#1a1a1a] mb-1 font-sans">LEKSIKON KBBI DIGITAL</h1>
            <p className="text-[10px] tracking-widest uppercase text-gray-500 font-bold">Laporan Resmi Evaluasi &amp; Pemeriksaan Typo</p>
          </div>
          <div className="text-right text-xs">
            <p className="font-bold text-gray-800">Tanggal Pemeriksaan:</p>
            <p className="text-gray-600 font-medium">
              {(() => {
                const d = new Date();
                const months = [
                  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
                ];
                const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
                return `${days[d.getDay()]} , ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
              })()}
            </p>
          </div>
        </div>

        {/* Ringkasan Statistik */}
        <div className="mb-8">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#1a1a1a] mb-4 pb-1 border-b border-gray-200">Ringkasan Evaluasi</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-gray-50 border border-gray-100 p-4 rounded-sm">
              <p className="text-[9px] uppercase tracking-wider text-gray-400 font-bold font-sans mb-1">Total Kata Diperiksa</p>
              <p className="text-2xl font-black text-[#1a1a1a]">
                {checkedResults.filter(r => r.isWord).length}
              </p>
            </div>
            <div className="bg-gray-50 border border-gray-100 p-4 rounded-sm">
              <p className="text-[9px] uppercase tracking-wider text-gray-400 font-bold font-sans mb-1">Typo Terdeteksi</p>
              <p className={`text-2xl font-black ${checkedResults.some(r => r.isTypo) ? 'text-amber-600' : 'text-green-600'}`}>
                {checkedResults.filter(r => r.isTypo).length}
              </p>
              {checkedResults.some(r => r.isTypo) && (
                <div className="flex gap-2 justify-center text-[8px] mt-1 text-gray-500 font-bold font-sans">
                  <span className="text-emerald-700">R: {checkedResults.filter(r => r.isTypo && r.severity === 'Low').length}</span>
                  <span className="text-amber-700">S: {checkedResults.filter(r => r.isTypo && r.severity === 'Medium').length}</span>
                  <span className="text-red-700">T: {checkedResults.filter(r => r.isTypo && r.severity === 'High').length}</span>
                </div>
              )}
            </div>
            <div className="bg-gray-50 border border-gray-100 p-4 rounded-sm">
              <p className="text-[9px] uppercase tracking-wider text-gray-400 font-bold font-sans mb-1">Skor Presisi</p>
              <p className="text-2xl font-black text-green-600">
                {(() => {
                  const totWords = checkedResults.filter(r => r.isWord).length;
                  if (totWords === 0) return '100%';
                  const typos = checkedResults.filter(r => r.isTypo).length;
                  return `${Math.round(((totWords - typos) / totWords) * 100)}%`;
                })()}
              </p>
            </div>
          </div>
        </div>

        {/* Detil Temuan Typo */}
        <div className="mb-8">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#1a1a1a] mb-4 pb-1 border-b border-gray-200">Daftar Kata Salah (Typo)</h2>
          {checkedResults.filter(r => r.isTypo).length > 0 ? (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-200 text-gray-700 font-bold">
                  <th className="py-2.5 w-12">No</th>
                  <th className="py-2.5">Kata Salah (Typo)</th>
                  <th className="py-2.5">Saran Koreksi</th>
                  <th className="py-2.5">Keparahan</th>
                  <th className="py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {checkedResults.filter(r => r.isTypo).map((item, idx) => (
                  <tr key={idx} className="text-gray-800">
                    <td className="py-2.5 font-medium">{idx + 1}</td>
                    <td className="py-2.5 text-red-600 font-medium line-through">{item.text}</td>
                    <td className="py-2.5 text-green-600 font-black">{item.bestSuggestion || '(Tidak ada saran)'}</td>
                    <td className="py-2.5">
                      {item.severity && (
                        <span className={`inline-block px-1.5 py-0.5 border rounded-sm text-[8px] font-bold uppercase tracking-wider ${
                          item.severity === 'Low' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          item.severity === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-red-50 text-red-700 border-red-200 font-extrabold'
                        }`}>
                          {item.severity === 'Low' ? 'Rendah' : item.severity === 'Medium' ? 'Sedang' : 'Tinggi ⚠️'}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5">
                      <span className="inline-block px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded-sm text-[9px] font-bold uppercase tracking-wider">Perbaiki</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-6 border border-dashed border-green-200 bg-green-50/55 rounded-sm text-center">
              <p className="text-xs text-green-700 font-bold mb-1">Selamat! Tidak Ditemukan Typo</p>
              <p className="text-[11px] text-green-600 font-medium">Dokumen Anda telah diperiksa dan bersih dari kesalahan penulisan (typo) berdasarkan bank data Leksikon.</p>
            </div>
          )}
        </div>

        {/* Pratinjau Teks Hasil Koreksi */}
        <div className="mb-8">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#1a1a1a] mb-4 pb-1 border-b border-gray-200">Teks Hasil Koreksi Lengkap</h2>
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-sm text-xs font-serif leading-relaxed text-gray-800 whitespace-pre-wrap">
            {checkedResults.map(r => r.text).join('')}
          </div>
        </div>

        {/* Signatures & Footer */}
        <div className="mt-16 flex justify-between items-end border-t border-gray-150 pt-8 text-[10px] text-gray-400">
          <div>
            <p className="font-bold text-gray-500 uppercase tracking-wider mb-1">LEKSIKON ENGINE v1.2</p>
            <p>Sistem Deteksi Typo Otomatis berbasis KBBI</p>
          </div>
          <div className="text-right flex flex-col items-end">
            <p className="font-medium text-gray-500">Dicetak melalui:</p>
            <p className="font-bold text-gray-700">Pemeriksa Typo Leksikon KBBI</p>
          </div>
        </div>
      </div>

      {/* Custom Stackable Toast Container */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 w-[90%] max-w-sm pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map(toast => (
            <div key={toast.id} className="pointer-events-auto">
              <ToastItem toast={toast} onClose={removeToast} />
            </div>
          ))}
        </AnimatePresence>
      </div>

      {/* Decorative BG element */}
      <div className="fixed top-0 right-0 p-8 pointer-events-none opacity-[0.03] overflow-hidden select-none">
        <span className="text-[300px] font-sans font-black leading-none">KBBI</span>
      </div>
    </div>
  );
}

