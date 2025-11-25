'use client';

import { useState } from 'react';
import { personalApi } from '@/lib/api';
import { FileText, ClockIcon, Bell } from 'lucide-react';
import { format } from 'date-fns';

interface RequestFormsProps {
  code: string;
  token: string;
  onSubmitSuccess: () => void;
}

export default function RequestForms({ code, token, onSubmitSuccess }: RequestFormsProps) {
  const [activeTab, setActiveTab] = useState<'advance' | 'leave' | 'retro'>('advance');
  const [loading, setLoading] = useState(false);

  // Advance Notice Form
  const [advanceData, setAdvanceData] = useState({
    type: 'late' as 'late' | 'leave',
    date: format(new Date(), 'yyyy-MM-dd'),
    expected_minutes: 30,
    reason: '',
  });

  // Leave Request Form
  const [leaveData, setLeaveData] = useState({
    start_datetime: '',
    end_datetime: '',
    type: 'sick' as 'sick' | 'menstrual' | 'personal' | 'other',
    reason: '',
  });

  // Retro Clock Form
  const [retroData, setRetroData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '09:00',
    type: 'WORK_ONSITE_START',
    reason: '',
    improvement_plan: '',
  });

  const handleAdvanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await personalApi.submitAdvanceNotice(code, token, advanceData);
      alert('預先告知已提交！');
      setAdvanceData({ ...advanceData, reason: '' });
      onSubmitSuccess();
    } catch (err: any) {
      alert(err.response?.data?.message || '提交失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await personalApi.submitLeaveRequest(code, token, leaveData);
      alert('請假申請已提交，等待審核！');
      setLeaveData({ ...leaveData, reason: '' });
      onSubmitSuccess();
    } catch (err: any) {
      alert(err.response?.data?.message || '提交失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleRetroSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await personalApi.submitRetroClockRequest(code, token, retroData);
      alert('補打卡申請已提交，等待審核！');
      setRetroData({ ...retroData, reason: '', improvement_plan: '' });
      onSubmitSuccess();
    } catch (err: any) {
      alert(err.response?.data?.message || '提交失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4">申請與通知</h2>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('advance')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'advance'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Bell className="w-4 h-4 inline mr-1" />
          預先告知
        </button>
        <button
          onClick={() => setActiveTab('leave')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'leave'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText className="w-4 h-4 inline mr-1" />
          請假申請
        </button>
        <button
          onClick={() => setActiveTab('retro')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'retro'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <ClockIcon className="w-4 h-4 inline mr-1" />
          補打卡
        </button>
      </div>

      {/* Advance Notice Form */}
      {activeTab === 'advance' && (
        <form onSubmit={handleAdvanceSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">類型</label>
            <select
              value={advanceData.type}
              onChange={(e) => setAdvanceData({ ...advanceData, type: e.target.value as any })}
              className="input"
              required
            >
              <option value="late">遲到</option>
              <option value="leave">請假</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">日期</label>
            <input
              type="date"
              value={advanceData.date}
              onChange={(e) => setAdvanceData({ ...advanceData, date: e.target.value })}
              className="input"
              required
            />
          </div>

          {advanceData.type === 'late' && (
            <div>
              <label className="block text-sm font-medium mb-2">預計遲到（分鐘）</label>
              <input
                type="number"
                value={advanceData.expected_minutes}
                onChange={(e) => setAdvanceData({ ...advanceData, expected_minutes: Number(e.target.value) })}
                className="input"
                min="1"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">原因</label>
            <textarea
              value={advanceData.reason}
              onChange={(e) => setAdvanceData({ ...advanceData, reason: e.target.value })}
              className="input"
              rows={3}
              required
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? '提交中...' : '提交預先告知'}
          </button>
        </form>
      )}

      {/* Leave Request Form */}
      {activeTab === 'leave' && (
        <form onSubmit={handleLeaveSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">請假類型</label>
            <select
              value={leaveData.type}
              onChange={(e) => setLeaveData({ ...leaveData, type: e.target.value as any })}
              className="input"
              required
            >
              <option value="sick">病假</option>
              <option value="menstrual">生理假</option>
              <option value="personal">事假</option>
              <option value="other">其他</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">開始時間</label>
              <input
                type="datetime-local"
                value={leaveData.start_datetime}
                onChange={(e) => setLeaveData({ ...leaveData, start_datetime: e.target.value })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">結束時間</label>
              <input
                type="datetime-local"
                value={leaveData.end_datetime}
                onChange={(e) => setLeaveData({ ...leaveData, end_datetime: e.target.value })}
                className="input"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">請假原因</label>
            <textarea
              value={leaveData.reason}
              onChange={(e) => setLeaveData({ ...leaveData, reason: e.target.value })}
              className="input"
              rows={3}
              required
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? '提交中...' : '提交請假申請'}
          </button>
        </form>
      )}

      {/* Retro Clock Form */}
      {activeTab === 'retro' && (
        <form onSubmit={handleRetroSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">日期</label>
              <input
                type="date"
                value={retroData.date}
                onChange={(e) => setRetroData({ ...retroData, date: e.target.value })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">時間</label>
              <input
                type="time"
                value={retroData.time}
                onChange={(e) => setRetroData({ ...retroData, time: e.target.value })}
                className="input"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">打卡類型</label>
            <select
              value={retroData.type}
              onChange={(e) => setRetroData({ ...retroData, type: e.target.value })}
              className="input"
              required
            >
              <option value="WORK_ONSITE_START">實地上班</option>
              <option value="WORK_ONSITE_END">實地下班</option>
              <option value="WORK_REMOTE_START">遠端上班</option>
              <option value="WORK_REMOTE_END">遠端下班</option>
              <option value="BREAK_OFFSITE_START">外出開始</option>
              <option value="BREAK_OFFSITE_END">外出結束</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">忘記打卡原因</label>
            <textarea
              value={retroData.reason}
              onChange={(e) => setRetroData({ ...retroData, reason: e.target.value })}
              className="input"
              rows={2}
              placeholder="說明為什麼忘記打卡..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">改善方案</label>
            <textarea
              value={retroData.improvement_plan}
              onChange={(e) => setRetroData({ ...retroData, improvement_plan: e.target.value })}
              className="input"
              rows={2}
              placeholder="如何避免下次再忘記打卡..."
              required
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? '提交中...' : '提交補打卡申請'}
          </button>
        </form>
      )}
    </div>
  );
}
