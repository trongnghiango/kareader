import React, { useState } from 'react';
import { X, Wifi, Check, AlertCircle, Save } from 'lucide-react';
import { AppSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (settings: AppSettings) => Promise<void>;
  onTestConnection: (ip: string, port: number, user: string, password: string) => Promise<string>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
  onTestConnection,
}) => {
  const [form, setForm] = useState<AppSettings>({
    ...settings,
    kindle_user: settings.kindle_user || 'root',
    kindle_password: settings.kindle_password || '',
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const msg = await onTestConnection(
        form.kindle_ip,
        form.kindle_port,
        form.kindle_user || 'root',
        form.kindle_password || ''
      );
      setTestResult({ success: true, msg });
    } catch (e: any) {
      setTestResult({ success: false, msg: String(e) });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        ...form,
        kindle_user: form.kindle_user.trim() || 'root',
        kindle_password: form.kindle_password || '',
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70  p-4">
      <div className="w-full max-w-md rounded-xl bg-[#0c1512] border border-[#509475]/50 shadow-2xl p-6 text-[#C1C497]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#509475]/20">
          <div className="flex items-center gap-2">
            <Wifi className="w-5 h-5 text-[#509475]" />
            <h2 className="text-base font-semibold text-[#F7E8B2]">Cấu hình KOReader & Sách</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[#53685B] hover:text-[#C1C497] hover:bg-[#509475]/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-4 space-y-4">
          {/* Kindle IP */}
          <div>
            <label className="block text-xs font-medium text-[#81B8A8] mb-1">
              Địa chỉ IP của Kindle (KOReader Wi-Fi)
            </label>
            <input
              type="text"
              value={form.kindle_ip}
              onChange={(e) => setForm({ ...form, kindle_ip: e.target.value })}
              placeholder="e.g. 192.168.1.15"
              className="w-full px-3 py-2 rounded-lg bg-[#111c18] border border-[#509475]/30 text-sm text-[#F7E8B2] focus:outline-none focus:border-[#509475] font-mono"
              required
            />
            <p className="text-[10px] text-[#53685B] mt-1">
              Xem IP trên Kindle trong KOReader: Menu trên &gt; Network &gt; SSH Server.
            </p>
          </div>

          {/* Port and User */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#81B8A8] mb-1">
                Port SSH (KOReader)
              </label>
              <input
                type="number"
                value={form.kindle_port}
                onChange={(e) => setForm({ ...form, kindle_port: parseInt(e.target.value) || 2222 })}
                className="w-full px-3 py-2 rounded-lg bg-[#111c18] border border-[#509475]/30 text-sm text-[#F7E8B2] focus:outline-none focus:border-[#509475] font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#81B8A8] mb-1">
                Username SSH
              </label>
              <input
                type="text"
                value={form.kindle_user}
                onChange={(e) => setForm({ ...form, kindle_user: e.target.value })}
                placeholder="root"
                className="w-full px-3 py-2 rounded-lg bg-[#111c18] border border-[#509475]/30 text-sm text-[#F7E8B2] focus:outline-none focus:border-[#509475] font-mono"
              />
            </div>
          </div>

          {/* Password (Optional) */}
          <div>
            <label className="block text-xs font-medium text-[#81B8A8] mb-1">
              Mật khẩu SSH (Để trống nếu không đặt mật khẩu)
            </label>
            <input
              type="password"
              value={form.kindle_password || ''}
              onChange={(e) => setForm({ ...form, kindle_password: e.target.value })}
              placeholder="Mặc định KOReader không có mật khẩu"
              className="w-full px-3 py-2 rounded-lg bg-[#111c18] border border-[#509475]/30 text-sm text-[#F7E8B2] focus:outline-none focus:border-[#509475] font-mono"
            />
          </div>

          {/* Remote Directory */}
          <div>
            <label className="block text-xs font-medium text-[#81B8A8] mb-1">
              Thư mục lưu sách trên Kindle
            </label>
            <input
              type="text"
              value={form.remote_books_dir}
              onChange={(e) => setForm({ ...form, remote_books_dir: e.target.value })}
              placeholder="/mnt/us/documents/Books"
              className="w-full px-3 py-2 rounded-lg bg-[#111c18] border border-[#509475]/30 text-sm text-[#F7E8B2] focus:outline-none focus:border-[#509475] font-mono"
              required
            />
          </div>

          {/* Local Library Directory */}
          <div>
            <label className="block text-xs font-medium text-[#81B8A8] mb-1">
              Thư mục sách trên máy tính
            </label>
            <input
              type="text"
              value={form.local_library_dir}
              onChange={(e) => setForm({ ...form, local_library_dir: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-[#111c18] border border-[#509475]/30 text-sm text-[#F7E8B2] focus:outline-none focus:border-[#509475] font-mono"
              required
            />
          </div>

          {/* Test Connection Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="w-full py-2 px-3 rounded-lg bg-[#111c18] border border-[#509475]/50 text-xs text-[#81B8A8] hover:text-[#F7E8B2] hover:bg-[#509475]/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>{testing ? 'Đang kiểm tra kết nối KOReader...' : 'Kiểm tra kết nối KOReader (Port 2222)'}</span>
            </button>

            {testResult && (
              <div
                className={`mt-2 p-2.5 rounded-lg text-xs flex items-start gap-2 ${
                  testResult.success
                    ? 'bg-emerald-950/60 border border-emerald-500/50 text-emerald-300'
                    : 'bg-rose-950/60 border border-rose-500/50 text-rose-300'
                }`}
              >
                {testResult.success ? (
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <span>{testResult.msg}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-[#509475]/20">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs text-[#81B8A8] hover:bg-[#509475]/10 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#509475] text-[#0c1512] font-semibold text-xs hover:bg-[#63b07a] transition-all cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Đang lưu...' : 'Lưu cấu hình'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
