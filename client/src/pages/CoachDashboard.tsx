import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, BarChart3, KeyRound, ArrowLeft } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";

export default function CoachDashboard() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const phone = params.get("phone") || "";
  const [, setLocation] = useLocation();
  const [showChangePassword, setShowChangePassword] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-teal-100 p-8">
      <div className="container max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">教練管理系統</h1>
            <p className="text-gray-600 mt-1">管理學生資料,查看統計報表</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowChangePassword(true)} variant="outline" size="sm">
              <KeyRound className="w-4 h-4 mr-1" />
              修改密碼
            </Button>
            <Button onClick={() => setLocation("/")} variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1" />
              登出
            </Button>
          </div>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="bg-gradient-to-r from-green-600 to-teal-600 text-white">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                學生管理
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <p className="text-gray-600 mb-4">查看和管理您負責的學生,包含學生資料、繳費狀況等</p>
              <div className="text-sm text-gray-500">
                功能開發中...
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="bg-gradient-to-r from-green-600 to-teal-600 text-white">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                統計報表
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <p className="text-gray-600 mb-4">查看學費收入統計、學生出席率等數據分析</p>
              <div className="text-sm text-gray-500">
                功能開發中...
              </div>
            </CardContent>
          </Card>
        </div>

        <ChangePasswordDialog
          open={showChangePassword}
          onOpenChange={setShowChangePassword}
          phone={phone}
          userType="coach"
        />
      </div>
    </div>
  );
}
