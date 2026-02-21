import { describe, it, expect } from 'vitest';
import { sendWhatsAppMessage } from './_core/whatsapp';

describe('Twilio WhatsApp Integration', () => {
  it('should send a test WhatsApp message', async () => {
    // 使用教練的電話號碼進行測試
    const testPhone = '94839882'; // 賴教練的電話
    const testMessage = '【測試訊息】\n\n這是一則來自跆拳道館管理系統的測試訊息。\n\nTwilio WhatsApp API 整合成功!';
    
    const result = await sendWhatsAppMessage(testPhone, testMessage);
    
    console.log('發送結果:', result);
    
    // 驗證結果
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.to).toContain('whatsapp:+852');
    
    if (result.success) {
      expect(result.sid).toBeDefined();
      console.log(`✅ 測試訊息已發送,SID: ${result.sid}`);
    } else {
      console.error(`❌ 發送失敗: ${result.error}`);
    }
  }, 30000); // 30秒超時
});
