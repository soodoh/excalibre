// oxlint-disable typescript/no-unsafe-call

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import type { JSX } from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "src/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "src/components/ui/dialog";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "src/components/ui/form";
import { Input } from "src/components/ui/input";
import { queryKeys } from "src/lib/query-keys";
import type { CreateReadingListInput } from "src/lib/validators";
import { createReadingListSchema } from "src/lib/validators";
import {
	createReadingListFn,
	updateReadingListFn,
} from "src/server/reading-lists";

type ReadingList = {
	id: number;
	name: string;
};

type ReadingListFormProps = {
	readingList?: ReadingList;
	trigger: React.ReactNode;
};

export function ReadingListForm({
	readingList,
	trigger,
}: ReadingListFormProps): JSX.Element {
	const [open, setOpen] = useState(false);
	const queryClient = useQueryClient();
	const isEdit = readingList !== undefined;

	const form = useForm<CreateReadingListInput>({
		resolver: zodResolver(createReadingListSchema),
		defaultValues: {
			name: readingList?.name ?? "",
		},
	});

	const handleSubmit = async (
		values: CreateReadingListInput,
	): Promise<void> => {
		try {
			if (isEdit) {
				await updateReadingListFn({ data: { id: readingList.id, ...values } });
				toast.success("Reading list updated successfully");
			} else {
				await createReadingListFn({ data: values });
				toast.success("Reading list created successfully");
			}

			await queryClient.invalidateQueries({
				queryKey: queryKeys.readingLists.all,
			});
			setOpen(false);
			form.reset();
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Something went wrong",
			);
		}
	};

	const handleOpenChange = (nextOpen: boolean) => {
		setOpen(nextOpen);
		if (!nextOpen) {
			form.reset();
		}
	};

	let submitLabel: string;
	if (form.formState.isSubmitting) {
		submitLabel = "Saving...";
	} else if (isEdit) {
		submitLabel = "Save Changes";
	} else {
		submitLabel = "Create Reading List";
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>{trigger}</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>
						{isEdit ? "Edit Reading List" : "New Reading List"}
					</DialogTitle>
				</DialogHeader>
				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(handleSubmit)}
						className="space-y-4"
					>
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Name</FormLabel>
									<FormControl>
										<Input placeholder="My Reading List" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<DialogFooter>
							<Button type="submit" disabled={form.formState.isSubmitting}>
								{submitLabel}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
