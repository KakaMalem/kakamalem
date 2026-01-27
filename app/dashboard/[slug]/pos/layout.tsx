// POS layout - removes default padding for full-screen experience
export default function POSLayout({ children }: { children: React.ReactNode }) {
  return <div className="-m-4 md:-m-6 h-[calc(100vh-64px)]">{children}</div>;
}
