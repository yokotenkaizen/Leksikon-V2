/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Search, History, BookOpen, Trash2, ArrowRight, Loader2, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getDefinition, type WordDefinition } from './lib/gemini.ts';

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<WordDefinition | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);

  // Check for API Key on mount
  useEffect(() => {
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === '') {
      setApiKeyMissing(true);
    }
  }, []);

  // Load history from localStorage on mount
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

  // Save history to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('kamus_history', JSON.stringify(history));
  }, [history]);

  const handleSearch = async (query: string = searchQuery) => {
    const trimmedQuery = query.trim().toLowerCase();
    if (!trimmedQuery) return;

    setIsLoading(true);
    setError(null);
    setSearchQuery(trimmedQuery);

    try {
      const data = await getDefinition(trimmedQuery);
      setResult(data);
      
      // Update history
      setHistory(prev => {
        const filtered = prev.filter(item => item !== trimmedQuery);
        return [trimmedQuery, ...filtered].slice(0, 10);
      });
    } catch (err) {
      console.error(err);
      setError('Maaf, tidak dapat menemukan definisi untuk kata tersebut atau terjadi kesalahan koneksi.');
      setResult(null);
    } finally {
      setIsLoading(false);
    }
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
      <header className="max-w-6xl mx-auto px-6 py-12 flex flex-col md:flex-row md:items-end justify-between border-b border-[#1a1a1a] mb-12">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase font-sans">Leksikon</h1>
          <p className="text-[10px] font-sans uppercase tracking-[0.2em] opacity-60">Kamus Besar Bahasa Indonesia Digital</p>
        </div>
        <div className="flex gap-8 text-[11px] font-sans font-bold uppercase tracking-widest mt-6 md:mt-0">
          <span className="opacity-40">Mutakhir</span>
          <span className="underline underline-offset-4 decoration-2">Definisi</span>
          <span className="opacity-40">Edisi Digital v5.4.1</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-12 gap-12">
        {/* Left Column: Search & Featured */}
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
            {isLoading && (
              <div className="absolute right-0 bottom-3">
                <Loader2 className="animate-spin text-gray-300" size={20} />
              </div>
            )}
          </div>

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
                  Didukung oleh Kecerdasan Buatan
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Definition View */}
        <div className="md:col-span-8">
          <AnimatePresence mode="wait">
            {apiKeyMissing && !result && (
              <motion.div 
                key="api-missing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-amber-50 border border-amber-200 p-8 rounded-sm mb-12 shadow-[10px_10px_0px_#fef3c7]"
              >
                <h3 className="font-sans font-bold text-xs uppercase tracking-widest text-amber-900 mb-4 flex items-center gap-2">
                  <Info size={14} /> Konfigurasi Diperlukan
                </h3>
                <p className="text-amber-800 font-serif text-lg leading-relaxed mb-6">
                  Aplikasi belum terhubung ke Google Gemini. Anda perlu menambahkan <code className="bg-amber-100 px-1 font-sans font-bold text-sm">GEMINI_API_KEY</code> ke dalam <strong>GitHub Secrets</strong> agar aplikasi dapat berfungsi.
                </p>
                <ol className="text-amber-800 text-[11px] font-sans space-y-2 list-decimal pl-4 leading-snug">
                  <li>Buka repositori Anda di GitHub.</li>
                  <li>Ke <strong>Settings</strong> → <strong>Secrets and variables</strong> → <strong>Actions</strong>.</li>
                  <li>Klik <strong>New repository secret</strong>.</li>
                  <li>Nama: <strong>GEMINI_API_KEY</strong>, Value: (Salin dari AI Studio).</li>
                  <li>Lakukan <strong>Re-run all jobs</strong> di tab <strong>Actions</strong>.</li>
                </ol>
              </motion.div>
            )}

            {error ? (
              <motion.div 
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-red-50 border border-red-200 p-8 rounded-sm"
              >
                <h3 className="font-sans font-bold text-xs uppercase tracking-widest text-red-900 mb-2">Terjadi Galat</h3>
                <p className="text-red-800 italic text-xl">{error}</p>
              </motion.div>
            ) : result ? (
              <motion.div 
                key="result"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white p-12 shadow-[20px_20px_0px_#e5e2da] border border-[#e5e2da] flex flex-col min-h-[400px]"
              >
                <div className="mb-12">
                  <div className="flex items-baseline gap-6 mb-4 flex-wrap">
                    <h2 className="text-7xl font-light italic tracking-tight capitalize">{result.word}</h2>
                    <span className="text-xl font-serif italic opacity-40">/{result.word.toLowerCase().split('').join('·')}/</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="px-3 py-1 border border-[#1a1a1a] text-[10px] font-sans font-bold uppercase tracking-widest leading-none flex items-center">{result.category}</span>
                    <span className="px-3 py-1 border border-[#1a1a1a] text-[10px] font-sans font-bold uppercase tracking-widest leading-none flex items-center">KBBI AI</span>
                  </div>
                </div>

                <div className="flex-grow space-y-12">
                  <section>
                    <h4 className="text-[11px] font-sans font-bold uppercase tracking-widest border-b border-gray-100 pb-3 mb-6">Definisi</h4>
                    <p className="text-3xl leading-snug font-serif text-gray-900">
                      {result.definition}
                    </p>
                  </section>

                  <section>
                    <h4 className="text-[11px] font-sans font-bold uppercase tracking-widest border-b border-gray-100 pb-3 mb-6">Contoh Penggunaan</h4>
                    <div className="space-y-8">
                      {result.examples.map((example, idx) => (
                        <p key={idx} className="text-xl italic leading-relaxed text-gray-700 relative pl-10">
                          <span className="absolute left-0 top-0 text-5xl opacity-20 font-serif leading-none">“</span>
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
                      className="px-6 py-2 bg-[#1a1a1a] text-white text-[10px] font-sans font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors"
                    >
                      Cari Lagi
                    </button>
                    <button className="px-6 py-2 border border-[#1a1a1a] text-[10px] font-sans font-bold uppercase tracking-widest hover:bg-gray-50 transition-colors">
                      Bagikan
                    </button>
                  </div>
                  <div className="text-[10px] font-sans italic opacity-40">Sumber: Leksikon v5.4.1</div>
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

      {/* Decorative BG element */}
      <div className="fixed top-0 right-0 p-8 pointer-events-none opacity-[0.03] overflow-hidden select-none">
        <span className="text-[300px] font-sans font-black leading-none">KBBI</span>
      </div>
    </div>
  );
}

