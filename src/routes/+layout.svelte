<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { MenuIcon, LogOutIcon, LogInIcon } from '@lucide/svelte';
	import { AppBar } from '@skeletonlabs/skeleton-svelte';

	let { children, data } = $props();

	const user = $derived(data.user);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Hueberbewertet</title>
</svelte:head>

<AppBar>
	<AppBar.Toolbar class="grid-cols-[auto_1fr_auto]">
		<AppBar.Lead>
			<button type="button" class="btn-icon btn-icon-lg hover:preset-tonal"><MenuIcon /></button>
		</AppBar.Lead>
		<AppBar.Headline>
			<a href="/" class="text-2xl">Hueberbewertet</a>
		</AppBar.Headline>
		<AppBar.Trail>
			{#if user}
				<div class="flex items-center gap-2">
					{#if user.user_metadata?.avatar_url}
						<img src={user.user_metadata.avatar_url} alt={user.user_metadata?.full_name || 'User'} class="size-8 rounded-full" />
					{/if}
					<span class="hidden md:inline">{user.user_metadata?.full_name || user.email}</span>
					<form method="POST" action="/?/logout">
						<button type="submit" class="btn-icon hover:preset-tonal" title="Sign Out">
							<LogOutIcon class="size-6" />
						</button>
					</form>
				</div>
			{:else}
				<form method="POST" action="/?/login">
					<button type="submit" class="btn flex items-center gap-2 preset-filled-primary-500 font-semibold">
						<LogInIcon class="size-5" />
						<span>Login mit Twitch</span>
					</button>
				</form>
			{/if}
		</AppBar.Trail>
	</AppBar.Toolbar>
</AppBar>

{@render children()}
