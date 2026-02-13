import { redirect } from '@sveltejs/kit';

export const actions = {
    login: async ({ locals, url }) => {
        const { data, error } = await locals.supabase.auth.signInWithOAuth({
            provider: 'twitch',
            options: {
                redirectTo: `${url.origin}/auth/callback`,
            },
        });

        if (data.url) {
            throw redirect(303, data.url);
        }
    },
};