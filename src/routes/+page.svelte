<script lang="ts">
	import { dndzone, TRIGGERS } from 'svelte-dnd-action';
	import { enhance } from '$app/forms';
	import { X, Search, Loader2, ChevronUp, Plus, Filter, Pencil } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type Tier = {
		id: number;
		label: string;
		rank_order: number;
		color: string;
		items: Game[];
	};

	type Game = {
		id?: string;
		steam_id: number;
		name: string;
		ig_link?: string;
		yt_link?: string;
		image_url?: string;
		upvotes?: number;
		user_vote?: number | null;
		tags?: string[];
	};

	type Tag = {
		id?: number;
		name: string;
	};

	let tiers: Tier[] = $state([]);

	// Tag filter state
	let activeFilterTags = $state<string[]>([]);

	$effect(() => {
		if (!data.tiers) {
			tiers = [];
			return;
		}

		const tierMap = new Map<number, Tier>();

		data.tiers.forEach((tier: any) => {
			tierMap.set(tier.id, {
				id: tier.id,
				label: tier.label,
				rank_order: tier.rank_order,
				color: tier.color,
				items: []
			});
		});

		if (!data.games) {
			tiers = Array.from(tierMap.values()).sort((a, b) => a.rank_order - b.rank_order);
			return;
		}

		const userVotes = data.userVotes ?? {};

		data.games.forEach((game: any) => {
			const tierId = game.tier_id || 0;
			// Extract tag names from the nested game_tags relation
			const gameTags: string[] = (game.game_tags ?? []).map((gt: any) => gt.tags?.name).filter((name: any): name is string => !!name);

			tierMap.get(tierId)?.items.push({
				id: String(game.id),
				steam_id: game.steam_id,
				name: game.name,
				image_url: game.image_url,
				ig_link: game.ig_link ?? '',
				yt_link: game.yt_link ?? '',
				upvotes: game.upvotes ?? 0,
				user_vote: userVotes[game.id] ?? null,
				tags: gameTags
			});
		});

		tiers = Array.from(tierMap.values()).sort((a, b) => a.rank_order - b.rank_order);
	});

	// Filtered tiers based on active tag filter
	let filteredTiers = $derived(() => {
		if (activeFilterTags.length === 0) return tiers;
		return tiers.map((tier) => ({
			...tier,
			items: tier.items.filter((game) => activeFilterTags.every((tag) => game.tags?.includes(tag)))
		}));
	});

	function toggleFilterTag(tagName: string) {
		if (activeFilterTags.includes(tagName)) {
			activeFilterTags = activeFilterTags.filter((t) => t !== tagName);
		} else {
			activeFilterTags = [...activeFilterTags, tagName];
		}
	}

	function clearFilterTags() {
		activeFilterTags = [];
	}

	// Add/Edit Game Modal state
	let showModal = $state(false);
	let isEditMode = $state(false);
	let editingGameId = $state<string | null>(null);
	let searchQuery = $state('');
	let searchResults = $state<Game[]>([]);
	let selectedGame = $state<Game | null>(null);
	let selectedTierId = $state<number>(0);
	let searching = $state(false);
	let searchTimeout: ReturnType<typeof setTimeout>;

	// Tag state for Add/Edit Game Modal
	let selectedTags = $state<Tag[]>([]);
	let tagInput = $state('');
	let showTagDropdown = $state(false);

	let filteredTags = $derived(() => {
		if (!tagInput.trim()) return (data.tags ?? []).filter((t: Tag) => !selectedTags.some((s) => s.id === t.id));
		const q = tagInput.toLowerCase();
		return (data.tags ?? []).filter((t: Tag) => t.name.toLowerCase().includes(q) && !selectedTags.some((s) => s.id === t.id));
	});

	let canCreateTag = $derived(() => {
		if (!tagInput.trim()) return false;
		const q = tagInput.trim().toLowerCase();
		const existsInAll = (data.tags ?? []).some((t: Tag) => t.name.toLowerCase() === q);
		const existsInSelected = selectedTags.some((t) => t.name.toLowerCase() === q);
		return !existsInAll && !existsInSelected;
	});

	function addTag(tag: Tag) {
		selectedTags = [...selectedTags, tag];
		tagInput = '';
		showTagDropdown = false;
	}

	function createAndAddTag() {
		const name = tagInput.trim();
		if (!name) return;
		addTag({ name });
	}

	function removeTag(index: number) {
		selectedTags = selectedTags.filter((_, i) => i !== index);
	}

	function handleTagBlur() {
		setTimeout(() => {
			showTagDropdown = false;
		}, 200);
	}

	// Game Detail Modal state
	let showDetailModal = $state(false);
	let detailGame = $state<Game | null>(null);
	let detailTier = $state<Tier | null>(null);

	function openModal() {
		isEditMode = false;
		editingGameId = null;
		showModal = true;
		searchQuery = '';
		searchResults = [];
		selectedGame = null;
		selectedTierId = tiers[0]?.id ?? 0;
		selectedTags = [];
		tagInput = '';
	}

	function openEditModal(game: Game) {
		isEditMode = true;
		editingGameId = game.id ?? null;

		// Find the tier this game belongs to
		const gameTier = tiers.find((t) => t.items.some((item) => item.id === game.id));

		selectedGame = {
			steam_id: game.steam_id,
			name: game.name,
			image_url: game.image_url,
			ig_link: game.ig_link ?? '',
			yt_link: game.yt_link ?? ''
		};
		selectedTierId = gameTier?.id ?? tiers[0]?.id ?? 0;

		// Resolve tags: match tag names back to full tag objects with IDs
		selectedTags = (game.tags ?? []).map((tagName) => {
			const found = (data.tags ?? []).find((t: Tag) => t.name === tagName);
			return found ? { id: found.id, name: found.name } : { name: tagName };
		});
		tagInput = '';

		searchQuery = '';
		searchResults = [];

		// Close detail modal and open edit modal
		showDetailModal = false;
		detailGame = null;
		detailTier = null;
		showModal = true;
	}

	function closeModal() {
		showModal = false;
		isEditMode = false;
		editingGameId = null;
	}

	function openDetailModal(game: Game) {
		detailGame = game;
		detailTier = tiers.find((t) => t.items.some((item) => item.id === game.id)) ?? null;
		showDetailModal = true;
	}

	function closeDetailModal() {
		showDetailModal = false;
		detailGame = null;
		detailTier = null;
	}

	function handleSearchInput() {
		clearTimeout(searchTimeout);
		if (searchQuery.length < 2) {
			searchResults = [];
			return;
		}
		searching = true;
		searchTimeout = setTimeout(async () => {
			try {
				const res = await fetch(`/api/steam-search?q=${encodeURIComponent(searchQuery)}`);
				searchResults = await res.json();
			} catch {
				searchResults = [];
			} finally {
				searching = false;
			}
		}, 400);
	}

	function selectGame(game: Game) {
		selectedGame = game;
	}

	function findGameInTiers(gameId: string): Game | null {
		for (const tier of tiers) {
			const game = tier.items.find((g) => g.id === gameId);
			if (game) return game;
		}
		return null;
	}

	async function toggleVote(e: MouseEvent, game: Game) {
		e.stopPropagation();

		if (!data.session) {
			alert('Bitte einloggen!');
			return;
		}

		const gameId = game.id;
		if (!gameId) return;

		const originalUpvotes = game.upvotes ?? 0;
		const originalVote = game.user_vote;

		if (game.user_vote === 1) {
			game.upvotes = originalUpvotes - 1;
			game.user_vote = null;
		} else {
			game.upvotes = originalUpvotes + 1;
			game.user_vote = 1;
		}

		if (detailGame && detailGame.id === gameId) {
			detailGame.upvotes = game.upvotes;
			detailGame.user_vote = game.user_vote;
		}

		tiers = [...tiers];

		try {
			const response = await fetch('/api/vote', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ gameId: Number(gameId), value: game.user_vote === 1 ? 1 : null })
			});

			if (!response.ok) {
				throw new Error('Vote failed');
			}

			const result = await response.json();
			const gameRef = findGameInTiers(gameId);
			if (gameRef) {
				gameRef.upvotes = result.upvotes;
			}
			if (detailGame && detailGame.id === gameId) {
				detailGame.upvotes = result.upvotes;
			}
			tiers = [...tiers];
		} catch {
			const gameRef = findGameInTiers(gameId);
			if (gameRef) {
				gameRef.upvotes = originalUpvotes;
				gameRef.user_vote = originalVote;
			}
			if (detailGame && detailGame.id === gameId) {
				detailGame.upvotes = originalUpvotes;
				detailGame.user_vote = originalVote;
			}
			tiers = [...tiers];
			alert('Fehler beim Voten');
		}
	}

	function handleConsider(e: { detail: { items: Game[] } }, tierIndex: number) {
		tiers[tierIndex].items = e.detail.items;
	}

	async function handleFinalize(e: { detail: { items: Game[]; info: { id: string; trigger: string } } }, tierIndex: number) {
		tiers[tierIndex].items = e.detail.items;

		if (e.detail.info.trigger !== TRIGGERS.DROPPED_INTO_ZONE) return;

		const droppedGameId = e.detail.info.id;
		const newTierId = tiers[tierIndex].id;

		const formData = new FormData();
		formData.set('gameId', droppedGameId);
		formData.set('tierId', String(newTierId));

		try {
			await fetch('?/updateTier', {
				method: 'POST',
				body: formData
			});
		} catch (err) {
			console.error('Failed to update tier:', err);
		}
	}
</script>

<!-- Add/Edit Game Modal -->
{#if showModal}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onkeydown={(e) => e.key === 'Escape' && closeModal()}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div class="absolute inset-0" onclick={closeModal}></div>

		<div class="relative z-10 w-full max-w-lg rounded-2xl border border-surface-200-800 bg-surface-900 p-6 shadow-2xl">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-xl font-bold text-white">{isEditMode ? 'Spiel bearbeiten' : 'Spiel hinzufügen'}</h2>
				<button onclick={closeModal} class="btn-icon hover:preset-tonal">
					<X class="size-5" />
				</button>
			</div>

			{#if !isEditMode}
				<div class="relative mb-4">
					<Search class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-surface-400" />
					<input
						type="text"
						placeholder="Nach Steam spielen suchen..."
						class="w-full rounded-lg border border-surface-200-800 bg-surface-800 py-2 pr-4 pl-10 text-white placeholder:text-surface-400 focus:border-primary-500 focus:outline-none"
						bind:value={searchQuery}
						oninput={handleSearchInput}
					/>
					{#if searching}
						<Loader2 class="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-surface-400" />
					{/if}
				</div>

				{#if searchResults.length > 0 && !selectedGame}
					<div class="mb-4 max-h-64 space-y-1 overflow-y-auto rounded-lg border border-surface-200-800 bg-surface-800 p-2">
						{#each searchResults as game}
							<button
								class="flex w-full items-center gap-3 rounded-lg p-2 text-left text-white transition-colors hover:bg-surface-700"
								onclick={() => selectGame(game)}
							>
								<img src={game.image_url} alt={game.name} class="h-10 w-16 rounded object-cover" />
								<span class="text-sm font-medium">{game.name}</span>
							</button>
						{/each}
					</div>
				{/if}
			{/if}

			{#if selectedGame}
				<div class="mb-4 rounded-lg border border-primary-500/40 bg-surface-800 p-4">
					<div class="flex items-center gap-4">
						<img
							src={`https://cdn.cloudflare.steamstatic.com/steam/apps/${selectedGame.steam_id}/header.jpg`}
							alt={selectedGame.name}
							class="h-14 w-24 rounded object-cover"
						/>
						<div class="flex-1">
							<p class="font-semibold text-white">{selectedGame.name}</p>
							<p class="text-xs text-surface-400">Steam ID: {selectedGame.steam_id}</p>
						</div>
						{#if !isEditMode}
							<button
								class="text-xs text-surface-400 hover:text-white"
								onclick={() => {
									selectedGame = null;
								}}
							>
								Ändern
							</button>
						{/if}
					</div>
				</div>

				<div class="mb-4">
					<label for="tier-select" class="mb-1 block text-sm text-surface-300">Tier auswählen</label>
					<select
						id="tier-select"
						bind:value={selectedTierId}
						class="w-full rounded-lg border border-surface-200-800 bg-surface-800 px-3 py-2 text-white focus:border-primary-500 focus:outline-none"
					>
						{#each tiers as tier}
							<option value={tier.id}>{tier.label}</option>
						{/each}
					</select>
				</div>

				<!-- Tags Input -->
				<div class="mb-4">
					<label for="tag-input" class="mb-1 block text-sm text-surface-300">Tags</label>

					<!-- Selected Tags -->
					{#if selectedTags.length > 0}
						<div class="mb-2 flex flex-wrap gap-1.5">
							{#each selectedTags as tag, i}
								<span class="inline-flex items-center gap-1 rounded-full bg-primary-500/20 px-2.5 py-1 text-xs font-medium text-primary-400">
									{tag.name}
									<button type="button" onclick={() => removeTag(i)} class="hover:text-white">
										<X class="size-3" />
									</button>
								</span>
							{/each}
						</div>
					{/if}

					<!-- Tag Search Input -->
					<div class="relative">
						<input
							type="text"
							id="tag-input"
							placeholder="Tag suchen oder erstellen..."
							class="w-full rounded-lg border border-surface-200-800 bg-surface-800 px-3 py-2 text-white placeholder:text-surface-400 focus:border-primary-500 focus:outline-none"
							bind:value={tagInput}
							onfocus={() => (showTagDropdown = true)}
							onblur={handleTagBlur}
							onkeydown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									if (canCreateTag()) {
										createAndAddTag();
									} else if (filteredTags().length > 0) {
										addTag(filteredTags()[0]);
									}
								}
							}}
						/>

						<!-- Tag Dropdown -->
						{#if showTagDropdown && (filteredTags().length > 0 || canCreateTag())}
							<div class="absolute z-20 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-surface-200-800 bg-surface-800 p-1 shadow-lg">
								{#each filteredTags() as tag}
									<button
										type="button"
										class="flex w-full items-center rounded-md px-3 py-1.5 text-left text-sm text-white transition-colors hover:bg-surface-700"
										onclick={() => addTag(tag)}
									>
										{tag.name}
									</button>
								{/each}
								{#if canCreateTag()}
									<button
										type="button"
										class="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm text-primary-400 transition-colors hover:bg-surface-700"
										onclick={createAndAddTag}
									>
										<Plus class="size-3.5" />
										<span>"{tagInput.trim()}" erstellen</span>
									</button>
								{/if}
							</div>
						{/if}
					</div>
				</div>

				<div class="mb-4">
					<label for="instant-gaming-link" class="mb-1 block text-sm text-surface-300">Instant Gaming Link</label>
					<input
						type="text"
						id="instant-gaming-link"
						name="ig_link"
						bind:value={selectedGame.ig_link}
						class="w-full rounded-lg border border-surface-200-800 bg-surface-800 px-3 py-2 text-white focus:border-primary-500 focus:outline-none"
					/>
				</div>

				<div class="mb-4">
					<label for="youtube-link" class="mb-1 block text-sm text-surface-300">YouTube Link</label>
					<input
						type="text"
						id="youtube-link"
						name="yt_link"
						bind:value={selectedGame.yt_link}
						class="w-full rounded-lg border border-surface-200-800 bg-surface-800 px-3 py-2 text-white focus:border-primary-500 focus:outline-none"
					/>
				</div>

				<form
					method="POST"
					action={isEditMode ? '?/editGame' : '?/addGame'}
					use:enhance={() => {
						return async ({ update }) => {
							await update();
							closeModal();
						};
					}}
				>
					{#if isEditMode && editingGameId}
						<input type="hidden" name="game_id" value={editingGameId} />
					{/if}
					<input type="hidden" name="name" value={selectedGame.name} />
					<input type="hidden" name="steam_id" value={selectedGame.steam_id} />
					<input type="hidden" name="image_url" value={selectedGame.image_url} />
					<input type="hidden" name="tier_id" value={selectedTierId} />
					<input type="hidden" name="ig_link" value={selectedGame.ig_link} />
					<input type="hidden" name="yt_link" value={selectedGame.yt_link} />
					<input type="hidden" name="tags" value={JSON.stringify(selectedTags)} />
					<button type="submit" class="btn w-full preset-filled-primary-500 font-semibold">
						{isEditMode ? 'Speichern' : 'Add Game'}
					</button>
				</form>
			{/if}

			{#if !isEditMode && !selectedGame && searchResults.length === 0 && searchQuery.length >= 2 && !searching}
				<p class="text-center text-sm text-surface-400">Kein Spiel gefunden.</p>
			{/if}
		</div>
	</div>
{/if}

<!-- Game Detail Modal -->
{#if showDetailModal && detailGame}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onkeydown={(e) => e.key === 'Escape' && closeDetailModal()}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div class="absolute inset-0" onclick={closeDetailModal}></div>

		<div class="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-surface-200-800 bg-surface-900 shadow-2xl">
			<!-- Header Image -->
			<div class="relative">
				<img src="https://cdn.cloudflare.steamstatic.com/steam/apps/{detailGame.steam_id}/header.jpg" alt={detailGame.name} class="h-56 w-full object-cover" />
				<button onclick={closeDetailModal} class="absolute top-3 right-3 btn-icon bg-black/50 hover:bg-black/70">
					<X class="size-5 text-white" />
				</button>
			</div>

			<!-- Content -->
			<div class="p-6">
				<div class="flex items-center justify-between">
					<h2 class="mb-1 text-2xl font-bold text-white">{detailGame.name}</h2>
					<div class="flex items-center gap-2">
						{#if data.isAdmin}
							<button
								class="flex items-center gap-1.5 rounded-lg bg-surface-800 px-3 py-1.5 text-surface-400 transition-colors hover:bg-surface-700 hover:text-white"
								onclick={() => openEditModal(detailGame!)}
								title="Spiel bearbeiten"
							>
								<Pencil class="size-4" />
							</button>
						{/if}
						<!-- Upvote in detail modal -->
						<button
							class="flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 transition-colors {detailGame.user_vote === 1
								? 'bg-primary-500/20 text-primary-400'
								: 'bg-surface-800 text-surface-400 hover:bg-surface-700 hover:text-white'}"
							onclick={(e) => toggleVote(e, detailGame!)}
						>
							<ChevronUp class="size-5" />
							<span class="text-sm font-bold">{detailGame.upvotes ?? 0}</span>
						</button>
					</div>
				</div>

				<!-- Tags in Detail Modal -->
				{#if detailGame.tags && detailGame.tags.length > 0}
					<div class="mt-2 flex flex-wrap gap-1.5">
						{#each detailGame.tags as tag}
							<span class="rounded-full bg-surface-700 px-2.5 py-0.5 text-xs font-medium text-surface-300">
								{tag}
							</span>
						{/each}
					</div>
				{/if}

				<!-- Tier Badge -->
				{#if detailTier}
					<div class="mt-3 flex items-center gap-2">
						<span class="text-sm text-surface-400">Tier:</span>
						<span class="rounded-md px-3 py-1 text-sm font-bold text-white" style="background-color: {detailTier.color || '#6b7280'};">
							{detailTier.label}
						</span>
					</div>
				{/if}

				<!-- Info Grid -->
				<div class="mt-4 grid grid-cols-2 gap-3">
					<div class="rounded-lg bg-surface-800 p-3">
						<p class="text-xs text-surface-400">Steam ID</p>
						<p class="font-mono text-sm text-white">{detailGame.steam_id}</p>
					</div>
					<div class="rounded-lg bg-surface-800 p-3">
						<p class="text-xs text-surface-400">Hinzugefügt</p>
						<p class="text-sm text-white">{new Date().toLocaleDateString('de-DE')}</p>
					</div>
				</div>

				<!-- Actions -->
				<div class="mt-5 flex gap-3">
					<a
						href="https://store.steampowered.com/app/{detailGame.steam_id}"
						target="_blank"
						rel="noopener noreferrer"
						class="btn flex-1 preset-filled-primary-500 font-semibold"
					>
						Steam
					</a>

					<a href={detailGame.ig_link} target="_blank" rel="noopener noreferrer" class="btn flex-1 preset-filled-primary-500 font-semibold"> Instant Gaming </a>

					<a href={detailGame.yt_link} target="_blank" rel="noopener noreferrer" class="btn flex-1 preset-filled-primary-500 font-semibold"> YouTube </a>
					<button onclick={closeDetailModal} class="btn preset-tonal-surface font-semibold"> Schließen </button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Tag Filter Bar -->
{#if (data.tags ?? []).length > 0}
	<div class="mx-50 mt-5 flex flex-wrap items-center gap-2">
		<div class="flex items-center gap-1.5 text-sm text-surface-400">
			<Filter class="size-4" />
			<span>Filter:</span>
		</div>
		{#each data.tags as tag}
			<button
				class="rounded-full px-3 py-1 text-xs font-medium transition-colors {activeFilterTags.includes(tag.name)
					? 'bg-primary-500 text-white'
					: 'bg-surface-800 text-surface-300 hover:bg-surface-700 hover:text-white'}"
				onclick={() => toggleFilterTag(tag.name)}
			>
				{tag.name}
			</button>
		{/each}
		{#if activeFilterTags.length > 0}
			<button
				class="flex items-center gap-1 rounded-full bg-surface-700 px-2.5 py-1 text-xs text-surface-300 hover:bg-surface-600 hover:text-white"
				onclick={clearFilterTags}
			>
				<X class="size-3" />
				Alle zurücksetzen
			</button>
		{/if}
	</div>
{/if}

<!-- Tier List -->
<div class="mx-50 my-5 space-y-4">
	{#each filteredTiers() as tier, i}
		<div class="flex w-full items-start gap-4 rounded-xl border-2 p-4" style="border-color: {tier.color || '#6b7280'};">
			<div class="w-20 self-center rounded-lg p-2 text-center text-xl font-bold text-white" style="background-color: {tier.color || '#6b7280'}33;">
				{tier.label}
			</div>

			<div
				use:dndzone={{ items: tier.items, flipDurationMs: 200, dragDisabled: !data.isAdmin, morphDisabled: true }}
				onconsider={(e) => handleConsider(e, i)}
				onfinalize={(e) => handleFinalize(e, i)}
				class="flex min-h-25 w-full flex-wrap gap-4"
			>
				{#each tier.items as game (game.id)}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="block max-w-md cursor-pointer divide-y divide-surface-200-800 overflow-hidden card border border-surface-200-800 preset-filled-surface-100-900 card-hover"
						onclick={() => openDetailModal(game)}
					>
						<header>
							<img src="https://cdn.cloudflare.steamstatic.com/steam/apps/{game.steam_id}/header.jpg" class="h-44 w-full" alt={game.name} />
						</header>
						<div class="space-y-2 p-4">
							<h4 class="h4">{game.name}</h4>
							{#if game.tags && game.tags.length > 0}
								<div class="flex flex-wrap gap-1">
									{#each game.tags as tag}
										<span class="rounded-full bg-surface-700 px-2 py-0.5 text-[10px] font-medium text-surface-300">
											{tag}
										</span>
									{/each}
								</div>
							{/if}
						</div>
						<footer class="flex items-center justify-between gap-4 p-4">
							<button
								class="flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition-colors {game.user_vote === 1
									? 'bg-primary-500/20 text-primary-400'
									: 'bg-surface-800 text-surface-400 hover:bg-surface-700 hover:text-white'}"
								onclick={(e) => toggleVote(e, game)}
							>
								<ChevronUp class="size-4" />
								<span class="text-sm font-bold">{game.upvotes ?? 0}</span>
							</button>
							<small class="opacity-60">{new Date().toLocaleDateString()}</small>
						</footer>
					</div>
				{/each}
			</div>
		</div>
	{/each}

	{#if data.isAdmin}
		<button class="btn preset-filled-primary-500 font-semibold" onclick={openModal}> Spiel hinzufügen </button>
	{/if}
</div>
