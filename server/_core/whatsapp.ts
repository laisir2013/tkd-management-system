import twilio from 'twilio';
import { ENV } from './env';

// 初始化 Twilio 客戶端
const client = twilio(ENV.twilioAccountSid, ENV.twilioAuthToken);

export interface WhatsAppMessage {
  to: string; // 接收者電話號碼(格式: +85291234567 或 91234567)
  message: string; // 訊息內容
}

/**
 * 發送 WhatsApp 訊息
 * @param to 接收者電話號碼(會自動加上 whatsapp: 前綴和 +852 國碼)
 * @param message 訊息內容
 * @returns 發送結果
 */
export async function sendWhatsAppMessage(to: string, message: string) {
  try {
    // 格式化電話號碼
    let formattedPhone = to.trim();
    
    // 如果沒有 + 號,加上香港國碼 +852
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = `+852${formattedPhone}`;
    }
    
    // 加上 whatsapp: 前綴
    const whatsappNumber = `whatsapp:${formattedPhone}`;
    
    console.log(`[WhatsApp] 發送訊息到 ${whatsappNumber}`);
    
    const result = await client.messages.create({
      from: ENV.twilioWhatsappFrom,
      to: whatsappNumber,
      body: message,
    });
    
    console.log(`[WhatsApp] 訊息已發送,SID: ${result.sid}`);
    
    return {
      success: true,
      sid: result.sid,
      to: whatsappNumber,
    };
  } catch (error: any) {
    console.error(`[WhatsApp] 發送失敗:`, error);
    return {
      success: false,
      error: error.message || '發送失敗',
      to,
    };
  }
}

/**
 * 批量發送 WhatsApp 訊息
 * @param messages 訊息列表
 * @returns 發送結果統計
 */
export async function sendBatchWhatsAppMessages(messages: WhatsAppMessage[]) {
  const results = await Promise.all(
    messages.map(({ to, message }) => sendWhatsAppMessage(to, message))
  );
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  return {
    total: messages.length,
    successful,
    failed,
    results,
  };
}
