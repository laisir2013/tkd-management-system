import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogIn } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

export default function Home() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const utils = trpc.useUtils();
  const loginMutation = trpc.auth.login.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !password.trim()) {
      setError("請輸入電話號碼和密碼");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const result = await loginMutation.mutateAsync({
        phone: phone.trim(),
        password: password.trim(),
      });
      
      if (result.success && result.role) {
        // 登入成功後，直接將 user 資料寫入 auth.me 的 query cache
        // 這樣跳轉後 Admin/Coach/Parent 頁面可以立即獲取到 user 資料
        // 不需要等 cookie 請求回來（sandbox proxy 環境下 cookie 可能延遲）
        
        // 儲存 session token 到 localStorage，作為 cookie 的備用方案
        if ((result as any).sessionToken) {
          localStorage.setItem("session_token", (result as any).sessionToken);
        }
        
        if (result.user) {
          utils.auth.me.setData(undefined, result.user as any);
        } else if ((result as any).student) {
          // 家長登入返回的是 student 欄位，轉為 User 格式
          const s = (result as any).student;
          utils.auth.me.setData(undefined, {
            id: s.id,
            openId: `phone:${s.phone}`,
            name: s.name,
            email: null,
            role: 'user',
            loginMethod: 'phone',
            createdAt: s.createdAt,
            lastSignedIn: new Date(),
          } as any);
        }
        
        // 根據角色自動跳轉
        switch (result.role) {
          case 'parent':
            setLocation(`/payment?phone=${encodeURIComponent(phone)}`);
            break;
          case 'coach':
            setLocation('/coach');
            break;
          case 'admin':
            setLocation('/admin');
            break;
          default:
            setError("無法識別用戶角色");
        }
      } else {
        setError(result.error || "登入失敗,請確認電話號碼和密碼是否正確");
      }
    } catch (error) {
      console.error("登入失敗:", error);
      setError("登入失敗,請稍後再試");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto w-32 h-32 mb-4 flex items-center justify-center">
            <img src="/logo.png" alt="跆拳道館 Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">跆拳道館管理系統</h1>
          <p className="text-gray-600">請輸入您的電話號碼和密碼登入</p>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg">
            <CardTitle className="text-2xl flex items-center gap-2">
              <LogIn className="w-6 h-6" />
              系統登入
            </CardTitle>
            <CardDescription className="text-blue-100">系統會自動識別您的身份</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">電話號碼</label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="請輸入電話號碼"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="text-lg h-12"
                  disabled={isLoading}
                  required
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">密碼</label>
                <Input
                  id="password"
                  type="password"
                  placeholder="預設密碼為電話號碼"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="text-lg h-12"
                  disabled={isLoading}
                  required
                />
              </div>
              {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded">{error}</div>}
              <Button 
                type="submit" 
                className="w-full h-12 text-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                disabled={isLoading}
              >
                {isLoading ? "登入中..." : "登入"}
              </Button>
            </form>
            
            <div className="mt-6 text-center text-sm text-gray-500">
              <p>首次登入請使用電話號碼作為密碼</p>
              <p className="mt-1">登入後建議修改密碼</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
