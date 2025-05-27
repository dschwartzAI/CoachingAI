import { redirect } from 'next/navigation'

export const metadata = {
  title: "OAuth2 Callback",
  description: "Processing your authentication"
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1
};

export default async function OAuth2Callback({ searchParams }) {
  // Process OAuth2 callback from the identity provider
  // This would be implemented based on the specific provider's requirements
  
  // Redirect to the home page after processing
  redirect('/')
} 