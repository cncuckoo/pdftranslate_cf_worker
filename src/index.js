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
		const { ARK_API_KEY, PREORITY, OPENAI_API_KEY, OPENAI_PROXY_ENDPOINT, OPENAI_MODEL_ID, DEEPSEEK_ARK_ENDPOINT, DEEPSEEK_ARK_MODEL_ID, TURING_USERS, ALLOWED_ORIGIN, ERROR, LANGUAGES } = env;
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
		const { key, text, prompt, file_info, source_language, target_language } = await request.json();
		const source_language_name = LANGUAGES[source_language]
		const target_language_name = LANGUAGES[target_language]

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

		const target_cn_prompt = `你是一位译著等身的绝世翻译高手，学冠中西、博通古今，尤其擅长技术、科普内容的翻译，译文准确、流畅，尤其在底层长上下文连贯性和术语统一性方面，你总能做到贴合语境、严谨细致，令人不禁拍案叫绝。
1.翻译风格：译文不照搬原文句式，不逐字逐句翻译，多数情况下都会重新组织语言，做到特别简洁易懂，且文白相间、通俗易懂。
2.术语统一：人名、地名、机构名、软件名称、编程语言、技术名词等尽量使用中文术语，如果英文简写形式更通用，则使用英文简写形式，如：AI、Web、HTML、HTTP。
3.输出格式：译文必须保留原文本中的LaTex公式、Markdown标记、HTML标签，不额外添加任何标签和标记。
4.代码片段：Markdown中的代码段必须原样输出，保持格式。
将以下${source_language_name}内容翻译成中文，只输出译文，不输出无关的内容。
`;
		// 如果目标语言不是中文，使用简化版提示词
		const default_prompt = target_language_name === LANGUAGES['zh'] ? target_cn_prompt : `将用户提交的Markdown格式的${source_language_name}翻译成${target_language_name}，只输出译文，不输出任何无关内容。`;

		// 本地开发测试用，上线前注释掉
		// return new Response(JSON.stringify(default_prompt), {
		// 	status: 200,
		// 	headers: corsHeaders
		// });


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
						source_language: source_language,
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
