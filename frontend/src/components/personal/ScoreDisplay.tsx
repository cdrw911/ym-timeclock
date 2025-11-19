'use client';

import { useEffect, useState } from 'react';
import { personalApi } from '@/lib/api';
import { format } from 'date-fns';
import { formatDate } from '@/lib/utils';
import { Trophy, TrendingDown, TrendingUp, Award } from 'lucide-react';

interface ScoreDisplayProps {
  code: string;
  token: string;
}

export default function ScoreDisplay({ code, token }: ScoreDisplayProps) {
  const [data, setData] = useState<any>(null);
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [month]);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await personalApi.getScore(code, token, month);
      setData(response.data);
    } catch (err) {
      console.error('Failed to load score:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const score = data?.score || {};
  const details = data?.details || [];

  const getScoreColor = (score: number) => {
    if (score >= 95) return 'text-green-600';
    if (score >= 85) return 'text-blue-600';
    if (score >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreGrade = (score: number) => {
    if (score >= 95) return 'A+';
    if (score >= 90) return 'A';
    if (score >= 85) return 'B+';
    if (score >= 80) return 'B';
    if (score >= 75) return 'C';
    return 'D';
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Trophy className="w-5 h-5" />
          本月分數
        </h2>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="input text-sm py-1"
        />
      </div>

      {/* Score Display */}
      <div className="bg-gradient-to-br from-primary-50 to-blue-50 rounded-xl p-6 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-600 mb-2">總分</div>
            <div className={`text-6xl font-bold ${getScoreColor(score.finalScore || 100)}`}>
              {(score.finalScore || 100).toFixed(1)}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              基礎分: {score.baseScore || 100} |
              扣分: {Math.abs(score.totalDeduction || 0)} |
              加分: {score.bonusPoints || 0}
            </div>
          </div>
          <div className="text-center">
            <div className={`text-5xl font-bold ${getScoreColor(score.finalScore || 100)}`}>
              {getScoreGrade(score.finalScore || 100)}
            </div>
            <div className="text-sm text-gray-500 mt-2">等第</div>
          </div>
        </div>
      </div>

      {/* Score Details */}
      <div>
        <h3 className="font-semibold mb-3 text-sm text-gray-600">扣分明細</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {details.length === 0 ? (
            <div className="text-center py-8">
              <Award className="w-12 h-12 text-green-500 mx-auto mb-2" />
              <p className="text-green-600 font-medium">本月無扣分記錄！</p>
              <p className="text-sm text-gray-500 mt-1">繼續保持 💪</p>
            </div>
          ) : (
            details.map((detail: any) => (
              <div
                key={detail.id}
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  detail.pointsDelta > 0 ? 'bg-green-50' : 'bg-red-50'
                }`}
              >
                <div className="text-2xl">
                  {detail.pointsDelta > 0 ? (
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  ) : (
                    <TrendingDown className="w-6 h-6 text-red-600" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">
                    {detail.reasonType === 'late' && '遲到'}
                    {detail.reasonType === 'early_leave' && '早退'}
                    {detail.reasonType === 'absence' && '缺勤'}
                    {detail.reasonType === 'retro' && '補打卡'}
                    {detail.reasonType === 'bonus' && '獎勵'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDate(detail.relatedDate)}
                    {detail.notes && ` - ${detail.notes}`}
                  </div>
                </div>
                <div className={`text-lg font-bold ${
                  detail.pointsDelta > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {detail.pointsDelta > 0 ? '+' : ''}{detail.pointsDelta}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
