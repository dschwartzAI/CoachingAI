"use server"

import { redirect } from 'next/navigation'
import SettingsForm from './_components/settings-form'

export default async function SettingsPage() {
  // Server-side component that will redirect to login if not authenticated
  // The actual settings form will be a client component

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Customize your experience and provide information about your business
        </p>
      </div>
      
      <SettingsForm />
    </div>
  )
} 