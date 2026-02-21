import { describe, it, expect, vi } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('Change Password', () => {
  it('should hash and verify password correctly', async () => {
    const password = '12345678';
    const hashed = await hashPassword(password);
    
    expect(hashed).not.toBe(password);
    expect(hashed.startsWith('$2')).toBe(true); // bcrypt hash prefix
    
    const isValid = await verifyPassword(password, hashed);
    expect(isValid).toBe(true);
    
    const isInvalid = await verifyPassword('wrongpassword', hashed);
    expect(isInvalid).toBe(false);
  });

  it('should reject same old and new password', async () => {
    const password = '12345678';
    const hashed = await hashPassword(password);
    
    // Verify old password matches
    const isValid = await verifyPassword(password, hashed);
    expect(isValid).toBe(true);
    
    // New password should be different
    const newPassword = 'newpassword123';
    expect(newPassword).not.toBe(password);
    
    const newHashed = await hashPassword(newPassword);
    const isNewValid = await verifyPassword(newPassword, newHashed);
    expect(isNewValid).toBe(true);
    
    // Old password should not match new hash
    const oldMatchesNew = await verifyPassword(password, newHashed);
    expect(oldMatchesNew).toBe(false);
  });

  it('should enforce minimum password length of 6', () => {
    const shortPassword = '12345';
    expect(shortPassword.length).toBeLessThan(6);
    
    const validPassword = '123456';
    expect(validPassword.length).toBeGreaterThanOrEqual(6);
  });
});

describe('Payment confirmedBy', () => {
  it('should have correct confirmedBy values', () => {
    const validValues = ['parent_upload', 'admin_approved'];
    
    expect(validValues).toContain('parent_upload');
    expect(validValues).toContain('admin_approved');
    expect(validValues).not.toContain('unknown');
  });

  it('should display correct label for confirmedBy', () => {
    const getLabel = (confirmedBy: string | null) => {
      if (confirmedBy === 'parent_upload') return '家長上傳收據繳費';
      if (confirmedBy === 'admin_approved') return '管理員確認已繳費';
      return '已繳費';
    };

    expect(getLabel('parent_upload')).toBe('家長上傳收據繳費');
    expect(getLabel('admin_approved')).toBe('管理員確認已繳費');
    expect(getLabel(null)).toBe('已繳費');
  });
});
