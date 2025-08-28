/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
async function sendLLMRequest({ endpoint, api_key, model, message }) {
	const requestBody = {
		model: model,
		messages: [{
			role: 'user',
			content: message
		}],
	}
	if (model !== 'gpt-5' && model !== 'gpt-5-mini') {
		requestBody.temperature = 0.2;
		requestBody.max_tokens = 4096
	}
	const response = await fetch(endpoint, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${api_key} `
		},
		body: JSON.stringify(requestBody)
	});

	return response.json();
}

export default {
	async fetch(request, env, ctx) {
		const { ALLOWED_ORIGIN } = env;
		const corsHeaders = {
			"Access-Control-Allow-Origin": ALLOWED_ORIGIN,
			"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
			"Content-Type": "application/json"
		}
		const STATUS400 = { status: 400, headers: corsHeaders }
		const STATUS200 = { status: 200, headers: corsHeaders }
		// 处理OPTIONS请求
		if (request.method === "OPTIONS") {
			return new Response(null, {
				status: 204,
				headers: corsHeaders
			});
		}
		//  只允许POST请求
		if (request.method !== 'POST')
			return new Response(JSON.stringify({ message: 'Hello world!' }), STATUS200)
		// 解析URL路径
		const url = new URL(request.url);

		const { MODELS_PROVIDERS, ARK_API_KEY, PREORITY, OPENAI_API_KEY, OPENAI_ENDPOINT, OPENAI_MODEL_DEFAULT, ARK_ENDPOINT, ARK_MODEL_DEFAULT, TURING_USERS, ERROR, LANGUAGES } = env;

		// 为前端提供可比较的模型
		if (url.pathname === '/models') {
			return new Response(JSON.stringify({ models: MODELS_PROVIDERS }), STATUS200)
		}

		if (url.pathname === '/chat') {

			const { key, model, message, provider } = await request.json();

			if (!key)
				return new Response(JSON.stringify(ERROR.NO_KEY), STATUS400);
			// 如果不在TURING_USERS列表中
			if (!TURING_USERS.includes(key))
				return new Response(JSON.stringify(ERROR.UNKOWN_KEY), STATUS400);
			if (!provider)
				return new Response(JSON.stringify(ERROR.NO_PROVIDER), STATUS400);
			// 验证provider存在于MODELS_PROVIDERS的provider值中
			const providerInfo = MODELS_PROVIDERS.find(p => p.provider === provider);
			if (!providerInfo)
				return new Response(JSON.stringify(ERROR.NO_PROVIDER), STATUS400);
			if (!model)
				return new Response(JSON.stringify(ERROR.NO_MODEL), STATUS400);
			// 验证model必须与MODELS_PROVIDERS中相应provider对应的的models中的某个元素的id相同
			const modelInfo = providerInfo.models.find(m => m.id === model);
			if (!modelInfo)
				return new Response(JSON.stringify(ERROR.NO_MODEL), STATUS400);
			if (!message)
				return new Response(JSON.stringify(ERROR.NO_MESSAGE), STATUS400)


			// 根据provider从MODELS_PROVIDERS中获取endpoint
			const endpoint = env[`${providerInfo.alias}_ENDPOINT`];
			const api_key = env[`${providerInfo.alias}_API_KEY`];

			// 调用LLM
			try {
				const response = await sendLLMRequest({ endpoint, api_key, model, message });
				const content = response.choices[0].message.content;

				return new Response(JSON.stringify({
					content: content,
					model: model,
					provider: provider,
					usage: response.usage ? {
						prompt_tokens: response.usage.prompt_tokens,
						completion_tokens: response.usage.completion_tokens,
						total_tokens: response.usage.total_tokens
					} : null
				}), STATUS200)
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

		}

		// 处理请求
		const { key, text, prompt, file_info, source_language, target_language } = await request.json();
		const source_language_name = LANGUAGES[source_language]
		const target_language_name = LANGUAGES[target_language]

		if (!key) {
			return new Response(JSON.stringify(ERROR.NO_KEY), STATUS400);
		}

		// 如果不在TURING_USERS列表中
		if (!TURING_USERS.includes(key)) {
			return new Response(JSON.stringify(ERROR.UNKOWN_KEY), STATUS400);
		}

		if (!text) {
			return new Response(JSON.stringify(ERROR.NO_TEXT), STATUS400);
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
		// return new Response(JSON.stringify(default_prompt), STATUS200);


		try {
			const system_prompt = prompt?.trim() ? prompt?.trim() : default_prompt;

			const isPriority = PREORITY.includes(key);
			// 根据判断结果选择使用哪个API Key
			const apiKeyToUse = isPriority ? OPENAI_API_KEY : ARK_API_KEY;
			const endpointToUse = isPriority ? OPENAI_ENDPOINT : ARK_ENDPOINT;
			const modelToUse = isPriority ? OPENAI_MODEL_DEFAULT : ARK_MODEL_DEFAULT;

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
			return new Response(JSON.stringify(data), STATUS200);
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
