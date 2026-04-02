// oxlint-disable typescript/no-unsafe-call, typescript/no-unsafe-return

import { useMutation } from "@tanstack/react-query";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "src/components/ui/button";
import { Textarea } from "src/components/ui/textarea";
import { cn } from "src/lib/utils";
import { createAnnotationFn } from "src/server/reading";

type AnnotationPopoverProps = {
	bookId: number;
	cfi: string;
	selectedText: string;
	position: { x: number; y: number };
	onClose: () => void;
	onCreated: () => void;
};

const HIGHLIGHT_COLORS = [
	{ label: "Yellow", value: "#facc15", bg: "bg-yellow-400" },
	{ label: "Green", value: "#4ade80", bg: "bg-green-400" },
	{ label: "Blue", value: "#60a5fa", bg: "bg-blue-400" },
	{ label: "Pink", value: "#f472b6", bg: "bg-pink-400" },
	{ label: "Orange", value: "#fb923c", bg: "bg-orange-400" },
];

export function AnnotationPopover({
	bookId,
	cfi,
	selectedText,
	position,
	onClose,
	onCreated,
}: AnnotationPopoverProps): JSX.Element {
	const [selectedColor, setSelectedColor] = useState(HIGHLIGHT_COLORS[0].value);
	const [note, setNote] = useState("");
	const [noteExpanded, setNoteExpanded] = useState(false);

	const truncatedText =
		selectedText.length > 100 ? `${selectedText.slice(0, 100)}…` : selectedText;

	const mutation = useMutation({
		mutationFn: (args: { type: "highlight" | "note" }) =>
			createAnnotationFn({
				data: {
					bookId,
					type: args.type,
					position: cfi,
					content: selectedText,
					note: note || undefined,
					color: selectedColor,
				},
			}),
		onSuccess: () => {
			toast.success("Annotation saved");
			onCreated();
			onClose();
		},
		onError: () => {
			toast.error("Failed to save annotation");
		},
	});

	const handleHighlight = () => {
		mutation.mutate({ type: "highlight" });
	};

	const handleSaveNote = () => {
		mutation.mutate({ type: "note" });
	};

	// Constrain popup to viewport
	const popoverWidth = 280;
	const left = Math.min(position.x, globalThis.innerWidth - popoverWidth - 8);

	return (
		<div
			className="absolute z-[100] w-70 rounded-lg border bg-popover p-3 shadow-lg"
			style={{ left, top: position.y }}
		>
			{/* Selected text preview */}
			<p className="mb-3 line-clamp-2 text-xs text-muted-foreground italic">
				&ldquo;{truncatedText}&rdquo;
			</p>

			{/* Color picker */}
			<div className="mb-3 flex items-center gap-2">
				{HIGHLIGHT_COLORS.map((color) => (
					<button
						key={color.value}
						type="button"
						aria-label={`Highlight color: ${color.label}`}
						className={cn(
							"size-6 rounded-full border-2 transition-transform hover:scale-110",
							color.bg,
							selectedColor === color.value
								? "border-foreground scale-110"
								: "border-transparent",
						)}
						onClick={() => setSelectedColor(color.value)}
					/>
				))}
			</div>

			{/* Note area */}
			{noteExpanded ? (
				<Textarea
					placeholder="Add a note…"
					value={note}
					onChange={(e) => setNote(e.target.value)}
					className="mb-3 min-h-20 text-sm"
				/>
			) : (
				<button
					type="button"
					className="mb-3 w-full rounded-md border border-dashed px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent"
					onClick={() => setNoteExpanded(true)}
				>
					+ Add note
				</button>
			)}

			{/* Action buttons */}
			<div className="flex gap-2">
				<Button
					size="sm"
					className="flex-1"
					onClick={handleHighlight}
					disabled={mutation.isPending}
				>
					Highlight
				</Button>
				{noteExpanded && (
					<Button
						size="sm"
						variant="outline"
						className="flex-1"
						onClick={handleSaveNote}
						disabled={mutation.isPending}
					>
						Save Note
					</Button>
				)}
				<Button
					size="sm"
					variant="ghost"
					onClick={onClose}
					disabled={mutation.isPending}
				>
					Cancel
				</Button>
			</div>
		</div>
	);
}
