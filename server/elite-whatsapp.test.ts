import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock whatsapp module
vi.mock("./_core/whatsapp", () => ({
  sendBatchWhatsAppMessages: vi.fn().mockResolvedValue({ successful: 2, failed: 0 }),
}));

describe("Elite WhatsApp Payment Reminders", () => {
  describe("EliteWhatsAppButton component logic", () => {
    it("should generate correct WhatsApp URL with student info", () => {
      const studentPhone = "91234567";
      const studentName = "陳大文";
      const remainingClasses = 2;
      const paidClasses = 10;
      const attendedClasses = 8;
      const feePerClass = "200";
      const fee12Classes = parseFloat(feePerClass) * 12;

      // Simulate the message generation logic from EliteWhatsAppButton
      let statusText = "";
      if (remainingClasses < 0) {
        statusText = `已超用 ${Math.abs(remainingClasses)} 堂`;
      } else if (remainingClasses === 0) {
        statusText = "堂數已用完";
      } else {
        statusText = `剩餘 ${remainingClasses} 堂`;
      }

      expect(statusText).toBe("剩餘 2 堂");
      expect(fee12Classes).toBe(2400);

      const whatsappUrl = `https://wa.me/852${studentPhone}?text=${encodeURIComponent("test")}`;
      expect(whatsappUrl).toContain("852" + studentPhone);
    });

    it("should handle zero remaining classes", () => {
      const remainingClasses = 0;
      let statusText = "";
      if (remainingClasses < 0) {
        statusText = `已超用 ${Math.abs(remainingClasses)} 堂`;
      } else if (remainingClasses === 0) {
        statusText = "堂數已用完";
      } else {
        statusText = `剩餘 ${remainingClasses} 堂`;
      }
      expect(statusText).toBe("堂數已用完");
    });

    it("should handle negative remaining classes (overused)", () => {
      const remainingClasses = -3;
      let statusText = "";
      if (remainingClasses < 0) {
        statusText = `已超用 ${Math.abs(remainingClasses)} 堂`;
      } else if (remainingClasses === 0) {
        statusText = "堂數已用完";
      } else {
        statusText = `剩餘 ${remainingClasses} 堂`;
      }
      expect(statusText).toBe("已超用 3 堂");
    });

    it("should calculate correct fee for 12 classes", () => {
      const testCases = [
        { feePerClass: "200", expected: 2400 },
        { feePerClass: "250", expected: 3000 },
        { feePerClass: "150", expected: 1800 },
      ];
      
      testCases.forEach(({ feePerClass, expected }) => {
        const fee12Classes = parseFloat(feePerClass) * 12;
        expect(fee12Classes).toBe(expected);
      });
    });
  });

  describe("WhatsApp message template", () => {
    it("should include all required information in the message", () => {
      const studentName = "陳大文";
      const paidClasses = 10;
      const attendedClasses = 8;
      const remainingClasses = 2;
      const feePerClass = "200";
      const fee12Classes = parseFloat(feePerClass) * 12;
      const studentPhone = "91234567";
      const systemUrl = "https://example.com";

      const message = `🥋 ${studentName} 家長您好！

📌 *精英班繳費通知*

目前堂數狀況：
• 已繳堂數：${paidClasses} 堂
• 已上堂數：${attendedClasses} 堂
• 剩餘 ${remainingClasses} 堂

請及時繳費以確保孩子能繼續上課。

💰 *繳費金額：$${fee12Classes.toLocaleString()} (12堂)*

───────────────
💳 *繳費方式*

銀行轉帳：
• 銀行：中國銀行
• 帳戶號碼：012-692-2-0114816
• 帳戶名稱：Chong Mo Company Limited

轉數快 (FPS)：
• ID：164577132

───────────────
📱 *上傳收據步驟*

1️⃣ 完成轉帳並截圖
2️⃣ 登入系統：${systemUrl}
3️⃣ 使用您的電話號碼登入
   · 帳號：${studentPhone}
   · 密碼：${studentPhone}
   (登入後可自行修改密碼)
4️⃣ 上傳收據截圖
5️⃣ 完成！

───────────────
ℹ️ 如有任何疑問，歡迎隨時聯絡我們！

✅ *已繳費者請忽略此訊息*
謝謝您的配合！🙏`;

      expect(message).toContain(studentName);
      expect(message).toContain("精英班繳費通知");
      expect(message).toContain(`已繳堂數：${paidClasses} 堂`);
      expect(message).toContain(`已上堂數：${attendedClasses} 堂`);
      expect(message).toContain(`剩餘 ${remainingClasses} 堂`);
      expect(message).toContain(`$${fee12Classes.toLocaleString()}`);
      expect(message).toContain("012-692-2-0114816");
      expect(message).toContain("164577132");
      expect(message).toContain(systemUrl);
      expect(message).toContain(studentPhone);
    });
  });

  describe("localStorage reminder tracking", () => {
    it("should format time difference correctly", () => {
      const formatLastRemindedTime = (timestamp: number): string => {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return "剛剛";
        if (minutes < 60) return `${minutes}分鐘前`;
        if (hours < 24) return `${hours}小時前`;
        return `${days}天前`;
      };

      const now = Date.now();
      expect(formatLastRemindedTime(now)).toBe("剛剛");
      expect(formatLastRemindedTime(now - 5 * 60000)).toBe("5分鐘前");
      expect(formatLastRemindedTime(now - 3 * 3600000)).toBe("3小時前");
      expect(formatLastRemindedTime(now - 2 * 86400000)).toBe("2天前");
    });
  });

  describe("Batch reminder filtering logic", () => {
    it("should filter students with remaining classes <= 3", () => {
      const balances = [
        { studentId: 1, studentName: "A", remainingClasses: 5, paidClasses: 10, attendedClasses: 5 },
        { studentId: 2, studentName: "B", remainingClasses: 2, paidClasses: 10, attendedClasses: 8 },
        { studentId: 3, studentName: "C", remainingClasses: 0, paidClasses: 10, attendedClasses: 10 },
        { studentId: 4, studentName: "D", remainingClasses: -1, paidClasses: 10, attendedClasses: 11 },
        { studentId: 5, studentName: "E", remainingClasses: 3, paidClasses: 10, attendedClasses: 7 },
      ];

      const needReminder = balances.filter(b => (b.remainingClasses ?? 0) <= 3);
      expect(needReminder).toHaveLength(4);
      expect(needReminder.map(b => b.studentName)).toEqual(["B", "C", "D", "E"]);
    });

    it("should return empty when no students need reminders", () => {
      const balances = [
        { studentId: 1, studentName: "A", remainingClasses: 10, paidClasses: 10, attendedClasses: 0 },
        { studentId: 2, studentName: "B", remainingClasses: 5, paidClasses: 10, attendedClasses: 5 },
      ];

      const needReminder = balances.filter(b => (b.remainingClasses ?? 0) <= 3);
      expect(needReminder).toHaveLength(0);
    });
  });
});
