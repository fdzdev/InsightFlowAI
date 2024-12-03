// Google API credentials and configuration
const CLIENT_ID = '19203262221-vj9b9csd76v2erv9ddiq3ea5a5nb13t7.apps.googleusercontent.com';
const API_KEY = 'AIzaSyAKTtOZIs3BWK8vyoLiUcZUo37dlIGdGx0';
const DISCOVERY_DOCS = [
    "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
    "https://docs.googleapis.com/$discovery/rest?version=v1"
];
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/documents';

// Dynamically load the Google API client library
const loadGapi = () => {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = () => {
            console.log('GAPI script loaded');
            resolve();
        };
        script.onerror = (error) => {
            console.error('Failed to load GAPI script:', error);
            reject(error);
        };
        document.head.appendChild(script);
    });
};

// Initialize GAPI
const initGapi = async () => {
    try {
        await loadGapi();
        gapi.load('client:auth2', async () => {
            await gapi.client.init({
                apiKey: API_KEY,
                clientId: CLIENT_ID,
                discoveryDocs: DISCOVERY_DOCS,
                scope: SCOPES
            });
            console.log('GAPI client initialized');
        });
    } catch (error) {
        console.error('Error initializing GAPI client:', error);
    }
};

// Call this function where needed
export async function handleClientLoad() {
    try {
        await initGapi();
    } catch (error) {
        console.error('Error in handleClientLoad:', error);
    }
}

export async function createDocument(title, content) {
    try {
        const response = await gapi.client.docs.documents.create({
            title: title
        });
        console.log('Document created:', response.result);
        const documentId = response.result.documentId;

        await gapi.client.docs.documents.batchUpdate({
            documentId: documentId,
            requests: [
                {
                    insertText: {
                        location: { index: 1 },
                        text: content
                    }
                }
            ]
        });
        console.log('Content added to document');
        return `https://docs.google.com/document/d/${documentId}/edit`;
    } catch (error) {
        console.error('Error creating document:', error);
        throw error;
    }
}
