'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import { formatDateTime, eventTypeMap, statusMap } from '@/lib/utils';
import { Check, X, Clock } from 'lucide-react';

export default function RetroRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');

  useEffect(() => {
    loadRequests();
  }, [filter]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getRetroRequests(filter === 'all' ? undefined : filter);
      setRequests(response.data);
    } catch (err) {
      console.error('Failed to load retro requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    if (!confirm('確定要核准此補打卡申請嗎？')) return;

    try {
      await adminApi.approveRetroRequest(id);
      alert('已核准補打卡申請');
      loadRequests();
    } catch (err: any) {
      alert(err.response?.data?.message || '操作失敗');
    }
  };

  const handleReject = async (id: string) => {
    const notes = prompt('請輸入駁回原因：');
    if (!notes) return;

    try {
      await adminApi.rejectRetroRequest(id, notes);
      alert('已駁回補打卡申請');
      loadRequests();
    } catch (err: any) {
      alert(err.response?.data?.message || '操作失敗');
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">補打卡申請審核</h1>
        <p className="text-gray-500 mt-1">審核實習生的補打卡申請</p>
      </div>

      {/* Filter */}
      <div className="card mb-6">
        <div className="flex gap-2">
          {(['pending', 'approved', 'rejected', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === f
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {f === 'pending' && '待審核'}
              {f === 'approved' && '已核准'}
              {f === 'rejected' && '已駁回'}
              {f === 'all' && '全部'}
            </button>
          ))}
        </div>
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : requests.length === 0 ? (
        <div className="card text-center py-12">
          <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">沒有補打卡申請</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <div key={request.id} className="card">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold">{request.user?.name || request.userId}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${statusMap[request.status]?.color}`}>
                      {statusMap[request.status]?.label}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>日期時間: {formatDateTime(`${request.date}T${request.time}`)}</div>
                    <div>打卡類型: {eventTypeMap[request.type] || request.type}</div>
                  </div>
                </div>
                {request.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(request.id)}
                      className="btn-primary flex items-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      核准
                    </button>
                    <button
                      onClick={() => handleReject(request.id)}
                      className="btn-danger flex items-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      駁回
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-yellow-50 rounded-lg p-4">
                  <div className="text-sm font-medium text-yellow-700 mb-1">忘記打卡原因</div>
                  <div className="text-gray-900">{request.reason}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="text-sm font-medium text-green-700 mb-1">改善方案</div>
                  <div className="text-gray-900">{request.improvementPlan}</div>
                </div>
              </div>

              {request.reviewNotes && (
                <div className="mt-4 bg-blue-50 rounded-lg p-4">
                  <div className="text-sm font-medium text-blue-700 mb-1">審核備註</div>
                  <div className="text-blue-900">{request.reviewNotes}</div>
                </div>
              )}

              <div className="mt-4 text-xs text-gray-500">
                申請時間: {formatDateTime(request.createdAt)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
