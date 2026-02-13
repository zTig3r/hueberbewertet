import { createServerClient } from '@supabase/ssr'
import type { Handle } from '@sveltejs/kit'
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public'

export const handle: Handle = async ({ event, resolve }) => {
    // 1. Client erstellen
    event.locals.supabase = createServerClient(
        PUBLIC_SUPABASE_URL,
        PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll: () => event.cookies.getAll(),
                setAll: (cookiesToSet) => {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        event.cookies.set(name, value, { ...options, path: '/' })
                    })
                },
            },
        }
    )

    // 2. safeGetSession implementieren (ersetzt das alte getSession)
    event.locals.safeGetSession = async () => {
        const {
            data: { session },
        } = await event.locals.supabase.auth.getSession()

        if (!session) {
            return { session: null, user: null }
        }

        // Hier ist der Security-Check: Wir validieren das Token mit getUser
        const {
            data: { user },
            error,
        } = await event.locals.supabase.auth.getUser()

        if (error) {
            // Wenn das Token ungültig ist, löschen wir die Session
            return { session: null, user: null }
        }

        return { session, user }
    }

    return resolve(event, {
        filterSerializedResponseHeaders: (name) => name === 'content-range',
    })
}