import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Lock } from 'lucide-react'

interface LoginPageProps {
    onLogin: (apiKey: string) => void
}

export function LoginPage({ onLogin }: LoginPageProps) {
    const [apiKey, setApiKey] = useState('')

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (apiKey.trim()) {
            onLogin(apiKey.trim())
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                        <Lock className="w-6 h-6 text-primary-foreground" />
                    </div>
                    <CardTitle>Antigravity Admin</CardTitle>
                    <p className="text-sm text-muted-foreground mt-2">
                        Enter your API key to access the dashboard
                    </p>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="apiKey" className="block text-sm font-medium mb-2">
                                API Key
                            </label>
                            <input
                                id="apiKey"
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="sk-xxxxxxxxxxxxx"
                                className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                                required
                            />
                        </div>
                        <Button type="submit" className="w-full">
                            Sign In
                        </Button>
                    </form>
                    <div className="mt-4 text-center text-sm text-muted-foreground">
                        <p>Default API Key:</p>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                            sk-237f70229d394f69af234a7609703c64
                        </code>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
