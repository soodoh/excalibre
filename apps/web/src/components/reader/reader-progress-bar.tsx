import type { JSX } from "react";
import { cn } from "src/lib/utils";

type ReaderProgressBarProps = {
	fraction: number;
	positionLabel: string;
	isSaving?: boolean;
	visible: boolean;
};

export function ReaderProgressBar({
	fraction,
	positionLabel,
	isSaving,
	visible,
}: ReaderProgressBarProps): JSX.Element {
	const percentage = Math.round(fraction * 100);

	return (
		<div
			className={cn(
				"fixed right-0 bottom-0 left-0 z-60 bg-black/80 backdrop-blur-sm px-4 pt-2 pb-3 transition-all duration-300",
				visible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0",
			)}
		>
			{/* Labels row */}
			<div className="mb-1.5 flex items-center justify-between text-xs">
				<span className="text-white/60">{positionLabel}</span>
				<div className="flex items-center gap-2">
					{isSaving && (
						<span className="text-white/40 animate-pulse">Saving…</span>
					)}
					<span className="text-white/80">{percentage}%</span>
				</div>
			</div>

			{/* Progress bar */}
			<div className="h-1 w-full overflow-hidden rounded-full bg-white/20">
				<div
					className="h-full rounded-full bg-green-500 transition-all duration-500"
					style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
				/>
			</div>
		</div>
	);
}
