import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import {
    getAuth,
    GoogleAuthProvider,
    getRedirectResult,
    signOut,
    onAuthStateChanged,
    setPersistence,
    browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import {
    getFirestore,
    collection,
    doc,
    setDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    addDoc
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";


// Firebase Configuration FOR DEMO PURPOSES ONLY /// TO BE DELETED 01/05/2025


import { LINKEDIN_CONFIG, initializeLinkedInAuth, shareToLinkedIn } from './linkedin-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let selectedText = "";
(async () => {
    try {
        await setPersistence(auth, browserLocalPersistence);
        console.log('Firebase persistence set to LOCAL');
    } catch (error) {
        console.error('Error setting persistence:', error);
    }
})();

// Add this near the top after Firebase initialization
// Startup check for existing authentication
chrome.runtime.onStartup.addListener(() => {
    console.log("Extension starting up, checking auth state...");
    checkExistingAuth();
});

chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension installed/updated, checking auth state...");
    checkExistingAuth();
});

async function checkExistingAuth() {
    try {
        const token = await new Promise(resolve =>
            chrome.identity.getAuthToken({ interactive: false }, resolve)
        );

        if (token) {
            console.log("Existing token found");
            // Validate the token
            const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.ok) {
                const userInfo = await response.json();
                await storeUserData({
                    uid: userInfo.sub,
                    email: userInfo.email,
                    displayName: userInfo.name,
                    photoURL: userInfo.picture
                });
            }
        }
    } catch (error) {
        console.error("Error checking existing auth:", error);
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
        case "checkRedirectResult":
            handleRedirectResult(sendResponse);
            return true;
        case "logout":
            handleLogout(sendResponse);
            return true;
        case "storeUserData":
            // Create an async function and execute it immediately
            (async () => {
                try {
                    const userData = message.userData;
                    const userRef = doc(db, 'accounts', userData.uid);
                    await setDoc(userRef, {
                        email: userData.email || '',
                        displayName: userData.displayName || '',
                        photoURL: userData.photoURL || '',
                        lastLogin: serverTimestamp(),
                        createdAt: serverTimestamp() // This will only be set on first creation
                    }, { merge: true });

                    console.log('User data stored successfully in Firestore');
                    sendResponse({ success: true });
                } catch (error) {
                    console.error('Error storing user data:', error);
                    sendResponse({ success: false, error: error.message });
                }
            })();
            return true;
        case "checkAuthStatus":
            console.log("Checking auth status in background...");
            (async () => {
                try {
                    // Get a fresh token
                    const token = await new Promise(resolve =>
                        chrome.identity.getAuthToken({ interactive: false }, resolve)
                    );

                    if (token) {
                        try {
                            // Get user info from Google
                            const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                                headers: { Authorization: `Bearer ${token}` }
                            });

                            if (response.ok) {
                                const userInfo = await response.json();
                                sendResponse({
                                    isAuthenticated: true,
                                    user: {
                                        email: userInfo.email,
                                        displayName: userInfo.name,
                                        uid: userInfo.sub,
                                        given_name: userInfo.given_name,
                                        picture: userInfo.picture
                                    }
                                });
                            } else {
                                throw new Error('Failed to get user info');
                            }
                        } catch (error) {
                            console.log("Token validation failed:", error);
                            // Try to refresh the token
                            await chrome.identity.removeCachedAuthToken({ token });
                            sendResponse({ isAuthenticated: false });
                        }
                    } else {
                        console.log("No token found");
                        sendResponse({ isAuthenticated: false });
                    }
                } catch (error) {
                    console.error('Auth check error:', error);
                    sendResponse({ isAuthenticated: false, error: error.message });
                }
            })();
            return true;

        case "saveToDocs":
            console.log("Handling saveToDocs request...");
            // Get a fresh token for Google Docs API
            chrome.identity.getAuthToken({ interactive: true }, async (token) => {
                if (chrome.runtime.lastError || !token) {
                    console.error("Token error:", chrome.runtime.lastError);
                    sendResponse({
                        success: false,
                        error: "Authentication failed. Please sign in again."
                    });
                    return;
                }

                try {
                    const result = await handleDocsSave(message.data, token);
                    sendResponse(result);
                } catch (error) {
                    console.error('Save to Docs error:', error);
                    sendResponse({
                        success: false,
                        error: error.message
                    });
                }
            });
            return true;
        case 'openAuthPopup':
            // Trigger sign-in flow
            chrome.identity.getAuthToken({ interactive: true }, (token) => {
                if (chrome.runtime.lastError) {
                    console.error('Auth error:', chrome.runtime.lastError);
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    console.log('Auth token obtained');
                    sendResponse({ success: true });
                }
            });
            return true;
        case 'sendToPopup':
            selectedText = message.text;
            console.log("Stored text:", selectedText);
            sendResponse({ success: true });
            return true;

        case 'getSelectedText':
            sendResponse({ text: selectedText });
            return true;
        case "storeSummary":
            (async () => {
                try {
                    const { text, title, url } = message.summary;

                    // Get token instead of checking auth.currentUser
                    const token = await new Promise(resolve =>
                        chrome.identity.getAuthToken({ interactive: false }, resolve)
                    );

                    if (!token) {
                        throw new Error('User not authenticated');
                    }

                    // Get user info
                    const userResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    const userInfo = await userResponse.json();

                    const summaryRef = collection(db, 'summaries');
                    const newSummary = {
                        text,
                        title: title || 'Untitled Summary',
                        url: url || '',
                        userId: userInfo.sub,  // Use Google user ID
                        createdAt: serverTimestamp()
                    };

                    await addDoc(summaryRef, newSummary);
                    console.log('Summary stored successfully');
                    sendResponse({ success: true });
                } catch (error) {
                    console.error('Error storing summary:', error);
                    sendResponse({ success: false, error: error.message });
                }
            })();
            return true;

        case "fetchSummaries":
            (async () => {
                try {
                    // Get current user token
                    const token = await new Promise(resolve =>
                        chrome.identity.getAuthToken({ interactive: false }, resolve)
                    );

                    if (!token) {
                        throw new Error('User not authenticated');
                    }

                    // Get user info
                    const userResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    const userInfo = await userResponse.json();

                    // Query Firestore
                    const summariesRef = collection(db, 'summaries');
                    const q = query(
                        summariesRef,
                        where('userId', '==', userInfo.sub),
                        // orderBy('createdAt', 'desc'),
                        // limit(10)  
                        //composite index for your query because you're using both where and orderBy together.
                    );

                    const querySnapshot = await getDocs(q);
                    const summaries = [];
                    querySnapshot.forEach((doc) => {
                        summaries.push({
                            id: doc.id,
                            ...doc.data(),
                            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
                        });
                    });

                    console.log('Fetched summaries:', summaries);
                    sendResponse({ success: true, summaries });
                } catch (error) {
                    console.error('Error fetching summaries:', error);
                    sendResponse({ success: false, error: error.message });
                }
            })();
            return true;
        default:
            console.error("Unhandled action:", message.action);
            sendResponse({ success: false, error: "Unknown action" });
            return true;
    }
});
// Add this function to handle user data storage
async function storeUserData(user) {
    try {
        const userRef = doc(db, 'accounts', user.uid);
        await setDoc(userRef, {
            email: user.email || '',
            displayName: user.displayName || '',
            photoURL: user.photoURL || '',
            lastLogin: serverTimestamp(),
            createdAt: serverTimestamp() // This will only be set on first creation
        }, { merge: true }); // merge: true ensures we don't overwrite existing data

        console.log('User data stored successfully');
    } catch (error) {
        console.error('Error storing user data:', error);
    }
}


// Update the auth state listener
auth.onAuthStateChanged(async (user) => {
    console.log("Auth state changed:", user ? "logged in" : "logged out");

    try {
        // Notify any open popups about the auth state change
        chrome.runtime.sendMessage({
            action: 'authStateChanged',
            user: user ? {
                email: user.email,
                displayName: user.displayName,
                uid: user.uid
            } : null
        }).catch(() => {
            // Ignore errors if no listeners
            console.log("No active listeners for auth state change");
        });

        if (user) {
            await storeUserData(user);
        }
    } catch (error) {
        console.error("Error in auth state change handler:", error);
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Message received in background script:', message);

    if (message.action === 'processText') {
        const { text, action } = message.data || {};

        if (action === 'Summarize') {
            console.log('Processing text with Summarize action:', text.slice(0, 50));
            const summary = `Processed chunk: ${text.slice(0, 50)}...`; // Simulate summary
            sendResponse({ success: true, text: summary });
        } else {
            console.warn('Unknown action in processText:', action);
            sendResponse({ success: false, error: 'Unknown action' });
        }

        return true; // Async response
    }
});
async function refreshAuthToken() {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: false }, async (token) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                return;
            }

            try {
                // Remove the old token
                await chrome.identity.removeCachedAuthToken({ token });
                // Get a fresh token
                chrome.identity.getAuthToken({ interactive: false }, (newToken) => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(newToken);
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    });
}

// Handle Redirect Result
async function handleRedirectResult(sendResponse) {
    try {
        const result = await getRedirectResult(auth);
        if (result && result.user) {
            console.log("User retrieved:", result.user);
            sendResponse({
                success: true,
                user: {
                    displayName: result.user.displayName || "No Name",
                    email: result.user.email || "No Email",
                },
            });
        } else {
            console.log("No user information found after redirect.");
            sendResponse({ success: false, error: "No user information found." });
        }
    } catch (error) {
        console.error("Error during redirect result handling:", error.message);
        sendResponse({ success: false, error: error.message });
    }
}
async function handleDocsSave(data, token) {
    console.log("Starting Doc save with token:", token ? "present" : "missing");

    try {
        // Create new document
        const createResponse = await fetch('https://docs.googleapis.com/v1/documents', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                title: data.title
            })
        });

        if (!createResponse.ok) {
            throw new Error(`Failed to create document: ${createResponse.statusText}`);
        }

        const doc = await createResponse.json();
        console.log("Document created:", doc);

        // Update document content
        const updateResponse = await fetch(`https://docs.googleapis.com/v1/documents/${doc.documentId}:batchUpdate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                requests: [{
                    insertText: {
                        location: { index: 1 },
                        text: data.content
                    }
                }]
            })
        });

        if (!updateResponse.ok) {
            throw new Error(`Failed to update document: ${updateResponse.statusText}`);
        }

        return {
            success: true,
            docUrl: `https://docs.google.com/document/d/${doc.documentId}/edit`,
            documentId: doc.documentId
        };
    } catch (error) {
        console.error("Doc save error:", error);
        throw error;
    }
}
// Handle Logout
async function handleLogout(sendResponse) {
    try {
        // Remove the auth token first
        const token = await new Promise(resolve =>
            chrome.identity.getAuthToken({ interactive: false }, resolve)
        );

        if (token) {
            // Remove token from Chrome's cache
            await chrome.identity.removeCachedAuthToken({ token });

            // Revoke access (optional but recommended)
            try {
                await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`);
            } catch (error) {
                console.warn('Token revocation failed:', error);
                // Continue with logout even if revocation fails
            }
        }

        // Clear Firebase auth state
        auth.currentUser = null;

        console.log("User signed out successfully.");
        sendResponse({ success: true });

        // Notify any open popups about the auth state change
        try {
            chrome.runtime.sendMessage({
                action: 'authStateChanged',
                user: null
            });
        } catch (error) {
            console.log("No active listeners for auth state change");
        }
    } catch (error) {
        console.error("Error during logout:", error.message);
        sendResponse({ success: false, error: error.message });
    }
}
// LinkedIn auth handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'checkLinkedInAuth') {
        // Check for existing token
        chrome.storage.local.get(['linkedInToken'], result => {
            sendResponse({
                isAuthenticated: !!result.linkedInToken,
                success: true
            });
        });
        return true;
    }

    if (message.action === 'openLinkedInAuth') {
        initializeLinkedInAuth()
            .then(code => {
                sendResponse({ success: true, code });
            })
            .catch(error => {
                console.error('LinkedIn auth error:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }

    if (message.action === 'shareToLinkedIn') {
        const { summary, title, url } = message.data;
        console.log('Sharing to LinkedIn:', { summary, title, url });

        shareToLinkedIn(summary, title, url)
            .then(result => {
                console.log('LinkedIn share result:', result);
                sendResponse({ success: true, result });
            })
            .catch(error => {
                console.error('LinkedIn sharing error:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }
});
