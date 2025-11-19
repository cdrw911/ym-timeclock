'use client';

import { useEffect, useState } from 'react';
import { personalApi } from '@/lib/api';
import { format } from 'date-fns';
import { secondsToHours } from '@/lib/utils';
import { Calendar, TrendingUp } from 'lucide-react';

interface MonthSummaryProps {
  code: string;
  token: string;
}

export default function MonthSummary({ code, token }: MonthSummaryProps) {
  const [data, setData] = useState<any>(null);
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [month]);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await personalApi.getMonthSummary(code, token, month);
      setData(response.data);
    } catch (err) {
      console.error('Failed to load month summary:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const summary = data?.summary || {};

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          本月統計
        </h2>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="input text-sm py-1"
        />
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-primary-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">出勤天數</div>
            <div className="text-3xl font-bold text-primary-600">
              {summary.totalDays || 0}
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">總工時</div>
            <div className="text-2xl font-bold text-green-600">
              {secondsToHours(summary.totalWorkSeconds || 0)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="text-xs text-gray-600 mb-1">實地工時</div>
            <div className="text-xl font-bold text-blue-600">
              {secondsToHours(summary.totalOnsiteSeconds || 0)}
            </div>
          </div>
          <div className="bg-indigo-50 rounded-lg p-3">
            <div className="text-xs text-gray-600 mb-1">遠端工時</div>
            <div className="text-xl font-bold text-indigo-600">
              {secondsToHours(summary.totalRemoteSeconds || 0)}
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div>
              <div className="text-gray-600 mb-1">遲到</div>
              <div className={`text-2xl font-bold ${summary.lateDays > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                {summary.lateDays || 0}
              </div>
            </div>
            <div>
              <div className="text-gray-600 mb-1">早退</div>
              <div className={`text-2xl font-bold ${summary.earlyLeaveDays > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                {summary.earlyLeaveDays || 0}
              </div>
            </div>
            <div>
              <div className="text-gray-600 mb-1">請假</div>
              <div className={`text-2xl font-bold ${summary.leaveDays > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>
                {summary.leaveDays || 0}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
