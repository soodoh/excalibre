// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-return
import { useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getReadingProgressFn,
  saveReadingProgressFn,
} from "src/server/reading";
import { queryKeys } from "src/lib/query-keys";

export function useReadingProgress(bookId: number): {
  initialPosition: string | undefined;
  initialProgress: number;
  saveProgress: (fraction: number, position?: string) => void;
  isSaving: boolean;
} {
  const queryClient = useQueryClient();
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const { data: progressEntries } = useQuery({
    queryKey: queryKeys.reading.progress(bookId),
    queryFn: () => getReadingProgressFn({ data: { bookId } }),
  });

  const webProgress = progressEntries?.find(
    (p: { deviceType: string }) => p.deviceType === "web",
  );

  const mutation = useMutation({
    mutationFn: (data: { progress: number; position?: string }) =>
      saveReadingProgressFn({
        data: {
          bookId,
          deviceType: "web",
          progress: data.progress,
          position: data.position,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.reading.progress(bookId),
      });
    },
  });

  const saveProgress = useCallback(
    (fraction: number, position?: string) => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        mutation.mutate({ progress: fraction, position });
      }, 2000);
    },
    [mutation],
  );

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return {
    initialPosition: webProgress?.position ?? undefined,
    initialProgress: webProgress?.progress ?? 0,
    saveProgress,
    isSaving: mutation.isPending,
  };
}
