import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Receipt, History } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

export default function Parent() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const loginMutation = trpc.auth.loginParent.useQuery(
    { phone: phone.trim(), password: password.trim() },
    { enabled: false }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !password.trim()) {
      setError("請輸入電話號碼和密碼");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const result = await loginMutation.refetch();
      
      if (result.data?.success) {
        // 登入成功,導向家長頁面
        setLocation(`/payment?phone=${encodeURIComponent(phone)}&tab=overview`);
      } else {
        setError(result.data?.error || "登入失敗,請確認電話號碼和密碼是否正確");
      }
    } catch (error) {
      console.error("登入失敗:", error);
      setError("登入失敗,請稍後再試");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100">
      <div className="container max-w-4xl py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            家長查詢系統
          </h1>
          <p className="text-lg text-gray-600">
            輕鬆管理學費繳納,上傳收據即可完成
          </p>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-t-lg">
            <CardTitle className="text-2xl flex items-center gap-2">
              <Phone className="w-6 h-6" />
              家長登入
            </CardTitle>
            <CardDescription className="text-purple-100">
              請輸入您的電話號碼以查看學生資料
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                  電話號碼
                </label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="請輸入電話號碼 (例如: 90971420)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="text-lg h-12"
                  required
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  密碼
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="預設密碼為電話號碼"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="text-lg h-12"
                  required
                />
              </div>
              {error && (
                <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
                  {error}
                </div>
              )}
              <Button 
                type="submit" 
                className="w-full h-12 text-lg bg-purple-600 hover:bg-purple-700" 
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? "登入中..." : "登入"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6 mt-8">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-600">
                <Receipt className="w-5 h-5" />
                上傳收據
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                拍攝或上傳學費收據照片,系統會自動識別金額並記錄繳費資訊
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-600">
                <History className="w-5 h-5" />
                查看記錄
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                隨時查看已繳費的歷史記錄,包含繳費日期、金額和收據
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
