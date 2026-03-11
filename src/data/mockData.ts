export type PartData = {
  partNo: string;
  partName: string;
  category: string; // Kolom K (e.g., YGP, POB, OOB)
  abcCategory: string; // Kolom L (e.g., A, B, C)
  stockQty: number;
  j1Total: number;
  j2Total: number;
  // N01 to N12 (12 bulan terakhir untuk grafik tren)
  monthlyDemand: number[];
};

export const mockDatabase: PartData[] = [
  // YGP Data (Dari Gambar)
  {
    partNo: "132-14146-00",
    partName: "PLATE (RXS,RXK,STF)",
    category: "YGP",
    abcCategory: "C",
    stockQty: 0,
    j1Total: 79,
    j2Total: 102,
    monthlyDemand: [0, 0, 0, 0, 0, 0, 19, 60, 0, 20, 0, 50],
  },
  {
    partNo: "132-E6369-00",
    partName: "RING, FRICTION (RX)",
    category: "YGP",
    abcCategory: "A",
    stockQty: 293,
    j1Total: 1200,
    j2Total: 928,
    monthlyDemand: [10, 58, 139, 75, 144, 100, 100, 150, 45, 31, 98, 250],
  },
  {
    partNo: "136-82540-03",
    partName: "NEUTRAL SWITCH A",
    category: "YGP",
    abcCategory: "C",
    stockQty: 0,
    j1Total: 78,
    j2Total: 66,
    monthlyDemand: [0, 0, 0, 0, 18, 12, 25, 5, 0, 0, 0, 0],
  },
  {
    partNo: "137-16356-00",
    partName: "ROD PUSH 1",
    category: "YGP",
    abcCategory: "C",
    stockQty: 35,
    j1Total: 383,
    j2Total: 381,
    monthlyDemand: [3, 22, 41, 47, 45, 19, 20, 24, 40, 35, 31, 20],
  },
  {
    partNo: "14B-W2587-00",
    partName: "MASTER CYLINDER",
    category: "YGP",
    abcCategory: "A",
    stockQty: 120,
    j1Total: 450,
    j2Total: 300,
    monthlyDemand: [40, 35, 50, 45, 30, 40, 55, 60, 35, 20, 25, 15],
  },

  // POB Data (Simulasi)
  {
    partNo: "90793-AJ801",
    partName: "YAMALUBE SPORT MOTOR OIL",
    category: "POB",
    abcCategory: "A",
    stockQty: 1500,
    j1Total: 18000,
    j2Total: 16500,
    monthlyDemand: [1500, 1600, 1450, 1550, 1400, 1650, 1700, 1500, 1450, 1600, 1550, 1450],
  },
  {
    partNo: "90793-AJ802",
    partName: "YAMALUBE MATIC MOTOR OIL",
    category: "POB",
    abcCategory: "A",
    stockQty: 2200,
    j1Total: 24000,
    j2Total: 22000,
    monthlyDemand: [2000, 2100, 1950, 2050, 1900, 2150, 2200, 2000, 1950, 2100, 2050, 1950],
  },
  {
    partNo: "90793-AJ803",
    partName: "YAMALUBE SUPER SPORT",
    category: "POB",
    abcCategory: "B",
    stockQty: 300,
    j1Total: 3600,
    j2Total: 3200,
    monthlyDemand: [300, 320, 290, 310, 280, 330, 340, 300, 290, 320, 310, 290],
  },

  // OOB + OIL Data (Simulasi)
  {
    partNo: "OOB-1001",
    partName: "BAN LUAR IRC 90/90-14",
    category: "OOB",
    abcCategory: "A",
    stockQty: 450,
    j1Total: 5400,
    j2Total: 5000,
    monthlyDemand: [450, 480, 430, 460, 420, 490, 510, 450, 430, 480, 460, 430],
  },
  {
    partNo: "OOB-1002",
    partName: "BAN DALAM IRC 17",
    category: "OOB",
    abcCategory: "B",
    stockQty: 800,
    j1Total: 9600,
    j2Total: 9000,
    monthlyDemand: [800, 850, 760, 820, 750, 880, 920, 800, 760, 850, 820, 760],
  },
  {
    partNo: "OIL-GEAR-01",
    partName: "YAMALUBE GEAR OIL 100ML",
    category: "OIL",
    abcCategory: "A",
    stockQty: 1200,
    j1Total: 14400,
    j2Total: 13000,
    monthlyDemand: [1200, 1250, 1150, 1220, 1100, 1300, 1350, 1200, 1150, 1250, 1220, 1150],
  }
];
