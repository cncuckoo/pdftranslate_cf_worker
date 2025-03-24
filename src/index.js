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
		const { AI_GATEWAY, DEEPSEEK_API_KEY, TURING_USERS, ALLOWED_ORIGIN } = env;
		const corsHeaders = {
			"Access-Control-Allow-Origin": ALLOWED_ORIGIN,
			"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
		};
		if (request.method === "OPTIONS") {
			return new Response(null, {
				status: 204,
				headers: corsHeaders,
			});
		}

		if (request.method !== 'POST')
			return new Response('hello world!', { status: 200 })

		// 处理请求
		const data = await request.json();
		if (TURING_USERS.includes(data.key) === false) {
			return new Response('please input the key.', { status: 200 })
		}


		return new Response(JSON.stringify(data), { status: 200, headers: corsHeaders });

		try {
			const response = await fetch(AI_GATEWAY, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
				},
				body: JSON.stringify({
					model: 'deepseek-chat',
					messages: [
						{ "role": "system", "content": "请" },
						{ "role": "user", "content": "hi" },
					],
					temperature: 0.2,
					max_tokens: 4000
				})
			});
			const data = await response.json();
			// const data = TURING_USERS;
			return new Response(JSON.stringify(data), { status: 200 });
		} catch (error) {
			return new Response('Error occurred', { status: 500 });
		}
	},
};
