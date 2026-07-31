import Sidebar from "@/components/Sidebar";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-dvh">
      <Sidebar />
      <main className="md:pl-60 pb-20 md:pb-8">
        <div className="mx-auto max-w-[1200px] px-4 md:px-8 pt-6 md:pt-8">
          {children}
        </div>
      </main>
    </div>
  );
}
