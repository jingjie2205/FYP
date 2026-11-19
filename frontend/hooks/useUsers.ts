import { useCallback, useState } from 'react'
import { Alert } from 'react-native'

const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface UserDetails {
  userId: string;
  email: string;
}

export const useUsers = () => {
    const [isLoading, setIsLoading] = useState(false)

    const addUser = useCallback(async (userData: UserDetails) => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_URL}/users`, {
                method: 'POST', 
                headers: {
                    'Content-Type': 'application/json',
                },

                body: JSON.stringify({
                    user_id: userData.userId,
                    email: userData.email.toLowerCase(),
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create user');
            }
            
        } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
            console.error("Error adding user:", errorMessage);
            Alert.alert("Error", errorMessage);
        } finally {
            setIsLoading(false);
        }
    }, [])

    /**
     * Silent upsert used on every app open, so a Clerk user always has a row in the
     * `users` table (sign-up sync can be skipped if the screen unmounts early).
     * Returns true when the row exists.
     */
    const ensureUser = useCallback(async (userData: UserDetails): Promise<boolean> => {
        try {
            const response = await fetch(`${API_URL}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userData.userId,
                    email: userData.email.toLowerCase(),
                }),
            });
            if (!response.ok) {
                console.log("User sync failed:", response.status, await response.text());
                return false;
            }
            return true;
        } catch (e) {
            console.error("Error syncing user:", e);
            return false;
        }
    }, [])

    return {
        isLoading,
        addUser,
        ensureUser,
    }
}