import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

/**
 * 加密密碼
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * 驗證密碼
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}

/**
 * 為用戶設定預設密碼(電話號碼)
 */
export async function setDefaultPassword(phone: string): Promise<string> {
  return await hashPassword(phone);
}
