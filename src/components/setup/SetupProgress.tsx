interface SetupProgressProps {
  currentStep: number;
  totalSteps?: number;
}

const SetupProgress = ({ currentStep, totalSteps = 3 }: SetupProgressProps) => {
  const steps = Array.from({ length: totalSteps }, (_, i) => i + 1);

  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center">
          {/* Circle */}
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
              step <= currentStep
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-secondary text-muted-foreground border-border'
            }`}
          >
            {step}
          </div>
          {/* Line */}
          {i < totalSteps - 1 && (
            <div
              className={`w-16 h-0.5 transition-colors ${
                step < currentStep ? 'bg-primary' : 'bg-border'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
};

export default SetupProgress;
