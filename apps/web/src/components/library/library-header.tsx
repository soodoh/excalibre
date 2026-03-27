import type { JSX } from "react";
import { ScanLine } from "lucide-react";
import { Button } from "src/components/ui/button";
import { Input } from "src/components/ui/input";
import { Badge } from "src/components/ui/badge";

type Library = {
  id: number;
  name: string;
};

type LibraryHeaderProps = {
  library: Library;
  bookCount: number;
  search: string;
  onSearchChange: (value: string) => void;
  onScan: () => void;
  isScanning: boolean;
  isAdmin: boolean;
};

export default function LibraryHeader({
  library,
  bookCount,
  search,
  onSearchChange,
  onScan,
  isScanning,
  isAdmin,
}: LibraryHeaderProps): JSX.Element {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{library.name}</h1>
        <Badge variant="secondary">{bookCount} books</Badge>
      </div>
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search books..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full sm:w-60"
        />
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            onClick={onScan}
            disabled={isScanning}
          >
            <ScanLine className="mr-1.5 size-4" />
            {isScanning ? "Scanning..." : "Scan Now"}
          </Button>
        )}
      </div>
    </div>
  );
}
