import { PartData } from "../data/mockData";

export type TimeFilter = "J1" | "J2" | "ALL";

export const calculateAvgDemand = (part: PartData, filter: TimeFilter): number => {
  let avg = 0;
  if (filter === "J1") {
    avg = part.j1Total / 12;
  } else if (filter === "J2") {
    avg = part.j2Total / 12;
  } else if (filter === "ALL") {
    avg = (part.j1Total + part.j2Total) / 24;
  }
  
  // Bulatkan ke 2 angka desimal
  return Math.round(avg * 100) / 100;
};

export const calculateMOS = (stock: number, avgDemand: number): number => {
  if (avgDemand === 0) return stock > 0 ? 999 : 0; // 999 sebagai indikator overstock ekstrem jika demand 0
  const mos = stock / avgDemand;
  return Math.round(mos * 100) / 100;
};
