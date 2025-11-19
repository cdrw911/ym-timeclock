import { format, parseISO } from 'date-fns';
import { zhTW } from 'date-fns/locale';

export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'HH:mm', { locale: zhTW });
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'yyyy-MM-dd', { locale: zhTW });
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'yyyy-MM-dd HH:mm', { locale: zhTW });
}

export function formatDateTimeFull(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'yyyy年M月d日 HH:mm', { locale: zhTW });
}

export function secondsToHours(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export const eventTypeMap: Record<string, string> = {
  WORK_ONSITE_START: '實地上班',
  WORK_ONSITE_END: '實地下班',
  WORK_REMOTE_START: '遠端上班',
  WORK_REMOTE_END: '遠端下班',
  BREAK_OFFSITE_START: '外出開始',
  BREAK_OFFSITE_END: '外出結束',
};

export const leaveTypeMap: Record<string, string> = {
  sick: '病假',
  menstrual: '生理假',
  personal: '事假',
  other: '其他',
};

export const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '待審核', color: 'bg-yellow-100 text-yellow-800' },
  approved: { label: '已核准', color: 'bg-green-100 text-green-800' },
  rejected: { label: '已駁回', color: 'bg-red-100 text-red-800' },
};
