import { handleGoogleSignIn, checkRedirectResult, checkAuthStatus } from "./firebase-config.js";

// Declare elements at the top level
let elements;


document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM Content Loaded');

    // DOM Elements
    elements = {
        auth: {
            signInButton: document.getElementById('signInButton'),
            logoutButton: document.getElementById('logoutButton'),
            authContainer: document.getElementById('authContainer'),
            appContainer: document.getElementById('appContainer'),
            userInfo: document.getElementById('userInfo'),
            errorMessage: document.getElementById('errorMessage')
        },
        app: {
            summaryButton: document.getElementById('summaryButton'),
            insightsButton: document.getElementById('insightsButton'),
            chartButton: document.getElementById('chartButton'),
            selectedText: document.getElementById('selectedText'),
            addToDoc: document.getElementById('addToDoc')
        },
        history: {
            historyList: document.getElementById('historyList'),
            clearHistoryBtn: document.getElementById('clearHistoryBtn')
        }
    };

    // Store original button HTML
    const originalSignInButtonHTML = elements.auth.signInButton?.innerHTML;

    // Check Authentication Status
    try {
        const authStatus = await checkAuthStatus();
        console.log('Auth status received:', authStatus);
        if (authStatus.isAuthenticated && authStatus.user) {
            updateUIForUser(authStatus.user);
        } else {
            updateUIForUser(null);
        }
    } catch (error) {
        console.log("Initial auth check failed:", error.message);
        try {
            const redirectUser = await checkRedirectResult();
            if (redirectUser) {
                updateUIForUser(redirectUser);
            } else {
                updateUIForUser(null);
            }
        } catch (redirectError) {
            console.log("No redirect result:", redirectError.message);
            updateUIForUser(null);
        }
    }


    // Add auth state change listener
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'authStateChanged' && message.user) {
            console.log('Auth state changed received:', message.user);
            updateUIForUser(message.user);
        }
    });


    // Sign-In Handler
    if (elements.auth.signInButton) {
        elements.auth.signInButton.addEventListener("click", async () => {
            console.log("Sign in button clicked");
            try {
                elements.auth.signInButton.disabled = true;
                elements.auth.signInButton.innerHTML = `<span class="google-text">Signing in...</span>`;
                const userInfo = await handleGoogleSignIn();
                updateUIForUser(userInfo);
            } catch (error) {
                console.error("Sign in error:", error);
                elements.auth.errorMessage.textContent = error.message;
                elements.auth.errorMessage.style.display = "block";
            } finally {
                elements.auth.signInButton.disabled = false;
                elements.auth.signInButton.innerHTML = originalSignInButtonHTML;
            }
        });
    }

    // Sign-Out Handler
    if (elements.auth.logoutButton) {
        elements.auth.logoutButton.addEventListener("click", async () => {
            console.log("Logout button clicked");
            elements.auth.logoutButton.disabled = true;

            try {
                const response = await chrome.runtime.sendMessage({ action: "logout" });
                console.log("Logout response:", response);

                if (response.success) {
                    console.log("Logout successful, updating UI");
                    updateUIForUser(null);
                    // Clear any local state
                    elements.app.selectedText.value = '';
                    elements.history.historyList.innerHTML = '';
                } else {
                    throw new Error(response.error || 'Logout failed');
                }
            } catch (error) {
                console.error("Logout error:", error);
                elements.auth.errorMessage.textContent = "Failed to sign out. Please try again.";
                elements.auth.errorMessage.style.display = "block";
            } finally {
                elements.auth.logoutButton.disabled = false;
            }
        });
    }
    // Summary button
    elements.app.summaryButton?.addEventListener('click', async () => {
        const text = elements.app.selectedText.value;
        if (!text.trim()) {
            elements.auth.errorMessage.textContent = 'Please enter some text to summarize';
            elements.auth.errorMessage.style.display = 'block';
            return;
        }

        elements.app.summaryButton.disabled = true;
        elements.app.summaryButton.textContent = 'Summarizing...';

        try {
            const result = await textProcessing.handleSummarization(text);

            if (result.success) {
                elements.app.selectedText.value = result.summary;

                // Store the summary in Firestore
                await chrome.runtime.sendMessage({
                    action: 'storeSummary',
                    summary: {
                        text: result.summary,
                        title: 'Summary ' + new Date().toLocaleDateString()
                    }
                });

                // Refresh the history display
                loadSummaryHistory();
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            elements.auth.errorMessage.textContent = error.message;
            elements.auth.errorMessage.style.display = 'block';
        } finally {
            elements.app.summaryButton.disabled = false;
            elements.app.summaryButton.textContent = 'Create Summary';
        }
    });

    // Google Docs save handler
    elements.app.addToDoc?.addEventListener('click', async () => {
        try {
            // First check if there's text to save
            const text = elements.app.selectedText.value;
            if (!text) {
                throw new Error('No text selected');
            }

            // Show loading state
            const originalButtonText = elements.app.addToDoc.textContent;
            elements.app.addToDoc.disabled = true;
            elements.app.addToDoc.textContent = 'Saving...';

            // Check authentication status with debug logs
            console.log("Checking auth status...");
            const authStatus = await chrome.runtime.sendMessage({ action: 'checkAuthStatus' });
            console.log("Auth status response:", authStatus);

            if (!authStatus?.isAuthenticated) {
                throw new Error('Please sign in to save to Google Docs');
            }

            // Try to save to Google Docs
            console.log("Attempting to save to Google Docs...");
            const result = await chrome.runtime.sendMessage({
                action: 'saveToDocs',
                data: {
                    title: 'InsightFlow Summary',
                    content: text
                }
            });
            console.log("Save to Docs result:", result);

            if (result.success) {
                window.open(result.docUrl, '_blank');
                elements.auth.errorMessage.style.display = 'none';
            } else {
                throw new Error(result.error || 'Failed to save to Google Docs');
            }
        } catch (error) {
            console.error('Save to Docs error:', error);
            elements.auth.errorMessage.textContent = error.message;
            elements.auth.errorMessage.style.display = 'block';
        } finally {
            // Reset button state
            if (elements.app.addToDoc) {
                elements.app.addToDoc.disabled = false;
                elements.app.addToDoc.textContent = originalButtonText;
            }
        }
    });
    elements.history.clearHistoryBtn?.addEventListener('click', async () => {
        if (confirm('Are you sure you want to clear all summaries? This cannot be undone.')) {
            try {
                await chrome.runtime.sendMessage({ action: 'clearSummaries' });
                loadSummaryHistory(); // Reload the empty history
            } catch (error) {
                console.error('Error clearing history:', error);
            }
        }
    });
});


function updateUIForUser(user) {
    console.log('updateUIForUser called with:', user);

    if (!elements) {
        console.error('Elements not initialized yet');
        return;
    }

    if (user) {
        console.log('Updating UI for logged in user:', user);
        elements.auth.authContainer.style.display = "none";
        elements.auth.appContainer.style.display = "block";

        // Create user info HTML with picture and first name
        const firstName = user.given_name || user.displayName?.split(' ')[0] || user.email?.split('@')[0];
        elements.auth.userInfo.innerHTML = `
            <div class="user-info-container">
                <img src="${user.picture}" alt="Profile" class="profile-pic">
                <span>Signed in as ${firstName}</span>
            </div>
        `;

        elements.auth.errorMessage.style.display = "none";
        loadSummaryHistory();
    } else {
        console.log('Updating UI for logged out state');
        elements.auth.authContainer.style.display = "block";
        elements.auth.appContainer.style.display = "none";
        elements.auth.userInfo.innerHTML = "";
    }
}

async function loadSummaryHistory() {
    if (!elements || !elements.history) return;

    try {
        const response = await chrome.runtime.sendMessage({ action: 'fetchSummaries' });

        if (response.success && response.summaries.length > 0) {
            // First, update the HTML content
            elements.history.historyList.innerHTML = `
                <div class="history-header">
                    <h2>Your Summaries</h2>
                    <div class="history-actions">
                        <button class="filter-button">
                            <i class="fas fa-filter"></i>
                        </button>
                        <button class="search-button">
                            <i class="fas fa-search"></i>
                        </button>
                    </div>
                </div>
                <div class="history-grid">
                    ${response.summaries.map(summary => `
                        <div class="history-card">
                            <div class="card-content">
                                <div class="card-header">
                                    <div class="card-title-group">
                                        <h3 class="card-title">${summary.title || 'Untitled'}</h3>
                                        <span class="card-date">${new Date(summary.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })}</span>
                                    </div>
                                    <div class="card-menu">
                                        <button class="menu-button">
                                            <i class="fas fa-ellipsis-v"></i>
                                        </button>
                                    </div>
                                </div>
                                ${summary.url ? `
                                    <a href="${summary.url}" target="_blank" class="card-source">
                                        <i class="fas fa-link"></i>
                                        <span>${new URL(summary.url).hostname}</span>
                                    </a>
                                ` : ''}
                                <div class="card-summary">
                                    <p>${summary.text}</p>
                                </div>
                            </div>
                            <div class="card-actions">
                                <button class="action-button primary" data-text="${encodeURIComponent(summary.text)}">
                                    <i class="fas fa-copy"></i>
                                    <span>Copy</span>
                                </button>
                                <button class="action-button" data-id="${summary.id}">
                                    <i class="fas fa-file-alt"></i>
                                    <span>Save to Docs</span>
                                </button>
                                <button class="action-button" data-id="${summary.id}">
                                    <i class="fas fa-share"></i>
                                    <span>Share</span>
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>`;

            addHistoryEventListeners(response.summaries);

        } else {
            elements.history.historyList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i class="fas fa-file-alt"></i>
                    </div>
                    <h3>No summaries yet</h3>
                    <p>Your summaries will appear here once you create them</p>
                    <button class="create-first-button">
                        <i class="fas fa-plus"></i>
                        Create your first summary
                    </button>
                </div>`;
        }
    } catch (error) {
        console.error('Error loading summaries:', error);
        elements.history.historyList.innerHTML = `
            <div class="error-state">
                <div class="error-icon">
                    <i class="fas fa-exclamation-circle"></i>
                </div>
                <h3>Couldn't load summaries</h3>
                <p>Please check your connection and try again</p>
                <button onclick="loadSummaryHistory()" class="retry-button">
                    <i class="fas fa-redo"></i>
                    Retry
                </button>
            </div>`;
    }
}

// Updated styles
const style = `
<style>
.history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 24px;
    border-bottom: 1px solid #e0e0e0;
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(10px);
    position: sticky;
    top: 0;
    z-index: 100;
}

.history-header h2 {
    font-size: 20px;
    font-weight: 500;
    color: #202124;
    margin: 0;
}

.history-actions {
    display: flex;
    gap: 8px;
}

.history-actions button {
    background: transparent;
    border: none;
    padding: 8px;
    border-radius: 50%;
    color: #5f6368;
    cursor: pointer;
    transition: all 0.2s ease;
}

.history-actions button:hover {
    background: #f1f3f4;
    color: #202124;
}

.history-grid {
    display: grid;
    gap: 16px;
    padding: 24px;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
}

.history-card {
    background: white;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
    transition: all 0.3s cubic-bezier(.25,.8,.25,1);
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.history-card:hover {
    box-shadow: 0 14px 28px rgba(0,0,0,0.25), 0 10px 10px rgba(0,0,0,0.22);
    transform: translateY(-2px);
}

.card-content {
    padding: 20px;
    flex-grow: 1;
}

.card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
}

.card-title-group {
    flex: 1;
}

.card-title {
    font-size: 16px;
    font-weight: 500;
    color: #202124;
    margin: 0 0 4px 0;
}

.card-date {
    font-size: 12px;
    color: #5f6368;
}

.card-source {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: #1a73e8;
    text-decoration: none;
    margin-bottom: 12px;
}

.card-summary {
    font-size: 14px;
    line-height: 1.5;
    color: #3c4043;
    max-height: 150px;
    overflow-y: auto;
    margin-bottom: 16px;
}

.card-actions {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    padding: 12px;
    background: #f8f9fa;
    border-top: 1px solid #e0e0e0;
}

.action-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 16px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: #3c4043;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
}

.action-button:hover {
    background: #e8eaed;
}

.action-button.primary {
    color: #1a73e8;
}

.action-button.primary:hover {
    background: #e8f0fe;
}

.empty-state, .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    text-align: center;
}

.empty-state-icon, .error-icon {
    font-size: 48px;
    color: #dadce0;
    margin-bottom: 16px;
}

.empty-state h3, .error-state h3 {
    font-size: 18px;
    font-weight: 500;
    color: #202124;
    margin: 0 0 8px 0;
}

.empty-state p, .error-state p {
    font-size: 14px;
    color: #5f6368;
    margin: 0 0 24px 0;
}

.create-first-button, .retry-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    border: none;
    border-radius: 24px;
    background: #1a73e8;
    color: white;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
}

.create-first-button:hover, .retry-button:hover {
    background: #1557b0;
    box-shadow: 0 2px 6px rgba(26,115,232,0.3);
}

@media (max-width: 768px) {
    .history-grid {
        grid-template-columns: 1fr;
    }
}
</style>`;

document.head.insertAdjacentHTML('beforeend', style);

// Separate function to add event listeners
function addHistoryEventListeners(summaries) {
    console.log('Adding event listeners to history items');

    // Copy buttons
    document.querySelectorAll('.action-button.primary').forEach(button => {
        button.addEventListener('click', async () => {
            console.log('Copy button clicked');
            const text = decodeURIComponent(button.dataset.text);
            try {
                await navigator.clipboard.writeText(text);
                const originalHTML = button.innerHTML;
                button.innerHTML = '<i class="fas fa-check"></i><span>Copied!</span>';
                setTimeout(() => {
                    button.innerHTML = originalHTML;
                }, 2000);
            } catch (error) {
                console.error('Failed to copy:', error);
            }
        });
    });

    // Save to Docs buttons
    document.querySelectorAll('.action-button .fa-file-alt').forEach(icon => {
        const button = icon.closest('.action-button');
        button.addEventListener('click', async () => {
            console.log('Save to Docs button clicked');
            const summaryId = button.dataset.id;
            const summary = summaries.find(s => s.id === summaryId);
            if (!summary) return;

            try {
                button.disabled = true;
                const originalHTML = button.innerHTML;
                button.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Saving...</span>';

                const result = await chrome.runtime.sendMessage({
                    action: 'saveToDocs',
                    data: {
                        title: summary.title || 'InsightFlow Summary',
                        content: summary.text
                    }
                });

                if (result.success) {
                    window.open(result.docUrl, '_blank');
                    button.innerHTML = '<i class="fas fa-check"></i><span>Saved!</span>';
                } else {
                    throw new Error(result.error || 'Failed to save');
                }

                setTimeout(() => {
                    button.innerHTML = originalHTML;
                    button.disabled = false;
                }, 2000);
            } catch (error) {
                console.error('Failed to save to Docs:', error);
                button.innerHTML = '<i class="fas fa-exclamation-circle"></i><span>Failed</span>';
                setTimeout(() => {
                    button.innerHTML = '<i class="fas fa-file-alt"></i><span>Save to Docs</span>';
                    button.disabled = false;
                }, 2000);
            }
        });
    });

    // Share buttons
    document.querySelectorAll('.action-button .fa-share').forEach(icon => {
        const button = icon.closest('.action-button');
        button.addEventListener('click', async () => {
            console.log('Share button clicked');
            const summaryId = button.dataset.id;
            const summary = summaries.find(s => s.id === summaryId);
            if (!summary) return;

            try {
                if (navigator.share) {
                    await navigator.share({
                        title: summary.title || 'InsightFlow Summary',
                        text: summary.text,
                    });
                } else {
                    await navigator.clipboard.writeText(summary.text);
                    const originalHTML = button.innerHTML;
                    button.innerHTML = '<i class="fas fa-check"></i><span>Copied!</span>';
                    setTimeout(() => {
                        button.innerHTML = originalHTML;
                    }, 2000);
                }
            } catch (error) {
                console.error('Failed to share:', error);
            }
        });
    });

    // Menu buttons
    document.querySelectorAll('.menu-button').forEach(button => {
        button.addEventListener('click', (e) => {
            console.log('Menu button clicked');
            e.stopPropagation();

            // Remove any existing dropdown menus
            document.querySelectorAll('.dropdown-menu').forEach(menu => menu.remove());

            const menu = document.createElement('div');
            menu.className = 'dropdown-menu';
            menu.innerHTML = `
                <button class="dropdown-item delete-item">
                    <i class="fas fa-trash-alt"></i>
                    Delete
                </button>
                <button class="dropdown-item edit-item">
                    <i class="fas fa-edit"></i>
                    Edit
                </button>
            `;

            const rect = button.getBoundingClientRect();
            menu.style.position = 'absolute';
            menu.style.top = `${rect.bottom + 5}px`;
            menu.style.left = `${rect.left}px`;

            document.body.appendChild(menu);

            const closeMenu = (e) => {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            };

            setTimeout(() => {
                document.addEventListener('click', closeMenu);
            }, 0);
        });
    });
}