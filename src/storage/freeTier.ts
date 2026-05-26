import AsyncStorage from "@react-native-async-storage/async-storage";

export const FREE_PROJECT_LIMIT = 1;
export const FREE_PDF_EXPORTS = 3;

const PDF_COUNT_KEY = "app:pdfExports:count";

export async function getPdfExportCount(): Promise<number> {
  const raw = await AsyncStorage.getItem(PDF_COUNT_KEY);
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  return isNaN(n) ? 0 : n;
}

export async function incrementPdfExportCount(): Promise<void> {
  const current = await getPdfExportCount();
  await AsyncStorage.setItem(PDF_COUNT_KEY, String(current + 1));
}

export async function canExportPdf(): Promise<boolean> {
  const count = await getPdfExportCount();
  return count < FREE_PDF_EXPORTS;
}
