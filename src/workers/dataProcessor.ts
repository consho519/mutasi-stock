import { OutputData, RawDB1, RawDB2 } from '../types';

self.onmessage = (e: MessageEvent) => {
    const { db1, db2 } = e.data;

    if (!db1 || db1.length === 0) {
        self.postMessage({ type: 'COMPLETE', payload: [] });
        return;
    }

    const mappedOutput: OutputData[] = [];
    const CHUNK_SIZE = 500;

    // Helper fungsi baru yang MEMPRIORITASKAN URUTAN dari possibleKeys.
    // Bukan sekadar siapa yang lebih dulu muncul di Excel.
    const getValPrio = (obj: any, possibleKeys: string[]) => {
        if (!obj) return undefined;
        const objKeys = Object.keys(obj);

        // Tahap 1: Cocokkan Persis (Exact Match) sesuai prioritas The possibleKeys
        for (const pk of possibleKeys) {
            const found = objKeys.find(k => k.toLowerCase() === pk.toLowerCase());
            if (found && obj[found] !== undefined && obj[found] !== '') return obj[found];
        }

        // Tahap 2: Cocokkan Mengandung Kata (Includes Match) sesuai prioritas The possibleKeys
        for (const pk of possibleKeys) {
            const found = objKeys.find(k => k.toLowerCase().includes(pk.toLowerCase()));
            if (found && obj[found] !== undefined && obj[found] !== '') return obj[found];
        }

        return undefined;
    };

    // PRE-COMPUTE DB2 INDEX (Hash Map) untuk VLOOKUP Super Cepat O(1)
    const db2Map = new Map<string, any>();

    if (db2 && db2.length > 0) {
        db2.forEach((m: any) => {
            const keys = Object.keys(m);
            // Tangkap semua kolom yang berpotensi menyimpan Part Number (baik Part_No, Printed_Part_No, dll)
            const partKeys = keys.filter(k => {
                const lowerK = k.toLowerCase();
                return (lowerK.includes('part') && (lowerK.includes('no') || lowerK.includes('num'))) || lowerK.includes('printed');
            });

            partKeys.forEach(pk => {
                const val = String(m[pk] || '').trim();
                if (val) {
                    // Simpan versi dengan Strip (-)
                    const withDash = val.replace(/[^a-zA-Z0-9\-]/g, '').toUpperCase();
                    if (withDash && !db2Map.has(withDash)) db2Map.set(withDash, m);

                    // Simpan versi Tanpa Strip sama sekali 
                    const noDash = val.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                    if (noDash && !db2Map.has(noDash)) db2Map.set(noDash, m);
                }
            });

            // Fallback ekstrim jika kebetulan tidak ada header part sama sekali
            if (partKeys.length === 0) {
                const values = Object.values(m);
                const potentialPartNo = values.find(val =>
                    typeof val === 'string' && val.includes('-') && val.length > 5 && /[a-zA-Z0-9]/.test(val)
                );
                if (potentialPartNo) {
                    const val = String(potentialPartNo);
                    const withDash = val.replace(/[^a-zA-Z0-9\-]/g, '').toUpperCase();
                    const noDash = val.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                    if (withDash && !db2Map.has(withDash)) db2Map.set(withDash, m);
                    if (noDash && !db2Map.has(noDash)) db2Map.set(noDash, m);
                }
            }
        });
    }

    const processChunks = async () => {
        try {
            for (let i = 0; i < db1.length; i += CHUNK_SIZE) {
                const chunk = db1.slice(i, i + CHUNK_SIZE);

                const processedChunk = chunk.map((row: any) => {
                    const keys = Object.keys(row);

                    // Di DB1, kita Wajib mencari yang ada unsur Strip "-" nya duluan.
                    const partNo = getValPrio(row, ['parts no.(-)', 'printed', 'parts no.', 'part_n', 'part no', 'part number', 'kode', 'item']) || 'UNKNOWN';
                    // Di DB1, Part Name normal.
                    const partName = getValPrio(row, ['parts name', 'part_name', 'part name', 'nama', 'description', 'desc']) || 'Unknown Part';

                    const stockQty = parseInt(getValPrio(row, ['stock q', 'stock', 'stok', 'qty', 'sisa'])) || 0;
                    const rop = parseFloat(getValPrio(row, ['rop'])) || 0;
                    const roq = parseFloat(getValPrio(row, ['roq'])) || 0;
                    const avgCost = parseFloat(getValPrio(row, ['avg cost', 'average cost', 'cost', 'harga'])) || 0;

                    let monthlyDemand: number[] = [];
                    let monthlyDemand24: number[] = [];

                    const nCols12 = ['n12', 'n11', 'n10', 'n09', 'n08', 'n07', 'n06', 'n05', 'n04', 'n03', 'n02', 'n01'];
                    const nCols24 = ['n24', 'n23', 'n22', 'n21', 'n20', 'n19', 'n18', 'n17', 'n16', 'n15', 'n14', 'n13', ...nCols12];

                    const hasNCols = nCols12.every(ncol => keys.some(k => k.toLowerCase() === ncol));
                    const hasNCols24 = nCols24.every(ncol => keys.some(k => k.toLowerCase() === ncol));

                    if (hasNCols) {
                        monthlyDemand = nCols12.map(ncol => {
                            const key = keys.find(k => k.toLowerCase() === ncol);
                            return key ? (parseInt(row[key]) || 0) : 0;
                        });
                    } else {
                        const demandKeys = keys.filter(k =>
                            k.toLowerCase().includes('demand') ||
                            k.toLowerCase().includes('bulan') ||
                            ['jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agu', 'sep', 'okt', 'nov', 'des'].some(m => k.toLowerCase().includes(m))
                        );
                        monthlyDemand = demandKeys.map(k => parseInt(row[k]) || 0).slice(0, 12);
                    }

                    if (hasNCols24) {
                        monthlyDemand24 = nCols24.map(ncol => {
                            const key = keys.find(k => k.toLowerCase() === ncol);
                            return key ? (parseInt(row[key]) || 0) : 0;
                        });
                    } else {
                        monthlyDemand24 = [...Array(12).fill(0), ...monthlyDemand];
                    }

                    if (monthlyDemand.length < 12) {
                        const padding = Array(12 - monthlyDemand.length).fill(0);
                        monthlyDemand = [...padding, ...monthlyDemand];
                    }
                    if (monthlyDemand24.length < 24) {
                        const padding = Array(24 - monthlyDemand24.length).fill(0);
                        monthlyDemand24 = [...padding, ...monthlyDemand24];
                    }

                    const explicitJ1 = getValPrio(row, ['j1 tot', 'j1 total', 'j1']);
                    const j1Total = explicitJ1 !== undefined ? parseInt(explicitJ1) || 0 : monthlyDemand.reduce((a, b) => a + b, 0);

                    const explicitJ2 = getValPrio(row, ['j2 tot', 'j2 total', 'j2']);
                    const j2Total = explicitJ2 !== undefined ? parseInt(explicitJ2) || 0 : monthlyDemand24.slice(0, 12).reduce((a, b) => a + b, 0);

                    // VLOOKUP Cepat O(1) Menggunakan db2Map yang sudah dicompile
                    // Kita cari dengan 2 cara: Memakai Strip (-) dan Tanpa Strip
                    const cleanPartNoWithDash = String(partNo).replace(/[^a-zA-Z0-9\-]/g, '').toUpperCase();
                    const cleanPartNoNoDash = String(partNo).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

                    const mItem = db2Map.get(cleanPartNoWithDash) || db2Map.get(cleanPartNoNoDash);

                    // 1. CARI "MKT CATEGORY NAME" (DB2 KOLOM F) yang mendefinisikan JENIS.
                    // Prioritaskan mencari KEYWORD YANG TEPAT agar tidak meleset ke Kolom C (Part_Name).
                    let mktCateg = getValPrio(mItem, ['mkt category name', 'mkt_category_name', 'mkt categ', 'market category']);
                    if (!mktCateg) {
                        // Coba lagi dengan sekadar 'kategori' atau fallback ke DB1 jika kosong
                        mktCateg = getValPrio(mItem, ['kategori', 'category', 'jenis']) || getValPrio(row, ['kategori', 'category', 'jenis']) || '';
                    }

                    // 2. NORMALISASI TAB "CATEGORY" DARI DB1!
                    // Sesuai instruksi User: DB2 Tuh cuma buat nambahin nama pencarian OOB/OIL aja. Semua kategori dasar dari DB1.
                    let rawCat = getValPrio(row, ['large_g', 'categor', 'kategori', 'group', 'jenis']) || 'OOB';
                    let category = String(rawCat).toUpperCase().trim();

                    if (category === 'YLB' || category === 'YAMALUBE') {
                        category = 'OIL'; // Yamalube masuk ke Tab OOB+OIL
                    } else if (category === 'ACC' || category === 'AKSESORIS' || category.includes('ACCESSORIES') || category.includes('ACC')) {
                        category = 'YGP'; // ACC/Aksesoris masuk ke Tab YGP+AKSESORIS
                    } else if (category !== 'POB' && category !== 'YGP' && category !== 'OIL') {
                        category = 'OOB'; // Kategori merk luar lainnya masuk OOB
                    }

                    if (mktCateg === '') mktCateg = category; // Fallback text di UI.

                    // Semua atribut lain murni ditarik dari DB1
                    const abcCategory = getValPrio(row, ['abc']) || 'C';
                    const largeGroup = getValPrio(row, ['group', 'large grou']) || '';
                    const rawAvgDemand = parseFloat(getValPrio(row, ['avg demand', 'average demand'])) || 0;
                    const frekuensi = monthlyDemand.filter(demand => demand >= 1).length;

                    const onPurchaseQty = parseFloat(getValPrio(row, ['on purchase', 'on_purchase'])) || 0;
                    const receiveQty = parseFloat(getValPrio(row, ['receive qt', 'receive', 'received'])) || 0;
                    const boQty = parseFloat(getValPrio(row, ['bo qt', 'backorder', 'bo_'])) || 0;

                    const fStock = stockQty + onPurchaseQty + receiveQty - boQty;

                    return {
                        partNo: String(partNo),
                        partName: String(partName),
                        rop,
                        roq,
                        category: String(category),
                        abcCategory: String(abcCategory),
                        avgCost,
                        stockQty,
                        j1: j1Total,
                        j2: j2Total,
                        avgDemand: rawAvgDemand,
                        mos: 0,
                        mktCateg: String(mktCateg),
                        largeGroup: String(largeGroup),
                        fStock,
                        frekuensi,
                        fMos: 0,
                        monthlyDemand,
                        monthlyDemand24
                    };
                });

                mappedOutput.push(...processedChunk);

                const progress = Math.min(100, Math.round(((i + CHUNK_SIZE) / db1.length) * 100));
                self.postMessage({ type: 'PROGRESS', payload: progress });

                await new Promise(resolve => setTimeout(resolve, 0));
            }

            self.postMessage({ type: 'PROGRESS', payload: 100 });
            self.postMessage({ type: 'COMPLETE', payload: mappedOutput });
        } catch (error: any) {
            self.postMessage({ type: 'ERROR', payload: error.message || 'Error processing data' });
        }
    };

    processChunks();
};
