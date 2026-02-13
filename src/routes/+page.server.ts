import { redirect } from "@sveltejs/kit";
import { PUBLIC_SITE_URL } from '$env/static/public';

export const load = async ({ locals }) => {
    const session = await locals.safeGetSession();

    // 1. Hole alle Spiele und ihre Tiers
    const { data: games } = await locals.supabase
        .from('games')
        .select('*, tiers(label, rank_order), game_tags(tag_id, tags(name))')
        .order('tier_id');

    const { data: tiers } = await locals.supabase
        .from('tiers')
        .select('*')
        .order('rank_order');

    // Hole alle Tags
    const { data: tags } = await locals.supabase
        .from('tags')
        .select('*')
        .order('name');

    // 2. Prüfe, ob der User Admin ist (für das UI)
    let isAdmin = false;
    let userVotes: Record<number, number> = {};

    if (session.user) {
        const { data: profile } = await locals.supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();
        isAdmin = profile?.role === 'admin';

        // 3. Hole die Votes des Users
        const { data: votes } = await locals.supabase
            .from('votes')
            .select('game_id, value')
            .eq('user_id', session.user.id);

        if (votes) {
            for (const vote of votes) {
                userVotes[vote.game_id] = vote.value;
            }
        }
    }

    return {
        games,
        tiers,
        tags: tags ?? [],
        isAdmin,
        userVotes,
        session: session.session,
        user: session.user
    };
};

export const actions = {
    updateTier: async ({ request, locals }) => {
        const session = await locals.safeGetSession();

        if (!session.user) {
            return { status: 401, message: "Nicht eingeloggt" };
        }

        const { data: profile } = await locals.supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();

        if (profile?.role !== 'admin') {
            return { status: 403, message: 'Nur Admins dürfen Tiers ändern' };
        }

        const formData = await request.formData();
        const gameId = formData.get('gameId');
        const newTierId = formData.get('tierId');

        if (!gameId || !newTierId) {
            return { success: false, message: 'gameId und tierId werden benötigt' };
        }

        const { error } = await locals.supabase
            .from('games')
            .update({ tier_id: Number(newTierId) })
            .eq('id', Number(gameId));

        if (error) {
            console.error('Error updating tier:', error);
            return { success: false, message: error.message };
        }

        return { success: true };
    },

    login: async ({ locals, url }) => {
        const { data, error } = await locals.supabase.auth.signInWithOAuth({
            provider: 'twitch',
            options: {
                redirectTo: `${PUBLIC_SITE_URL}/api/auth/callback`,
            },
        });

        if (error) {
            console.error(error);
            return { success: false };
        }

        if (data.url) {
            throw redirect(303, data.url);
        }
    },

    logout: async ({ locals }) => {
        const { error } = await locals.supabase.auth.signOut();
        if (error) {
            console.error(error);
        }
        throw redirect(303, '/');
    },

    addGame: async ({ request, locals }) => {
        const session = await locals.safeGetSession();

        if (!session.user) {
            return { status: 401, message: 'Nicht eingeloggt' };
        }

        const { data: profile } = await locals.supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();

        if (profile?.role !== 'admin') {
            return { success: false, message: 'Nur Admins dürfen Spiele hinzufügen' };
        }

        const formData = await request.formData();
        const name = formData.get('name') as string;
        const steamId = formData.get('steam_id') as string;
        const imageUrl = formData.get('image_url') as string;
        const tierId = formData.get('tier_id') as string;
        const igLink = formData.get('ig_link') as string;
        const ytLink = formData.get('yt_link') as string;
        const tagsJson = formData.get('tags') as string;

        if (!name) {
            return { success: false, message: 'Name fehlt' };
        }

        const { data: newGame, error } = await locals.supabase.from('games').insert({
            name,
            steam_id: steamId ? Number(steamId) : null,
            image_url: imageUrl || null,
            tier_id: tierId ? Number(tierId) : 1,
            ig_link: igLink || null,
            yt_link: ytLink || null
        }).select('id').single();

        if (error) {
            console.error('Error adding game:', error);
            return { success: false, message: error.message };
        }

        // Handle tags
        if (tagsJson && newGame) {
            const tagItems: { id?: number; name: string }[] = JSON.parse(tagsJson);
            const tagIds: number[] = [];

            for (const tag of tagItems) {
                if (tag.id) {
                    // Existing tag
                    tagIds.push(tag.id);
                } else {
                    // New tag — create it
                    const { data: newTag, error: tagError } = await locals.supabase
                        .from('tags')
                        .insert({ name: tag.name })
                        .select('id')
                        .single();

                    if (tagError) {
                        console.error('Error creating tag:', tagError);
                        continue;
                    }
                    if (newTag) {
                        tagIds.push(newTag.id);
                    }
                }
            }

            // Insert game_tags associations
            if (tagIds.length > 0) {
                const gameTagRows = tagIds.map((tagId) => ({
                    game_id: newGame.id,
                    tag_id: tagId
                }));

                const { error: gtError } = await locals.supabase
                    .from('game_tags')
                    .insert(gameTagRows);

                if (gtError) {
                    console.error('Error inserting game_tags:', gtError);
                }
            }
        }

        return { success: true };
    },

    editGame: async ({ request, locals }) => {
        const session = await locals.safeGetSession();

        if (!session.user) {
            return { status: 401, message: 'Nicht eingeloggt' };
        }

        const { data: profile } = await locals.supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();

        if (profile?.role !== 'admin') {
            return { success: false, message: 'Nur Admins dürfen Spiele bearbeiten' };
        }

        const formData = await request.formData();
        const gameId = formData.get('game_id') as string;
        const name = formData.get('name') as string;
        const steamId = formData.get('steam_id') as string;
        const imageUrl = formData.get('image_url') as string;
        const tierId = formData.get('tier_id') as string;
        const igLink = formData.get('ig_link') as string;
        const ytLink = formData.get('yt_link') as string;
        const tagsJson = formData.get('tags') as string;

        if (!gameId || !name) {
            return { success: false, message: 'gameId und Name werden benötigt' };
        }

        const { error } = await locals.supabase
            .from('games')
            .update({
                name,
                steam_id: steamId ? Number(steamId) : null,
                image_url: imageUrl || null,
                tier_id: tierId ? Number(tierId) : 1,
                ig_link: igLink || null,
                yt_link: ytLink || null
            })
            .eq('id', Number(gameId));

        if (error) {
            console.error('Error updating game:', error);
            return { success: false, message: error.message };
        }

        // Handle tags: delete existing, then re-insert
        const { error: deleteError } = await locals.supabase
            .from('game_tags')
            .delete()
            .eq('game_id', Number(gameId));

        if (deleteError) {
            console.error('Error deleting old game_tags:', deleteError);
        }

        if (tagsJson) {
            const tagItems: { id?: number; name: string }[] = JSON.parse(tagsJson);
            const tagIds: number[] = [];

            for (const tag of tagItems) {
                if (tag.id) {
                    tagIds.push(tag.id);
                } else {
                    const { data: newTag, error: tagError } = await locals.supabase
                        .from('tags')
                        .insert({ name: tag.name })
                        .select('id')
                        .single();

                    if (tagError) {
                        console.error('Error creating tag:', tagError);
                        continue;
                    }
                    if (newTag) {
                        tagIds.push(newTag.id);
                    }
                }
            }

            if (tagIds.length > 0) {
                const gameTagRows = tagIds.map((tagId) => ({
                    game_id: Number(gameId),
                    tag_id: tagId
                }));

                const { error: gtError } = await locals.supabase
                    .from('game_tags')
                    .insert(gameTagRows);

                if (gtError) {
                    console.error('Error inserting game_tags:', gtError);
                }
            }
        }

        return { success: true };
    }
};