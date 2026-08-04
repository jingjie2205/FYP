import { Stack, useRouter } from 'expo-router'
import { useAuth } from '@clerk/expo'
import { useEffect } from 'react'

export default function AuthRoutesLayout() {
  const { isSignedIn, isLoaded } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace('/(home)/home');
    }
  }, [isSignedIn, isLoaded]);

  if (!isLoaded) {
    return null; 
  }

  return <Stack screenOptions={{ headerShown: false }} />
}