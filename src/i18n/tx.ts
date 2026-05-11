// src/i18n/tx.ts
import { useTranslation } from "react-i18next";

export function useTx() {
  const { t } = useTranslation();
  return (key: string, fallback?: string) => {
    const res = t(key);
    return res === key && fallback ? fallback : res;
  };
}
