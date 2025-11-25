'use client';

import { LogIn, LogOut, Coffee } from 'lucide-react';
import { useState } from 'react';

interface ClockButtonsProps {
  onAction: (action: 'in' | 'out' | 'break-start' | 'break-end', type?: 'onsite' | 'remote') => Promise<void>;
  todayData: any;
}

export default function ClockButtons({ onAction, todayData }: ClockButtonsProps) {
  const [loading, setLoading] = useState(false);
  const [showWorkTypeModal, setShowWorkTypeModal] = useState(false);

  const handleClockIn = async (type: 'onsite' | 'remote') => {
    setLoading(true);
    setShowWorkTypeModal(false);
    try {
      await onAction('in', type);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: 'out' | 'break-start' | 'break-end') => {
    setLoading(true);
    try {
      await onAction(action);
    } finally {
      setLoading(false);
    }
  };

  const lastEvent = todayData?.lastEvent;
  const canClockIn = !lastEvent || lastEvent.type.includes('END');
  const canClockOut = lastEvent && lastEvent.type.includes('START') && lastEvent.type.includes('WORK');
  const canBreakStart = lastEvent && lastEvent.type.includes('WORK_') && lastEvent.type.includes('START');
  const canBreakEnd = lastEvent && lastEvent.type === 'BREAK_OFFSITE_START';

  return (
    <div className="card mb-6">
      <h2 className="text-xl font-bold mb-4">打卡操作</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Clock In */}
        <button
          onClick={() => setShowWorkTypeModal(true)}
          disabled={!canClockIn || loading}
          className="btn-primary flex flex-col items-center py-6 disabled:opacity-50"
        >
          <LogIn className="w-8 h-8 mb-2" />
          <span className="font-semibold">上班打卡</span>
        </button>

        {/* Clock Out */}
        <button
          onClick={() => handleAction('out')}
          disabled={!canClockOut || loading}
          className="btn-primary flex flex-col items-center py-6 disabled:opacity-50"
        >
          <LogOut className="w-8 h-8 mb-2" />
          <span className="font-semibold">下班打卡</span>
        </button>

        {/* Break Start */}
        <button
          onClick={() => handleAction('break-start')}
          disabled={!canBreakStart || loading}
          className="btn-secondary flex flex-col items-center py-6 disabled:opacity-50"
        >
          <Coffee className="w-8 h-8 mb-2" />
          <span className="font-semibold">外出開始</span>
        </button>

        {/* Break End */}
        <button
          onClick={() => handleAction('break-end')}
          disabled={!canBreakEnd || loading}
          className="btn-secondary flex flex-col items-center py-6 disabled:opacity-50"
        >
          <Coffee className="w-8 h-8 mb-2" />
          <span className="font-semibold">外出結束</span>
        </button>
      </div>

      {/* Work Type Modal */}
      {showWorkTypeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">選擇工作類型</h3>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleClockIn('onsite')}
                className="btn-primary py-8"
                disabled={loading}
              >
                <div className="text-4xl mb-2">🏢</div>
                <div className="font-semibold">實地上班</div>
              </button>
              <button
                onClick={() => handleClockIn('remote')}
                className="btn-primary py-8"
                disabled={loading}
              >
                <div className="text-4xl mb-2">🏠</div>
                <div className="font-semibold">遠端上班</div>
              </button>
            </div>
            <button
              onClick={() => setShowWorkTypeModal(false)}
              className="btn-secondary w-full mt-4"
              disabled={loading}
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
