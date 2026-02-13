import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
    const query = url.searchParams.get('q');
    if (!query || query.length < 2) {
        return json([]);
    }

    // Use the Steam Store search API
    const res = await fetch(
        `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=english&cc=US`
    );

    if (!res.ok) {
        return json([], { status: 502 });
    }

    const data = await res.json();

    const results = (data.items ?? []).map((item: any) => ({
        steam_id: item.id,
        name: item.name,
        image_url: item.tiny_image // small capsule image from Steam
    }));

    return json(results);
};