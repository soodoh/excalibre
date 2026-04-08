import { Readable } from "node:stream";

async function waitForStreamOpen(stream: Readable): Promise<void> {
	return await new Promise((resolve, reject) => {
		const onOpen = () => {
			cleanup();
			resolve();
		};
		const onError = (error: Error) => {
			cleanup();
			reject(error);
		};
		const cleanup = () => {
			stream.off("open", onOpen);
			stream.off("error", onError);
		};

		stream.once("open", onOpen);
		stream.once("error", onError);
	});
}

export async function createStreamResponse(
	stream: Readable,
	init: ResponseInit,
): Promise<Response> {
	await waitForStreamOpen(stream);
	return new Response(
		Readable.toWeb(stream) as unknown as ReadableStream,
		init,
	);
}
