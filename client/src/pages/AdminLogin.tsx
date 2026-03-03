import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

export default function AdminLogin() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const loginMutation = trpc.auth.loginAdmin.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !password.trim()) {
      setError("請輸入電話號碼和密碼");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const result = await loginMutation.mutateAsync({ phone: phone.trim(), password: password.trim() });
      
      if (result?.success) {
        // Store session token in localStorage as fallback for proxy environments
        if ((result as any).sessionToken) {
          localStorage.setItem("session_token", (result as any).sessionToken);
        }
        setLocation('/admin');
      } else {
        setError(result?.error || "登入失敗,請確認電話號碼和密碼是否正確");
      }
    } catch (error) {
      console.error("登入失敗:", error);
      setError("登入失敗,請稍後再試");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-orange-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">管理員系統</h1>
          <p className="text-gray-600">完整系統管理權限</p>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-t-lg">
            <CardTitle className="text-2xl flex items-center gap-2">
              <Shield className="w-6 h-6" />
              管理員登入
            </CardTitle>
            <CardDescription className="text-orange-100">請輸入您的電話號碼和密碼</CardDescription>
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
                className="w-full h-12 text-lg bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700"
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
