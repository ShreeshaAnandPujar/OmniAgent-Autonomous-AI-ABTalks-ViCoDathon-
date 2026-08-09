export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg">
      <header className="h-14 border-b border-border-hi bg-surface flex items-center px-6">
        <a href="/" className="font-display font-bold text-text gradient-text mr-6">
          SwarmFeed
        </a>
        <span className="text-xs text-danger border border-danger/30 bg-danger/10 px-2 py-0.5 font-display">
          ADMIN
        </span>
      </header>
      {children}
    </div>
  );
}
