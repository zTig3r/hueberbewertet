import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
    const session = await locals.safeGetSession();

    if (!session.user) {
        return json({ error: 'Nicht eingeloggt' }, { status: 401 });
    }

    const { gameId, value } = await request.json();

    if (!gameId) {
        return json({ error: 'gameId fehlt' }, { status: 400 });
    }

    const userId = session.user.id;

    if (value === null || value === undefined) {
        // Remove vote
        const { error } = await locals.supabase
            .from('votes')
            .delete()
            .eq('game_id', gameId)
            .eq('user_id', userId);

        if (error) {
            console.error('Error removing vote:', error);
            return json({ error: error.message }, { status: 500 });
        }
    } else {
        // Upsert vote (insert or update)
        const { error } = await locals.supabase
            .from('votes')
            .upsert(
                { game_id: gameId, user_id: userId, value: 1 },
                { onConflict: 'game_id,user_id' }
            );

        if (error) {
            console.error('Error upserting vote:', error);
            return json({ error: error.message }, { status: 500 });
        }
    }

    // Recalculate upvotes for this game
    const { count } = await locals.supabase
        .from('votes')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', gameId);

    const { error: updateError } = await locals.supabase
        .from('games')
        .update({ upvotes: count ?? 0 })
        .eq('id', gameId);

    if (updateError) {
        console.error('Error updating upvotes count:', updateError);
    }

    return json({ success: true, upvotes: count ?? 0 });
};