# InsightFlowAI
InsightFlow AI uses Google Chrome's built-in summary feature to generate concise summaries. Easily save to Google Docs or share on LinkedIn, streamlining productivity for students and professionals.

## Setup for Demo/Testing

This project includes a demo Firebase configuration for testing purposes. For security:
- The demo project has limited permissions
- API calls are rate-limited
- Access is restricted to specific domains

# Visual Workflow of InsightFlow AI

## 1. User Highlights Text on a Page
   - **content.js:** Detects the highlight and sends the text to the popup or background script.

## 2. Action Buttons in Popup
   - **popup.html:** Interface where users can select:
     - **Summarize**
     - **Insights**
     - **Chart**
   - **popup.js:** Handles the selection by triggering corresponding API calls.

## 3. Result Storage
   - **firebase.js:** Manages the storage of generated results.
   - **googleDocs.js:** Provides functionality to save results to Google Docs.
   - **linkedin-config.js:** Provides functionality to share results to LinkedIn.

## 4. History Display
   - Results are dynamically fetched and shown in the popup:
     - Includes **user-specific summaries and insights**.
     - Options to **clear history** are available.

## 5. Google Authentication
   - **Firebase:** Manages login/logout functionality for secure access.

   # Files and Their Roles

## 1. manifest.json ([11†source])

**Purpose:**
- Defines the core configuration of the Chrome extension, including permissions, background scripts, content scripts, and the default popup page.

**Key Features:**

- **Manifest Version:** Uses Manifest V3 for improved security and performance.
- **Permissions:** Includes access to tabs, notifications, storage, and Google's OAuth APIs.
- **Background Service Worker:** Runs `background.js` as a module to handle context menu events and real-time operations.
- **OAuth2 Integration:** Configures `client_id` and scopes for Google login and API access.
- **Content Scripts:** Injects `content.js` into web pages to handle text interactions and highlighting.

## 2. popup.html ([12†source])

**Purpose:**
- Provides the UI for the extension's popup. It includes features such as login, history display, text highlighting, and action buttons for summaries and insights.

**Key Features:**

- **Auth UI:** Google Sign-In button allows users to authenticate and access the extension's features.
- **Dynamic UI Updates:** JavaScript dynamically updates elements like the history list and user information.
- **Action Buttons:** Provides primary functions like summarize, generate insights, and save results to external apps (Docs or Keep).

## 3. background.js

**Purpose:**
- Handles background tasks such as maintaining session states and responding to context menu actions.

**Key Features:**

- **Real-Time Context Menu Updates:** Dynamically adds context menu options based on user interactions.
- **Integration with Google APIs:** Ensures smooth operations for data retrieval and synchronization.
- **Event Handling:** Manages on-click events for the context menu.

## 4. content.js

**Purpose:**
- Interacts with web pages to detect and process highlighted text.

**Key Features:**

- **Text Detection:** Monitors user interactions for text selection.
- **Messaging:** Sends data (selected text) to the popup or background scripts for further processing.
- **Event Listeners:** Ensures minimal impact on the host webpage's performance.

## 5. firebase.js

**Purpose:**
- Manages authentication and real-time database interactions using Firebase.

**Key Features:**

- **Firebase Initialization:** Configures the extension with the Firebase project credentials.
- **Authentication Management:** Provides Google OAuth login/logout functionality.
- **Database Operations:** Enables secure storage and retrieval of user-specific data, such as summaries and insights history.