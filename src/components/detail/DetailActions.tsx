import type { ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Props {
  primary?: ReactNode;
  ghost?: ReactNode;
  overflow?: ReactNode;
}

/**
 * Layout container for detail-page action row.
 * Primary (filled) sits left, ghost/icon buttons follow, overflow menu right.
 */
const DetailActions = ({ primary, ghost, overflow }: Props) => {
  if (!primary && !ghost && !overflow) return null;
  return (
    <div className="flex items-center gap-1.5 w-full">
      {primary}
      {ghost}
      {overflow && (
        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">{overflow}</DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
};

export default DetailActions;
