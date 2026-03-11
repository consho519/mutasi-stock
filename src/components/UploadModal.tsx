import React, { useState, useRef } from 'react';
import { X, UploadCloud, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, Database, Layers } from 'lucide-react';
import * as XLSX from 'xlsx';
import { PartData } from '../data/mockData';

export interface MasterData {
  partNo: string;
  category: string;
  abcCategory: string;
}

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (db1: any[] | null, db2: any[] | null, onProgress?: (p: number) => void) => Promise<void>;
}

type UploadType = 'inventory' | 'master';

export function UploadModal({ isOpen, onClose, onComplete }: UploadModalProps) {
  const [activeTab, setActiveTab] = useState<UploadType>('inventory');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Local state for holding data before confirmation
  const [tempDB1, setTempDB1] = useState<any[] | null>(null);
  const [tempDB2, setTempDB2] = useState<any[] | null>(null);
  const [progress, setProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const processExcel = (file: File) => {
    setIsLoading(true);
    setError('');
    setProgress(0);
    
    // Simulate generic loading progress for UI
    const progressInterval = setInterval(() => {
      setProgress(p => Math.min(p + 15, 90));
    }, 100);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const ab = evt.target?.result;
        const wb = XLSX.read(ab, { type: 'array' });
        // Loop ke semua sheet, dan ambil sheet yang barisnya paling banyak 
        // (menghindari error karena Sheet 1 cuma info filter, sedangkan Sheet 2 baru isinya data)
        let targetSheetName = wb.SheetNames[0];
        let maxSheetRows = 0;
        let bestRawRows: any[][] = [];

        for (const sheetName of wb.SheetNames) {
          const wsRaw = wb.Sheets[sheetName];
          const raw = XLSX.utils.sheet_to_json(wsRaw, { header: 1 }) as any[][];
          if (raw.length > maxSheetRows) {
            maxSheetRows = raw.length;
            targetSheetName = sheetName;
            bestRawRows = raw;
          }
        }

        if (maxSheetRows === 0) {
          throw new Error('Semua Sheet dalam file Excel ini kosong.');
        }

        const ws = wb.Sheets[targetSheetName];

        // Fallback robust heuristic: Cari baris yang punya paling banyak kolom
        let headerRowIndex = 0;
        let maxCols = 0;
        
        for (let i = 0; i < Math.min(bestRawRows.length, 30); i++) {
          const row = bestRawRows[i] || [];
          const validCols = row.filter(cell => cell !== null && cell !== undefined && String(cell).trim() !== '').length;
          
          if (validCols > maxCols) {
            maxCols = validCols;
            headerRowIndex = i;
          }
        }

        const data = XLSX.utils.sheet_to_json(ws, { range: headerRowIndex });
        
        if (data.length === 0) {
          throw new Error('Data gagal dibaca. Coba ubah baris paling atas menjadi header tabel (Part No, Stok, dst).');
        }

        clearInterval(progressInterval);
        setProgress(100);

        // Store temporarily instead of saving immediately
        if (activeTab === 'inventory') {
          setTempDB1(data);
          // Auto-switch to Master if it's empty
          if (!tempDB2) setActiveTab('master');
        } else {
          setTempDB2(data);
        }
        
      } catch (err: any) {
        clearInterval(progressInterval);
        setError(err.message || 'Gagal memproses file Excel. Pastikan formatnya benar.');
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = () => {
      clearInterval(progressInterval);
      setError('Gagal membaca file.');
      setIsLoading(false);
      setProgress(0);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
        processExcel(file);
      } else {
        setError('Mohon upload file Excel (.xlsx, .xls) atau CSV.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processExcel(e.target.files[0]);
    }
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setProgress(0);
    try {
      await onComplete(tempDB1, tempDB2, setProgress);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal generate output');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Upload Data Lokal</h2>
              <p className="text-xs text-slate-500">Siapkan DB1 dan DB2 sebelum masuk ke Dashboard</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Upload Status Summary */}
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex gap-4">
          <div className={`flex-1 flex items-center gap-3 p-3 rounded-xl border ${tempDB1 ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
            <div className={`p-2 rounded-full ${tempDB1 ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
              <Database className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-700">DB1 (Stok)</p>
              <p className="text-[10px] text-slate-500">
                {tempDB1 ? <span className="text-emerald-600 font-medium flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Siap ({tempDB1.length} baris)</span> : 'Belum diupload'}
              </p>
            </div>
          </div>
          <div className={`flex-1 flex items-center gap-3 p-3 rounded-xl border ${tempDB2 ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
            <div className={`p-2 rounded-full ${tempDB2 ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-700">DB2 (Master)</p>
              <p className="text-[10px] text-slate-500">
                {tempDB2 ? <span className="text-emerald-600 font-medium flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Siap ({tempDB2.length} baris)</span> : 'Secara Opsional'}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          <button
            onClick={() => { setActiveTab('inventory'); setError(''); }}
            className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'inventory' 
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white' 
                : 'text-slate-500 hover:text-slate-700 bg-slate-50'
            }`}
          >
            Upload DB1
            {tempDB1 && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          </button>
          <button
            onClick={() => { setActiveTab('master'); setError(''); }}
            className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'master' 
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white' 
                : 'text-slate-500 hover:text-slate-700 bg-slate-50'
            }`}
          >
            Upload DB2
            {tempDB2 && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg flex items-start gap-2 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div 
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors flex flex-col items-center justify-center min-h-[200px] ${
              isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-3" />
                <p className="text-sm font-medium text-slate-700">Memproses Data...</p>
                {progress > 0 && progress <= 100 && (
                  <div className="w-full max-w-xs mt-4">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Proses</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2.5">
                      <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              // Show state if already uploaded for active tab
              (activeTab === 'inventory' && tempDB1) || (activeTab === 'master' && tempDB2) ? (
                <>
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mb-1">
                    File {activeTab === 'inventory' ? 'DB1' : 'DB2'} Berhasil Dibaca!
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    {activeTab === 'inventory' ? `${tempDB1?.length} baris data stok ditemukan.` : `${tempDB2?.length} baris data master ditemukan.`}
                  </p>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="text-indigo-600 text-sm font-medium hover:underline focus:outline-none"
                  >
                    Ganti File Lain
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept=".xlsx, .xls, .csv" 
                    className="hidden" 
                  />
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-12 h-12 text-slate-400 mb-4" />
                  <h3 className="text-sm font-bold text-slate-900 mb-1">
                    Tarik & Lepas File {activeTab === 'inventory' ? 'Stok (DB1)' : 'Master (DB2)'}
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">Format: .xlsx, .xls, atau .csv</p>
                  
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept=".xlsx, .xls, .csv" 
                    className="hidden" 
                  />
                  
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                  >
                    Jelajahi File
                  </button>
                </>
              )
            )}
          </div>
        </div>

        {/* Generate / Action Footer */}
        <div className="p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <p className="text-[11px] text-slate-500 max-w-[200px]">
            Data akan diproses secara lokal dan <span className="font-semibold text-slate-700">belum</span> tersimpan ke Spreadsheet.
          </p>
          <button
            onClick={handleGenerate}
            disabled={!tempDB1 || isLoading}
            className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-all shadow-sm ${
              tempDB1 && !isLoading
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 transform hover:-translate-y-0.5' 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isLoading ? 'Memproses...' : 'Generate Output'}
          </button>
        </div>
      </div>
    </div>
  );
}
