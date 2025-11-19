'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import { Settings, Save } from 'lucide-react';

export default function ConfigPage() {
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      const response = await adminApi.getConfig();
      setConfigs(response.data);
    } catch (err) {
      console.error('Failed to load configs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (key: string, value: any) => {
    setSaving(true);
    try {
      await adminApi.updateConfig(key, value);
      alert('設定已更新');
      loadConfigs();
    } catch (err: any) {
      alert(err.response?.data?.message || '更新失敗');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const groupedConfigs = configs.reduce((acc, config) => {
    const category = config.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(config);
    return acc;
  }, {});

  const categoryNames: Record<string, string> = {
    schedule: '時間設定',
    rules: '規則設定',
    scoring: '評分設定',
    security: '安全設定',
    other: '其他設定',
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Settings className="w-8 h-8" />
          系統設定
        </h1>
        <p className="text-gray-500 mt-1">調整系統參數與規則</p>
      </div>

      <div className="space-y-6">
        {Object.entries(groupedConfigs).map(([category, items]: [string, any]) => (
          <div key={category} className="card">
            <h2 className="text-xl font-bold mb-4">{categoryNames[category] || category}</h2>
            <div className="space-y-4">
              {items.map((config: any) => (
                <div key={config.id} className="border-b border-gray-200 last:border-0 pb-4 last:pb-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 mb-1">{config.key}</div>
                      <div className="text-sm text-gray-600 mb-2">{config.description}</div>
                      <ConfigInput
                        config={config}
                        onSave={(value) => handleSave(config.key, value)}
                        saving={saving}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfigInput({ config, onSave, saving }: any) {
  const [value, setValue] = useState(config.value);
  const [editing, setEditing] = useState(false);

  const handleSave = () => {
    onSave(value);
    setEditing(false);
  };

  const parseValue = (val: string) => {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <div className="px-3 py-2 bg-gray-100 rounded-lg font-mono text-sm flex-1">
          {typeof config.value === 'object' ? JSON.stringify(config.value) : config.value}
        </div>
        <button onClick={() => setEditing(true)} className="btn-secondary">
          編輯
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={typeof value === 'object' ? JSON.stringify(value) : value}
        onChange={(e) => setValue(parseValue(e.target.value))}
        className="input flex-1"
      />
      <button
        onClick={handleSave}
        disabled={saving}
        className="btn-primary flex items-center gap-2"
      >
        <Save className="w-4 h-4" />
        儲存
      </button>
      <button
        onClick={() => {
          setValue(config.value);
          setEditing(false);
        }}
        className="btn-secondary"
      >
        取消
      </button>
    </div>
  );
}
