const Dashboard = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--nav-height))] gap-6">
      <div className="flex flex-col items-center gap-4">
        <span className="text-7xl font-extrabold text-primary tracking-tight">FS</span>
        <h1 className="text-2xl font-bold text-foreground tracking-wide">
          FiveServ Operations
        </h1>
        <p className="text-sm text-muted-foreground tracking-widest uppercase">
          Five Days. One Call. Done.
        </p>
      </div>
      <div className="mt-4 px-6 py-3 border border-primary/30 rounded-lg">
        <p className="text-sm text-primary font-medium">
          ✓ Dashboard — Coming Soon
        </p>
      </div>
    </div>
  );
};

export default Dashboard;
