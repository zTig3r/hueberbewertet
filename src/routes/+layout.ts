import { createBrowserClient, createServerClient, isBrowser } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ data, depends, fetch }) => {
    /**
     * Declare a dependency so the layout can be invalidated
     * when `invalidate('supabase:auth')` is called.
     */
    depends('supabase:auth');

    const supabase = isBrowser()
        ? createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
            global: { fetch }
        })
        : createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
            global: { fetch },
            cookies: {
                getAll() {
                    return data.session ? [] : [];
                }
            }
        });

    /**
     * It's fine to use `getSession` here because on the client, `getSession` is
     * safe and on the server, the session was already validated in `hooks.server.ts`.
     */
    const {
        data: { session }
    } = await supabase.auth.getSession();

    return { session, supabase, user: data.user };
};