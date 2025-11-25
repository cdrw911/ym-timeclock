'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { personalApi } from '@/lib/api';
import { formatTime, formatDate, secondsToHours, formatDateTime } from '@/lib/utils';
import { Clock, LogIn, LogOut, Coffee, CoffeeIcon } from 'lucide-react';
import TodayStatus from '@/components/personal/TodayStatus';
import ClockButtons from '@/components/personal/ClockButtons';
import MonthSummary from '@/components/personal/MonthSummary';
import ScoreDisplay from '@/components/personal/ScoreDisplay';
import RequestForms from '@/components/personal/RequestForms';

export default function PersonalPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const code = params.code as string;
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [todayData, setTodayData] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    // Update clock every second
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!token) {
      setError('無效的存取連結，請確認您的 Token 是否正確');
      setLoading(false);
      return;
    }

    loadTodayData();
    // Refresh every 30 seconds
    const interval = setInterval(loadTodayData, 30000);
    return () => clearInterval(interval);
  }, [code, token]);

  const loadTodayData = async () => {
    if (!token) return;

    try {
      const response = await personalApi.getTodaySummary(code, token);
      setTodayData(response.data);
      setError(null);
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError('Token 無效或已過期，請聯繫管理員');
      } else {
        setError('無法載入資料，請稍後再試');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClockAction = async (action: 'in' | 'out' | 'break-start' | 'break-end', type?: 'onsite' | 'remote') => {
    if (!token) return;

    try {
      if (action === 'in' && type) {
        await personalApi.clockIn(code, token, type);
      } else if (action === 'out') {
        await personalApi.clockOut(code, token);
      } else if (action === 'break-start') {
        await personalApi.breakStart(code, token);
      } else if (action === 'break-end') {
        await personalApi.breakEnd(code, token);
      }

      // Reload data
      await loadTodayData();
    } catch (err: any) {
      alert(err.response?.data?.message || '操作失敗');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">載入中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card max-w-md w-full text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold mb-2">存取錯誤</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-blue-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="card mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {todayData?.user?.name || code}
              </h1>
              <p className="text-gray-500 mt-1">實習生編號：{code}</p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-mono font-bold text-primary-600">
                {formatTime(currentTime)}
              </div>
              <p className="text-gray-500 mt-1">{formatDate(currentTime)}</p>
            </div>
          </div>
        </div>

        {/* Clock Buttons */}
        <ClockButtons onAction={handleClockAction} todayData={todayData} />

        {/* Today Status */}
        <TodayStatus todayData={todayData} />

        {/* Month Summary & Score */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <MonthSummary code={code} token={token!} />
          <ScoreDisplay code={code} token={token!} />
        </div>

        {/* Request Forms */}
        <RequestForms code={code} token={token!} onSubmitSuccess={loadTodayData} />
      </div>
    </div>
  );
}
