import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, Receipt, Calendar, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";

const PERIOD_LABELS: Record<string, string> = {
  Q1: "1-3月",
  Q2: "4-6月",
  Q3: "7-9月",
  Q4: "10-12月",
  CUSTOM: "自選月份",
};

export default function History() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const phone = params.get("phone") || "";
  const [, setLocation] = useLocation();

  const { data: students, isLoading: studentsLoading } = trpc.students.getByPhone.useQuery({ phone });
  const studentIds = students?.map(s => s.id) || [];
  const { data: payments, isLoading: paymentsLoading } = trpc.payments.getByStudentIds.useQuery(
    { studentIds },
    { enabled: studentIds.length > 0 }
  );

  const isLoading = studentsLoading || paymentsLoading;

  const getStudentName = (studentId: number) => {
    return students?.find(s => s.id === studentId)?.name || "未知學生";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12">
      <div className="container max-w-4xl">
        <Button onClick={() => setLocation("/")} variant="outline" className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回首頁
        </Button>

        <Card className="shadow-xl">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            <CardTitle className="text-2xl">繳費記錄</CardTitle>
            <CardDescription className="text-blue-100">
              查看所有學生的繳費歷史記錄
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {!payments || payments.length === 0 ? (
              <div className="text-center py-12">
                <Receipt className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500 text-lg">尚無繳費記錄</p>
                <Button
                  onClick={() => setLocation(`/payment?phone=${encodeURIComponent(phone)}`)}
                  className="mt-4"
                >
                  立即繳費
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {payments.map((payment) => (
                  <Card 
                    key={payment.id} 
                    className={`hover:shadow-md transition-shadow ${
                      payment.status === 'pending' || parseFloat(payment.amount) <= 0
                        ? 'border-2 border-yellow-400 bg-yellow-50' 
                        : ''
                    }`}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-lg">
                              {getStudentName(payment.studentId)}
                            </h3>
                            {(payment.status === 'pending' || parseFloat(payment.amount) <= 0) && (
                              <span className="text-xs font-semibold text-yellow-700 bg-yellow-200 px-2 py-1 rounded flex items-center gap-1">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                需人工審核
                              </span>
                            )}
                          </div>
                          <div className="space-y-1 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4" />
                              <span>
                                繳費期間: {PERIOD_LABELS[payment.paymentPeriod] || payment.paymentPeriod}
                                {payment.paymentPeriod === "CUSTOM" && payment.customMonths && (
                                  <span className="ml-1">
                                    ({Array.isArray(payment.customMonths) 
                                      ? payment.customMonths.join(", ") 
                                      : payment.customMonths})
                                  </span>
                                )}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <DollarSign className="w-4 h-4" />
                              <span>金額: ${payment.amount}</span>
                            </div>
                            {payment.receiptTransferDate && (
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                <span>
                                  轉帳日期: {format(new Date(payment.receiptTransferDate), "yyyy年MM月dd日", { locale: zhTW })}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4" />
                              <span className="text-xs text-gray-500">
                                記錄日期: {format(new Date(payment.paymentDate), "yyyy年MM月dd日", { locale: zhTW })}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="ml-4">
                          {payment.receiptUrl && (
                            <a
                              href={payment.receiptUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                            >
                              <Receipt className="w-4 h-4" />
                              查看收據
                            </a>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
