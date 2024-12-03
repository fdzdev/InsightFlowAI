export const LINKEDIN_CONFIG = {
    CLIENT_ID: '8668be7mw0ci5k',
    REDIRECT_URI: 'http://localhost:3000/linkedin/callback',
    API_BASE_URL: 'http://localhost:3000/api/linkedin',
    // Updated scopes for LinkedIn API v2
    SCOPES: ['openid', 'profile', 'email', 'w_member_social']
};

export async function shareToLinkedIn(summary, title, url) {
    try {
        // Create the content to be shared
        const content = `${summary}\n\nOriginal article: ${title}\n${url}`;

        // Create state object
        const stateObj = {
            content: content,
            timestamp: Date.now()
        };

        // Encode state as base64
        const state = btoa(JSON.stringify(stateObj));

        // Construct LinkedIn OAuth URL
        const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
        authUrl.searchParams.append('response_type', 'code');
        authUrl.searchParams.append('client_id', LINKEDIN_CONFIG.CLIENT_ID);
        authUrl.searchParams.append('redirect_uri', LINKEDIN_CONFIG.REDIRECT_URI);
        authUrl.searchParams.append('state', state);
        authUrl.searchParams.append('scope', LINKEDIN_CONFIG.SCOPES.join(' '));

        console.log('Starting auth flow with URL:', authUrl.toString());

        // Launch auth flow
        const redirectUrl = await chrome.identity.launchWebAuthFlow({
            url: authUrl.toString(),
            interactive: true
        });

        if (!redirectUrl) {
            throw new Error('No redirect URL received');
        }

        return { success: true };
    } catch (error) {
        console.error('LinkedIn sharing error:', error);
        throw error;
    }
}

export async function initializeLinkedInAuth() {
    try {
        const responseType = 'code';
        const scope = encodeURIComponent(LINKEDIN_CONFIG.SCOPES.join(' '));
        const state = Math.random().toString(36).substring(7);

        const authUrl = `https://www.linkedin.com/oauth/v2/authorization?` +
            `response_type=${responseType}` +
            `&client_id=${LINKEDIN_CONFIG.CLIENT_ID}` +
            `&redirect_uri=${encodeURIComponent(LINKEDIN_CONFIG.REDIRECT_URI)}` +
            `&state=${state}` +
            `&scope=${scope}`;

        console.log('Starting auth flow with URL:', authUrl);

        const redirectUrl = await chrome.identity.launchWebAuthFlow({
            url: authUrl,
            interactive: true
        });

        console.log('Received redirect URL:', redirectUrl);

        if (!redirectUrl) {
            throw new Error('No redirect URL received');
        }

        // Extract the authorization code from the redirect URL
        const url = new URL(redirectUrl);
        const code = url.searchParams.get('code');

        if (!code) {
            throw new Error('No authorization code received');
        }

        return code;

    } catch (error) {
        console.error('LinkedIn auth error:', error);
        throw error;
    }
} 