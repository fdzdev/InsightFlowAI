export const saveUserToFirestore = async (user) => {
    try {
        console.log('Attempting to save user to accounts collection:', user.uid);
        const response = await chrome.runtime.sendMessage({
            action: 'saveUserToFirestore',
            user: {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                lastLogin: new Date().toISOString(),
                createdAt: new Date().toISOString()
            }
        });

        if (response.error) {
            throw new Error(response.error);
        }

        console.log('User saved successfully to accounts collection');
    } catch (error) {
        console.error('Error saving user to accounts collection:', error);
        throw error;
    }
};