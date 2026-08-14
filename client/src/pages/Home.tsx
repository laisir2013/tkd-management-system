import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogIn, GraduationCap, ClipboardCheck, Shield, CreditCard } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";

// 根據角色陣列決定可用入口
function getPortals(roles: string[]) {
  const portals: { key: string; label: string; desc: string; icon: any; path: string; color: string }[] = [];
  if (roles.includes('admin')) {
    portals.push({ key: 'admin', label: '管理後台', desc: '系統全功能管理', icon: Shield, path: '/admin', color: 'from-purple-600 to-indigo-600' });
  }
  if (roles.includes('coach')) {
    portals.push({ key: 'coach', label: '教練系統', desc: '學生管理・點名・收據', icon: GraduationCap, path: '/coach', color: 'from-green-600 to-teal-600' });
  }
  if (roles.includes('staff') || roles.includes('examiner') || roles.includes('coach')) {
    portals.push({ key: 'exam', label: '考試系統', desc: '點名・評分・時間表', icon: ClipboardCheck, path: '/staff', color: 'from-amber-500 to-orange-600' });
  }
  return portals;
}

export default function Home() {
  const search = useSearch();
  const urlParams = new URLSearchParams(search);
  const initialRedirectTab = urlParams.get("tab") || "";

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [loggedInUser, setLoggedInUser] = useState<{ name: string; roles: string[]; role: string } | null>(null);
  const [redirectTab, setRedirectTab] = useState(initialRedirectTab);

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
        // 儲存 session token
        if ((result as any).sessionToken) {
          localStorage.setItem("session_token", (result as any).sessionToken);
        }
        
        if (result.user) {
          utils.auth.me.setData(undefined, result.user as any);
        } else if ((result as any).student) {
          const s = (result as any).student;
          utils.auth.me.setData(undefined, {
            id: s.id,
            openId: `phone:${s.phone}`,
            name: s.name,
            email: null,
            role: 'user',
            roles: ['user'],
            loginMethod: 'phone',
            createdAt: s.createdAt,
            lastSignedIn: new Date(),
          } as any);
        }
        
        // 取得多角色
        const roles: string[] = Array.isArray((result as any).roles) ? (result as any).roles : [result.role];
        const userName = (result.user as any)?.name || phone;
        
        // 家長直接跳轉繳費頁
        if (result.role === 'parent' || (roles.length === 1 && roles[0] === 'user')) {
          const tabParam = redirectTab ? `&tab=${redirectTab}` : '';
          setLocation(`/payment?phone=${encodeURIComponent(phone)}${tabParam}`);
          return;
        }
        
        // 單一角色且只有一個入口：直接跳轉
        const portals = getPortals(roles);
        if (portals.length === 1) {
          setLocation(portals[0].path);
          return;
        }
        
        // 多入口：顯示選擇畫面
        setLoggedInUser({ name: userName, roles, role: result.role });
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

  // 登入後的入口選擇畫面
  if (loggedInUser) {
    const portals = getPortals(loggedInUser.roles);
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <div className="mx-auto w-20 h-20 mb-3 flex items-center justify-center">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">創武管理系統</h1>
            <p className="text-gray-600">歡迎，<span className="font-semibold text-blue-700">{loggedInUser.name}</span></p>
          </div>

          <div className="space-y-3">
            {portals.map(portal => (
              <button
                key={portal.key}
                onClick={() => setLocation(portal.path)}
                className="w-full flex items-center gap-4 p-4 bg-white rounded-xl shadow-md hover:shadow-lg transition-all border border-gray-100 hover:border-gray-200 group"
              >
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${portal.color} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                  <portal.icon className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-900 text-lg">{portal.label}</div>
                  <div className="text-sm text-gray-500">{portal.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto w-32 h-32 mb-4 flex items-center justify-center">
            <img src="/logo.png" alt="創武管理系統 Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">創武管理系統</h1>
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

        {/* 快捷入口 */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={() => setLocation("/register")}
            className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow-md hover:shadow-lg transition-all border border-gray-100 hover:border-blue-200"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <span className="text-lg">📝</span>
            </div>
            <span className="text-sm font-medium text-gray-700">新生報名</span>
          </button>
          <button
            onClick={() => { setRedirectTab('exam-registration'); setError(''); }}
            className={`flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow-md hover:shadow-lg transition-all border ${redirectTab === 'exam-registration' ? 'border-orange-400 ring-2 ring-orange-200' : 'border-gray-100 hover:border-orange-200'}`}
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <span className="text-lg">🥋</span>
            </div>
            <span className="text-sm font-medium text-gray-700">考試報名</span>
            {redirectTab === 'exam-registration' && <span className="text-[10px] text-orange-600">登入後直接跳轉</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
