export type Role = 'admin' | 'user';

export interface Branch {
  id: string;
  name: string;
  spreadsheetId: string;
}

export interface User {
  id: string;
  username: string;
  password?: string;
  role: Role;
  branchIds: string[];
}

export interface CurrentUser {
  id: string;
  username: string;
  role: Role;
  branchIds: string[];
}

export type RawDB1 = Record<string, any>;
export type RawDB2 = Record<string, any>;

export interface OutputData {
  partNo: string; // Part No. (-)
  partName: string; // Part Name
  rop: number; // ROP
  roq: number; // ROQ
  category: string; // Category
  abcCategory: string; // ABC Category
  avgCost: number; // AVG Cost
  stockQty: number; // Stock QTY
  j1: number; // J1 Total
  j2: number; // J2 Total
  avgDemand: number; // AVG Demand
  mos: number; // MOS
  mktCateg: string; // Mkt Categ
  largeGroup: string; // large_group
  
  // New additions
  fStock: number;
  amount: number; // Nilai Rupiah dari F Stock * AVG Cost
  frekuensi: number;
  fMos: number;

  // Also keep the raw arrays for charts and logic
  monthlyDemand: number[];
  monthlyDemand24: number[];
  status?: string; // used for filtering "AMAN", "RESTOCK"
}
