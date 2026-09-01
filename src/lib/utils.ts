import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function csvField(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Serialiseert rijen naar CSV (met header op basis van de keys van de eerste
 * rij). Velden met komma's, aanhalingstekens of newlines worden correct
 * ge-escaped/omsloten. Regels gescheiden met CRLF (RFC 4180).
 */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(csvField).join(","),
    ...rows.map((row) => headers.map((key) => csvField(row[key])).join(",")),
  ];

  return lines.join("\r\n");
}
