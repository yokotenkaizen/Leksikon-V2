export interface DigitalProduct {
  id: string;
  title: string;
  description: string;
  format: 'doc' | 'pdf' | 'image' | 'link';
  price: number; // 0 for free
  contentUrl: string; // The link, or downloadable simulated file content base64, or dummy download link
  theme: 'slate' | 'indigo' | 'emerald' | 'amber' | 'rose'; // Accent theme for nice cover display
  createdAt: string;
}

export interface LibraryPayment {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  productId: string;
  productTitle: string;
  amount: number;
  status: 'pending' | 'approved';
  requestedAt: string;
  approvedAt?: string;
}

export const initialProducts: DigitalProduct[] = [
  {
    id: 'prod-001',
    title: 'E-Book Pedoman Penerapan EYD Lengkap',
    description: 'Buku panduan digital komprehensif mengenai aturan Ejaan Yang Disempurnakan (EYD) teranyar, dilengkapi contoh penulisan populer, kasus kesalahan umum, dan latihan perbaikan kalimat.',
    format: 'pdf',
    price: 15000,
    contentUrl: 'https://cdn.example.com/downloads/pedoman_eyd_terbaru.pdf',
    theme: 'indigo',
    createdAt: '2026-05-15T10:00:00Z',
  },
  {
    id: 'prod-002',
    title: 'Template Standar Surat Keputusan (SK) Resmi',
    description: 'Format dokumen instan untuk keperluan dinas maupun korporasi. Memenuhi unsur formalitas tata naskah dinas, lengkap dengan marjin presisi, bentuk kop surat, dan penutup.',
    format: 'doc',
    price: 0,
    contentUrl: 'https://cdn.example.com/downloads/template_sk_dinas.docx',
    theme: 'slate',
    createdAt: '2026-05-18T08:30:00Z',
  },
  {
    id: 'prod-003',
    title: 'Infografis Poster Kaidah Penulisan Sastra',
    description: 'Poster beresolusi tinggi (HD Printable) untuk memperjelas konsep diksi, rima, gaya bahasa, dan majas dalam penulisan naratif maupun puisi. Cocok untuk bahan edukasi.',
    format: 'image',
    price: 10000,
    contentUrl: 'https://cdn.example.com/downloads/poster_kaidah_sastra.png',
    theme: 'rose',
    createdAt: '2026-05-20T14:45:00Z',
  },
  {
    id: 'prod-004',
    title: 'Panduan Ringkas Penulisan Esai Ilmiah Populer',
    description: 'Langkah praktis menyusun esai akademis dengan gaya membaca yang populer dan mengalir. Termasuk teknik membangun argumentasi logis dan sitasi tanpa bingung.',
    format: 'pdf',
    price: 0,
    contentUrl: 'https://cdn.example.com/downloads/panduan_esai_ilmiah.pdf',
    theme: 'emerald',
    createdAt: '2026-05-22T09:15:00Z',
  },
  {
    id: 'prod-005',
    title: 'Akses Eksklusif Rekaman Webinar Menulis Kreatif',
    description: 'Tautan langsung ke ruang arsip video serta materi presentasi eksklusif selama 3 jam bersama penulis novel best-seller nasional.',
    format: 'link',
    price: 25000,
    contentUrl: 'https://exclusive.example.club/class/creative-writing-recording',
    theme: 'amber',
    createdAt: '2026-05-24T16:00:00Z',
  }
];
