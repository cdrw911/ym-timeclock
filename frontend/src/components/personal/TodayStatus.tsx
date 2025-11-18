'use client';

import { formatTime, formatDateTime, secondsToHours, eventTypeMap } from '@/lib/utils';
import { Clock, AlertCircle, CheckCircle, TrendingUp } from 'lucide-react';

interface TodayStatusProps {
  todayData: any;
}

export default function TodayStatus({ todayData }: TodayStatusProps) {
  if (!todayData?.daySummary) {
    return (
      <div className="card mb-6">
        <h2 className="text-xl font-bold mb-4">今日出勤狀態</h2>
        <p className="text-gray-500">尚無今日出勤記錄</p>
      </div>
    );
  }

  const summary = todayData.daySummary;
  const events = todayData.events || [];

  return (
    <div className="card mb-6">
      <h2 className="text-xl font-bold mb-4">今日出勤狀態</h2>

      {/* Status Badges */}
      <div className="flex flex-wrap gap-2 mb-6">
        {summary.isLate && (
          <div className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            遲到 {summary.lateMinutes} 分鐘
          </div>
        )}
        {summary.isEarlyLeave && (
          <div className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-medium flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            早退 {summary.earlyLeaveMinutes} 分鐘
          </div>
        )}
        {summary.hasAdvanceNotice && (
          <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium flex items-center gap-1">
            <CheckCircle className="w-4 h-4" />
            已預先告知
          </div>
        )}
        {!summary.isLate && !summary.isEarlyLeave && (
          <div className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium flex items-center gap-1">
            <CheckCircle className="w-4 h-4" />
            正常出勤
          </div>
        )}
      </div>

      {/* Work Hours Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-primary-50 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">總工時</div>
          <div className="text-2xl font-bold text-primary-600">
            {secondsToHours(summary.totalWorkSeconds)}
          </div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">實地工時</div>
          <div className="text-2xl font-bold text-green-600">
            {secondsToHours(summary.workOnsiteSeconds)}
          </div>
        </div>
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">遠端工時</div>
          <div className="text-2xl font-bold text-blue-600">
            {secondsToHours(summary.workRemoteSeconds)}
          </div>
        </div>
        <div className="bg-orange-50 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">外出時間</div>
          <div className="text-2xl font-bold text-orange-600">
            {secondsToHours(summary.breakOffsiteSeconds || 0)}
          </div>
        </div>
      </div>

      {/* Events Timeline */}
      <div>
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          打卡記錄
        </h3>
        <div className="space-y-2">
          {events.length === 0 ? (
            <p className="text-gray-500 text-sm">尚無打卡記錄</p>
          ) : (
            events.map((event: any, index: number) => (
              <div
                key={event.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
              >
                <div className="text-2xl">
                  {event.type.includes('WORK_ONSITE') && '🏢'}
                  {event.type.includes('WORK_REMOTE') && '🏠'}
                  {event.type.includes('BREAK') && '☕'}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{eventTypeMap[event.type] || event.type}</div>
                  <div className="text-sm text-gray-500">{formatTime(event.timestamp)}</div>
                </div>
                <div className="text-sm text-gray-400">
                  {event.source === 'web' && '網頁'}
                  {event.source === 'discord' && 'Discord'}
                  {event.source === 'admin' && '管理員'}
                  {event.source === 'retro_approved' && '補打卡'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
