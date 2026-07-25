import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface SectionTab {
  value: string;
  label: string;
  count?: number;
  content: ReactNode;
}

interface Props {
  value: string;
  onValueChange: (v: string) => void;
  tabs: SectionTab[];
  className?: string;
}

const SectionTabs = ({ value, onValueChange, tabs, className }: Props) => (
  <Tabs value={value} onValueChange={onValueChange} className={cn('mt-2', className)}>
    <div className="overflow-x-auto -mx-4 px-4 border-b border-border/60">
      <TabsList className="bg-transparent p-0 h-auto gap-1">
        {tabs.map((t) => (
          <TabsTrigger
            key={t.value}
            value={t.value}
            className="relative h-11 rounded-none border-b-2 border-transparent px-3 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            {t.label}
            {typeof t.count === 'number' && (
              <span className="ml-1.5 text-[11px] text-muted-foreground tabular-nums">{t.count}</span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </div>
    {tabs.map((t) => (
      <TabsContent key={t.value} value={t.value} className="mt-4 focus-visible:outline-none">
        {t.content}
      </TabsContent>
    ))}
  </Tabs>
);

export default SectionTabs;
