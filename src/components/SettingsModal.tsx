import React, { useState } from 'react';
import { X, Copy, Check, Database, RefreshCw, AlertCircle, ExternalLink } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSync: (url: string) => Promise<void>;
  initialUrl: string;
  isSyncing: boolean;
  syncError: string;
}

const gasScript = `function doGet(e) {
  var sheetName = e.parameter.sheet || "Inventory";
  var spreadsheetId = e.parameter.spreadsheetId;
  
  if (!spreadsheetId) return ContentService.createTextOutput(JSON.stringify({error: "spreadsheetId is required"})).setMimeType(ContentService.MimeType.JSON);
  
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return ContentService.createTextOutput(JSON.stringify({error: "Sheet '" + sheetName + "' not found"})).setMimeType(ContentService.MimeType.JSON);
    
    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
    
    var headers = data[0];
    var result = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var item = {};
      for (var j = 0; j < headers.length; j++) {
        item[headers[j]] = row[j];
      }
      if (item.history && typeof item.history === 'string') {
        try { item.history = JSON.parse(item.history); } catch(err) { item.history = []; }
      }
      result.push(item);
    }
    
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({error: error.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var sheetName = payload.sheet || "Inventory";
    var spreadsheetId = payload.spreadsheetId;
    var action = payload.action || "overwrite"; // 'overwrite' or 'append'
    
    if (!spreadsheetId) return ContentService.createTextOutput(JSON.stringify({error: "spreadsheetId is required"})).setMimeType(ContentService.MimeType.JSON);
    
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      action = "overwrite";
    }
    
    var rows = [];
    var headers = [];
    
    if (action === "overwrite") {
      sheet.clear();
      if (sheetName === "Inventory") {
        headers = ["partNo", "name", "category", "abcCategory", "stock", "j1Total", "j2Total", "history"];
      } else if (sheetName === "MasterData") {
        headers = ["partNo", "category", "abcCategory"];
      }
      if (headers.length > 0) {
        sheet.appendRow(headers);
      }
    }
    
    if (sheetName === "Inventory") {
      rows = payload.data.map(function(item) {
        return [
          item.partNo,
          item.partName,
          item.category || 'OOB',
          item.abcCategory || 'C',
          item.stockQty,
          item.j1Total || 0,
          item.j2Total || 0,
          JSON.stringify(item.monthlyDemand || [])
        ];
      });
    } else if (sheetName === "MasterData") {
      rows = payload.data.map(function(item) {
        return [
          item.partNo,
          item.category,
          item.abcCategory
        ];
      });
    }
    
    if (rows.length > 0) {
      var startRow = sheet.getLastRow() + 1;
      var numCols = rows[0].length;
      sheet.getRange(startRow, 1, rows.length, numCols).setValues(rows);
    }
    
    return ContentService.createTextOutput(JSON.stringify({success: true, message: "Data saved to " + sheetName, rows: rows.length})).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({error: error.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}`;

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSync,
  initialUrl,
  isSyncing,
  syncError
}) => {
  const [url, setUrl] = useState(initialUrl);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(gasScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSync(url.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-800">
            <Database className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold">Setup Database Google Sheets</h2>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* Step 1 */}
          <section>
            <h3 className="text-md font-bold text-slate-800 mb-3 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-sm">1</span>
              Buat Master Google Sheet
            </h3>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-sm text-slate-600">
              <p className="mb-2">Buat file Google Spreadsheet kosong baru. File ini hanya digunakan sebagai tempat untuk menaruh <strong>Google Apps Script (GAS)</strong>.</p>
              <p className="mb-2">Anda tidak perlu membuat sheet atau header secara manual di file ini.</p>
            </div>
          </section>

          {/* Step 2 */}
          <section>
            <h3 className="text-md font-bold text-slate-800 mb-3 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-sm">2</span>
              Pasang Google Apps Script (GAS)
            </h3>
            <div className="text-sm text-slate-600 mb-3">
              Di Google Sheets Anda, klik menu <strong>Extensions &gt; Apps Script</strong>. Hapus semua kode yang ada, lalu paste kode di bawah ini:
            </div>
            <div className="relative group">
              <pre className="bg-slate-900 text-slate-50 p-4 rounded-xl text-xs font-mono overflow-x-auto">
                <code>{gasScript}</code>
              </pre>
              <button 
                onClick={handleCopy}
                className="absolute top-3 right-3 p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg backdrop-blur-sm transition-all flex items-center gap-1.5"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span className="text-xs font-medium">{copied ? 'Copied!' : 'Copy Code'}</span>
              </button>
            </div>
            <div className="mt-3 text-sm text-slate-600 bg-amber-50 border border-amber-100 p-3 rounded-lg">
              <strong>Penting saat Deploy:</strong> Klik tombol <strong>Deploy &gt; New deployment</strong>. Pilih tipe <strong>Web app</strong>. 
              Set <em>Execute as</em> ke <strong>Me</strong>, dan <em>Who has access</em> ke <strong>Anyone</strong>. Copy URL Web App yang dihasilkan.
            </div>
          </section>

          {/* Step 3 */}
          <section>
            <h3 className="text-md font-bold text-slate-800 mb-3 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-sm">3</span>
              Hubungkan Master Web App
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Master Web App URL</label>
                <input 
                  type="url" 
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm font-mono"
                  required
                />
              </div>
              
              {syncError && (
                <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{syncError}</p>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button 
                  type="submit" 
                  disabled={isSyncing || !url.trim()}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg font-medium transition-colors shadow-sm"
                >
                  {isSyncing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4" />
                      Simpan Master URL
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>

          {/* Step 4 */}
          <section>
            <h3 className="text-md font-bold text-slate-800 mb-3 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-sm">4</span>
              Setup Spreadsheet Cabang
            </h3>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-sm text-slate-600">
              <p className="mb-2">Untuk setiap cabang baru:</p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Buat file Google Spreadsheet kosong baru.</li>
                <li>Copy <strong>Spreadsheet ID</strong> dari URL file tersebut (bagian panjang antara <code>/d/</code> dan <code>/edit</code>).</li>
                <li>Buka menu <strong>Pengaturan Admin</strong> (ikon roda gigi) di pojok kanan atas.</li>
                <li>Tambah cabang baru dan paste Spreadsheet ID yang sudah dicopy.</li>
              </ol>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
};
