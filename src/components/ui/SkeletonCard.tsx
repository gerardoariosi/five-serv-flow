interface SkeletonCardProps {
  count?: number;
}

const SkeletonCard = ({ count = 1 }: SkeletonCardProps) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="fs-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="skeleton-pulse h-4 w-24" />
            <div className="skeleton-pulse h-4 w-16 rounded-full" />
            <div className="skeleton-pulse h-4 w-20 rounded-full" />
          </div>
          <div className="skeleton-pulse h-3 w-3/4" />
          <div className="skeleton-pulse h-3 w-1/2" />
        </div>
      ))}
    </>
  );
};

export default SkeletonCard;
