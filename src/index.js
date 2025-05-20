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
		const { ARK_API_KEY, PREORITY, OPENAI_API_KEY, OPENAI_PROXY_ENDPOINT, OPENAI_MODEL_ID, DEEPSEEK_ARK_ENDPOINT, DEEPSEEK_ARK_MODEL_ID, TURING_USERS, ALLOWED_ORIGIN, ERROR } = env;
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

		const default_prompt = `你是一位译著等身的绝世翻译高手，学冠中西、博通古今，尤其擅长技术、科普内容的翻译，译文准确、流畅，尤其在底层长上下文连贯性和术语统一性方面，你总能做到贴合语境、严谨细致，令人不禁拍案叫绝。
1.翻译风格：你的译文不会照搬原文句式，不会逐字逐句地翻译，多数情况下会重新组织语言，做到特别简洁易懂，且文白相间、地道深刻。
2.术语统一：你的译文会尽量使用中文术语，不会使用英文术语。人名、地名、机构名、软件名称、编程语言、技术名词等，你都会使用中文术语。
3.输出格式：你的译文会保留原文的LaTex公式、Markdown标记、HTML标签，也不会添加原文中没有的Markdown标签。
请将用户提交的Markdown格式的英文翻译成中文，只输出译文，不输出任何无关内容。
`;

		try {
			const system_prompt = prompt?.trim() ? prompt?.trim() : default_prompt;

			const isPriority = PREORITY.includes(key);
			// 根据判断结果选择使用哪个API Key
			const apiKeyToUse = isPriority ? OPENAI_API_KEY : ARK_API_KEY;
			const endpointToUse = isPriority ? OPENAI_PROXY_ENDPOINT : DEEPSEEK_ARK_ENDPOINT;
			const modelToUse = isPriority ? OPENAI_MODEL_ID : DEEPSEEK_ARK_MODEL_ID;

			// 模拟概率性的503错误：本地开发测试用，上线时注释掉！！！
			// if (Math.random() > 0.6)
			// 	return new Response(JSON.stringify({
			// 		error: 'Translation service error',
			// 		message: 'Translation service is temporarily unavailable'
			// 	}), {
			// 		status: 503,
			// 		headers: corsHeaders
			// 	});

			// console.log('system_prompt', system_prompt)
			// console.log('endpointToUse', endpointToUse)
			// console.log('modelToUse', modelToUse)

			const response = await fetch(endpointToUse, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${apiKeyToUse} `
				},
				body: JSON.stringify({
					model: modelToUse,
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
						file_info: JSON.stringify(file_info || {}),
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
			// console.log('data', data)
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
