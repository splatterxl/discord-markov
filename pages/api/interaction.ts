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
		case InteractionType.ApplicationCommand: {
			res.send({
				type: InteractionResponseType.DeferredChannelMessageWithSource
			});

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
							return respond(
								{
									type: InteractionResponseType.ChannelMessageWithSource,
									data: {
										content: '⚠️ Please only provide one word in your prompt',
										flags: 64
									}
								},
								body
							);

						const array = map.get(prompt);

						if (!array)
							return respond(
								{
									type: InteractionResponseType.ChannelMessageWithSource,
									data: {
										content: "⚠️ I've never seen that word before!",
										flags: 64
									}
								},
								body
							);
					}

					const gen = () =>
						generateFromMap(map, {
							start: prompt
						});

					let resp = gen();

					let i = 0;

					while (resp.split(' ').length < 2 && i < 5) {
						resp = gen();

						i++;
					}

					return respond(
						{
							type: InteractionResponseType.ChannelMessageWithSource,
							data: {
								content: resp
							}
						},
						body
					);
				}
				default:
					res.send('' as any);
			}
		}
	}
}

async function respond(response: APIInteractionResponse, body: APIInteraction) {
	switch (response.type) {
		case InteractionResponseType.ChannelMessageWithSource: {
			const url = `https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${body.token}/messages/@original`;

			const json = await fetch(url, {
				method: 'PATCH',
				body: JSON.stringify(response.data),
				headers: {
					Authorization: `Bot ${process.env.TOKEN}`,
					'User-Agent': `DiscordBot (v1.0.0; https://github.com/splatterxl/hn-member)`,
					'Content-Type': 'application/json'
				}
			}).then((res) => res.json());
		}
	}
}
