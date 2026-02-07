import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, ArrowLeft, Loader2, Chrome } from 'lucide-react'
import { supabase, API_BASE_URL, GOOGLE_SCOPES } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import axios from 'axios'

interface ServerAccount {
    email: string
    hasToken: boolean
    addedAt: string
}

interface AccountsPageProps {
    apiKey: string
    user: User | null
    onBack: () => void
    onLogout: () => void
}

export function AccountsPage({ apiKey, user, onBack, onLogout }: AccountsPageProps) {
    const [isSigningIn, setIsSigningIn] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const queryClient = useQueryClient()

    // Lấy danh sách accounts từ Render server
    const { data: accounts = [], isLoading: isLoadingAccounts } = useQuery<ServerAccount[]>({
        queryKey: ['server-accounts'],
        queryFn: async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/auth/accounts`, {
                    headers: { Authorization: `Bearer ${apiKey}` },
                })
                return response.data.accounts || []
            } catch {
                return []
            }
        },
        refetchInterval: 10000,
    })

    // Thêm account lên Render server
    const addAccountToServer = useMutation({
        mutationFn: async (tokenData: { email: string; accessToken: string; refreshToken: string }) => {
            const response = await axios.post(
                `${API_BASE_URL}/auth/accounts`,
                {
                    email: tokenData.email,
                    access_token: tokenData.accessToken,
                    refresh_token: tokenData.refreshToken,
                },
                { headers: { Authorization: `Bearer ${apiKey}` } }
            )
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['server-accounts'] })
            queryClient.invalidateQueries({ queryKey: ['health'] })
        },
    })

    // Xóa account khỏi Render server
    const removeAccountFromServer = useMutation({
        mutationFn: async (email: string) => {
            await axios.delete(`${API_BASE_URL}/auth/accounts/${encodeURIComponent(email)}`, {
                headers: { Authorization: `Bearer ${apiKey}` },
            })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['server-accounts'] })
            queryClient.invalidateQueries({ queryKey: ['health'] })
        },
    })

    // Login với Google qua Supabase → lấy provider_token
    const handleGoogleSignIn = async () => {
        setIsSigningIn(true)
        setError(null)

        try {
            const { error: signInError } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    scopes: GOOGLE_SCOPES,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    },
                    redirectTo: window.location.origin + window.location.pathname,
                },
            })

            if (signInError) {
                setError(signInError.message)
                setIsSigningIn(false)
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Đăng nhập thất bại')
            setIsSigningIn(false)
        }
    }

    // Gửi token Supabase trả về lên Render server
    const handleSendTokenToServer = async () => {
        setError(null)

        try {
            const { data: sessionData } = await supabase.auth.getSession()
            const session = sessionData?.session

            if (!session) {
                setError('Không có session. Hãy đăng nhập Google trước.')
                return
            }

            const providerToken = session.provider_token
            const providerRefreshToken = session.provider_refresh_token
            const email = session.user?.email

            if (!providerToken || !email) {
                setError('Không lấy được Google token. Hãy đăng nhập lại với Google.')
                return
            }

            await addAccountToServer.mutateAsync({
                email,
                accessToken: providerToken,
                refreshToken: providerRefreshToken || '',
            })
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Gửi token thất bại')
        }
    }

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
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Google Accounts</h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Quản lý tài khoản Google cho proxy</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Error Alert */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    </div>
                )}

                {/* Step 1: Login Google qua Supabase */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center text-lg">
                            <span className="w-7 h-7 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold mr-3">1</span>
                            Đăng nhập Google
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {user ? (
                            <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                                <div>
                                    <p className="font-medium text-green-700 dark:text-green-300">✅ Đã đăng nhập</p>
                                    <p className="text-sm text-muted-foreground">{user.email}</p>
                                </div>
                                <Button variant="outline" size="sm" onClick={onLogout}>
                                    Đổi account
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <p className="text-sm text-muted-foreground">
                                    Đăng nhập với Google account mà bạn muốn dùng cho Gemini API proxy.
                                </p>
                                <Button
                                    onClick={handleGoogleSignIn}
                                    disabled={isSigningIn}
                                    className="w-full"
                                    size="lg"
                                >
                                    {isSigningIn ? (
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                    ) : (
                                        <Chrome className="w-5 h-5 mr-2" />
                                    )}
                                    {isSigningIn ? 'Đang chuyển hướng...' : 'Login with Google'}
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Step 2: Gửi token lên server */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center text-lg">
                            <span className="w-7 h-7 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold mr-3">2</span>
                            Thêm vào Proxy Server
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground mb-4">
                            Sau khi đăng nhập, click nút bên dưới để gửi Google token lên Render server.
                        </p>
                        <Button
                            onClick={handleSendTokenToServer}
                            disabled={!user || addAccountToServer.isPending}
                            className="w-full"
                            size="lg"
                        >
                            {addAccountToServer.isPending ? (
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            ) : (
                                <Plus className="w-5 h-5 mr-2" />
                            )}
                            {addAccountToServer.isPending ? 'Đang gửi...' : 'Thêm Account vào Server'}
                        </Button>
                        {addAccountToServer.isSuccess && (
                            <p className="mt-2 text-sm text-green-600">✅ Đã thêm thành công!</p>
                        )}
                    </CardContent>
                </Card>

                {/* Danh sách accounts trên server */}
                <Card>
                    <CardHeader>
                        <CardTitle>
                            Accounts trên Server ({accounts.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoadingAccounts ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : accounts.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <p>Chưa có account nào trên server.</p>
                                <p className="text-xs mt-1">Hoàn thành bước 1 & 2 ở trên để thêm.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {accounts.map((account) => (
                                    <div
                                        key={account.email}
                                        className="flex items-center justify-between p-4 border border-border rounded-lg"
                                    >
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{account.email}</span>
                                                {account.hasToken && (
                                                    <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
                                                        Active
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Thêm lúc: {new Date(account.addedAt).toLocaleString()}
                                            </p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeAccountFromServer.mutate(account.email)}
                                            disabled={removeAccountFromServer.isPending}
                                        >
                                            <Trash2 className="w-4 h-4 text-red-500" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}
