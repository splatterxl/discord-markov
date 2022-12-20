// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { webcrypto } from 'crypto';
import {
	APIInteraction,
	APIInteractionResponse,
	ApplicationCommandOptionType,
	ApplicationCommandType,
	InteractionResponseType,
	InteractionType
} from 'discord-api-types/v10';
import { verify } from 'discord-verify/node';
import type { NextApiRequest, NextApiResponse } from 'next';

import { generateFromMap, loadArray } from 'mrkv';

const loaded = require('../../data.json');

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse<APIInteractionResponse>
) {
	if (req.headers['user-agent']?.startsWith('Mozilla'))
		return res.redirect('/');

	// verify the request
	const {
		'x-signature-ed25519': signature,
		'x-signature-timestamp': timestamp
	} = req.headers;
	const rawBody = JSON.stringify(req.body);

	const isValid = await verify(
		rawBody,
		signature?.toString(),
		timestamp?.toString(),
		'a8d49db6bf10b96427b94ccb795b8ed4c94e5de6df7605e320768c6fbce411ce',
		webcrypto.subtle
	);

	if (!isValid) {
		return res.status(401).send('Invalid signature' as any);
	}

	let { body }: { body: APIInteraction } = req;

	switch (body.type) {
		case InteractionType.Ping:
			return res.send({ type: InteractionResponseType.Pong });
		case InteractionType.ApplicationCommand:
			switch (body.data.type) {
				case ApplicationCommandType.ChatInput: {
					let prompt: string | undefined = undefined;

					const map = await loadArray(loaded);

					switch (body.data.options?.[0]?.type) {
						case ApplicationCommandOptionType.String: {
							prompt = body.data.options[0].value;
						}
					}

					if (prompt) {
						if (prompt.split(' ').length > 1)
							return res.send({
								type: InteractionResponseType.ChannelMessageWithSource,
								data: {
									content: '⚠️ Please only provide one word in your prompt',
									flags: 64
								}
							});

						const array = map.get(prompt);

						if (!array)
							return res.send({
								type: InteractionResponseType.ChannelMessageWithSource,
								data: {
									content: "⚠️ I've never seen that word before!",
									flags: 64
								}
							});
					}

					const gen = () =>
						generateFromMap(map, {
							start: prompt
						});

					let resp = gen();

					while (resp.split(' ').length < 2) {
						resp = gen();
					}

					return res.send({
						type: InteractionResponseType.ChannelMessageWithSource,
						data: {
							content: resp
						}
					});
				}
				default:
					res.send('' as any);
			}
	}
}
