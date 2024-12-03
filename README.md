# InsightFlow AI

**Enhance Productivity with AI-Driven Insights**

InsightFlow AI harnesses Google Chrome's native summarization capabilities to deliver concise summaries. With options to save directly to Google Docs or share on LinkedIn, it streamlines efficiency for students and professionals alike.

## Setup for Demo/Testing

- **Security Measures:** 
  - The demo Firebase configuration includes limited permissions.
  - API calls are rate-limited to prevent abuse.
  - Access is restricted to specific domains for testing purposes.

## Visual Workflow of InsightFlow AI

### 1. Text Highlighting on Pages
   - **content.js** detects and sends highlighted text to extension scripts.

### 2. User Interaction in Popup
   - **popup.html** offers user interface with options:
     - **Summarize** //implemented
     - **Insights** //not implemented
     - **Translation** //not implemented
   - **popup.js** orchestrates API calls based on user selections.

### 3. Result Management
   - **firebase.js**: Secure storage and retrieval of results.
   - **googleDocs.js**: Integration for saving summaries to Google Docs.
   - **linkedin-config.js**: Functionality to share insights on LinkedIn.

### 4. History and Persistence
   - Results dynamically fetched in the popup:
     - Shows **user-specific summaries and insights**.
     - Provides an option to **clear history**.

### 5. Authentication and Security
   - **Firebase** handles user authentication, ensuring secure access and data integrity.

## Files and Their Roles

### 1. manifest.json

**Purpose:** Core configuration file for the Chrome extension.

**Key Features:**
   - **Manifest Version:** V3 for enhanced security and performance.
   - **Permissions:** Grants access to tabs, notifications, and Google APIs.
   - **Background Service Worker:** `background.js` manages event-driven operations.
   - **OAuth2 Setup:** Configures Google authentication.
   - **Content Scripts:** `content.js` for text interaction on pages.

### 2. popup.html

**Purpose:** User interface for extension functionality.

**Key Features:**
   - **Authentication UI:** Seamless Google login integration.
   - **Dynamic Content:** JavaScript for updating UI elements in real-time.
   - **Action Buttons:** User controls for summary generation and content sharing.

### 3. background.js

**Purpose:** Manages background processes.

**Key Features:**
   - **Context Menu:** Real-time updates based on user actions.
   - **API Integration:** Smooth data flow with Google services.
   - **Event Management:** Handles context menu interactions.

### 4. content.js

**Purpose:** Interacts with web page content.

**Key Features:**
   - **Text Selection:** Detects user highlights.
   - **Data Messaging:** Communicates selections to extension components.
   - **Performance:** Efficient event listeners to minimize page impact.

### 5. firebase.js

**Purpose:** Facilitates Firebase integration for authentication and data storage.

**Key Features:**
   - **Initialization:** Configures with secure Firebase credentials.
   - **Authentication:** Manages user login/logout.
   - **Database:** Handles CRUD operations for user data.

---

This structure provides a clear overview of the project's components and functionalities, enhancing both usability and developer understanding.
