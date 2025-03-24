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
		const {key, text }= await request.json();

		if (!key) {
			return new Response(JSON.stringify({ error: 'API key is required' }), { 
				status: 400, 
				headers: corsHeaders 
			});
		}
		
		if (!TURING_USERS.includes(key)) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
				status: 401, 
				headers: corsHeaders 
			});
		}
		
		if (!text) {
			return new Response(JSON.stringify({ error: 'No text provided' }), { 
				status: 400, 
				headers: corsHeaders 
			});
		}

		try {
			const prompt = `请将以下英文文本翻译成中文，保持原文的格式和段落结构，只返回译文：\n\n${text}`
			const response = await fetch(AI_GATEWAY, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
				},
				body: JSON.stringify({
					model: 'deepseek-chat',
					messages: [
						{ "role": "user", "content": prompt },
					],
					temperature: 0.2,
					max_tokens: 4000
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
