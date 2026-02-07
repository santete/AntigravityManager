import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Activity, Database, LogOut, RefreshCw, Users } from 'lucide-react'
import axios from 'axios'

interface DashboardPageProps {
  apiKey: string
  onLogout: () => void
  onNavigateToAccounts: () => void
}

export function DashboardPage({ apiKey, onLogout, onNavigateToAccounts }: DashboardPageProps) {
  const { data: healthData, isLoading, refetch } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const response = await axios.get('https://api.projectnow.app/health')
      return response.data
    },
    refetchInterval: 30000, // Refresh every 30s
  })

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    return `${hours}h ${minutes}m ${secs}s`
  }

  const formatMemory = (bytes: number) => {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Antigravity Admin</h1>
            <p className="text-sm text-muted-foreground">Proxy Management Dashboard</p>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={onNavigateToAccounts}>
              <Users className="w-4 h-4 mr-2" />
              Accounts
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button variant="ghost" size="sm" onClick={onLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Server Status */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Server Status</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? (
                  <span className="text-muted-foreground">Loading...</span>
                ) : healthData?.status === 'ok' ? (
                  <span className="text-green-600">Online</span>
                ) : (
                  <span className="text-red-600">Offline</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {healthData?.timestamp ? new Date(healthData.timestamp).toLocaleString() : 'N/A'}
              </p>
            </CardContent>
          </Card>

          {/* Uptime */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Uptime</CardTitle>
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {healthData?.uptime ? formatUptime(healthData.uptime) : 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Since last restart
              </p>
            </CardContent>
          </Card>

          {/* Memory Usage */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {healthData?.memory?.heapUsed ? formatMemory(healthData.memory.heapUsed) : 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Heap: {healthData?.memory?.heapTotal ? formatMemory(healthData.memory.heapTotal) : 'N/A'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* API Configuration */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>API Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">API Endpoint</label>
              <code className="block bg-muted px-3 py-2 rounded text-sm">
                https://api.projectnow.app/v1/chat/completions
              </code>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Your API Key</label>
              <code className="block bg-muted px-3 py-2 rounded text-sm font-mono">
                {apiKey.substring(0, 20)}...
              </code>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Usage Example (PowerShell)</label>
              <pre className="bg-gray-900 text-gray-100 px-4 py-3 rounded text-xs overflow-x-auto">
                {`$body = '{"model":"gemini-2.5-flash","messages":[{"role":"user","content":"Hello"}]}'

Invoke-RestMethod -Uri "https://api.projectnow.app/v1/chat/completions" \\
  -Method POST \\
  -ContentType "application/json" \\
  -Headers @{"Authorization"="Bearer ${apiKey}"} \\
  -Body $body`}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Status Info */}
        <Card>
          <CardHeader>
            <CardTitle>Current Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Backend Status:</span>
                <span className="font-medium">
                  {healthData?.status === 'ok' ? '✅ Online' : '❌ Offline'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Google Accounts:</span>
                <span className={`font-medium ${healthData?.accounts > 0 ? 'text-green-600' : 'text-yellow-600'}`}>
                  {healthData?.accounts > 0
                    ? `✅ ${healthData.accounts} account(s) active`
                    : '⚠️ No accounts (go to Accounts page)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">API Mode:</span>
                <span className="font-medium">
                  {healthData?.accounts > 0 ? '🟢 Gemini Proxy (Live)' : '🟡 Waiting for accounts'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
