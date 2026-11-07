'use client';

/**
 * অ্যাডমিন চার্ট — Chart.js (https://www.chartjs.org) অরিজিনাল কম্পোনেন্ট
 * ---------------------------------------------------------------------------
 * react-chartjs-2 (Line / Bar / Doughnut) + সাইট থিমের রঙ ও বাংলা ফরম্যাটিং।
 * সব চার্ট mount হওয়ার পরেই রেন্ডার হয় (অ্যাডমিন পেজ mounted গেট ব্যবহার করে)।
 */

import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
  type ChartOptions,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { formatBDT, formatBnDate, toBn } from '@/lib/types';

// শুধু দরকারি কম্পোনেন্ট রেজিস্টার — বান্ডেল ছোট রাখতে
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend
);

// বাংলা ফন্টে চার্টের লেবেল
if (typeof window !== 'undefined') {
  ChartJS.defaults.font.family = '"Noto Serif Bengali", "Noto Sans Bengali", serif';
  ChartJS.defaults.font.size = 11;
}

/** থিম রঙ — CSS ভেরিয়েবল থেকে, না পেলে hex fallback */
function themeColors() {
  const read = (name: string, fallback: string): string => {
    if (typeof window === 'undefined') return fallback;
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  };
  return {
    primary: read('--primary', '#2e7d55'),
    honey: read('--honey', '#d99a2b'),
    border: read('--border', '#e5e7eb'),
    mutedFg: read('--muted-foreground', '#6b7280'),
    popover: read('--popover', '#ffffff'),
    popoverFg: read('--popover-foreground', '#1f2937'),
  };
}

/** যেকোনো CSS রঙ (oklch/lab/hex...) থেকে আলফা-সহ rgba বানান — canvas-নিরাপদ */
function withAlpha(color: string, alpha: number): string {
  if (typeof document === 'undefined') return color;
  try {
    const cvs = document.createElement('canvas');
    cvs.width = 1;
    cvs.height = 1;
    const ctx = cvs.getContext('2d');
    if (!ctx) return color;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return `rgba(${r}, ${g}, ${b}, ${Number(((a / 255) * alpha).toFixed(3))})`;
  } catch {
    return color;
  }
}

const PALETTE = ['#2e7d55', '#d99a2b', '#3f9163', '#e0b13f', '#b06a3b', '#7c5cbf', '#4f8fbf', '#bf5c8a'];

/** থিম-ভিত্তিক টুলটিপ স্টাইল (canvas-এ CSS var() চলে না — computed মান লাগে) */
function tooltipStyle(t: ReturnType<typeof themeColors>) {
  return {
    backgroundColor: t.popover,
    borderColor: t.border,
    borderWidth: 1,
    titleColor: t.popoverFg,
    bodyColor: t.popoverFg,
    footerColor: t.popoverFg,
    borderRadius: 10,
    fontSize: 12,
    padding: 10,
  };
}

// ───────────────────────────── বিক্রয় লাইন চার্ট ─────────────────────────────

export type SalesPoint = { label: string; sales: number; orders: number; full: string };

export function SalesLineChart({ data }: { data: SalesPoint[] }) {
  const t = useMemo(() => themeColors(), []);

  const options = useMemo<ChartOptions<'line'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: 'circle', padding: 16 },
        },
        tooltip: {
          ...tooltipStyle(t),
          callbacks: {
            title: (items) => {
              const idx = items[0]?.dataIndex ?? -1;
              return idx >= 0 && data[idx] ? formatBnDate(data[idx].full) : '';
            },
            label: (ctx) =>
              ctx.datasetIndex === 0
                ? `বিক্রয়: ${formatBDT(Number(ctx.parsed.y))}`
                : `অর্ডার: ${toBn(Number(ctx.parsed.y))} টি`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { color: t.border },
          ticks: { color: t.mutedFg, maxRotation: 0, autoSkipPadding: 12 },
        },
        y: {
          beginAtZero: true,
          grid: { color: t.border },
          border: { display: false },
          ticks: {
            color: t.mutedFg,
            maxTicksLimit: 6,
            callback: (v) => {
              const n = Number(v);
              return n >= 1000 ? `${toBn(Math.round(n / 1000))}k` : toBn(n);
            },
          },
        },
        y1: {
          position: 'right',
          beginAtZero: true,
          grid: { display: false },
          border: { display: false },
          ticks: { color: t.mutedFg, maxTicksLimit: 6, precision: 0, callback: (v) => toBn(Number(v)) },
        },
      },
    }),
    [data, t]
  );

  const chartData = useMemo(
    () => ({
      labels: data.map((d) => d.label),
      datasets: [
        {
          label: 'বিক্রয় (৳)',
          data: data.map((d) => d.sales),
          yAxisID: 'y',
          borderColor: t.primary,
          backgroundColor: (ctx: { chart: { ctx: CanvasRenderingContext2D; chartArea?: { top: number; bottom: number } } }) => {
            const { ctx: c, chartArea } = ctx.chart;
            if (!chartArea) return withAlpha(t.primary, 0.2);
            const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            g.addColorStop(0, withAlpha(t.primary, 0.35));
            g.addColorStop(1, withAlpha(t.primary, 0.04));
            return g;
          },
          fill: true,
          borderWidth: 2,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: t.primary,
        },
        {
          label: 'অর্ডার',
          data: data.map((d) => d.orders),
          yAxisID: 'y1',
          borderColor: t.honey,
          borderWidth: 2,
          borderDash: [5, 4],
          fill: false,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: t.honey,
        },
      ],
    }),
    [data, t]
  );

  return <Line options={options} data={chartData} />;
}

// ───────────────────────────── ক্যাটাগরি হরিজন্টাল বার ─────────────────────────────

export type CategoryPerf = { name: string; orders: number; revenue: number };

export function CategoryBarChart({ data }: { data: CategoryPerf[] }) {
  const t = useMemo(() => themeColors(), []);

  const options = useMemo<ChartOptions<'bar'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tooltipStyle(t),
          callbacks: {
            label: (ctx) => {
              const item = data[ctx.dataIndex];
              return `আয়: ${formatBDT(Number(ctx.parsed.x))}${item ? ` • ${toBn(item.orders)} অর্ডার` : ''}`;
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: t.border },
          border: { display: false },
          ticks: {
            color: t.mutedFg,
            maxTicksLimit: 6,
            callback: (v) => {
              const n = Number(v);
              return n >= 1000 ? `${toBn(Math.round(n / 1000))}k` : toBn(n);
            },
          },
        },
        y: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: t.mutedFg },
        },
      },
    }),
    [data, t]
  );

  const chartData = useMemo(
    () => ({
      labels: data.map((d) => d.name),
      datasets: [
        {
          label: 'আয় (৳)',
          data: data.map((d) => d.revenue),
          backgroundColor: withAlpha(t.primary, 0.7),
          hoverBackgroundColor: t.primary,
          borderRadius: 6,
          maxBarThickness: 22,
        },
      ],
    }),
    [data, t]
  );

  return <Bar options={options} data={chartData} />;
}

// ───────────────────────────── পেমেন্ট ডোনাট ─────────────────────────────

export type PaymentSlice = { method: string; count: number; amount: number };

export function PaymentDoughnutChart({ data }: { data: PaymentSlice[] }) {
  const t = useMemo(() => themeColors(), []);

  const options = useMemo<ChartOptions<'doughnut'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: 'circle', padding: 12 },
        },
        tooltip: {
          ...tooltipStyle(t),
          callbacks: {
            label: (ctx) => {
              const item = data[ctx.dataIndex];
              const amount = formatBDT(Number(ctx.parsed));
              return item ? `${item.method}: ${amount} • ${toBn(item.count)} অর্ডার` : amount;
            },
          },
        },
      },
    }),
    [data, t]
  );

  const chartData = useMemo(
    () => ({
      labels: data.map((d) => d.method),
      datasets: [
        {
          data: data.map((d) => d.amount),
          backgroundColor: data.map((_, i) => PALETTE[i % PALETTE.length]),
          borderColor: t.popover,
          borderWidth: 2,
          hoverOffset: 6,
        },
      ],
    }),
    [data, t]
  );

  return <Doughnut options={options} data={chartData} />;
}
