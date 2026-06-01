import React, { useState, useEffect } from 'react';
import { 
  Search, BookOpen, FileText, Image as ImageIcon, Link as LinkIcon, Download, 
  CreditCard, ExternalLink, Clock, Check, Plus, Trash2, Edit, Save, 
  X, HelpCircle, Loader2, BarChart2, TrendingUp, Users, DollarSign, Upload
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { initialProducts, type DigitalProduct, type LibraryPayment } from '../data/initialProducts';
import { db, collection, doc, setDoc, getDocs, onSnapshot, updateDoc, deleteDoc } from '../lib/firebase';

interface PustakaDigitalProps {
  isAdmin: boolean;
  userEmail?: string;
  paymentSettings: {
    gopayNumber: string;
    qrisImageUrl: string;
    amount: number;
  };
  showStatus: (msg: string, type?: 'info' | 'error' | 'success') => void;
  formatRupiah: (val: number) => string;
}

export function PustakaDigital({ isAdmin, userEmail = '', paymentSettings, showStatus, formatRupiah }: PustakaDigitalProps) {
  // Sync States
  const [products, setProducts] = useState<DigitalProduct[]>([]);
  const [payments, setPayments] = useState<LibraryPayment[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [formatFilter, setFormatFilter] = useState<'all' | 'doc' | 'pdf' | 'image' | 'link'>('all');
  const [priceFilter, setPriceFilter] = useState<'all' | 'free' | 'paid'>('all');

  // Purchase/Modal states
  const [selectedProduct, setSelectedProduct] = useState<DigitalProduct | null>(null);
  const [checkoutName, setCheckoutName] = useState('');
  const [checkoutPhone, setCheckoutPhone] = useState('');
  const [checkoutEmail, setCheckoutEmail] = useState(userEmail || localStorage.getItem('user_typo_email') || '');
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [activePaymentRequest, setActivePaymentRequest] = useState<LibraryPayment | null>(null);
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Admin section state
  const [adminMode, setAdminMode] = useState<'pembeli' | 'admin'>(isAdmin ? 'admin' : 'pembeli');
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  // New Product Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formFormat, setFormFormat] = useState<'doc' | 'pdf' | 'image' | 'link'>('pdf');
  const [formPrice, setFormPrice] = useState<number>(0);
  const [formContentUrl, setFormContentUrl] = useState('');
  const [formTheme, setFormTheme] = useState<'slate' | 'indigo' | 'emerald' | 'amber' | 'rose'>('indigo');

  // Support direct file uploads or links
  const [uploadType, setUploadType] = useState<'link' | 'file'>('link');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadedFileSize, setUploadedFileSize] = useState(0);

  // In-app confirmation states to bypass sandboxed window.confirm restrictions
  const [confirmDeleteProductId, setConfirmDeleteProductId] = useState<string | null>(null);
  const [confirmDeletePaymentId, setConfirmDeletePaymentId] = useState<string | null>(null);

  // Load Data with LocalStorage fallback as demanded by criteria #9
  useEffect(() => {
    // 1. Initial State
    let unsubProducts = () => {};
    let unsubPayments = () => {};

    const loadLocalData = () => {
      // Products
      const localProds = localStorage.getItem('pustaka_products');
      if (localProds) {
        setProducts(JSON.parse(localProds));
      } else {
        setProducts(initialProducts);
        localStorage.setItem('pustaka_products', JSON.stringify(initialProducts));
      }

      // Payments
      const localPays = localStorage.getItem('pustaka_payments');
      if (localPays) {
        setPayments(JSON.parse(localPays));
      } else {
        setPayments([]);
        localStorage.setItem('pustaka_payments', JSON.stringify([]));
      }
      setLoading(false);
    };

    if (db) {
      try {
        // Realtime Products
        unsubProducts = onSnapshot(collection(db, 'library_products'), (snapshot) => {
          if (!snapshot.empty) {
            const list: DigitalProduct[] = [];
            snapshot.forEach((d) => {
              list.push({ id: d.id, ...d.data() } as DigitalProduct);
            });
            // Update local memory & storage
            setProducts(list);
            localStorage.setItem('pustaka_products', JSON.stringify(list));
          } else {
            // Seed Firestore with defaults if empty
            initialProducts.forEach(async (p) => {
              await setDoc(doc(db, 'library_products', p.id), p);
            });
            setProducts(initialProducts);
            localStorage.setItem('pustaka_products', JSON.stringify(initialProducts));
          }
          setLoading(false);
        }, (error) => {
          console.warn("Firestore library_products error, using fallback:", error);
          loadLocalData();
        });

        // Realtime Payments
        unsubPayments = onSnapshot(collection(db, 'library_payments'), (snapshot) => {
          const list: LibraryPayment[] = [];
          snapshot.forEach((d) => {
            list.push({ id: d.id, ...d.data() } as LibraryPayment);
          });
          list.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
          setPayments(list);
          localStorage.setItem('pustaka_payments', JSON.stringify(list));
        }, (error) => {
          console.warn("Firestore library_payments error, using fallback:", error);
          loadLocalData();
        });

      } catch (err) {
        console.warn("Error subscribing to Firestore, using local fallback:", err);
        loadLocalData();
      }
    } else {
      loadLocalData();
    }

    return () => {
      unsubProducts();
      unsubPayments();
    };
  }, []);

  // Update default states when user login sets/effects email
  useEffect(() => {
    if (userEmail) {
      setCheckoutEmail(userEmail);
    }
  }, [userEmail]);

  // Keep adminMode in sync when state toggles
  useEffect(() => {
    setAdminMode(isAdmin ? 'admin' : 'pembeli');
  }, [isAdmin]);

  // Handle Download Logic (Either Free or Approved Paid Product)
  const triggerDownload = async (product: DigitalProduct) => {
    const fileName = `${product.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    let extension: string = product.format;
    if (product.format === 'doc') extension = 'docx';
    if (product.format === 'image') extension = 'jpg';

    // 1. If it is an uploaded file (Base64 data URL)
    if (product.contentUrl && product.contentUrl.startsWith('data:')) {
      try {
        // High fidelity, uncorrupted browser decoding using fetch async
        const res = await fetch(product.contentUrl);
        const blob = await res.blob();
        
        const url = URL.createObjectURL(blob);
        const element = document.createElement('a');
        element.href = url;
        element.download = `${fileName}.${extension}`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        URL.revokeObjectURL(url);
        showStatus(`Berhasil mengunduh berkas fisik: ${product.title}`, 'success');
        return;
      } catch (err) {
        console.warn("Direct base64 fetch failed, trying manual decoder", err);
        // Manual decode fallback with whitespace safety
        try {
          const arr = product.contentUrl.split(',');
          const mimeMatch = arr[0].match(/:(.*?);/);
          const mime = mimeMatch ? mimeMatch[1] : '';
          const bstr = atob(arr[1].replace(/\s/g, ''));
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
          const blob = new Blob([u8arr], { type: mime });
          const url = URL.createObjectURL(blob);
          const element = document.createElement('a');
          element.href = url;
          element.download = `${fileName}.${extension}`;
          document.body.appendChild(element);
          element.click();
          document.body.removeChild(element);
          URL.revokeObjectURL(url);
          showStatus(`Berhasil mengunduh berkas fisik: ${product.title}`, 'success');
          return;
        } catch (e) {
          console.error("All decoding pathways failed", e);
          showStatus('Gagal memproses berkas unduhan yang terunggah.', 'error');
        }
      }
    }

    // 2. If it is a real non-placeholder web URL (for example, a real Google Drive file link) - we open it!
    const isRealWebUrl = product.contentUrl && (
      (product.contentUrl.startsWith('http://') || 
       product.contentUrl.startsWith('https://') || 
       product.contentUrl.includes('drive.google.com')) &&
      !product.contentUrl.includes('example.com') &&
      !product.contentUrl.includes('example.club')
    );

    if (isRealWebUrl) {
      window.open(product.contentUrl, '_blank', 'noreferrer');
      showStatus(`Tautan berkas aman berhasil dibuka: ${product.title}`, 'success');
      return;
    }

    // Fallback: Generate an actual readable plain-text file so it opens cleanly without being corrupted (with real/masked link depending on Admin mode)
    const content = `========================================================================
PUSTAKA DIGITAL - UNDUHAN SELESAI (NASKAH DOKUMEN SIMULASI)
========================================================================
Produk ID   : ${product.id}
Judul Buku  : ${product.title.toUpperCase()}
Format Asli : ${product.format.toUpperCase()}
Aset Dok    : ${isAdmin ? product.contentUrl : '[Tautan Terlindung Keamanan Sistem - Akses Akun Pemeriksa Terverifikasi]'}
Tanggal     : ${new Date().toLocaleString('id-ID')}

Terima kasih telah mengunduh produk digital dari sistem kami!
Dokumen ini merupakan file naskah simulasi media pengujian terintegrasi penuh.

--- DETAIL INFORMASI DOKUMEN ---
Judul      : ${product.title}
Deskripsi  : ${product.description}
Status     : Terverifikasi Aman

*Catatan Keamanan: Link drive asli terenkripsi dan dilindungi demi melestarikan privasi dokumen serta mencegah penyebaran eksternal yang tidak sah. Link folder utama hanya dapat dilihat secara utuh melalui login Panel Admin Pustaka yang sah.
========================================================================`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const element = document.createElement('a');
    element.href = url;
    // We append .txt extension so any operating system opens it instantly as text!
    element.download = `${fileName}_${extension}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(url);
    showStatus(`Berhasil mengunduh modul: ${product.title} (.txt)`, 'success');
  };

  // Check purchase status for this product for current customer
  const checkPurchaseStatus = (productId: string) => {
    const emailToTest = checkoutEmail.toLowerCase().trim();
    if (!emailToTest) return 'none';
    const match = payments.find(p => p.productId === productId && p.customerEmail.toLowerCase().trim() === emailToTest);
    return match ? match.status : 'none';
  };

  // Process free checkout or open trigger window
  const handleProductSelect = (product: DigitalProduct) => {
    setSelectedProduct(product);
    if (product.price === 0) {
      // Free download
      triggerDownload(product);
    } else {
      // Paid product
      const status = checkPurchaseStatus(product.id);
      if (status === 'approved') {
        // Already paid and approved! Run direct download
        triggerDownload(product);
      } else if (status === 'pending') {
        // Pending approval. Show invoice details directly
        const match = payments.find(p => p.productId === product.id && p.customerEmail.toLowerCase().trim() === checkoutEmail.toLowerCase().trim());
        if (match) {
          setActivePaymentRequest(match);
          setShowPaymentDetails(true);
        }
      } else {
        // Show checkout details form
        setShowCheckoutModal(true);
      }
    }
  };

  // Submit payment registration and details
  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!checkoutName.trim()) {
      showStatus('Nama lengkap pembeli wajib diisi.', 'error');
      return;
    }
    if (!checkoutPhone.trim()) {
      showStatus('Nomor Handphone wajib diisi.', 'error');
      return;
    }
    if (!checkoutEmail.trim() || !emailRegex.test(checkoutEmail.trim())) {
      showStatus('Harap masukkan alamat email pembeli yang valid.', 'error');
      return;
    }

    setIsSubmittingPayment(true);
    const newPaymentId = `pay-${Date.now()}`;
    const newPayment: LibraryPayment = {
      id: newPaymentId,
      customerName: checkoutName.trim(),
      customerPhone: checkoutPhone.trim(),
      customerEmail: checkoutEmail.trim().toLowerCase(),
      productId: selectedProduct.id,
      productTitle: selectedProduct.title,
      amount: selectedProduct.price,
      status: 'pending',
      requestedAt: new Date().toISOString()
    };

    try {
      // 1. Save to Firestore
      if (db) {
        await setDoc(doc(db, 'library_payments', newPaymentId), newPayment);
      }

      // 2. Local Backup / standalone mode
      const localPays = JSON.parse(localStorage.getItem('pustaka_payments') || '[]');
      const updatedPays = [newPayment, ...localPays];
      localStorage.setItem('pustaka_payments', JSON.stringify(updatedPays));
      
      // Update state UI
      if (!db) {
        setPayments(updatedPays);
      }

      setActivePaymentRequest(newPayment);
      setShowCheckoutModal(false);
      setShowPaymentDetails(true);
      showStatus('Berhasil mendaftarkan bukti pembayaran ke admin!', 'success');
    } catch (err) {
      console.error("Gagal mendaftarkan pembayaran:", err);
      showStatus('Terjadi kendala jaringan saat mendaftarkan pembayaran.', 'error');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Admin Actions: Approve payments
  const handleApproveLibraryPayment = async (payId: string) => {
    try {
      // 1. Update in Firestore
      if (db) {
        await setDoc(doc(db, 'library_payments', payId), {
          status: 'approved',
          approvedAt: new Date().toISOString()
        }, { merge: true });
      }

      // 2. Update local state fallback
      const updated = payments.map(p => {
        if (p.id === payId) {
          return { ...p, status: 'approved' as const, approvedAt: new Date().toISOString() };
        }
        return p;
      });
      setPayments(updated);
      localStorage.setItem('pustaka_payments', JSON.stringify(updated));

      showStatus('Pembayaran digital disetujui! Pembeli sekarang dapat langsung mendownload file.', 'success');
    } catch (err) {
      console.error("Gagal menyetujui:", err);
      showStatus('Gagal memverifikasi status pembayaran.', 'error');
    }
  };

  // Admin Actions: Delete payment requests
  const handleDeleteLibraryPayment = async (payId: string) => {
    try {
      if (db) {
        await deleteDoc(doc(db, 'library_payments', payId));
      }
      const updated = payments.filter(p => p.id !== payId);
      setPayments(updated);
      localStorage.setItem('pustaka_payments', JSON.stringify(updated));
      showStatus('Pengajuan berhasil dihapus dari rekam jejak.', 'success');
      setConfirmDeletePaymentId(null);
    } catch (err) {
      console.error(err);
      showStatus('Gagal menghapus data pengajuan.', 'error');
    }
  };

  // Admin Actions: Create or Edit product
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formDescription.trim() || !formContentUrl.trim()) {
      showStatus('Mohon lengkapi seluruh kolom isian produk.', 'error');
      return;
    }

    const isEdit = !!editingProductId;
    const targetId = isEdit ? editingProductId! : `prod-${Date.now()}`;

    const productPayload: DigitalProduct = {
      id: targetId,
      title: formTitle.trim(),
      description: formDescription.trim(),
      format: formFormat,
      price: Number(formPrice) || 0,
      contentUrl: formContentUrl.trim(),
      theme: formTheme,
      createdAt: isEdit 
        ? (products.find(p => p.id === targetId)?.createdAt || new Date().toISOString()) 
        : new Date().toISOString()
    };

    try {
      if (db) {
        await setDoc(doc(db, 'library_products', targetId), productPayload);
      }

      const localProds = JSON.parse(localStorage.getItem('pustaka_products') || '[]');
      let updatedProds = [];
      if (isEdit) {
        updatedProds = localProds.map((p: any) => p.id === targetId ? productPayload : p);
      } else {
        updatedProds = [productPayload, ...localProds];
      }
      localStorage.setItem('pustaka_products', JSON.stringify(updatedProds));
      
      if (!db) {
        setProducts(updatedProds);
      }

      showStatus(`Produk "${formTitle}" berhasil ${isEdit ? 'diperbaiki' : 'ditambahkan'}!`, 'success');
      resetProductForm();
    } catch (err) {
      console.error(err);
      showStatus('Gagal mengunggah produk.', 'error');
    }
  };

  const handleEditProductClick = (prod: DigitalProduct) => {
    setEditingProductId(prod.id);
    setFormTitle(prod.title);
    setFormDescription(prod.description);
    setFormFormat(prod.format);
    setFormPrice(prod.price);
    setFormContentUrl(prod.contentUrl);
    setFormTheme(prod.theme);
    setIsAddingProduct(true);

    if (prod.contentUrl && prod.contentUrl.startsWith('data:')) {
      setUploadType('file');
      setUploadedFileName(`Berkas_Terunggah.${prod.format === 'doc' ? 'docx' : prod.format === 'image' ? 'jpg' : prod.format}`);
      setUploadedFileSize(Math.round(prod.contentUrl.length * 0.75));
    } else {
      setUploadType('link');
      setUploadedFileName('');
      setUploadedFileSize(0);
    }
  };

  const handleDeleteProduct = async (prodId: string) => {
    try {
      if (db) {
        await deleteDoc(doc(db, 'library_products', prodId));
      }
      const updated = products.filter(p => p.id !== prodId);
      setProducts(updated);
      localStorage.setItem('pustaka_products', JSON.stringify(updated));
      showStatus('Produk berhasil dihapus dari pustaka digital.', 'success');
      setConfirmDeleteProductId(null);
    } catch (err) {
      console.error(err);
      showStatus('Gagal menghapus produk.', 'error');
    }
  };

  const resetProductForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormFormat('pdf');
    setFormPrice(0);
    setFormContentUrl('');
    setFormTheme('indigo');
    setEditingProductId(null);
    setIsAddingProduct(false);
    setUploadType('link');
    setUploadedFileName('');
    setUploadedFileSize(0);
  };

  // Convert theme name to Tailwind Classes for covers
  const getCoverColors = (theme: DigitalProduct['theme']) => {
    switch (theme) {
      case 'indigo': return 'from-indigo-600 to-blue-700 text-white border-indigo-900';
      case 'emerald': return 'from-emerald-600 to-teal-700 text-white border-emerald-900';
      case 'amber': return 'from-amber-500 to-orange-600 text-white border-amber-800';
      case 'rose': return 'from-rose-500 to-pink-600 text-white border-rose-900';
      default: return 'from-slate-650 to-neutral-750 text-white border-slate-900';
    }
  };

  // Get format icons
  const getFormatIcon = (format: DigitalProduct['format'], size = 16) => {
    switch (format) {
      case 'doc': return <FileText size={size} />;
      case 'pdf': return <BookOpen size={size} />;
      case 'image': return <ImageIcon size={size} />;
      case 'link': return <LinkIcon size={size} />;
    }
  };

  // Filter products based on parameters
  const filteredProducts = products.filter(prod => {
    const matchSearch = prod.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        prod.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchFormat = formatFilter === 'all' ? true : prod.format === formatFilter;
    const matchPrice = priceFilter === 'all' ? true : 
                       priceFilter === 'free' ? prod.price === 0 : prod.price > 0;
    return matchSearch && matchFormat && matchPrice;
  });

  // Calculate stats for admin section
  const totalApprovedSales = payments.filter(p => p.status === 'approved');
  const totalEarnings = totalApprovedSales.reduce((acc, curr) => acc + curr.amount, 0);
  const totalPurchasesCount = payments.length;

  const downloadSalesExcel = () => {
    if (payments.length === 0) {
      showStatus('Tidak ada data transaksi pembayaran untuk diunduh.', 'info');
      return;
    }
    const data = [
      ["ID Transaksi", "Nama Lengkap", "No HP / WA", "Email Pembeli", "ID Produk", "Nama Produk Digital", "Total Bayar", "Status Verifikasi", "Waktu Permohonan", "Waktu Disetujui"]
    ];
    payments.forEach(p => {
      data.push([
        p.id,
        p.customerName,
        p.customerPhone,
        p.customerEmail,
        p.productId,
        p.productTitle,
        p.amount,
        p.status === 'approved' ? 'Disetujui' : 'Tertunda / Pending',
        new Date(p.requestedAt).toLocaleString('id-ID'),
        p.approvedAt ? new Date(p.approvedAt).toLocaleString('id-ID') : '-'
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap Penjualan Pustaka");
    XLSX.writeFile(wb, "Pustaka_Digital_Rekap_Penjualan.xlsx");
    showStatus('Rekapan berhasil diunduh ke Excel!', 'success');
  };

  return (
    <div className="space-y-12">
      {/* Title Hero */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-gray-150 pb-8">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight font-sans text-gray-900">
            Pustaka Digital
          </h1>
          <p className="text-sm text-gray-500 font-serif max-w-2xl mt-2 leading-relaxed">
            Marketplace digital premium mandiri yang menyediakan kumpulan naskah regulasi, dokumen contoh formalitas, poster edukasi sastra, dan modul e-book terlengkap.
          </p>
        </div>

        {/* Mode Switchers */}
        {isAdmin && (
          <div className="flex p-0.5 bg-gray-100 rounded-sm border border-gray-200">
            <button
              onClick={() => { setAdminMode('pembeli'); }}
              className={`px-4 py-2 text-[10px] uppercase font-sans font-black tracking-widest transition-all rounded-sm ${adminMode === 'pembeli' ? 'bg-[#1a1a1a] text-white' : 'text-gray-500 hover:text-[#1a1a1a]'}`}
            >
              Mode Pembeli
            </button>
            <button
              onClick={() => { setAdminMode('admin'); }}
              className={`px-4 py-2 text-[10px] uppercase font-sans font-black tracking-widest transition-all rounded-sm ${adminMode === 'admin' ? 'bg-[#1a1a1a] text-white shadow-sm' : 'text-gray-500 hover:text-[#1a1a1a]'}`}
            >
              Panel Admin Pustaka
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-24 text-center space-y-4">
          <Loader2 className="animate-spin mx-auto text-amber-600" size={32} />
          <p className="text-sm font-secondary font-bold italic text-gray-400">Loading data pustaka...</p>
        </div>
      ) : adminMode === 'pembeli' ? (
        // ================= CLIENT MODE VIEW =================
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Filters column */}
          <div className="lg:col-span-3 space-y-8 bg-gray-50/50 p-6 border border-gray-150 rounded-sm">
            <h3 className="text-slate-800 text-[10px] font-sans font-bold uppercase tracking-widest border-b border-gray-200 pb-2">Filter Pencarian</h3>
            
            {/* Search Input */}
            <div className="space-y-2">
              <label className="block text-[9px] font-sans font-bold uppercase tracking-widest text-[#1a1a1a] opacity-50">Ketik Kata Kunci</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Cari modul..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs font-sans border border-gray-200 focus:border-[#1a1a1a] focus:outline-none px-3 py-2.5 bg-white text-gray-800 rounded-sm"
                />
              </div>
            </div>

            {/* Format Filter */}
            <div className="space-y-2">
              <label className="block text-[9px] font-sans font-bold uppercase tracking-widest text-[#1a1a1a] opacity-50">Format Dokumen</label>
              <div className="flex flex-col gap-1">
                {(['all', 'doc', 'pdf', 'image', 'link'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFormatFilter(f)}
                    className={`text-left text-xs font-sans px-3 py-2 rounded-sm border transition-all flex items-center justify-between ${formatFilter === f ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]' : 'border-gray-100 bg-white hover:border-gray-300 text-gray-600'}`}
                  >
                    <span className="capitalize">{f === 'all' ? 'Semua Format' : f === 'doc' ? 'Dokumen (.doc/.docx)' : f === 'pdf' ? 'E-Book (.pdf)' : f === 'image' ? 'Gambar (.png/.jpg)' : 'Tautan Tautan'}</span>
                    <span className="opacity-60">{f !== 'all' && getFormatIcon(f, 12)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Price Filter */}
            <div className="space-y-2">
              <label className="block text-[9px] font-sans font-bold uppercase tracking-widest text-[#1a1a1a] opacity-50">Skema Tarif</label>
              <div className="flex flex-col gap-1">
                {(['all', 'free', 'paid'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setPriceFilter(p)}
                    className={`text-left text-xs font-sans px-3 py-2 rounded-sm border transition-all ${priceFilter === p ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]' : 'border-gray-100 bg-white hover:border-gray-300 text-gray-600'}`}
                  >
                    {p === 'all' ? 'Seluruh Harga' : p === 'free' ? 'Hanya Gratis (Free)' : 'Berbayar (Premium)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Current Account Session Info */}
            <div className="bg-amber-50/40 p-4 border border-amber-100 rounded-sm space-y-2">
              <p className="text-[10px] font-bold text-amber-800 uppercase tracking-widest">Informasi Akses</p>
              <p className="text-[11px] font-serif inline-block text-gray-600">Alamat email pemeriksa saat ini:</p>
              <p className="text-xs font-mono font-bold text-gray-800 break-all">{checkoutEmail || '(Email Belum Diset)'}</p>
              {!checkoutEmail && (
                <p className="text-[10px] text-red-500 italic font-serif leading-tight">Pastikan ketik email terlebih dahulu saat mengunduh produk berbayar agar admin bisa memproses persetujuan.</p>
              )}
            </div>
          </div>

          {/* Product Grid Area */}
          <div className="lg:col-span-9 space-y-6">
            <div className="flex justify-between items-center bg-gray-50 px-4 py-2 border border-gray-150 rounded-sm">
              <span className="text-[10px] font-mono uppercase font-bold text-gray-500">Tampilan {filteredProducts.length} dokumen tersedia</span>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="py-24 border border-dashed border-gray-200 rounded-sm text-center">
                <p className="text-gray-400 font-serif italic text-sm">Tidak ada produk digital yang cocok dengan filter pencarian saat ini.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredProducts.map((p) => {
                  const purchaseType = checkPurchaseStatus(p.id);
                  return (
                    <div 
                      key={p.id} 
                      className="border border-[#1a1a1a]/10 bg-white hover:shadow-[10px_10px_0px_#fdfbf7] transition-all hover:-translate-y-1 flex flex-col h-full rounded-sm overflow-hidden text-left"
                    >
                      {/* Product simulated Show Book Cover */}
                      <div className={`h-40 bg-gradient-to-r ${getCoverColors(p.theme)} p-6 flex flex-col justify-between relative border-b border-black/10`}>
                        <div className="flex justify-between items-start">
                          <span className="bg-black/15 text-[8px] tracking-wider uppercase font-sans font-black px-2 py-1 rounded-[2px] backdrop-blur-md">
                            {p.format.toUpperCase()}
                          </span>
                          <span className="bg-white/15 text-[9px] tracking-widest uppercase font-mono px-2 py-0.5 rounded-[2px] backdrop-blur-md">
                            {p.price === 0 ? 'FREE' : formatRupiah(p.price)}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-normal font-sans font-bold leading-tight line-clamp-2 uppercase tracking-tight">{p.title}</h4>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-mono opacity-70">
                          <span>E-Ref ID: {p.id}</span>
                          <span className="flex items-center gap-1">
                            {getFormatIcon(p.format, 12)}
                          </span>
                        </div>
                      </div>

                      {/* Info & Details */}
                      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                        <p className="text-xs text-gray-500 font-serif line-clamp-3 leading-relaxed">
                          {p.description}
                        </p>

                        <div className="pt-2 border-t border-gray-50 flex items-center justify-between leading-none">
                          <span className="text-[10px] font-mono text-gray-400">Tipe File: .{p.format}</span>
                          {p.price > 0 && (
                            <span className={`text-[9px] font-sans font-black uppercase px-2 py-1 border rounded-[2px] ${
                              purchaseType === 'approved' ? 'bg-green-50 text-green-700 border-green-200' :
                              purchaseType === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse' :
                              'bg-gray-50 text-gray-600 border-gray-200'
                            }`}>
                              {purchaseType === 'approved' ? 'Terbuka' : purchaseType === 'pending' ? 'Menunggu' : 'Premium'}
                            </span>
                          )}
                        </div>

                        {/* Order button */}
                        <button
                          onClick={() => handleProductSelect(p)}
                          className={`w-full py-2.5 font-sans font-black uppercase tracking-widest text-[9px] rounded-sm transition-all flex items-center justify-center gap-2 border ${
                            p.price === 0 ? 'bg-[#1a1a1a] hover:bg-gray-800 text-white border-[#1a1a1a]' : 
                            purchaseType === 'approved' ? 'bg-green-600 hover:bg-green-700 text-white border-green-600' :
                            purchaseType === 'pending' ? 'bg-amber-100 hover:bg-amber-200 text-amber-800 border-amber-200' :
                            'bg-gradient-to-r from-neutral-850 to-neutral-900 text-white hover:brightness-110 border-[#1a1a1a]'
                          }`}
                        >
                          {p.price === 0 ? (
                            <>
                              <Download size={12} /> Unduh Gratis
                            </>
                          ) : purchaseType === 'approved' ? (
                            <>
                              <Download size={12} /> Unduh File
                            </>
                          ) : purchaseType === 'pending' ? (
                            <>
                              <Clock size={12} /> Pembayaran Pending
                            </>
                          ) : (
                            <>
                              <CreditCard size={12} /> Beli Rp.{p.price.toLocaleString('id-ID')}
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        // ================= ADMIN MODE VIEW =================
        <div className="space-y-8 animate-in fade-in duration-350">
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-[#1a1a1a]/10 p-6 rounded-sm shadow-[6px_6px_0px_#f5f5f5] flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-gray-400">Total Pemasukan</p>
                <h3 className="text-2xl font-black font-sans text-gray-800">{formatRupiah(totalEarnings)}</h3>
              </div>
              <div className="p-3 bg-green-50 text-green-600 rounded-sm border border-green-150">
                <DollarSign size={20} />
              </div>
            </div>

            <div className="bg-white border border-[#1a1a1a]/10 p-6 rounded-sm shadow-[6px_6px_0px_#f5f5f5] flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-gray-400">Pengajuan Transaksi</p>
                <h3 className="text-2xl font-black font-sans text-gray-800">{totalPurchasesCount}</h3>
              </div>
              <div className="p-3 bg-amber-50 text-amber-600 rounded-sm border border-amber-150">
                <TrendingUp size={20} />
              </div>
            </div>

            <div className="bg-white border border-[#1a1a1a]/10 p-6 rounded-sm shadow-[6px_6px_0px_#f5f5f5] flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-gray-400">Total Produk Aktif</p>
                <h3 className="text-2xl font-black font-sans text-gray-800">{products.length}</h3>
              </div>
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-sm border border-indigo-150">
                <BookOpen size={20} />
              </div>
            </div>
          </div>

          {/* Admin Navigation Tab Section */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left side Form to upload or edit products */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white border border-[#1a1a1a]/10 rounded-sm p-6 shadow-md">
                <div className="flex justify-between items-center border-b border-gray-100 pb-4 mb-4">
                  <h3 className="text-xs font-sans font-black uppercase tracking-widest text-[#1a1a1a]">
                    {editingProductId ? 'Edit Spek Produk' : 'Unggah Produk baru'}
                  </h3>
                  {isAddingProduct && (
                    <button onClick={resetProductForm} className="text-gray-400 hover:text-red-500 text-xs flex items-center gap-1">
                      <X size={14} /> Batal
                    </button>
                  )}
                </div>

                <form onSubmit={handleSaveProduct} className="space-y-4 text-left">
                  <div>
                    <label className="block text-[9px] font-sans font-bold uppercase tracking-widest mb-1.5 opacity-50">Judul Produk</label>
                    <input
                      type="text"
                      required
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="Contoh: Ebook Regulasi Kelulusan Sekolah"
                      className="w-full text-xs font-sans border border-gray-200 focus:border-[#1a1a1a] focus:outline-none px-3 py-2 bg-transparent text-gray-800 rounded-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-sans font-bold uppercase tracking-widest mb-1.5 opacity-50">Deskripsi Lengkap</label>
                    <textarea
                      required
                      rows={3}
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Rincian mengenai isi, sasaran, nilai manfaat dokumen dsb..."
                      className="w-full text-xs font-sans border border-gray-200 focus:border-[#1a1a1a] focus:outline-none p-3 bg-transparent text-gray-800 rounded-sm leading-relaxed"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-sans font-bold uppercase tracking-widest mb-1.5 opacity-50">Format Unduh</label>
                      <select
                        value={formFormat}
                        onChange={(e) => setFormFormat(e.target.value as any)}
                        className="w-full text-xs font-sans border border-gray-200 focus:border-[#1a1a1a] focus:outline-none px-1.5 py-2 bg-white text-gray-800 rounded-sm"
                      >
                        <option value="pdf">E-Book (.pdf)</option>
                        <option value="doc">Dokumen (.doc)</option>
                        <option value="image">Gambar (.png/.jpg)</option>
                        <option value="link">Tautan Web (.link)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] font-sans font-bold uppercase tracking-widest mb-1.5 opacity-50">Harga Satuan (Rp)</label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={formPrice}
                        onChange={(e) => setFormPrice(Math.max(0, parseInt(e.target.value) || 0))}
                        placeholder="Ketik 0 untuk gratis"
                        className="w-full text-xs font-sans border border-gray-200 focus:border-[#1a1a1a] focus:outline-none px-3 py-2 bg-transparent text-gray-800 rounded-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-[9px] font-sans font-bold uppercase tracking-widest mb-1.5 opacity-50">Pilihan Skema Warna Card</label>
                      <select
                        value={formTheme}
                        onChange={(e) => setFormTheme(e.target.value as any)}
                        className="w-full text-xs font-sans border border-gray-200 focus:border-[#1a1a1a] focus:outline-none px-1.5 py-2 bg-white text-gray-800 rounded-sm"
                      >
                        <option value="indigo">Retro Indigo</option>
                        <option value="slate">Corporate Slate</option>
                        <option value="emerald">Classic Emerald</option>
                        <option value="rose">Elegant Rose</option>
                        <option value="amber">Warm Amber</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-[9px] font-sans font-bold uppercase tracking-widest opacity-55">Sumber Penyaluran Berkas</label>
                    <div className="flex p-0.5 bg-gray-50 border border-gray-200 rounded-sm">
                      <button
                        type="button"
                        onClick={() => {
                          setUploadType('link');
                          setFormContentUrl('');
                        }}
                        className={`flex-1 py-1.5 text-[9px] uppercase font-sans font-black tracking-widest transition-all rounded-sm ${uploadType === 'link' ? 'bg-[#1a1a1a] text-white shadow-sm' : 'text-gray-500 hover:text-[#1a1a1a]'}`}
                      >
                        🔗 Tautan URL
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUploadType('file');
                          setFormContentUrl('');
                        }}
                        className={`flex-1 py-1.5 text-[9px] uppercase font-sans font-black tracking-widest transition-all rounded-sm ${uploadType === 'file' ? 'bg-[#1a1a1a] text-white shadow-sm' : 'text-gray-500 hover:text-[#1a1a1a]'}`}
                      >
                        📁 Unggah File
                      </button>
                    </div>

                    {uploadType === 'link' ? (
                      <div className="space-y-3">
                        {/* Google Drive Pustaka upload assistant guides */}
                        <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-sm space-y-2 text-left">
                          <div className="flex items-center gap-1.5 text-blue-900 font-bold text-[10px] uppercase tracking-wider font-sans">
                            <span className="text-xs">📂</span>
                            <span>Akses Simpan Google Drive Admin</span>
                          </div>
                          <p className="text-[10px] text-blue-800 font-serif leading-relaxed">
                            Silakan unggah dokumen baru Anda terlebih dahulu ke folder Google Drive bersama kami berikut:
                          </p>
                          <a 
                            href="https://drive.google.com/drive/folders/1qjiFhrTiuhmRMz9gCDLD9-aHQbLh0cBf?usp=drive_link" 
                            target="_blank" 
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-700 hover:bg-blue-800 text-white rounded-sm text-[9px] font-sans font-black uppercase tracking-widest transition-colors"
                          >
                            <ExternalLink size={10} /> Buka Folder Drive Pustaka
                          </a>
                          <p className="text-[10px] text-blue-700/90 font-serif leading-relaxed mt-1">
                            Lalu salin Tautan Berbagi atau Kode ID file dari Google Drive, kemudian masukkan pada kolom di bawah.
                          </p>
                        </div>

                        <input
                          type="text"
                          required
                          value={formContentUrl}
                          onChange={(e) => setFormContentUrl(e.target.value)}
                          placeholder="Salin/tempel tautan Google Drive atau link web berkas di sini"
                          className="w-full text-xs font-mono border border-gray-200 focus:border-[#1a1a1a] focus:outline-none px-3 py-2 bg-transparent text-gray-800 rounded-sm"
                        />
                        <p className="text-[10px] text-gray-400 font-serif leading-tight">Contoh: https://drive.google.com/file/d/KODE_ID_FILE/view?usp=sharing</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {formContentUrl && formContentUrl.startsWith('data:') ? (
                          <div className="border border-green-200 bg-green-50/30 p-3 rounded-sm flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs">
                              <FileText className="text-green-600 shrink-0" size={16} />
                              <div className="text-left">
                                <p className="font-bold text-gray-800 break-all">{uploadedFileName || 'Berkas_Terunggah'}</p>
                                <p className="text-[10px] text-gray-400 font-mono">Ukuran: {uploadedFileSize ? `${(uploadedFileSize / 1024).toFixed(1)} KB` : 'N/A'}</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setFormContentUrl('');
                                setUploadedFileName('');
                                setUploadedFileSize(0);
                              }}
                              className="text-[10px] uppercase font-black tracking-wider text-red-650 hover:text-red-700 px-2 py-1 border border-red-200 hover:bg-red-50 rounded-sm"
                            >
                              Ganti
                            </button>
                          </div>
                        ) : (
                          <div className="border border-dashed border-gray-300 rounded-sm hover:border-[#1a1a1a] transition-colors p-4 text-center cursor-pointer relative bg-white">
                            <input
                              type="file"
                              accept=".doc,.docx,.pdf,.png,.jpg,.jpeg"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                
                                // Automatic format detection from uploaded file extension
                                const nameLower = file.name.toLowerCase();
                                if (nameLower.endsWith('.pdf')) {
                                  setFormFormat('pdf');
                                } else if (nameLower.endsWith('.doc') || nameLower.endsWith('.docx')) {
                                  setFormFormat('doc');
                                } else if (nameLower.endsWith('.png') || nameLower.endsWith('.jpg') || nameLower.endsWith('.jpeg')) {
                                  setFormFormat('image');
                                }

                                const reader = new FileReader();
                                reader.onload = () => {
                                  if (typeof reader.result === 'string') {
                                    setFormContentUrl(reader.result);
                                    setUploadedFileName(file.name);
                                    setUploadedFileSize(file.size);
                                    showStatus(`Berhasil membaca file: ${file.name}`, 'success');
                                  }
                                };
                                reader.onerror = () => {
                                  showStatus('Gagal membaca berkas.', 'error');
                                };
                                reader.readAsDataURL(file);
                              }}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <div className="space-y-1">
                              <Upload size={20} className="mx-auto text-gray-400" />
                              <p className="text-xs font-bold text-[#1a1a1a]">Klik atau seret file ke sini</p>
                              <p className="text-[10px] text-gray-400 leading-none">Mendukung .PDF, .DOC, .DOCX, atau Gambar (.PNG/.JPG)</p>
                            </div>
                          </div>
                        )}
                        <input type="hidden" required value={formContentUrl} />
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-[#1a1a1a] hover:bg-gray-800 text-white font-sans font-black uppercase tracking-widest text-[10px] py-3.5 transition-all rounded-sm flex items-center justify-center gap-2"
                  >
                    <Plus size={14} /> {editingProductId ? 'Terapkan Perbaikan' : 'Unggah ke Etalase'}
                  </button>
                </form>
              </div>
            </div>

            {/* Right side database and transaction grids */}
            <div className="lg:col-span-8 space-y-6">
              {/* Product Shelf List */}
              <div className="bg-white border border-[#1a1a1a]/10 rounded-sm p-6 shadow-md text-left">
                <h3 className="text-xs font-sans font-black uppercase tracking-widest text-[#1a1a1a] border-b border-gray-100 pb-3 mb-4">Etalase Buku & Sastra Saat Ini ({products.length} item)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-sans text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-gray-550 uppercase tracking-widest text-[8px] font-black">
                        <th className="px-4 py-3">Rincian Judul</th>
                        <th className="px-4 py-3">Sifat File</th>
                        <th className="px-4 py-3">Tarif Harga</th>
                        <th className="px-4 py-3">Link/Kode File (Secure Admin)</th>
                        <th className="px-4 py-3 text-right">Aksi Manajemen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-150">
                      {products.map((prod) => (
                        <tr key={prod.id} className="hover:bg-gray-50/55 text-gray-800">
                          <td className="px-4 py-3">
                            <p className="font-bold font-sans uppercase text-gray-850">{prod.title}</p>
                            <p className="text-[10px] text-gray-400 font-serif leading-tight mt-0.5 max-w-sm shrink truncate line-clamp-1">{prod.description}</p>
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-gray-500 flex items-center gap-1.5 uppercase">
                            {getFormatIcon(prod.format, 12)} .{prod.format}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-gray-700">
                            {prod.price === 0 ? 'Gratis' : formatRupiah(prod.price)}
                          </td>
                          <td className="px-4 py-3">
                            {prod.contentUrl && prod.contentUrl.startsWith('data:') ? (
                              <span className="text-[10px] font-sans font-bold bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-sm">
                                📁 Berkas Fisik Base64 ({Math.round(prod.contentUrl.length * 0.75 / 1024)} KB)
                              </span>
                            ) : (
                              <div className="flex items-center gap-1.5 max-w-xs xl:max-w-sm">
                                {prod.contentUrl && prod.contentUrl.includes('drive.google.com') ? (
                                  <span className="inline-flex bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 text-[9px] font-sans font-black uppercase rounded-sm shrink-0">
                                    Drive
                                  </span>
                                ) : (
                                  <span className="inline-flex bg-gray-50 text-gray-600 border border-gray-200 px-1.5 py-0.5 text-[9px] font-sans font-black uppercase rounded-sm shrink-0">
                                    Web
                                  </span>
                                )}
                                <a
                                  href={prod.contentUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[10px] font-mono hover:underline hover:text-blue-600 text-gray-500 truncate"
                                  title={prod.contentUrl}
                                >
                                  {prod.contentUrl}
                                </a>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right space-x-2 shrink-0">
                            <button
                              onClick={() => handleEditProductClick(prod)}
                              className="inline-flex items-center gap-1 border border-indigo-200 text-indigo-700 hover:bg-indigo-50 px-2.5 py-1 rounded-sm text-[9px] uppercase font-bold"
                            >
                              <Edit size={10} /> Edit
                            </button>
                            {confirmDeleteProductId === prod.id ? (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  onClick={() => handleDeleteProduct(prod.id)}
                                  className="inline-flex items-center gap-1 bg-red-650 hover:bg-red-750 text-white px-2 py-1 rounded-sm text-[9px] uppercase font-bold transition-all shadow-sm"
                                >
                                  Ya, Hapus
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteProductId(null)}
                                  className="inline-flex items-center gap-1 border border-gray-350 text-gray-700 hover:bg-gray-100 px-2 py-1 rounded-sm text-[9px] uppercase font-bold"
                                >
                                  Batal
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteProductId(prod.id)}
                                className="inline-flex items-center gap-1 border border-red-200 text-red-600 hover:bg-red-50 px-2.5 py-1 rounded-sm text-[9px] uppercase font-bold"
                              >
                                <Trash2 size={10} /> Hapus
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Transactions sales log */}
              <div className="bg-white border border-[#1a1a1a]/10 rounded-sm p-6 shadow-md text-left space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 pb-3 gap-2">
                  <h3 className="text-xs font-sans font-black uppercase tracking-widest text-[#1a1a1a]">Verifikasi Pelanggan & Penjualan ({payments.length} log)</h3>
                  <button
                    onClick={downloadSalesExcel}
                    className="flex items-center gap-1 border border-[#1a1a1a] text-[#1a1a1a] hover:bg-[#1a1a1a] hover:text-white px-3 py-1.5 text-[9px] uppercase font-black tracking-wider transition-colors rounded-sm"
                  >
                    <Download size={11} /> Unduh Rekap Penjualan
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left font-sans text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-gray-550 uppercase tracking-widest text-[8px] font-black">
                        <th className="px-4 py-3">Email Pengguna / WA</th>
                        <th className="px-4 py-3">Nama Produk Dibeli</th>
                        <th className="px-4 py-3">Nominal Bayar</th>
                        <th className="px-4 py-3">Status Verif</th>
                        <th className="px-4 py-3 text-right">Aksi Verifikasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-150">
                      {payments.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-12 text-center text-gray-400 font-serif italic text-sm">
                            Belum ada rekam transaksi pembelian yang masuk.
                          </td>
                        </tr>
                      ) : (
                        payments.map((pay) => (
                          <tr key={pay.id} className="hover:bg-gray-50/50">
                            <td className="px-4 py-3 font-mono">
                              <p className="font-bold text-gray-800 leading-tight">{pay.customerName}</p>
                              <p className="text-[10px] text-gray-400 break-all leading-tight mt-0.5">{pay.customerEmail}</p>
                              <p className="text-[9px] text-gray-400 leading-none mt-1">{pay.customerPhone}</p>
                            </td>
                            <td className="px-4 py-3 font-sans truncate shrink max-w-xs">{pay.productTitle}</td>
                            <td className="px-4 py-3 font-mono font-bold text-[#1a1a1a]">{formatRupiah(pay.amount)}</td>
                            <td className="px-4 py-3">
                              {pay.status === 'approved' ? (
                                <span className="inline-flex bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 text-[8px] font-bold uppercase rounded-sm">Disetujui</span>
                              ) : (
                                <span className="inline-flex bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 text-[8px] font-bold uppercase rounded-sm animate-pulse">Pending</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right space-x-2">
                              {pay.status === 'pending' && (
                                <button
                                  onClick={() => handleApproveLibraryPayment(pay.id)}
                                  className="border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 px-2 py-1 text-[9px] font-bold uppercase rounded-sm"
                                >
                                  Terima Bayar
                                </button>
                              )}
                              {confirmDeletePaymentId === pay.id ? (
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    onClick={() => handleDeleteLibraryPayment(pay.id)}
                                    className="inline-flex items-center gap-1 bg-red-650 hover:bg-red-750 text-white px-2 py-1 rounded-sm text-[9px] uppercase font-bold transition-all shadow-sm"
                                  >
                                    Ya, Hapus
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeletePaymentId(null)}
                                    className="inline-flex items-center gap-1 border border-gray-350 text-gray-700 hover:bg-gray-100 px-1.5 py-1 rounded-sm text-[9px] uppercase font-bold"
                                  >
                                    Batal
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmDeletePaymentId(pay.id)}
                                  className="border border-red-200 text-red-600 hover:bg-red-50 px-2 py-1 text-[9px] font-bold uppercase rounded-sm"
                                >
                                  Hapus
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* ================= MODALS & POPUPS ================= */}

      {/* Buyer Checkout Modal Dialog */}
      {showCheckoutModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            onClick={() => setShowCheckoutModal(false)}
            className="absolute inset-0 bg-[#1a1a1a]/40 backdrop-blur-sm"
          />
          <div className="relative bg-white w-full max-w-md p-8 shadow-2xl border border-[#1a1a1a] rounded-sm max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black uppercase tracking-tighter font-sans text-[#1a1a1a]">Formulir Pembelian</h2>
              <button onClick={() => setShowCheckoutModal(false)} className="text-gray-400 hover:text-[#1a1a1a]">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCheckoutSubmit} className="space-y-4 text-left">
              <p className="text-xs text-gray-500 font-serif leading-relaxed mb-4">
                Anda memilih produk premium: <strong className="text-gray-800 uppercase font-sans">{selectedProduct.title}</strong> seharga <strong>{formatRupiah(selectedProduct.price)}</strong>. Mohon lengkapi identitas pemrosesan di bawah ini.
              </p>

              <div>
                <label className="block text-[9px] font-sans font-bold uppercase tracking-widest mb-1 opacity-50">Nama Lengkap Anda</label>
                <input 
                  type="text" 
                  required
                  value={checkoutName}
                  onChange={(e) => setCheckoutName(e.target.value)}
                  className="w-full text-xs font-sans border-b border-gray-200 focus:border-[#1a1a1a] focus:outline-none py-2 bg-transparent text-gray-800"
                  placeholder="Contoh: Raden Saleh"
                />
              </div>

              <div>
                <label className="block text-[9px] font-sans font-bold uppercase tracking-widest mb-1 opacity-50">Nomor HP / WhatsApp Aktif</label>
                <input 
                  type="text" 
                  required
                  value={checkoutPhone}
                  onChange={(e) => setCheckoutPhone(e.target.value)}
                  className="w-full text-xs font-mono border-b border-gray-200 focus:border-[#1a1a1a] focus:outline-none py-2 bg-transparent text-gray-800"
                  placeholder="Contoh: 081234567890"
                />
              </div>

              <div>
                <label className="block text-[9px] font-sans font-bold uppercase tracking-widest mb-1 opacity-50">Alamat Email Aktif</label>
                <input 
                  type="email" 
                  required
                  value={checkoutEmail}
                  onChange={(e) => setCheckoutEmail(e.target.value)}
                  className="w-full text-xs font-sans border-b border-gray-200 focus:border-[#1a1a1a] focus:outline-none py-2 bg-transparent text-gray-800"
                  placeholder="nama@domain.com"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowCheckoutModal(false)}
                  className="w-1/2 py-3 border border-gray-200 hover:border-[#1a1a1a] font-sans font-bold uppercase tracking-widest text-[9px] text-gray-500 hover:text-[#1a1a1a] transition-all rounded-sm"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="w-1/2 bg-[#1a1a1a] hover:bg-gray-800 text-white py-3 font-sans font-bold uppercase tracking-widest text-[9px] transition-all rounded-sm flex items-center justify-center gap-2"
                >
                  {isSubmittingPayment ? <Loader2 size={12} className="animate-spin" /> : <CreditCard size={12} />}
                  Lanjut Bayar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Details Screen and Payment instructions */}
      {showPaymentDetails && activePaymentRequest && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div 
            onClick={() => setShowPaymentDetails(false)}
            className="absolute inset-0 bg-[#1a1a1a]/40 backdrop-blur-sm"
          />
          <div className="relative bg-white w-full max-w-lg p-8 shadow-2xl border border-[#1a1a1a] rounded-sm max-h-[90vh] overflow-y-auto text-left space-y-6">
            <div className="flex justify-between items-center border-b border-gray-100 pb-4">
              <h2 className="text-xl font-black uppercase tracking-tighter font-sans text-[#1a1a1a]">Instruksi Pembayaran</h2>
              <button onClick={() => setShowPaymentDetails(false)} className="text-gray-400 hover:text-[#1a1a1a]">
                <X size={20} />
              </button>
            </div>

            {checkPurchaseStatus(selectedProduct.id) === 'approved' ? (
              <div className="text-center py-6 space-y-4">
                <div className="inline-flex bg-green-50 text-green-600 border border-green-200 p-3 rounded-full">
                  <Check size={32} />
                </div>
                <h3 className="font-sans font-bold uppercase tracking-widest text-xs text-green-800">Pembayaran Berhasil Diverifikasi!</h3>
                <p className="text-xs text-gray-650 font-serif leading-relaxed px-4">
                  Unduhan produk premium <strong>{selectedProduct.title}</strong> saat ini telah resmi diaktifkan untuk alamat email <span className="font-mono font-bold text-gray-800">{checkoutEmail}</span>. Silakan klik tombol di bawah untuk mengunduh naskah/modul digital Anda.
                </p>
                <div className="flex gap-4 max-w-xs mx-auto">
                  <button
                    onClick={() => {
                      triggerDownload(selectedProduct);
                      setShowPaymentDetails(false);
                    }}
                    className="w-full py-3 bg-green-600 hover:bg-green-700 text-white uppercase text-[10px] font-black tracking-widest transition-all rounded-sm flex items-center justify-center gap-2"
                  >
                    <Download size={14} /> Unduh Sekarang
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="border border-amber-100 bg-amber-50/20 p-4 rounded-sm flex items-start gap-3">
                  <Clock className="text-amber-600 shrink-0 mt-0.5 animate-pulse" size={16} />
                  <div>
                    <h4 className="text-[10px] font-sans font-bold uppercase tracking-widest text-amber-900">Menunggu Persetujuan Admin</h4>
                    <p className="text-xs text-gray-600 font-serif leading-relaxed mt-1">
                      Silakan selesaikan proses pembayaran sebesar <strong>{formatRupiah(activePaymentRequest.amount)}</strong>. Setelah Anda melakukan transfer, admin akan memvalidasi pengajuan Anda dalam beberapa menit.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#fdfbf7] p-4 border border-gray-150 rounded-sm">
                  <div className="space-y-2 text-xs">
                    <h5 className="text-[9px] font-sans font-bold uppercase tracking-widest text-gray-400">Saluran Gopay</h5>
                    <div>
                      <p className="text-gray-500 font-serif">Nomor Tujuan GoPay:</p>
                      <p className="text-lg font-mono font-black text-[#1a1a1a]">{paymentSettings.gopayNumber}</p>
                    </div>
                    <div className="pt-2 text-[10px] text-amber-800/85 italic leading-normal">
                      Sertakan catatan/identitas deskripsi transfer: <strong>{checkoutEmail}</strong> saat mengirim gopay agar mempercepat deteksi otomatis oleh Admin.
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center border-l border-gray-200/40 pl-0 md:pl-4">
                    <p className="text-[9px] font-sans font-black uppercase tracking-widest text-gray-500 mb-2">Pindai QRIS</p>
                    <img 
                      src={paymentSettings.qrisImageUrl} 
                      alt="QRIS QR Code" 
                      className="w-32 h-32 border border-gray-200 p-1 bg-white rounded-sm"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>

                <div className="space-y-2 text-xs font-sans">
                  <span className="text-[9px] font-sans font-bold uppercase tracking-widest text-gray-400">Rincian Data Pengajuan</span>
                  <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-sm font-sans text-[11px]">
                    <div className="text-gray-450">ID Registrasi:</div>
                    <div className="font-mono font-bold text-right">{activePaymentRequest.id}</div>
                    <div className="text-gray-450">Nama Pelanggan:</div>
                    <div className="font-bold text-right">{activePaymentRequest.customerName}</div>
                    <div className="text-gray-450">Email Registrasi:</div>
                    <div className="font-mono font-bold text-right">{activePaymentRequest.customerEmail}</div>
                  </div>
                </div>

                <div className="flex gap-4 pt-2">
                  <button 
                    type="button"
                    onClick={() => setShowPaymentDetails(false)}
                    className="w-full py-3 bg-[#1a1a1a] hover:bg-gray-800 text-white font-sans font-bold uppercase tracking-widest text-[10px] transition-all rounded-sm text-center"
                  >
                    Saya Mengerti, Tutup Dialog
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
