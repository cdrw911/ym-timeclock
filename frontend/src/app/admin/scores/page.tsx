'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import { Trophy, Download } from 'lucide-react';
import { format } from 'date-fns';

export default function ScoresPage() {
  const [scores, setScores] = useState<any[]>([]);
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadScores();
  }, [month]);

  const loadScores = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getScores(month);
      setScores(response.data);
    } catch (err) {
      console.error('Failed to load scores:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'excel') => {
    try {
      const response = await adminApi.exportReport(month, format);
      const blob = new Blob([response.data], {
        type: format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-report-${month}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.response?.data?.message || '匯出失敗');
    }
  };

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Trophy className="w-8 h-8" />
              分數管理
            </h1>
            <p className="text-gray-500 mt-1">查看實習生每月出勤分數</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleExport('csv')}
              className="btn-secondary flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              匯出 CSV
            </button>
            <button
              onClick={() => handleExport('excel')}
              className="btn-primary flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              匯出 Excel
            </button>
          </div>
        </div>
      </div>

      <div className="card mb-6">
        <div className="flex items-center gap-4">
          <label className="font-medium">選擇月份：</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="input"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : scores.length === 0 ? (
        <div className="card text-center py-12">
          <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">該月份無分數記錄</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4">排名</th>
                <th className="text-left py-3 px-4">編號</th>
                <th className="text-left py-3 px-4">姓名</th>
                <th className="text-right py-3 px-4">基礎分</th>
                <th className="text-right py-3 px-4">扣分</th>
                <th className="text-right py-3 px-4">加分</th>
                <th className="text-right py-3 px-4">總分</th>
                <th className="text-left py-3 px-4">等第</th>
              </tr>
            </thead>
            <tbody>
              {scores
                .sort((a, b) => b.finalScore - a.finalScore)
                .map((score, index) => {
                  const getGrade = (s: number) => {
                    if (s >= 95) return 'A+';
                    if (s >= 90) return 'A';
                    if (s >= 85) return 'B+';
                    if (s >= 80) return 'B';
                    if (s >= 75) return 'C';
                    return 'D';
                  };

                  const getGradeColor = (s: number) => {
                    if (s >= 95) return 'bg-green-100 text-green-800';
                    if (s >= 85) return 'bg-blue-100 text-blue-800';
                    if (s >= 75) return 'bg-yellow-100 text-yellow-800';
                    return 'bg-red-100 text-red-800';
                  };

                  return (
                    <tr key={score.id} className="border-b border-gray-100 last:border-0">
                      <td className="py-3 px-4">
                        <span className="text-lg font-bold">
                          {index === 0 && '🥇'}
                          {index === 1 && '🥈'}
                          {index === 2 && '🥉'}
                          {index > 2 && `#${index + 1}`}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono">{score.user?.code}</td>
                      <td className="py-3 px-4 font-medium">{score.user?.name}</td>
                      <td className="py-3 px-4 text-right">{score.baseScore}</td>
                      <td className="py-3 px-4 text-right text-red-600">
                        -{Math.abs(score.totalDeduction).toFixed(1)}
                      </td>
                      <td className="py-3 px-4 text-right text-green-600">
                        +{score.bonusPoints.toFixed(1)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-2xl font-bold text-primary-600">
                          {score.finalScore.toFixed(1)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-bold ${getGradeColor(score.finalScore)}`}>
                          {getGrade(score.finalScore)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
