/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export default {
	async fetch(request, env, ctx) {
		const { ARK_API_KEY, DEEPSEEK_ARK_ENDPOINT, DEEPSEEK_ARK_MODEL_ID, TURING_USERS, ALLOWED_ORIGIN, ERROR } = env;
		const corsHeaders = {
			"Access-Control-Allow-Origin": ALLOWED_ORIGIN,
			"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
			"Content-Type": "application/json"
		};
		if (request.method === "OPTIONS") {
			return new Response(null, {
				status: 204,
				headers: corsHeaders,
			});
		}

		if (request.method !== 'POST')
			return new Response(JSON.stringify({ message: 'Hello world!' }), {
				status: 200,
				headers: corsHeaders
			})

		// 处理请求
		const { key, text, prompt, file_info } = await request.json();

		if (!key) {
			return new Response(JSON.stringify(ERROR.NO_KEY), {
				status: 400,
				headers: corsHeaders
			});
		}

		// 如果不在TURING_USERS列表中
		if (!TURING_USERS.includes(key)) {
			return new Response(JSON.stringify(ERROR.UNKOWN_KEY), {
				status: 401,
				headers: corsHeaders
			});
		}

		if (!text) {
			return new Response(JSON.stringify(ERROR.NO_TEXT), {
				status: 400,
				headers: corsHeaders
			});
		}

		try {
			const system_prompt = prompt.trim() ? prompt.trim() : `请将以下英文文本翻译成中文，保留Markdown格式。注意：只返回译文，不返回任何其他无关内容。`

			// 根据判断结果选择使用哪个API Key
			const apiKeyToUse = ARK_API_KEY;

			// 模拟概率性的503错误：本地开发测试用，上线时注释掉！！！
			// if (Math.random() > 0.6)
			// 	return new Response(JSON.stringify({
			// 		error: 'Translation service error',
			// 		message: 'Translation service is temporarily unavailable'
			// 	}), {
			// 		status: 503,
			// 		headers: corsHeaders
			// 	});

			console.log('system_prompt', system_prompt)

			const response = await fetch(DEEPSEEK_ARK_ENDPOINT, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${apiKeyToUse}`
				},
				body: JSON.stringify({
					model: DEEPSEEK_ARK_MODEL_ID,
					messages: [
						{ "role": "system", "content": system_prompt },
						{
							"role": "user",
							"content": text,
						}
					],
					temperature: 0.2,
					max_tokens: 4000,
					metadata: {
						file_info: file_info || {},
						key: key,
						system_prompt: system_prompt
					}
				})
			});


			if (!response.ok) {
				const errorText = await response.text();
				console.error('AI Gateway error:', errorText);
				return new Response(JSON.stringify({
					error: 'Translation service error',
					details: errorText
				}), {
					status: 502,
					headers: corsHeaders
				});
			}

			const data = await response.json();
			return new Response(JSON.stringify(data), {
				status: 200,
				headers: corsHeaders
			});
		} catch (error) {
			console.error('Error processing request:', error);
			return new Response(JSON.stringify({
				error: 'Internal server error',
				message: error.message
			}), {
				status: 500,
				headers: corsHeaders
			});
		}
	},
};
