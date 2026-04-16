import { json } from '@sveltejs/kit';
import { GROQ_API_KEY } from '$env/static/private';

export async function POST({ request }) {
	try {
		const body = await request.json();
		const {
			character,
			source,
			loraName,
			loraWeight,
			triggerWords,
			appearance,
			outfit,
			location,
			pose,
			unwanted
		} = body;

		// 1. รวมคำอธิบายฝั่งที่อยากได้ (Positive)
		const positiveDescriptions = [
			appearance && `Appearance: ${appearance}`,
			outfit && `Outfit: ${outfit}`,
			location && `Location: ${location}`,
			pose && `Pose: ${pose}`
		]
			.filter(Boolean)
			.join('\n');

		// 2. รวมคำอธิบายฝั่งที่ไม่อยากได้ (Negative)
		const negativeDescriptions = unwanted ? `Unwanted elements: ${unwanted}` : 'None';

		// 3. 📝 ปรับ System Prompt ใหม่ให้เป็น "นักกวีและศิลปิน"
		const systemPrompt = `
You are a Master Prompt Engineer, a Visionary Digital Artist, and a Poet.
Your task is to translate Thai descriptions into English and craft highly evocative, cinematic, and breathtaking image generation prompts for the Pony Diffusion V6 XL model.

Rules for crafting the prompt:
1. TONE & STYLE: Use flowing, sensory-rich adjectives. Describe the atmosphere, the emotional vibe, the dramatic lighting (e.g., cinematic lighting, soft bioluminescence, golden hour), and camera angles seamlessly.
2. STRUCTURE: Blend natural, poetic phrases with comma-separated Danbooru tags. Make the transition between the character's face, their intricate outfit, the pose, and the background environment feel incredibly smooth and alive.
3. POETIC EXPANSION: Do not just list items; paint a picture with words. Instead of "red dress, garden", write "wearing an elegant crimson dress fluttering in the gentle breeze, standing amidst a lush, vibrant Japanese garden bathed in the warm glow of sunset".
4. OUTPUT FORMAT: You MUST output ONLY a valid JSON object. No other text or markdown.
5. The JSON must have exactly two keys: "positive_tags" and "negative_tags".
   - "positive_tags": Your poetic, comma-separated masterpiece based on Appearance, Outfit, Location, and Pose.
   - "negative_tags": Translate the Unwanted elements into standard comma-separated negative tags.
        `;

		const userContent = `
Please craft a breathtaking prompt based on these details:
[POSITIVE]
${positiveDescriptions || 'None'}

[NEGATIVE]
${negativeDescriptions}
        `;

		// 4. เรียกใช้ Groq API (อัปเกรด Model และเพิ่มความสร้างสรรค์)
		const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${GROQ_API_KEY}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				model: 'llama-3.3-70b-versatile', // 🚀 อัปเกรดเป็นตัวท็อป 70B
				response_format: { type: 'json_object' },
				messages: [
					{ role: 'system', content: systemPrompt },
					{ role: 'user', content: userContent }
				],
				temperature: 0.75, // 🎨 ปรับเพิ่มความสร้างสรรค์และใช้คำศัพท์สวยขึ้น
				max_tokens: 1024
			})
		});

		if (!groqResponse.ok) throw new Error(`Groq API Error: ${await groqResponse.text()}`);

		const groqData = await groqResponse.json();

		// 5. แกะข้อมูล JSON ที่ AI ส่งมา
		let aiGenerated;
		try {
			aiGenerated = JSON.parse(groqData.choices[0].message.content.trim());
		} catch {
			aiGenerated = { positive_tags: '', negative_tags: '' };
		}

		const aiPositiveTags = aiGenerated.positive_tags === 'None' ? '' : aiGenerated.positive_tags;
		const aiNegativeTags = aiGenerated.negative_tags === 'None' ? '' : aiGenerated.negative_tags;

		// 6. ประกอบร่าง Positive Prompt (รวมของตายตัวเข้ากับบทกวีของ AI)
		const baseTags = `score_9, score_8_up, score_7_up, source_anime`;
		const loraTag = loraName ? `<lora:${loraName}:${loraWeight}>` : '';
		const qualityTags =
			'masterpiece, best quality, ultra-detailed, highly detailed eyes, detailed skin, intricate hair strands, cinematic lighting, breathtaking composition';

		const finalPositivePrompt = [
			baseTags,
			loraTag,
			triggerWords,
			character,
			source,
			aiPositiveTags, // แทรกบทกวีที่ AI แต่งมาตรงนี้
			qualityTags
		]
			.filter((tag) => tag && tag.trim() !== '')
			.join(', ');

		// 7. ประกอบร่าง Negative Prompt
		const defaultNegative =
			'score_6, score_5, score_4, source_cartoon, source_pony, 3d, realistic, photorealistic, monochrome, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry, artist name, bad anatomy, bad proportions, gross proportions, ugly, disfigured, mutated, malformed, deformed body, asymmetric, bad face, poorly drawn face, bad hands, poorly drawn hands, missing fingers, extra fingers, bad feet, poorly drawn feet';

		const finalNegativePrompt = [aiNegativeTags, defaultNegative]
			.filter((tag) => tag && tag.trim() !== '')
			.join(', ');

		// 8. ส่งกลับไปที่หน้าเว็บ
		return json({ prompt: finalPositivePrompt, negativePrompt: finalNegativePrompt });
	} catch (error) {
		console.error('API Error:', error);
		return json({ error: 'Failed to generate prompt', details: String(error) }, { status: 500 });
	}
}
