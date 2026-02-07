import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
    ArrowLeft,
    RefreshCw,
    Loader2,
    Zap,
    AlertTriangle,
    CheckCircle,
    XCircle,
    ShieldAlert,
    HelpCircle,
    Play,
} from 'lucide-react'
import axios from 'axios'
import { API_BASE_URL } from '@/lib/supabase'

interface ModelUsage {
    rpm: number
    rpd: number
    rpmPercent: number
    rpdPercent: number
    errors24h: number
    lastError: { timestamp: number; code: number; message: string } | null
}

interface ModelLimits {
    rpm: number
    rpd: number
    tpm: number
}

interface ModelStatus {
    model: string
    available: boolean
    status: 'ok' | 'warning' | 'exhausted' | 'unavailable' | 'auth_error' | 'unknown'
    limits: ModelLimits
    usage: ModelUsage
}

interface AccountModelStatus {
    email: string
    tokenValid: boolean
    tokenError: string | null
    models: ModelStatus[]
}

interface ModelStatusResponse {
    accounts: AccountModelStatus[]
    checkedAt: string
}

interface ModelMonitorPageProps {
    apiKey: string
    onBack: () => void
}

// Trạng thái → icon + màu + label
function getStatusDisplay(status: string) {
    switch (status) {
        case 'ok':
            return { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-950', label: 'Sẵn sàng' }
        case 'warning':
            return { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-950', label: 'Sắp hết quota' }
        case 'exhausted':
            return { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950', label: 'Hết quota' }
        case 'rate_limited':
            return { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950', label: 'Rate limited' }
        case 'unavailable':
            return { icon: XCircle, color: 'text-gray-400', bg: 'bg-gray-50 dark:bg-gray-900', label: 'Không khả dụng' }
        case 'auth_error':
            return { icon: ShieldAlert, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-950', label: 'Token lỗi' }
        default:
            return { icon: HelpCircle, color: 'text-gray-400', bg: 'bg-gray-50 dark:bg-gray-900', label: 'Chưa rõ' }
    }
}

// Thanh progress bar
function UsageBar({ current, max, label }: { current: number; max: number; label: string }) {
    const percent = max > 0 ? Math.min(Math.round((current / max) * 100), 100) : 0
    let barColor = 'bg-green-500'
    if (percent >= 80) {
        barColor = 'bg-yellow-500'
    }
    if (percent >= 100) {
        barColor = 'bg-red-500'
    }

    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-mono font-medium">{current}/{max}</span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                    style={{ width: `${percent}%` }}
                />
            </div>
        </div>
    )
}

// Model display name
function modelDisplayName(modelId: string): string {
    const names: Record<string, string> = {
        'gemini-2.5-pro': '⭐ Gemini 2.5 Pro',
        'gemini-2.5-flash': '⚡ Gemini 2.5 Flash',
        'gemini-2.0-flash': '⚡ Gemini 2.0 Flash',
        'gemini-2.0-flash-lite': '💨 Gemini 2.0 Flash Lite',
        'gemini-1.5-pro': '🧠 Gemini 1.5 Pro',
        'gemini-1.5-flash': '⚡ Gemini 1.5 Flash',
    }

    return names[modelId] || modelId
}

export function ModelMonitorPage({ apiKey, onBack }: ModelMonitorPageProps) {
    const [probeResult, setProbeResult] = useState<Record<string, string>>({})

    const { data, isLoading, refetch, isFetching } = useQuery<ModelStatusResponse>({
        queryKey: ['model-status'],
        queryFn: async () => {
            const response = await axios.get(`${API_BASE_URL}/models/status`, {
                headers: { Authorization: `Bearer ${apiKey}` },
            })

            return response.data
        },
        refetchInterval: 60000, // Refresh mỗi 60s
    })

    // Probe mutation — kiểm tra real-time 1 model
    const probeMutation = useMutation({
        mutationFn: async ({ email, model }: { email: string; model: string }) => {
            const response = await axios.post(
                `${API_BASE_URL}/models/probe`,
                { email, model },
                { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
            )

            return response.data
        },
        onSuccess: (data) => {
            const key = `${data.email}::${data.model}`
            setProbeResult(prev => ({ ...prev, [key]: data.status }))
            // Refresh data sau khi probe
            setTimeout(() => refetch(), 1000)
        },
    })

    const handleProbe = (email: string, model: string) => {
        const key = `${email}::${model}`
        setProbeResult(prev => ({ ...prev, [key]: 'probing...' }))
        probeMutation.mutate({ email, model })
    }

    // Tổng hợp overview
    const totalAccounts = data?.accounts?.length || 0
    const healthyAccounts = data?.accounts?.filter(a => a.tokenValid).length || 0
    const totalModelsOk = data?.accounts?.reduce(
        (sum, a) => sum + a.models.filter(m => m.status === 'ok').length, 0
    ) || 0
    const totalModelsWarning = data?.accounts?.reduce(
        (sum, a) => sum + a.models.filter(m => m.status === 'warning' || m.status === 'exhausted').length, 0
    ) || 0

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="sm" onClick={onBack}>
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Dashboard
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Model Monitor</h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Theo dõi tình trạng free tier từng model × account
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetch()}
                        disabled={isFetching}
                    >
                        {isFetching ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <RefreshCw className="w-4 h-4 mr-2" />
                        )}
                        Refresh
                    </Button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Overview Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-2xl font-bold">{totalAccounts}</div>
                            <p className="text-xs text-muted-foreground">Accounts</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-2xl font-bold text-green-600">{healthyAccounts}</div>
                            <p className="text-xs text-muted-foreground">Token hợp lệ</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-2xl font-bold text-green-600">{totalModelsOk}</div>
                            <p className="text-xs text-muted-foreground">Models sẵn sàng</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-2xl font-bold text-yellow-600">{totalModelsWarning}</div>
                            <p className="text-xs text-muted-foreground">Cần chú ý</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Last checked */}
                {data?.checkedAt && (
                    <p className="text-xs text-muted-foreground mb-4">
                        Cập nhật lần cuối: {new Date(data.checkedAt).toLocaleString()}
                    </p>
                )}

                {/* Loading state */}
                {isLoading && (
                    <div className="flex flex-col items-center justify-center py-16">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">Đang kiểm tra các models...</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            (Gọi Google API cho từng account, có thể mất 5–10s)
                        </p>
                    </div>
                )}

                {/* No accounts */}
                {!isLoading && totalAccounts === 0 && (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-lg font-medium">Chưa có account nào</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Thêm Google account ở trang Accounts để bắt đầu monitor.
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* Per-account model status */}
                {data?.accounts?.map((account) => (
                    <Card key={account.email} className="mb-6">
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-lg">📧</span>
                                    <div>
                                        <span className="text-base">{account.email}</span>
                                        {!account.tokenValid && (
                                            <span className="ml-2 text-xs bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full">
                                                Token lỗi
                                            </span>
                                        )}
                                        {account.tokenValid && (
                                            <span className="ml-2 text-xs bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full">
                                                Token OK
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </CardTitle>
                            {account.tokenError && (
                                <p className="text-xs text-red-500 mt-1">⚠️ {account.tokenError}</p>
                            )}
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {account.models.map((model) => {
                                    const statusInfo = getStatusDisplay(model.status)
                                    const StatusIcon = statusInfo.icon
                                    const probeKey = `${account.email}::${model.model}`
                                    const currentProbe = probeResult[probeKey]

                                    return (
                                        <div
                                            key={model.model}
                                            className={`p-4 rounded-lg border border-border ${statusInfo.bg}`}
                                        >
                                            {/* Model header */}
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <StatusIcon className={`w-4 h-4 ${statusInfo.color}`} />
                                                    <span className="font-medium text-sm">
                                                        {modelDisplayName(model.model)}
                                                    </span>
                                                </div>
                                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusInfo.color} ${statusInfo.bg}`}>
                                                    {statusInfo.label}
                                                </span>
                                            </div>

                                            {/* Usage bars */}
                                            {model.available && (
                                                <div className="space-y-2 mb-3">
                                                    <UsageBar
                                                        current={model.usage.rpm}
                                                        max={model.limits.rpm}
                                                        label="RPM (req/min)"
                                                    />
                                                    <UsageBar
                                                        current={model.usage.rpd}
                                                        max={model.limits.rpd}
                                                        label="RPD (req/ngày)"
                                                    />
                                                </div>
                                            )}

                                            {/* Extra info */}
                                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                <div className="space-y-0.5">
                                                    {model.usage.errors24h > 0 && (
                                                        <p className="text-red-500">
                                                            ❌ {model.usage.errors24h} lỗi trong 24h
                                                        </p>
                                                    )}
                                                    {model.usage.lastError && (
                                                        <p className="text-red-400 truncate max-w-[200px]" title={model.usage.lastError.message}>
                                                            Lỗi cuối: {model.usage.lastError.message.substring(0, 50)}...
                                                        </p>
                                                    )}
                                                    {!model.available && (
                                                        <p>Model không khả dụng cho account này</p>
                                                    )}
                                                </div>

                                                {/* Probe button */}
                                                {model.available && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 text-xs"
                                                        onClick={() => handleProbe(account.email, model.model)}
                                                        disabled={probeMutation.isPending}
                                                        title="Gửi test request để kiểm tra real-time"
                                                    >
                                                        {currentProbe === 'probing...' ? (
                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                        ) : (
                                                            <>
                                                                <Play className="w-3 h-3 mr-1" />
                                                                Test
                                                            </>
                                                        )}
                                                    </Button>
                                                )}
                                            </div>

                                            {/* Probe result */}
                                            {currentProbe && currentProbe !== 'probing...' && (
                                                <div className={`mt-2 text-xs px-2 py-1 rounded ${currentProbe === 'ok'
                                                        ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                                                        : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                                                    }`}>
                                                    Probe: {currentProbe === 'ok' ? '✅ Hoạt động' : `❌ ${currentProbe}`}
                                                </div>
                                            )}

                                            {/* TPM info */}
                                            <div className="mt-2 text-xs text-muted-foreground">
                                                TPM limit: {(model.limits.tpm / 1000).toFixed(0)}K tokens/min
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </main>
        </div>
    )
}
