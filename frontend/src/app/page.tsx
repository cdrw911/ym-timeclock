'use client';

import { useEffect, useState } from 'react';
import { publicApi } from '@/lib/api';
import { Trophy, TrendingUp, Clock, Users } from 'lucide-react';
import { formatTime } from '@/lib/utils';

export default function PublicBoard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadData = async () => {
    try {
      const response = await publicApi.getBoard();
      setData(response.data);
    } catch (err) {
      console.error('Failed to load board:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 to-blue-700">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4"></div>
          <p className="text-xl">載入中...</p>
        </div>
      </div>
    );
  }

  const interns = data?.interns || [];
  const topPerformers = [...interns].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 5);
  const currentlyWorking = interns.filter((i: any) => i.status === 'working');

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-blue-700 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center text-white mb-12">
          <div className="text-6xl mb-4">🕐</div>
          <h1 className="text-5xl font-bold mb-4">TimeClock</h1>
          <p className="text-2xl font-light opacity-90">VDO 實習生出勤系統</p>
          <div className="text-4xl font-mono font-bold mt-6">
            {formatTime(currentTime)}
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white bg-opacity-20 backdrop-blur-lg rounded-2xl p-6 text-white">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-8 h-8" />
              <div className="text-lg opacity-90">實習生總數</div>
            </div>
            <div className="text-5xl font-bold">{interns.length}</div>
          </div>

          <div className="bg-white bg-opacity-20 backdrop-blur-lg rounded-2xl p-6 text-white">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-8 h-8" />
              <div className="text-lg opacity-90">目前上班中</div>
            </div>
            <div className="text-5xl font-bold">{currentlyWorking.length}</div>
          </div>

          <div className="bg-white bg-opacity-20 backdrop-blur-lg rounded-2xl p-6 text-white">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-8 h-8" />
              <div className="text-lg opacity-90">平均出勤率</div>
            </div>
            <div className="text-5xl font-bold">
              {interns.length > 0
                ? Math.round(interns.reduce((sum: number, i: any) => sum + (i.attendanceRate || 0), 0) / interns.length)
                : 0}%
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Performers */}
          <div className="bg-white rounded-2xl shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <Trophy className="w-8 h-8 text-yellow-500" />
              <h2 className="text-2xl font-bold text-gray-900">本月排行榜</h2>
            </div>

            <div className="space-y-3">
              {topPerformers.length === 0 ? (
                <p className="text-gray-500 text-center py-8">暫無數據</p>
              ) : (
                topPerformers.map((intern: any, index: number) => (
                  <div
                    key={intern.id}
                    className={`flex items-center gap-4 p-4 rounded-xl ${
                      index === 0
                        ? 'bg-gradient-to-r from-yellow-100 to-yellow-50'
                        : index === 1
                        ? 'bg-gradient-to-r from-gray-100 to-gray-50'
                        : index === 2
                        ? 'bg-gradient-to-r from-orange-100 to-orange-50'
                        : 'bg-gray-50'
                    }`}
                  >
                    <div className="text-3xl font-bold">
                      {index === 0 && '🥇'}
                      {index === 1 && '🥈'}
                      {index === 2 && '🥉'}
                      {index > 2 && `#${index + 1}`}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-lg">{intern.name}</div>
                      <div className="text-sm text-gray-600">{intern.code}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary-600">
                        {(intern.score || 100).toFixed(1)}
                      </div>
                      <div className="text-xs text-gray-500">分數</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Current Status */}
          <div className="bg-white rounded-2xl shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <Clock className="w-8 h-8 text-primary-600" />
              <h2 className="text-2xl font-bold text-gray-900">即時狀態</h2>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {interns.length === 0 ? (
                <p className="text-gray-500 text-center py-8">暫無數據</p>
              ) : (
                interns.map((intern: any) => (
                  <div
                    key={intern.id}
                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl"
                  >
                    <div className="text-2xl">
                      {intern.status === 'working' && '💼'}
                      {intern.status === 'remote' && '🏠'}
                      {intern.status === 'break' && '☕'}
                      {intern.status === 'off' && '⏸️'}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold">{intern.name}</div>
                      <div className="text-sm text-gray-600">{intern.code}</div>
                    </div>
                    <div className="text-right">
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                        intern.status === 'working'
                          ? 'bg-green-100 text-green-800'
                          : intern.status === 'remote'
                          ? 'bg-blue-100 text-blue-800'
                          : intern.status === 'break'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {intern.status === 'working' && '上班中'}
                        {intern.status === 'remote' && '遠端工作'}
                        {intern.status === 'break' && '休息中'}
                        {intern.status === 'off' && '已下班'}
                      </div>
                      {intern.lastClockTime && (
                        <div className="text-xs text-gray-500 mt-1">
                          {formatTime(intern.lastClockTime)}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-white mt-12 opacity-75">
          <p>VDO Lab - Intern Attendance Management System</p>
          <p className="text-sm mt-2">
            <a href="/admin" className="hover:underline">管理員登入</a>
          </p>
        </div>
      </div>
    </div>
  );
}
