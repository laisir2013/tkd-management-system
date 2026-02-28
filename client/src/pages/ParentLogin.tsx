import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

export default function ParentLogin() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const loginMutation = trpc.auth.loginParent.useMutation();

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
        setLocation(`/payment?phone=${encodeURIComponent(phone)}&tab=overview`);
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-purple-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">家長查詢系統</h1>
          <p className="text-gray-600">查看學生資料與繳費記錄</p>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-t-lg">
            <CardTitle className="text-2xl flex items-center gap-2">
              <Users className="w-6 h-6" />
              家長登入
            </CardTitle>
            <CardDescription className="text-purple-100">請輸入您的電話號碼和密碼</CardDescription>
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
                className="w-full h-12 text-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
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
