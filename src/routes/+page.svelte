<script>
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase'; // 👈 เรียกใช้งาน Supabase

	// 1. ฐานข้อมูล Source (อัปเดตใหม่ของคุณ)
	const sourceDatabases = [
		'genshin impact',
		'honkai impact 3rd',
		'honkai: star rail',
		'wuthering waves',
		'blue archive',
		'zenless zone zero',
		'nikke',
		'azur lane',
		'fate/grand order',
		'evangelion',
		'resident evil',
		'high school dxd',
		'Sono Bisque Doll wa Koi o Suru',
		'vocaloid',
		'kakegurui',
		'rent a girlfriend',
		'bocchi the rock',
		'overlord',
		'5 toubun no hanayome',
		'original'
	];

	// 2. ฐานข้อมูล LoRA (จับคู่ชื่อไฟล์ กับ Trigger Words)
	/** @type {Record<string, string>} */
	const loraDatabase = {
		raiden_shogun_pony: 'raiden_shogun_ckxl',
		yae_miko_pony:
			'yae_miko, purple eyes, pink hair, very long hair, low-tied long hair, animal ears, fox ears, floppy ears, hair between eyes, earrings, hair ornament, jewelry',
		kafka_pony:
			'kafka, eyewear on head, round eyewear, purple eyes, purple hair, long hair,black jacket, gloves, high-waist shorts, jacket, pantyhose, pantyhose under shorts, shirt, shorts, white shirt',
		yaoguang_pony: 'Yaoguang, dress, bracelet, earrings, jewelry, high heels',
		feixiao_pony:
			'FeiDefault, animal ears, long hair, ponytail, multicolored hair, white hair, red eyeliner, ringed eyes, forehead mark, ear piercing, tassel hair ornament, tassel earring, sleeveless shirt, print shirt, brooch, blue shirt, chinese clothes, high collar, bare arms, red gloves, fingerless gloves, white belt, waist cape, black shorts, thigh strap, knee boots'
	};

	let character = $state('Character Name');
	let source = $state(sourceDatabases[0]);
	let loraName = $state('Lora_pony');
	let loraWeight = $state(0.8);

	// 3. สร้าง State สำหรับ Trigger Words
	let triggerWords = $state('');

	// 4. ใช้ $effect จับตาดู loraName
	$effect(() => {
		const foundWords = loraDatabase[loraName.toLowerCase()];
		if (foundWords) {
			triggerWords = foundWords;
		}
	});

	let appearance = $state('');
	let outfit = $state('');
	let location = $state('');
	let pose = $state('');  

	// 🆕 ตัวแปรใหม่สำหรับสกัดของไม่ต้องการ
	let unwanted = $state('');

	let positivePrompt = $state('Waiting for generation...');
	let defaultNegative =
		'score_6, score_5, score_4, source_cartoon, source_pony, 3d, realistic, photorealistic, monochrome, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry, artist name, bad anatomy, bad proportions, gross proportions, ugly, disfigured, mutated, malformed, deformed body, asymmetric, bad face, poorly drawn face, bad hands, poorly drawn hands, missing fingers, extra fingers, bad feet, poorly drawn feet';
	let negativePrompt = $state(defaultNegative);

	let isGenerating = $state(false);
	let showToast = $state(false);
	let toastMessage = $state('');
	let showSettings = $state(false);

	// 🔐 ระบบ Auth & History State
	/** @type {any} */
	let session = $state(null);
	/** @type {any[]} */
	let promptHistory = $state([]);
	let showHistoryModal = $state(false);

	// 🚀 เมื่อโหลดหน้าเว็บ ให้เช็คว่าล็อกอินอยู่ไหม
	onMount(() => {
		supabase.auth.getSession().then((/** @type {any} */ res) => {
			session = res.data.session;
			if (session) fetchHistory();
		});

		supabase.auth.onAuthStateChange((/** @type {any} */ _event, /** @type {any} */ _session) => {
			session = _session;
			if (session) fetchHistory();
		});
	});
	// 🔑 ฟังก์ชัน Login / Logout
	async function login() {
		await supabase.auth.signInWithOAuth({ provider: 'google' });
	}

	async function logout() {
		await supabase.auth.signOut();
		session = null;
		promptHistory = [];
		triggerToast('👋 Logged out successfully');
	}

	// 📥 ฟังก์ชันดึงประวัติ
	async function fetchHistory() {
		const { data, error } = await supabase
			.from('prompt_history')
			.select('*')
			.order('created_at', { ascending: false });
		if (!error && data) {
			promptHistory = data;
		}
	}

	/** @param {string} message */
	function triggerToast(message) {
		toastMessage = message;
		showToast = true;
		setTimeout(() => {
			showToast = false;
		}, 3000);
	}

	// 🌟 1. ฟังก์ชัน: ล้างข้อมูลทั้งหมด
	function handleClear() {
		character = '';
		source = '';
		loraName = '';
		triggerWords = '';
		appearance = '';
		outfit = '';
		location = '';
		pose = '';
		unwanted = '';
		positivePrompt = 'Waiting for generation...';
		negativePrompt = defaultNegative;
		triggerToast('🗑️ Cleared all fields!');
	}

	// 🌟 2. ฟังก์ชัน: สุ่มไอเดีย
	function handleRandomize() {
		const r = (/** @type {any[]} */ arr) => arr[Math.floor(Math.random() * arr.length)];
		character = r(['Kafka', 'Feixiao', 'Raiden Shogun', 'Yae Miko', 'Hatsune Miku']);
		source = r(['honkai: star rail', 'genshin impact', 'vocaloid', 'original']);
		loraName = '';
		triggerWords = '';
		appearance = r([
			'ผมสั้นสีฟ้า ตากลมโต ร่าเริง',
			'ผมยาวสีเงิน ปิดตาหนึ่งข้าง หน้านิ่ง',
			'ผมทวินเทล ท่าทางโกรธ',
			'เอลฟ์หูยาว หน้าตาง่วงนอน'
		]);
		outfit = r([
			'ชุดว่ายน้ำบิกินี่สีดำ ทับด้วยเสื้อเชิ้ตซีทรู',
			'ชุดเมดสไตล์โกธิค ถุงเท้าตาข่าย',
			'เสื้อฮู้ดตัวใหญ่เกินขนาด ไม่ใส่กางเกง',
			'ชุดเกราะอัศวินสีเงิน ถือดาบใหญ่'
		]);
		location = r([
			'ในคาเฟ่แมว แสงอบอุ่นทะลุหน้าต่าง',
			'ท่ามกลางสายฝน เมืองไซเบอร์พังค์ นีออน',
			'บนชายหาดตอนพระอาทิตย์ตก ท้องฟ้าสีส้ม'
		]);
		pose = r([
			'นอนอ่านหนังสือบนเตียง เตะเท้าไปมา',
			'ถือร่มใส มองมาที่กล้อง เอียงคอ',
			'นั่งไขว่ห้างบนเก้าอี้บาร์ ดื่มค็อกเทล'
		]);
		unwanted = 'ผู้ชาย, ตัวหนังสือ, ลายน้ำ, ภาพเบลอ';
		triggerToast('🎲 Random Idea Applied!');
	}

	async function handleGenerate() {
		isGenerating = true;
		positivePrompt = '✨ AI is crafting your prompt...';

		try {
			const response = await fetch('/api/generate-pose', {
				// อย่าลืมเช็ค URL โฟลเดอร์ API นะครับ
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
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
				})
			});

			if (!response.ok) throw new Error('Network response was not ok');

			const data = await response.json();

			if (data.prompt) {
				positivePrompt = data.prompt;
				if (data.negativePrompt) {
					negativePrompt = data.negativePrompt;
				}
				triggerToast('✨ Prompt generated successfully!');

				// 💾 ระบบ Auto-Save: ถ้าล็อกอินอยู่ ให้เซฟประวัติทันที!
				if (session) {
					await supabase.from('prompt_history').insert([
						{
							user_id: session.user.id,
							character,
							source,
							lora_name: loraName,
							positive_prompt: positivePrompt,
							negative_prompt: negativePrompt
						}
					]);
					fetchHistory(); // ดึงประวัติใหม่มาอัปเดตทันที
				}
			} else {
				throw new Error(data.error || 'Unknown error');
			}
		} catch (error) {
			console.error('Error generating prompt:', error);
			positivePrompt = '❌ Failed to generate prompt. Please check your connection or API key.';
			triggerToast('❌ Error generating prompt!');
		} finally {
			isGenerating = false;
		}
	}

	/** @param {string} text */
	function copyToClipboard(text) {
		if (!text || text.includes('Waiting') || text.includes('crafting')) return;
		navigator.clipboard.writeText(text).then(() => {
			triggerToast('📋 Copied to clipboard!');
		});
	}
</script>

<div
	class="relative flex min-h-screen flex-col items-center bg-[#1a1a2e] p-5 font-sans text-[#e2e8f0] selection:bg-[#ff7eb3] selection:text-white"
	style="background: url('https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=2560&auto=format&fit=crop') center/cover no-repeat; background-attachment: fixed;"
>
	{#if showToast}
		<div
			class="animate-fade-in-down fixed top-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-[#86efac] bg-[rgba(20,25,40,0.85)] px-6 py-3 text-[#86efac] shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md transition-all duration-300"
		>
			<svg
				class="h-6 w-6"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				xmlns="http://www.w3.org/2000/svg"
				><path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
				></path></svg
			>
			<span class="font-medium">{toastMessage}</span>
		</div>
	{/if}

	<nav
		class="animate-fade-in-down mb-5 flex w-full max-w-6xl items-center justify-between rounded-2xl border border-white/15 bg-[rgba(20,25,40,0.6)] px-6 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-md"
	>
		<h1
			class="m-0 bg-linear-to-r from-[#ff9a9e] via-[#fecfef] to-[#fecfef] bg-clip-text text-xl font-bold tracking-[2px] text-transparent md:text-2xl"
		>
			✨ PONY V6 AI PROMPT ARCHITECT ✨
		</h1>

		<div class="flex items-center gap-3">
			{#if session}
				<button
					onclick={() => (showHistoryModal = true)}
					class="flex cursor-pointer items-center gap-2 rounded-xl bg-purple-500/20 px-4 py-2 text-sm font-bold text-purple-200 transition-all hover:bg-purple-500/40 active:scale-95"
				>
					📜 History ({promptHistory.length})
				</button>
				<div class="flex items-center gap-3 border-l border-white/20 pl-3">
					<img
						src={session.user.user_metadata.avatar_url ||
							'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix'}
						alt="Avatar"
						class="h-8 w-8 rounded-full border border-white/30"
					/>
					<button
						onclick={logout}
						class="cursor-pointer text-sm font-medium text-red-300 transition-colors hover:text-red-400"
						>Logout</button
					>
				</div>
			{:else}
				<button
					onclick={login}
					class="flex cursor-pointer items-center gap-2 rounded-xl bg-white/10 px-5 py-2 text-sm font-bold text-white transition-all hover:bg-white/20 active:scale-95"
				>
					<svg class="h-4 w-4" viewBox="0 0 24 24"
						><path
							fill="currentColor"
							d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.761H12.545z"
						/></svg
					>
					Login to Save
				</button>
			{/if}
		</div>
	</nav>

	{#if showHistoryModal}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"
			role="button"
			tabindex="0"
			onclick={(e) => {
				if (e.target === e.currentTarget) showHistoryModal = false;
			}}
			onkeydown={(e) => {
				if (e.key === 'Escape' && e.target === e.currentTarget) showHistoryModal = false;
			}}
		>
			<div
				class="animate-fade-in-up flex max-h-[80vh] w-full max-w-4xl flex-col rounded-2xl border border-white/20 bg-[#1a1a2e] shadow-2xl"
			>
				<div class="flex items-center justify-between border-b border-white/10 p-5">
					<h2 class="m-0 text-xl font-bold text-white">📜 Your Prompt History</h2>
					<button
						onclick={() => (showHistoryModal = false)}
						class="cursor-pointer text-gray-400 transition-colors hover:text-white">✕</button
					>
				</div>

				<div class="custom-scrollbar flex flex-col gap-4 overflow-y-auto p-5">
					{#if promptHistory.length === 0}
						<p class="text-center text-gray-400">No prompts generated yet. Start crafting!</p>
					{:else}
						{#each promptHistory as history (history.id)}
							<div
								class="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:bg-white/10"
							>
								<div class="flex items-center justify-between">
									<span
										class="rounded bg-purple-500/20 px-2 py-1 text-xs font-bold text-purple-300"
									>
										{history.character || 'Original'} | {history.lora_name || 'No LoRA'}
									</span>
									<span class="text-xs text-gray-400"
										>{new Date(history.created_at).toLocaleString('th-TH')}</span
									>
								</div>
								<div>
									<p class="m-0 mb-1 text-xs font-bold text-[#86efac]">Positive:</p>
									<p class="m-0 line-clamp-2 text-sm text-gray-300">{history.positive_prompt}</p>
									<button
										onclick={() => copyToClipboard(history.positive_prompt)}
										class="mt-2 cursor-pointer text-xs text-[#86efac] underline transition-colors hover:text-white"
										>Copy Positive</button
									>
								</div>
							</div>
						{/each}
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<main class="grid w-full max-w-6xl grid-cols-1 gap-8 md:grid-cols-2">
		<section
			class="animate-fade-in-up flex flex-col gap-5 rounded-[20px] border border-white/15 bg-[rgba(20,25,40,0.6)] p-8 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-md"
		>
			<div class="flex flex-col">
				<h3
					class="m-0 mb-4 border-b border-dashed border-white/20 pb-2 text-[1.1rem] text-[#ffb7b2]"
				>
					🌸 1. CHAR & LORA PARAMS
				</h3>

				<div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div class="flex flex-col gap-1.5">
						<label for="source" class="text-[0.85rem] font-medium text-[#cbd5e1]"
							>Source (Anime/Game)</label
						>
						<input
							id="source"
							type="text"
							list="source-list"
							bind:value={source}
							class="rounded-xl border border-white/20 bg-black/30 px-4 py-2.5 text-white transition-all duration-300 outline-none hover:border-white/40 focus:border-[#ffb7b2] focus:shadow-[0_0_10px_rgba(255,183,178,0.3)]"
							placeholder="Type or select..."
						/>
						<datalist id="source-list"
							>{#each sourceDatabases as src (src)}<option value={src}></option>{/each}</datalist
						>
					</div>

					<div class="flex flex-col gap-1.5">
						<label for="char" class="text-[0.85rem] font-medium text-[#cbd5e1]">Character</label>
						<input
							id="char"
							type="text"
							bind:value={character}
							class="rounded-xl border border-white/20 bg-black/30 px-4 py-2.5 text-white transition-all duration-300 outline-none hover:border-white/40 focus:border-[#ffb7b2] focus:shadow-[0_0_10px_rgba(255,183,178,0.3)]"
						/>
					</div>
				</div>

				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div class="flex flex-col gap-1.5">
						<label for="lora" class="text-[0.85rem] font-medium text-[#cbd5e1]">LoRA Name</label>
						<input
							id="lora"
							type="text"
							bind:value={loraName}
							class="rounded-xl border border-white/20 bg-black/30 px-4 py-2.5 text-white transition-all duration-300 outline-none hover:border-white/40 focus:border-[#ffb7b2] focus:shadow-[0_0_10px_rgba(255,183,178,0.3)]"
						/>
					</div>

					<div class="flex flex-col gap-1.5">
						<label for="weight-input" class="text-[0.85rem] font-medium text-[#cbd5e1]"
							>Weight</label
						>
						<div
							class="flex items-center gap-3 rounded-xl border border-white/20 bg-black/30 px-3 py-1.5 transition-all duration-300 focus-within:border-[#ffb7b2] focus-within:shadow-[0_0_10px_rgba(255,183,178,0.3)] hover:border-white/40"
						>
							<input
								type="range"
								min="0.1"
								max="2"
								step="0.05"
								bind:value={loraWeight}
								class="w-full cursor-pointer accent-[#ffb7b2] transition-all hover:accent-[#ff7eb3]"
							/>
							<input
								id="weight-input"
								type="number"
								min="0.1"
								max="2"
								step="0.05"
								bind:value={loraWeight}
								class="w-16 rounded-lg border border-transparent bg-[rgba(0,0,0,0.4)] py-1 text-center text-sm text-white transition-colors outline-none focus:border-[#ffb7b2]"
							/>
						</div>
					</div>
				</div>
			</div>

			<div class="my-1 h-px bg-white/10"></div>

			<div class="flex flex-col gap-3">
				<h3
					class="m-0 mb-2 border-b border-dashed border-white/20 pb-2 text-[1.1rem] text-[#ffb7b2]"
				>
					👗 2. APPEARANCE & SCENE
				</h3>

				<div class="flex flex-col gap-1.5">
					<label for="appearance" class="text-[0.85rem] font-medium text-[#cbd5e1]"
						>Appearance (หน้าตา/ผม)</label
					><textarea
						id="appearance"
						rows="2"
						bind:value={appearance}
						placeholder="เช่น ผมยาวสีชมพู ตาสีม่วง..."
						class="resize-y rounded-xl border border-white/20 bg-black/30 px-4 py-2.5 text-white transition-all duration-300 outline-none focus:border-[#ffb7b2] focus:shadow-[0_0_10px_rgba(255,183,178,0.3)]"
					></textarea>
				</div>
				<div class="flex flex-col gap-1.5">
					<label for="outfit" class="text-[0.85rem] font-medium text-[#cbd5e1]">Outfit (ชุด)</label
					><textarea
						id="outfit"
						rows="2"
						bind:value={outfit}
						placeholder="เช่น ชุดกิโมโนสีแดง..."
						class="resize-y rounded-xl border border-white/20 bg-black/30 px-4 py-2.5 text-white transition-all duration-300 outline-none focus:border-[#ffb7b2] focus:shadow-[0_0_10px_rgba(255,183,178,0.3)]"
					></textarea>
				</div>
				<div class="flex flex-col gap-1.5">
					<label for="location" class="text-[0.85rem] font-medium text-[#cbd5e1]"
						>Location (สถานที่/แสง)</label
					><textarea
						id="location"
						rows="2"
						bind:value={location}
						placeholder="เช่น สวนญี่ปุ่นตอนเย็น..."
						class="resize-y rounded-xl border border-white/20 bg-black/30 px-4 py-2.5 text-white transition-all duration-300 outline-none focus:border-[#ffb7b2] focus:shadow-[0_0_10px_rgba(255,183,178,0.3)]"
					></textarea>
				</div>
				<div class="flex flex-col gap-1.5">
					<label for="pose" class="text-[0.85rem] font-medium text-[#cbd5e1]"
						>Pose Idea (ท่าทาง)</label
					><input
						id="pose"
						type="text"
						bind:value={pose}
						placeholder="เช่น ยืนหันข้าง..."
						class="rounded-xl border border-white/20 bg-black/30 px-4 py-2.5 text-white transition-all duration-300 outline-none focus:border-[#ffb7b2] focus:shadow-[0_0_10px_rgba(255,183,178,0.3)]"
					/>
				</div>

				<div class="mt-2 flex flex-col gap-1.5">
					<label for="unwanted" class="text-[0.85rem] font-medium text-red-300"
						>🚫 Unwanted (สิ่งที่ไม่อยากได้ในภาพ)</label
					><textarea
						id="unwanted"
						rows="2"
						bind:value={unwanted}
						placeholder="เช่น เครื่องประดับหัว, หมวก, แว่นตา, ตัวหนังสือ"
						class="resize-y rounded-xl border border-red-400/40 bg-[#2a1118]/50 px-4 py-2.5 text-red-100 transition-all duration-300 outline-none focus:border-red-400 focus:shadow-[0_0_10px_rgba(248,113,113,0.3)]"
					></textarea>
				</div>
			</div>

			<div class="my-1 h-px bg-white/10"></div>

			<div class="flex flex-col gap-3">
				<h3
					class="m-0 mb-2 border-b border-dashed border-white/20 pb-2 text-[1.1rem] text-[#ffb7b2]"
				>
					✨ 3. AI ACTION
				</h3>
				<button
					type="button"
					class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-none bg-linear-to-br from-[#ff758c] to-[#ff7eb3] py-3.5 text-[1.1rem] font-bold text-white transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_5px_20px_rgba(255,126,179,0.5)] active:scale-95"
					onclick={handleGenerate}
				>
					{#if isGenerating}
						<svg
							class="h-5 w-5 animate-spin text-white"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							><circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle><path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							></path></svg
						>
						Generating...
					{:else}
						✨ Generate & Refine Prompt
					{/if}
				</button>
				<div class="mt-1 grid grid-cols-2 gap-3">
					<button
						type="button"
						onclick={handleClear}
						class="cursor-pointer rounded-xl border border-white/20 bg-white/5 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:border-red-500/50 hover:bg-red-500/30 active:scale-95"
						>🗑️ Clear All</button
					>
					<button
						type="button"
						onclick={handleRandomize}
						class="cursor-pointer rounded-xl border border-white/20 bg-white/5 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:border-purple-500/50 hover:bg-purple-500/30 active:scale-95"
						>🎲 Inspire Me</button
					>
				</div>
			</div>
		</section>

		<section class="animate-fade-in-up flex h-full flex-col gap-6" style="animation-delay: 0.1s;">
			<div
				class="flex h-full flex-1 flex-col rounded-[20px] border border-t-[3px] border-white/15 border-t-[#86efac] bg-[rgba(20,25,40,0.6)] p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-md transition-transform duration-300 hover:-translate-y-1"
			>
				<div class="mb-4 flex items-center justify-between">
					<h3 class="m-0 text-[1.1rem] font-bold text-[#86efac]">✅ POSITIVE PROMPT</h3>
					<button
						onclick={() => copyToClipboard(positivePrompt)}
						class="cursor-pointer rounded-lg border border-white/30 bg-white/10 px-4 py-1.5 text-sm text-white transition-all duration-300 hover:border-[#86efac] hover:bg-[#86efac]/20 active:scale-95"
						>Copy</button
					>
				</div>
				<textarea
					readonly
					bind:value={positivePrompt}
					class="custom-scrollbar min-h-37.5 grow resize-none rounded-xl border border-transparent bg-black/20 p-4 text-[0.9rem] leading-relaxed text-[#e2e8f0] outline-none"
				></textarea>
			</div>
			<div
				class="flex h-full flex-1 flex-col rounded-[20px] border border-t-[3px] border-white/15 border-t-[#fca5a5] bg-[rgba(20,25,40,0.6)] p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-md transition-transform duration-300 hover:-translate-y-1"
			>
				<div class="mb-4 flex items-center justify-between">
					<h3 class="m-0 text-[1.1rem] font-bold text-[#fca5a5]">❌ NEGATIVE PROMPT</h3>
					<button
						onclick={() => copyToClipboard(negativePrompt)}
						class="cursor-pointer rounded-lg border border-white/30 bg-white/10 px-4 py-1.5 text-sm text-white transition-all duration-300 hover:border-[#fca5a5] hover:bg-[#fca5a5]/20 active:scale-95"
						>Copy</button
					>
				</div>
				<textarea
					readonly
					bind:value={negativePrompt}
					class="custom-scrollbar min-h-30 grow resize-none rounded-xl border border-transparent bg-black/20 p-4 text-[0.9rem] leading-relaxed text-[#e2e8f0] outline-none"
				></textarea>
			</div>
		</section>

		<section class="animate-fade-in-up md:col-span-2" style="animation-delay: 0.2s;">
			<button
				type="button"
				onclick={() => (showSettings = !showSettings)}
				class="flex w-full cursor-pointer items-center justify-between rounded-[20px] border border-white/15 bg-[rgba(20,25,40,0.6)] px-8 py-4 text-left shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-md transition-all duration-300 hover:bg-white/5 active:scale-[0.99]"
			>
				<h3 class="m-0 text-[1.1rem] font-bold text-[#c7d2fe]">
					⚙️ RECOMMENDED SETTINGS & CONFIG (ตั้งค่า WebUI)
				</h3>
				<svg
					class="h-6 w-6 text-[#c7d2fe] transition-transform duration-300 {showSettings
						? 'rotate-180'
						: ''}"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"
					></path></svg
				>
			</button>
			{#if showSettings}
				<div
					class="mt-4 grid grid-cols-1 gap-6 rounded-[20px] border border-white/15 bg-[rgba(20,25,40,0.6)] p-8 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-md sm:grid-cols-2 lg:grid-cols-4"
				>
					<div class="flex flex-col gap-2 rounded-xl border border-white/5 bg-black/20 p-5">
						<h4
							class="m-0 mb-2 border-b border-white/10 pb-2 text-[0.95rem] font-bold text-[#818cf8]"
						>
							💻 System & VRAM
						</h4>
						<p class="m-0 text-[0.85rem] text-[#cbd5e1]">
							<strong class="text-white">UI:</strong> WebUI (Forge / A1111)
						</p>
						<p class="m-0 text-[0.85rem] text-[#cbd5e1]">
							<strong class="text-white">GPU Weights:</strong> 1200 MB<br /><span
								class="text-[0.75rem] text-gray-400">(สำคัญ! คุม VRAM ไม่ให้เด้ง)</span
							>
						</p>
					</div>
					<div class="flex flex-col gap-2 rounded-xl border border-white/5 bg-black/20 p-5">
						<h4
							class="m-0 mb-2 border-b border-white/10 pb-2 text-[0.95rem] font-bold text-[#818cf8]"
						>
							📦 Models & LoRA
						</h4>
						<p class="m-0 text-[0.85rem] text-[#cbd5e1]">
							<strong class="text-white">Checkpoint:</strong> PonyV6XL
						</p>
						<p class="m-0 text-[0.85rem] text-[#cbd5e1]">
							<strong class="text-white">VAE:</strong> sdxl_vae
						</p>
						<p class="m-0 text-[0.85rem] text-[#cbd5e1]">
							<strong class="text-white">LoRA:</strong>
							{loraName || 'None'} <br /><span class="text-[#ffb7b2]">(Weight: {loraWeight})</span>
						</p>
					</div>
					<div class="flex flex-col gap-2 rounded-xl border border-white/5 bg-black/20 p-5">
						<h4
							class="m-0 mb-2 border-b border-white/10 pb-2 text-[0.95rem] font-bold text-[#818cf8]"
						>
							🎛️ Gen Parameters
						</h4>
						<p class="m-0 text-[0.85rem] text-[#cbd5e1]">
							<strong class="text-white">Sampler:</strong> DPM++ 2M Karras
						</p>
						<p class="m-0 text-[0.85rem] text-[#cbd5e1]">
							<strong class="text-white">Steps:</strong> 30
						</p>
						<p class="m-0 text-[0.85rem] text-[#cbd5e1]">
							<strong class="text-white">CFG Scale:</strong> 6.5
						</p>
						<p class="m-0 text-[0.85rem] text-[#cbd5e1]">
							<strong class="text-white">Clip Skip:</strong> 2
						</p>
						<p class="m-0 text-[0.85rem] text-[#cbd5e1]">
							<strong class="text-white">Res:</strong> 832 x 1216
						</p>
						<p class="m-0 text-[0.85rem] text-[#cbd5e1]">
							<strong class="text-white">Hires. fix:</strong> OFF (ตอนเทส)
						</p>
					</div>
					<div class="flex flex-col gap-2 rounded-xl border border-white/5 bg-black/20 p-5">
						<h4
							class="m-0 mb-2 border-b border-white/10 pb-2 text-[0.95rem] font-bold text-[#818cf8]"
						>
							🚀 Mega Pack Settings
						</h4>
						<p class="m-0 text-[0.85rem] text-[#cbd5e1]">
							<strong class="text-white">Seed:</strong> -1 <br /><span
								class="text-[0.75rem] text-gray-400">(สุ่มท่าทาง/มุมกล้องใหม่)</span
							>
						</p>
						<p class="m-0 text-[0.85rem] text-[#cbd5e1]">
							<strong class="text-white">Batch count:</strong> 50 - 100
						</p>
						<p class="m-0 text-[0.85rem] text-[#cbd5e1]">
							<strong class="text-white">Batch size:</strong> 1 <br /><span
								class="text-[0.75rem] text-red-300">(ต้องเป็น 1 เสมอกัน OOM)</span
							>
						</p>
					</div>
				</div>
			{/if}
		</section>
	</main>
</div>
