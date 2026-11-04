const paths = {
  dashboard: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  heart: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  home: "m3 10 9-7 9 7v11h-7v-7h-4v7H3Z",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M13 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  document: "M14 2H5v20h14V7ZM14 2v5h5M8 12h8m-8 4h6",
  finance: "M12 2v20m5-16H9a4 4 0 0 0 0 8h6a4 4 0 0 1 0 8H5",
  calendar: "M3 5h18v16H3zM7 2v6m10-6v6M3 11h18m-14 4h3m4 0h3",
  settings: "M4 5h16M4 12h16M4 19h16M8 2v6m8 1v6m-6 1v6",
  chart: "M3 3v18h18M7 16v-4m5 4V8m5 8V5",
  clock: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  search: "m16 16 5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  bed: "M3 19V5m0 11h18v3M3 10h18v6M7 10V7h5v3m2 0V7h5v3",
  bath: "M3 12h18m-16 0v5a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-5M7 20v2m10-2v2M5 12V5a3 3 0 0 1 6 0v1",
  area: "M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6M3 3l6 6m12-6-6 6M3 21l6-6m12 6-6-6",
  close: "m6 6 12 12M6 18 18 6",
  chevron: "m7 10 5 5 5-5",
  globe: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z",
} as const;

export function Icon({ name, className }: { name: keyof typeof paths; className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}
