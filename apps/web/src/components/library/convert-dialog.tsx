// oxlint-disable typescript/no-unsafe-call, typescript/no-unsafe-assignment, typescript/no-unsafe-member-access, typescript/no-unsafe-return
import type { JSX } from "react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "src/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "src/components/ui/select";
import { Button } from "src/components/ui/button";
import { Badge } from "src/components/ui/badge";
import {
  getSupportedConversionsFn,
  requestConversionFn,
} from "src/server/conversion";
import { queryKeys } from "src/lib/query-keys";

type ConvertDialogProps = {
  bookFile: {
    id: number;
    format: string;
    fileSize: number | null;
  };
  bookId: number;
  trigger: React.ReactNode;
};

function humanFileSize(bytes: number | null | undefined): string {
  if (!bytes) {
    return "Unknown";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FormatSelector({
  isLoading,
  formats,
  value,
  onChange,
}: {
  isLoading: boolean;
  formats: string[] | undefined;
  value: string;
  onChange: (value: string) => void;
}): JSX.Element {
  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">
        Loading supported formats...
      </p>
    );
  }
  if (!formats || formats.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No supported conversions for this format.
      </p>
    );
  }
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id="target-format" className="w-full">
        <SelectValue placeholder="Select a format..." />
      </SelectTrigger>
      <SelectContent>
        {formats.map((fmt) => (
          <SelectItem key={fmt} value={fmt}>
            {fmt.toUpperCase()}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ConvertDialog({
  bookFile,
  bookId,
  trigger,
}: ConvertDialogProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [targetFormat, setTargetFormat] = useState<string>("");
  const queryClient = useQueryClient();

  const { data: supportedFormats, isLoading: formatsLoading } = useQuery({
    queryKey: ["conversions", "supported", bookFile.format],
    queryFn: () =>
      getSupportedConversionsFn({ data: { format: bookFile.format } }),
    enabled: open,
  });

  const convertMutation = useMutation({
    mutationFn: () =>
      requestConversionFn({
        data: { bookFileId: bookFile.id, targetFormat },
      }),
    onSuccess: async () => {
      toast.success("Conversion queued!");
      setOpen(false);
      setTargetFormat("");
      await queryClient.invalidateQueries({
        queryKey: queryKeys.books.detail(bookId),
      });
    },
    onError: (error: Error) => {
      toast.error(error.message ?? "Failed to queue conversion");
    },
  });

  const handleOpenChange = (value: boolean) => {
    setOpen(value);
    if (!value) {
      setTargetFormat("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convert Book File</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              Source format:
            </span>
            <Badge variant="outline">{bookFile.format.toUpperCase()}</Badge>
            <span className="text-sm text-muted-foreground">
              {humanFileSize(bookFile.fileSize)}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" htmlFor="target-format">
              Target format
            </label>
            <FormatSelector
              isLoading={formatsLoading}
              formats={supportedFormats as string[] | undefined}
              value={targetFormat}
              onChange={setTargetFormat}
            />
          </div>
        </div>

        <DialogFooter showCloseButton>
          <Button
            onClick={() => convertMutation.mutate()}
            disabled={
              !targetFormat ||
              convertMutation.isPending ||
              !supportedFormats ||
              supportedFormats.length === 0
            }
          >
            {convertMutation.isPending ? "Queuing..." : "Convert"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
