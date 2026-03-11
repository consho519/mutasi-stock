import React, { useState, useMemo, useEffect } from 'react';
import { Download, TrendingUp, AlertTriangle, CheckCircle2, Filter, AlertOctagon, Search, ChevronLeft, ChevronRight, Database, RefreshCw, UploadCloud, LogOut, Settings, Building2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';
import { mockDatabase, PartData } from './data/mockData';
import { calculateAvgDemand, calculateMOS, TimeFilter } from './utils/calculations';
import { SettingsModal } from './components/SettingsModal';
import { UploadModal } from './components/UploadModal';
import { Login } from './components/Login';
import { AdminSettings } from './components/AdminSettings';
import { User, Branch, CurrentUser, RawDB1, RawDB2, OutputData } from './types';

type TabType = 'POB' | 'YGP' | 'OOB';
type ABCCategoryFilter = 'ALL' | 'A' | 'B' | 'C';
type StatusFilter = 'ALL' | 'AMAN' | 'RESTOCK' | 'OVERSTOCK' | 'DEAD_STOCK';

// Thresholds based on Yamaha Distributor Standards
const THRESHOLD_RESTOCK = 1.5; // MOS < 1.5 months means restock
const THRESHOLD_OVERSTOCK = 2.0; // MOS > 2.0 months means overstock

// Helper Format Rupiah
const formatRp = (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

// Komponen Mini Chart (Sparkline) untuk setiap baris
const Sparkline = ({ data }: { data: number[] }) => {
  // Grafik dibaca persis searah dengan sel Excel: N01 di kiri, N12 di kanan.
  const chartData = data.map((val, i) => ({ index: i, value: val }));

  // Cari nilai maksimum untuk menggambar titik (dot) pada puncak tertinggi
  const maxValue = Math.max(...data);

  // Rata-rata dari serangkaian data (N1-N12)
  const average = data.reduce((a, b) => a + b, 0) / (data.length || 1);

  // Nilai terbaru (N1 berada di index 0)
  const latestValue = data[0];

  // Logika warna sesuai permintaan: 
  // Hijau jika nilai (terbaru) berada di atas atau sama dengan rata-rata.
  // Merah jika di bawah rata-rata.
  // Biru (default) jika data kosong/nol semua
  const color = (average === 0 && latestValue === 0) ? '#6366f1' : 
                latestValue >= average ? '#10b981' : '#ef4444';

  // Custom Dot untuk menyorot nilai tertinggi (peak)
  const renderCustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (payload.value === maxValue && maxValue > 0) {
      return (
        <circle cx={cx} cy={cy} r={3} fill={color} stroke="none" />
      );
    }
    return null;
  };

  return (
    <div className="h-6 w-20">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={renderCustomDot}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default function App() {
  const [outputData, setOutputData] = useState<OutputData[]>([]);
  const [rawDB1, setRawDB1] = useState<RawDB1[]>([]);
  const [rawDB2, setRawDB2] = useState<RawDB2[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('POB');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('J1');
  const [abcFilter, setAbcFilter] = useState<ABCCategoryFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Auth & Multi-Branch State
  const [users, setUsers] = useState<User[]>(() => {
    const defaultAdmin: User = { id: '1', username: 'admin', password: 'password', role: 'admin', branchIds: [] };
    const saved = localStorage.getItem('users');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Ensure default admin exists and has correct credentials
          const adminIndex = parsed.findIndex(u => u.id === '1');
          if (adminIndex >= 0) {
            parsed[adminIndex] = { ...parsed[adminIndex], username: 'admin', password: 'password', role: 'admin' };
          } else {
            parsed.unshift(defaultAdmin);
          }
          return parsed;
        }
      } catch (e) {
        console.error("Error parsing users from localStorage", e);
      }
    }
    return [defaultAdmin];
  });
  const [branches, setBranches] = useState<Branch[]>(() => {
    const saved = localStorage.getItem('branches');
    if (saved) return JSON.parse(saved);
    return [];
  });
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => {
    const saved = localStorage.getItem('currentUser');
    if (saved) return JSON.parse(saved);
    return null;
  });
  const [currentBranchId, setCurrentBranchId] = useState<string>(() => {
    return localStorage.getItem('currentBranchId') || '';
  });
  const [isAdminSettingsOpen, setIsAdminSettingsOpen] = useState(false);

  // Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [masterGasUrl, setMasterGasUrl] = useState(() => localStorage.getItem('masterGasUrl') || '');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSavingToDB, setIsSavingToDB] = useState(false);
  const [syncError, setSyncError] = useState('');

  // Persist state
  useEffect(() => {
    localStorage.setItem('users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('branches', JSON.stringify(branches));
  }, [branches]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('currentUser');
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('currentBranchId', currentBranchId);
    // When branch changes, fetch data if masterGasUrl is set
    const branch = branches.find(b => b.id === currentBranchId);
    if (branch && branch.spreadsheetId && masterGasUrl) {
      fetchInventoryData(masterGasUrl, branch.spreadsheetId);
    } else {
      setOutputData([]);
      setRawDB1([]);
      setRawDB2([]);
    }
  }, [currentBranchId, branches, masterGasUrl]);

  // Auto-select first branch if none selected
  useEffect(() => {
    if (!currentBranchId && currentUser && branches.length > 0) {
      const availableBranches = currentUser.role === 'admin'
        ? branches
        : branches.filter(b => currentUser.branchIds.includes(b.id));

      if (availableBranches.length > 0) {
        setCurrentBranchId(availableBranches[0].id);
      }
    }
  }, [branches, currentUser, currentBranchId]);

  const handleLogin = (user: User) => {
    const { password, ...userWithoutPassword } = user;
    setCurrentUser(userWithoutPassword);

    // Auto-select first branch if available
    let availableBranches = branches;
    if (user.role !== 'admin') {
      availableBranches = branches.filter(b => user.branchIds.includes(b.id));
    }

    if (availableBranches.length > 0 && !currentBranchId) {
      setCurrentBranchId(availableBranches[0].id);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentBranchId('');
    setOutputData([]);
    setRawDB1([]);
    setRawDB2([]);
  };

  const handleSaveMasterUrl = async (url: string) => {
    setMasterGasUrl(url);
    localStorage.setItem('masterGasUrl', url);
    setIsSettingsOpen(false);

    // Fetch data if a branch is selected and has a spreadsheetId
    const branch = branches.find(b => b.id === currentBranchId);
    if (branch && branch.spreadsheetId) {
      await fetchInventoryData(url, branch.spreadsheetId);
    }
  };

  // Fetch data from GAS
  const fetchInventoryData = async (url: string, spreadsheetId?: string) => {
    setIsSyncing(true);
    setSyncError('');
    try {
      const branch = branches.find(b => b.id === currentBranchId);
      const targetSpreadsheetId = spreadsheetId || (branch ? branch.spreadsheetId : null);

      if (!targetSpreadsheetId) {
        throw new Error('Spreadsheet ID tidak ditemukan untuk cabang ini');
      }

      // We now fetch Output from GAS for quick dashboard loading
      const response = await fetch(`${url}?sheet=Output&spreadsheetId=${targetSpreadsheetId}`);
      if (!response.ok) throw new Error('Gagal mengambil data dari server');
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      if (Array.isArray(data)) {
        // Map data from GAS directly to OutputData
        const mappedData: OutputData[] = data.map((item: any) => {
          return {
            partNo: item.partNo || item['Part No. (-)'] || '',
            partName: item.partName || item['Part Name'] || '',
            rop: parseFloat(item.rop || item.ROP) || 0,
            roq: parseFloat(item.roq || item.ROQ) || 0,
            category: item.category || item.Category || 'OOB',
            abcCategory: item.abcCategory || item['ABC Category'] || 'C',
            avgCost: parseFloat(item.avgCost || item['AVG Cost']) || 0,
            stockQty: parseInt(item.stockQty || item['Stock QTY']) || 0,
            j1: parseInt(item.j1 || item['J1 Total']) || 0,
            j2: parseInt(item.j2 || item['J2 Total']) || 0,
            avgDemand: parseFloat(item.avgDemand || item['AVG Demand']) || 0,
            mos: parseFloat(item.mos || item.MOS) || 0,
            mktCateg: item.mktCateg || item['Mkt Categ'] || item.category || item.Category || '',
            largeGroup: item.largeGroup || item['Large Group'] || '',
            fStock: parseFloat(item['F Stock']) || 0,
            frekuensi: parseFloat(item['Frekuensi']) || 0,
            fMos: parseFloat(item['F MOS']) || 0,
            monthlyDemand: item.history ? (typeof item.history === 'string' ? JSON.parse(item.history) : item.history) : Array(12).fill(0),
            monthlyDemand24: item.history24 ? (typeof item.history24 === 'string' ? JSON.parse(item.history24) : item.history24) : Array(24).fill(0)
          };
        });
        setOutputData(mappedData);
      } else {
        throw new Error('Format data tidak sesuai');
      }
    } catch (err: any) {
      setSyncError(err.message || 'Terjadi kesalahan saat sinkronisasi');
    } finally {
      setIsSyncing(false);
    }
  };

  // Auto-fetch on load if URL exists
  useEffect(() => {
    if (masterGasUrl && currentBranchId) {
      const branch = branches.find(b => b.id === currentBranchId);
      if (branch && branch.spreadsheetId) {
        fetchInventoryData(masterGasUrl, branch.spreadsheetId);
      }
    }
  }, []);

  // Process Merge locally using a Web Worker to prevent UI freezing
  const generateOutputData = async (db1: RawDB1[], db2: RawDB2[], onProgress?: (p: number) => void) => {
    if (db1.length === 0) return;

    return new Promise<void>((resolve, reject) => {
      // Initialize the worker
      const worker = new Worker(new URL('./workers/dataProcessor.ts', import.meta.url), { type: 'module' });

      worker.onmessage = (event) => {
        const { type, payload } = event.data;
        if (type === 'PROGRESS') {
          if (onProgress) onProgress(payload);
        } else if (type === 'COMPLETE') {
          setOutputData(payload);
          worker.terminate();
          resolve();
        } else if (type === 'ERROR') {
          console.error("Worker error:", payload);
          worker.terminate();
          reject(new Error(payload));
        }
      };

      worker.onerror = (error) => {
        console.error("Worker failed:", error);
        worker.terminate();
        reject(error);
      };

      // Send data to worker
      worker.postMessage({ db1, db2 });
    });
  };

  // Handle Upload Complete (from UploadModal)
  const handleUploadComplete = async (db1: any[] | null, db2: any[] | null, onProgress?: (p: number) => void) => {
    let finalDB1 = rawDB1;
    let finalDB2 = rawDB2;

    if (db1) {
      setRawDB1(db1);
      finalDB1 = db1;
    }
    if (db2) {
      setRawDB2(db2);
      finalDB2 = db2;
    }

    await generateOutputData(finalDB1, finalDB2, onProgress);
    // Modal will close automatically now without blocking alert
  };

  // Save to GAS
  const handleSaveToSpreadsheet = async () => {
    if (!masterGasUrl) {
      alert('URL Google Apps Script belum disiapkan. Hubungi admin.');
      return;
    }

    if (outputData.length === 0) {
      alert('Data kosong! Harap upload file DB1 dan DB2 terlebih dahulu.');
      return;
    }

    const branch = branches.find(b => b.id === currentBranchId);
    if (!branch || !branch.spreadsheetId) {
      alert('Spreadsheet ID cabang tidak ditemukan.');
      return;
    }

    setIsSavingToDB(true);
    try {
      // Kita kirim data Output yang difilter khusus saja untuk dashboard sheet, tapi kita kirim semua DB1 dan DB2 apa adanya ke sheet inventory/master.
      const payloadOutput = outputData.map(item => ({
        'Part No. (-)': item.partNo,
        'Part Name': item.partName,
        'ROP': item.rop,
        'ROQ': item.roq,
        'Category': item.category,
        'ABC Category': item.abcCategory,
        'AVG Cost': item.avgCost,
        'Stock QTY': item.stockQty,
        'J1 Total': item.j1,
        'J2 Total': item.j2,
        'AVG Demand': item.avgDemand, // diisi setelah baseData recalc
        'MOS': item.mos, // diisi setelah baseData recalc
        'F Stock': item.fStock,
        'Amount': item.amount || 0,
        'Frekuensi': item.frekuensi,
        'F MOS': item.fMos,
        'Mkt Categ': item.mktCateg,
        'Large Group': item.largeGroup,
        'history': JSON.stringify(item.monthlyDemand),
        'history24': JSON.stringify(item.monthlyDemand24)
      }));

      const payload = {
        action: 'fullSync',
        spreadsheetId: branch.spreadsheetId,
        db1: rawDB1,
        db2: rawDB2,
        output: payloadOutput
      };

      const response = await fetch(masterGasUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (result.error) throw new Error(result.error);

      alert('Semua data berhasil di-Overwrite ke Google Spreadsheet!');
    } catch (err: any) {
      alert('Gagal menyimpan ke Spreadsheet: ' + err.message);
    } finally {
      setIsSavingToDB(false);
    }
  };

  // 1. Kalkulasi Data Dasar (Avg Demand & MOS) untuk semua item
  const baseData = useMemo(() => {
    return outputData.map((part) => {
      // Create a dummy PartData object for the calculation utilities
      const partMockForCalc = { ...part, j1Total: part.j1, j2Total: part.j2 };

      // Calculate Avg Demand directly from J1 / J2 total divided by 12 as requested
      let avgDemand = 0;
      if (timeFilter === 'ALL') {
        avgDemand = (part.j1 + part.j2) / 24;
      } else if (timeFilter === 'J1') {
        avgDemand = part.j1 / 12;
      } else {
        avgDemand = part.j2 / 12;
      }

      const mos = calculateMOS(part.stockQty, avgDemand);
      // Is Dead Stock if avgDemand is exactly 0 and there is still stock left
      const isDeadStock = part.stockQty > 0 && avgDemand === 0;

      // Calculate F MOS (F Stock / AVG Demand)
      const fMos = avgDemand > 0 ? part.fStock / avgDemand : (part.fStock > 0 ? 999 : 0);

      let status: StatusFilter = 'AMAN';
      if (isDeadStock || mos === 999) status = 'DEAD_STOCK';
      else if (mos > THRESHOLD_OVERSTOCK) status = 'OVERSTOCK';
      else if (mos < THRESHOLD_RESTOCK) status = 'RESTOCK';

      return { ...part, avgDemand, mos, fMos, isDeadStock, status };
    });
  }, [outputData, timeFilter]);

  // 2. Filter Data dasar berdasarkan Tab, ABC, dan Pencarian (TIDAK TERMASUK Status)
  const tabFilteredData = useMemo(() => {
    return baseData.filter((part) => {
      // Filter Tab
      let tabMatch = false;
      if (activeTab === 'POB') tabMatch = part.category === 'POB';
      else if (activeTab === 'YGP') tabMatch = part.category === 'YGP';
      else if (activeTab === 'OOB') tabMatch = part.category === 'OOB' || part.category === 'OIL';

      // Filter ABC
      const abcMatch = abcFilter === 'ALL' || part.abcCategory === abcFilter;

      // Filter Pencarian (Part No atau Part Name)
      const searchMatch = searchQuery === '' ||
        part.partNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        part.partName.toLowerCase().includes(searchQuery.toLowerCase());

      return tabMatch && abcMatch && searchMatch;
    });
  }, [baseData, activeTab, abcFilter, searchQuery]);

  // Reset pagination when any filter changes
  useMemo(() => {
    setCurrentPage(1);
  }, [activeTab, abcFilter, statusFilter, searchQuery, timeFilter]);

  // 3. Lakukan PIVOT (jika Tab OOB) atau biarkan normal (jika YGP/POB).
  // Ini harus dilakukan SEBELUM filter status, agar status Pivot akurat.
  const pivotedTabData = useMemo(() => {
    if (activeTab === 'OOB') {
      const grouped = [...tabFilteredData].reduce((acc, part) => {
        const key = part.mktCateg || 'UNNAMED_CATEGORY';
        if (!acc[key]) {
          acc[key] = {
            partNo: `PIVOT_${key}`,
            partName: key, // Gunakan Nama Kategori (Jenis) sebagai Nama Utama
            mktCateg: key,
            stockQty: 0,
            fStock: 0,
            j1Total: 0,
            j2Total: 0,
            avgDemand: 0,
            monthlyDemand: Array(12).fill(0),
            monthlyDemand24: Array(24).fill(0),
            status: 'AMAN' as StatusFilter,
            frekuensi: 0,
            amount: 0,
            mos: 0,
            fMos: 0,
            isDeadStock: false
          };
        }

        // Summing aggregates
        acc[key].stockQty += part.stockQty;
        acc[key].fStock += part.fStock;
        acc[key].amount += (part.amount || 0);
        acc[key].j1Total += part.j1;
        acc[key].j2Total += part.j2;
        acc[key].avgDemand += part.avgDemand;

        // Summing History Arrays
        part.monthlyDemand.forEach((v, i) => acc[key].monthlyDemand[i] += v);
        part.monthlyDemand24.forEach((v, i) => acc[key].monthlyDemand24[i] += v);

        return acc;
      }, {} as Record<string, any>);

      // Convert Record back to Array and recalculate MOS/Deadstock for the Pivot group
      return (Object.values(grouped) as any[]).map(group => {
        const isDeadStock = group.stockQty > 0 && group.avgDemand === 0;
        const mos = calculateMOS(group.stockQty, group.avgDemand);
        const fMos = group.avgDemand > 0 ? group.fStock / group.avgDemand : (group.fStock > 0 ? 999 : 0);

        // Recalculate true frequency for the grouped category
        const frekuensi = group.monthlyDemand.filter((demand: number) => demand >= 1).length;

        let status: StatusFilter = 'AMAN';
        if (isDeadStock || mos === 999) status = 'DEAD_STOCK';
        else if (mos > THRESHOLD_OVERSTOCK) status = 'OVERSTOCK';
        else if (mos < THRESHOLD_RESTOCK) status = 'RESTOCK';

        return { ...group, isDeadStock, mos, fMos, status, frekuensi };
      });
    }

    // Jika Tab Normal (POB / YGP)
    return tabFilteredData;
  }, [tabFilteredData, activeTab]);

  // 4. Hitung Statistik untuk Widget Murni Berdasarkan pivotedTabData (Mengabaikan filter tombol status yang sedang diklik user)
  const stats = useMemo(() => {
    let totalItems = 0; let totalAmount = 0;
    let overstockCount = 0; let overstockAmount = 0;
    let deadstockCount = 0; let deadstockAmount = 0;
    let restockCount = 0; let restockAmount = 0;
    
    pivotedTabData.forEach(item => {
      totalItems++;
      totalAmount += (item.amount || 0);
      if (item.status === 'OVERSTOCK') { overstockCount++; overstockAmount += (item.amount || 0); }
      else if (item.status === 'DEAD_STOCK') { deadstockCount++; deadstockAmount += (item.amount || 0); }
      else if (item.status === 'RESTOCK') { restockCount++; restockAmount += (item.amount || 0); }
    });

    return { totalItems, totalAmount, overstockCount, overstockAmount, deadstockCount, deadstockAmount, restockCount, restockAmount };
  }, [pivotedTabData]);

  // 5. Aplikasikan Filter Status Barulah Sortir (Trending)
  const sortedData = useMemo(() => {
    const statusFiltered = pivotedTabData.filter((item) => {
      return statusFilter === 'ALL' || item.status === statusFilter;
    });

    return statusFiltered.sort((a, b) => {
      const getTrendSum = (part: any) => {
        if (timeFilter === 'ALL') return part.monthlyDemand24.reduce((sum: number, val: number) => sum + val, 0);
        if (timeFilter === 'J2') return part.monthlyDemand24.slice(12, 24).reduce((sum: number, val: number) => sum + val, 0);
        return part.monthlyDemand.reduce((sum: number, val: number) => sum + val, 0); // j1
      };

      return getTrendSum(b) - getTrendSum(a); // Descending
    });
  }, [pivotedTabData, statusFilter, timeFilter]);

  // 6. Pagination Logic
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedData, currentPage, itemsPerPage]);

  // Data untuk grafik tren (menggunakan item pertama dari data yang difilter sebagai contoh)
  const trendData = useMemo(() => {
    if (sortedData.length === 0) return [];
    // Pada Pivot maupun Normal, data pertama di sortedData sudah pasti yang tertingginya
    return sortedData[0].monthlyDemand.map((demand: number, index: number) => ({
      month: `N${(index + 1).toString().padStart(2, '0')}`,
      demand: demand,
    }));
  }, [sortedData]);

  // Fungsi Export ke Excel
  const handleExportExcel = () => {
    const exportData = sortedData.map((item) => ({
      'Part No.': item.partNo,
      'Parts Name': item.partName,
      'Category': item.category,
      'ABC Categ': item.abcCategory,
      'Stock Qty': item.stockQty,
      'F Stock': item.fStock,
      'Amount (Rp)': item.amount || 0,
      'Avg Demand': item.avgDemand,
      'Frekuensi': item.frekuensi,
      'MOS': item.mos,
      'F MOS': item.fMos,
      'Status': item.status
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `${activeTab}_Report`);
    XLSX.writeFile(workbook, `Laporan_Distributor_${activeTab}_${timeFilter}.xlsx`);
  };

  if (!currentUser) {
    return <Login onLogin={handleLogin} users={users} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-4">

        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Dashboard Inventori Distributor</h1>
            <p className="text-xs text-slate-500 mt-1">Pantau pergerakan stok, tren demand, dan cegah dead stock.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Branch Selector */}
            {branches.length > 0 && (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                <Building2 className="w-4 h-4 text-slate-500" />
                <select
                  value={currentBranchId}
                  onChange={(e) => setCurrentBranchId(e.target.value)}
                  className="bg-transparent border-none text-sm font-medium text-slate-700 focus:ring-0 cursor-pointer outline-none"
                >
                  <option value="" disabled>Pilih Cabang</option>
                  {branches
                    .filter(b => currentUser.role === 'admin' || currentUser.branchIds.includes(b.id))
                    .map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                </select>
              </div>
            )}

            {/* User Menu */}
            <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-slate-800">{currentUser.username}</p>
                <p className="text-xs text-slate-500 capitalize">{currentUser.role}</p>
              </div>

              {currentUser.role === 'admin' && (
                <button
                  onClick={() => setIsAdminSettingsOpen(true)}
                  className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Pengaturan Admin"
                >
                  <Settings className="w-5 h-5" />
                </button>
              )}

              <button
                onClick={handleLogout}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Keluar"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (!currentBranchId) {
                  alert('Silakan tambah dan pilih cabang terlebih dahulu di Pengaturan Admin.');
                  return;
                }
                setIsUploadOpen(true);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all shadow-sm text-xs font-medium ${!currentBranchId
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              title={!currentBranchId ? "Pilih cabang terlebih dahulu" : "Upload Data Lokal"}
            >
              <UploadCloud className="w-4 h-4" />
              <span>{!currentBranchId ? 'Pilih Cabang Dulu' : 'Upload Data'}</span>
            </button>

            {masterGasUrl && currentBranchId && (
              <button
                onClick={() => {
                  if (outputData.length === 0) {
                    const confirmEmpty = window.confirm('Data dashboard Anda kosong. Apakah Anda tetap ingin me-reset (menghapus) semua data di Spreadsheet online?');
                    if (!confirmEmpty) return;
                  }
                  handleSaveToSpreadsheet();
                }}
                disabled={isSavingToDB}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all shadow-sm text-xs font-medium ${isSavingToDB
                  ? 'bg-amber-100 text-amber-700 cursor-not-allowed border border-amber-200'
                  : 'bg-amber-500 text-white hover:bg-amber-600'
                  }`}
                title="Overwrite semua data ke Google Spreadsheet"
              >
                {isSavingToDB ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                <span>{isSavingToDB ? 'Menyimpan ke GAS...' : 'Simpan ke Spreadsheet'}</span>
              </button>
            )}

            {currentUser.role === 'admin' && (
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm text-xs font-medium"
              >
                <Database className="w-4 h-4 text-indigo-500" />
                <span>Script Setup</span>
              </button>
            )}

            {masterGasUrl && currentBranchId && (
              <button
                onClick={() => fetchInventoryData(masterGasUrl)}
                disabled={isSyncing}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-all shadow-sm text-xs font-medium disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Sync</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Filter Waktu */}
            <div className="flex items-center bg-slate-100 rounded-lg p-1">
              {(['J1', 'J2', 'ALL'] as TimeFilter[]).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setTimeFilter(filter)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${timeFilter === filter
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  {filter === 'ALL' ? 'Semua (J1+J2)' : filter}
                </button>
              ))}
            </div>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Export Excel
            </button>
          </div>
        </div>

        {/* Smart Analysis Section */}
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-semibold text-slate-800">Ringkasan Gudang ({activeTab})</h2>
            </div>
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
              Total: {stats.totalItems.toLocaleString()} Item | {formatRp(stats.totalAmount)}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {/* Stat: Restock */}
            <div
              onClick={() => setStatusFilter(statusFilter === 'RESTOCK' ? 'ALL' : 'RESTOCK')}
              className={`p-3 rounded-lg border flex flex-col justify-between cursor-pointer transition-all ${statusFilter === 'RESTOCK' ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-200' : 'bg-slate-50 border-slate-100 hover:border-amber-200'}`}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-slate-700">Butuh Restock</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">MOS &lt; {THRESHOLD_RESTOCK} bulan</p>
                </div>
              </div>
              <div>
                <p className="text-xl font-bold text-amber-600 mt-2">{stats.restockCount.toLocaleString()}</p>
                <p className="text-[10px] font-semibold text-amber-700/70 mt-1">{formatRp(stats.restockAmount)}</p>
              </div>
            </div>

            {/* Stat: Overstock */}
            <div
              onClick={() => setStatusFilter(statusFilter === 'OVERSTOCK' ? 'ALL' : 'OVERSTOCK')}
              className={`p-3 rounded-lg border flex flex-col justify-between cursor-pointer transition-all ${statusFilter === 'OVERSTOCK' ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-200' : 'bg-slate-50 border-slate-100 hover:border-indigo-200'}`}
            >
              <div className="flex items-start gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5 transform rotate-180" />
                <div>
                  <p className="text-xs font-medium text-slate-700">Overstock</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">MOS &gt; {THRESHOLD_OVERSTOCK} bulan</p>
                </div>
              </div>
              <div>
                <p className="text-xl font-bold text-indigo-600 mt-2">{stats.overstockCount.toLocaleString()}</p>
                <p className="text-[10px] font-semibold text-indigo-700/70 mt-1">{formatRp(stats.overstockAmount)}</p>
              </div>
            </div>

            {/* Stat: Dead Stock */}
            <div
              onClick={() => setStatusFilter(statusFilter === 'DEAD_STOCK' ? 'ALL' : 'DEAD_STOCK')}
              className={`p-3 rounded-lg border flex flex-col justify-between cursor-pointer transition-all ${statusFilter === 'DEAD_STOCK' ? 'bg-red-50 border-red-300 ring-1 ring-red-200' : 'bg-slate-50 border-slate-100 hover:border-red-200'}`}
            >
              <div className="flex items-start gap-2">
                <AlertOctagon className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-slate-700">Dead Stock</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Demand 0 (J1)</p>
                </div>
              </div>
              <div>
                <p className="text-xl font-bold text-red-600 mt-2">{stats.deadstockCount.toLocaleString()}</p>
                <p className="text-[10px] font-semibold text-red-700/70 mt-1">{formatRp(stats.deadstockAmount)}</p>
              </div>
            </div>

            {/* Trend Chart */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <p className="text-[10px] font-mono text-slate-500 mb-1">TREN ITEM TERLARIS</p>
              <div className="h-10 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <Line type="monotone" dataKey="demand" stroke="#4f46e5" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs & Advanced Filters */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-3 border-b border-slate-200 pb-2">
          <div className="flex space-x-1">
            {(['POB', 'YGP', 'OOB'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setStatusFilter('ALL'); // Reset status filter when changing tabs
                }}
                className={`px-5 py-2.5 text-xs font-medium border-b-2 transition-colors ${activeTab === tab
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
              >
                {tab === 'YGP' ? 'YGP + AKSESORIS' : tab === 'OOB' ? 'OOB + OIL' : tab}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 pb-1">
            {/* Search Bar */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                <Search className="h-3.5 w-3.5 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Cari Part No / Nama..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 w-full md:w-56"
              />
            </div>

            {/* Filter Status Dropdown */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-md px-2 py-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="bg-transparent text-xs font-medium text-slate-700 outline-none cursor-pointer"
              >
                <option value="ALL">Semua Status</option>
                <option value="RESTOCK">Butuh Restock</option>
                <option value="OVERSTOCK">Overstock</option>
                <option value="DEAD_STOCK">Dead Stock</option>
                <option value="AMAN">Stok Aman</option>
              </select>
            </div>

            {/* Filter ABC Category */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-md px-2 py-1.5">
              <select
                value={abcFilter}
                onChange={(e) => setAbcFilter(e.target.value as ABCCategoryFilter)}
                className="bg-transparent text-xs font-medium text-slate-700 outline-none cursor-pointer"
              >
                <option value="ALL">Semua Kelas</option>
                <option value="A">Kelas A (Fast)</option>
                <option value="B">Kelas B (Med)</option>
                <option value="C">Kelas C (Slow)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3">
                    {activeTab === 'POB' && 'PART (Part No)'}
                    {activeTab === 'YGP' && 'CAT (ABC Category)'}
                    {activeTab === 'OOB' && 'JENIS'}
                  </th>
                  {activeTab === 'YGP' && <th className="px-4 py-3">PART NO</th>}
                  <th className="px-4 py-3 text-center">
                    TREN ({timeFilter === 'ALL' ? '24' : '12'} BLN)
                  </th>
                  <th className="px-4 py-3 text-right">STOCK</th>
                  <th className="px-4 py-3 text-right">F STOCK</th>
                  <th className="px-4 py-3 text-right">AMOUNT (Rp)</th>
                  <th className="px-4 py-3 text-right">AVG DEMAND</th>
                  <th className="px-4 py-3 text-right">FREKUENSI</th>
                  <th className="px-4 py-3 text-right">MOS</th>
                  <th className="px-4 py-3 text-right">F MOS</th>
                  <th className="px-4 py-3 text-center">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedData.map((row, idx) => (
                  <tr key={idx} className={`transition-colors ${row.status === 'DEAD_STOCK' ? 'bg-red-50/30 hover:bg-red-50/50' : 'hover:bg-slate-50/80'}`}>
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      <div className="flex flex-col">
                        {activeTab === 'POB' && <span>{row.partNo}</span>}
                        {activeTab === 'YGP' && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold w-fit ${row.abcCategory === 'A' ? 'bg-emerald-100 text-emerald-800' :
                            row.abcCategory === 'B' ? 'bg-blue-100 text-blue-800' :
                              'bg-slate-100 text-slate-800'
                            }`}>
                            Kelas {row.abcCategory}
                          </span>
                        )}
                        {activeTab === 'OOB' && <span className="truncate max-w-[200px]">{row.partName}</span>}

                        {activeTab !== 'OOB' && (
                          <span className="text-[10px] text-slate-500 mt-0.5 font-normal truncate max-w-[200px]">
                            {row.partName}
                          </span>
                        )}
                      </div>
                    </td>
                    {activeTab === 'YGP' && (
                      <td className="px-4 py-2.5 text-slate-600 font-mono text-[11px]">{row.partNo}</td>
                    )}
                    <td className="px-4 py-2.5">
                      <div className="flex justify-center">
                        <Sparkline data={
                          timeFilter === 'ALL' ? row.monthlyDemand24 :
                            timeFilter === 'J2' ? row.monthlyDemand24.slice(12, 24) :
                              row.monthlyDemand
                        } />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-900 font-semibold">{row.stockQty.toLocaleString('id-ID')}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-700">{row.fStock.toLocaleString('id-ID')}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-indigo-600 font-medium">{formatRp(row.amount || 0)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-600">{row.avgDemand.toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-700">{row.frekuensi}</td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      <span className={
                        row.status === 'DEAD_STOCK' ? 'text-red-600 font-bold' :
                          row.status === 'OVERSTOCK' ? 'text-indigo-600 font-semibold' :
                            row.status === 'RESTOCK' ? 'text-amber-600 font-semibold' :
                              'text-emerald-600 font-semibold'
                      }>
                        {row.status === 'DEAD_STOCK' ? '∞' : row.mos.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      <span className={
                        row.fMos === 999 ? 'text-red-600 font-bold' :
                          row.fMos > THRESHOLD_OVERSTOCK ? 'text-indigo-600 font-semibold' :
                            row.fMos < THRESHOLD_RESTOCK ? 'text-amber-600 font-semibold' :
                              'text-emerald-600 font-semibold'
                      }>
                        {row.fMos === 999 ? '∞' : row.fMos.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {row.status === 'DEAD_STOCK' ? (
                        <span className="text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded border border-red-200">DEAD STOCK</span>
                      ) : row.status === 'OVERSTOCK' ? (
                        <span className="text-[10px] font-medium text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">Overstock</span>
                      ) : row.status === 'RESTOCK' ? (
                        <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">Restock</span>
                      ) : (
                        <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">Aman</span>
                      )}
                    </td>
                  </tr>
                ))}
                {paginatedData.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center">
                        <Search className="w-6 h-6 text-slate-300 mb-2" />
                        <p>Tidak ada data yang cocok dengan filter atau pencarian Anda.</p>
                        <button
                          onClick={() => {
                            setSearchQuery('');
                            setStatusFilter('ALL');
                            setAbcFilter('ALL');
                          }}
                          className="mt-2 text-indigo-600 hover:text-indigo-700 text-xs font-medium"
                        >
                          Reset Filter
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {tabFilteredData.length > 0 && (
            <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Tampilkan</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-200 rounded text-xs py-1 px-2 outline-none"
                >
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={500}>500</option>
                </select>
                <span className="text-xs text-slate-500">baris per halaman</span>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-xs text-slate-600">
                  Menampilkan <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> - <span className="font-medium">{Math.min(currentPage * itemsPerPage, sortedData.length)}</span> dari <span className="font-medium">{sortedData.length}</span> data
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-1 rounded hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4 text-slate-600" />
                  </button>
                  <span className="text-xs font-medium text-slate-700 px-2">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="p-1 rounded hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSync={handleSaveMasterUrl}
        initialUrl={masterGasUrl}
        isSyncing={isSyncing}
        syncError={syncError}
      />

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onComplete={handleUploadComplete}
      />

      {/* Admin Settings Modal */}
      <AdminSettings
        isOpen={isAdminSettingsOpen}
        onClose={() => setIsAdminSettingsOpen(false)}
        users={users}
        branches={branches}
        onSaveUsers={setUsers}
        onSaveBranches={setBranches}
      />
    </div>
  );
}
