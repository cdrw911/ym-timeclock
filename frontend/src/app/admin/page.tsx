'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import { Users, Clock, FileText, TrendingUp, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      // Load dashboard stats (would need to implement this endpoint)
      // For now, we'll load from multiple endpoints
      const [usersRes, leaveRes, retroRes] = await Promise.all([
        adminApi.getUsers(),
        adminApi.getLeaveRequests('pending'),
        adminApi.getRetroRequests('pending'),
      ]);

      setStats({
        totalUsers: usersRes.data.length,
        activeUsers: usersRes.data.filter((u: any) => u.isActive).length,
        pendingLeaves: leaveRes.data.length,
        pendingRetros: retroRes.data.length,
      });
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">儀表板</h1>
        <p className="text-gray-500 mt-1">{format(new Date(), 'yyyy年M月d日 HH:mm')}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="text-gray-600 text-sm">總使用者數</div>
            <Users className="w-8 h-8 text-primary-600" />
          </div>
          <div className="text-3xl font-bold text-gray-900">{stats?.totalUsers || 0}</div>
          <div className="text-sm text-gray-500 mt-1">
            活躍: {stats?.activeUsers || 0}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="text-gray-600 text-sm">待審核請假</div>
            <FileText className="w-8 h-8 text-yellow-600" />
          </div>
          <div className="text-3xl font-bold text-gray-900">{stats?.pendingLeaves || 0}</div>
          <div className="text-sm text-gray-500 mt-1">
            需要處理
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="text-gray-600 text-sm">待審核補打卡</div>
            <Clock className="w-8 h-8 text-orange-600" />
          </div>
          <div className="text-3xl font-bold text-gray-900">{stats?.pendingRetros || 0}</div>
          <div className="text-sm text-gray-500 mt-1">
            需要處理
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="text-gray-600 text-sm">系統狀態</div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
          <div className="text-3xl font-bold text-green-600">正常</div>
          <div className="text-sm text-gray-500 mt-1">
            所有服務運行中
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h2 className="text-xl font-bold mb-4">待處理事項</h2>
          <div className="space-y-3">
            {stats?.pendingLeaves > 0 && (
              <a
                href="/admin/leave-requests"
                className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors"
              >
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <div className="flex-1">
                  <div className="font-medium">請假申請待審核</div>
                  <div className="text-sm text-gray-500">{stats.pendingLeaves} 筆待處理</div>
                </div>
              </a>
            )}
            {stats?.pendingRetros > 0 && (
              <a
                href="/admin/retro-requests"
                className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
              >
                <AlertCircle className="w-5 h-5 text-orange-600" />
                <div className="flex-1">
                  <div className="font-medium">補打卡申請待審核</div>
                  <div className="text-sm text-gray-500">{stats.pendingRetros} 筆待處理</div>
                </div>
              </a>
            )}
            {(!stats?.pendingLeaves && !stats?.pendingRetros) && (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">✓</div>
                <p>沒有待處理事項</p>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold mb-4">快速連結</h2>
          <div className="grid grid-cols-2 gap-3">
            <a href="/admin/users" className="btn-secondary text-center py-4">
              <Users className="w-6 h-6 mx-auto mb-2" />
              <div className="text-sm">使用者管理</div>
            </a>
            <a href="/admin/scores" className="btn-secondary text-center py-4">
              <TrendingUp className="w-6 h-6 mx-auto mb-2" />
              <div className="text-sm">分數統計</div>
            </a>
            <a href="/admin/config" className="btn-secondary text-center py-4">
              <TrendingUp className="w-6 h-6 mx-auto mb-2" />
              <div className="text-sm">系統設定</div>
            </a>
            <a href="/" className="btn-secondary text-center py-4">
              <TrendingUp className="w-6 h-6 mx-auto mb-2" />
              <div className="text-sm">公開看板</div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
