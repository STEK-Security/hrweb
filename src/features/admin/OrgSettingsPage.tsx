/**
 * 조직·기준·기능토글 설정(T12.2). org_settings(key/value jsonb) 조회·수정 — write 는 관리자만
 * RLS("settings admin write", 0008) 통과. 값 형태가 제각각(숫자/객체/배열/불리언)이라 불리언은
 * 토글 스위치, 그 외는 JSON 텍스트 편집으로 통일 처리한다.
 */
import { useEffect, useState } from 'react';
import { Settings, Loader2 } from 'lucide-react';
import { listOrgSettings, updateOrgSetting, type OrgSetting } from '../../lib/db';
import { setFieldGrades } from '../../excel/derive';
import { logEvent } from '../../lib/audit';

const KEY_LABELS: Record<string, string> = {
  probation_days: '수습평가 기준일(1차/최종, 일)',
  retire_age: '정년(세)',
  exclude_pattern: '명부 제외 패턴',
  field_grades: '현장직 직급 목록(이 직급만 현장직으로 집계)',
  org_name_map: '소속명 치환 매핑',
  employee_input_enabled: '직원 직접입력 기능',
  leave_input_enabled: '휴직 직접입력 기능',
};

function fmtTs(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString('ko-KR', { hour12: false });
}

export function OrgSettingsPage() {
  const [settings, setSettings] = useState<OrgSetting[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const reload = () => {
    setLoading(true);
    listOrgSettings().then((rows) => {
      setSettings(rows);
      setDrafts(Object.fromEntries(rows.map((r) => [r.key, JSON.stringify(r.value, null, 2)])));
      setLoading(false);
    });
  };

  useEffect(() => {
    reload();
  }, []);

  const handleSaveJson = async (key: string) => {
    setErrors((e) => ({ ...e, [key]: '' }));
    let parsed: unknown;
    try {
      parsed = JSON.parse(drafts[key] ?? '');
    } catch {
      setErrors((e) => ({ ...e, [key]: '유효한 JSON 형식이 아닙니다.' }));
      return;
    }
    setSavingKey(key);
    const ok = await updateOrgSetting(key, parsed);
    if (ok) {
      // field_grades 는 derive.ts 가 앱 시작 시 1회만 읽는다 → 저장 즉시 메모리에도 반영해야
      // 새로고침 없이 사무직/현장직 분류가 바뀐다.
      if (key === 'field_grades' && Array.isArray(parsed)) setFieldGrades(parsed as string[]);
      await logEvent('update_settings', { targetTable: 'org_settings', meta: { key } });
      reload();
    } else {
      setErrors((e) => ({ ...e, [key]: '저장에 실패했습니다.' }));
    }
    setSavingKey(null);
  };

  const handleToggleBool = async (key: string, next: boolean) => {
    setSavingKey(key);
    const ok = await updateOrgSetting(key, next);
    if (ok) {
      await logEvent('update_settings', { targetTable: 'org_settings', meta: { key, value: next } });
      reload();
    }
    setSavingKey(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-600" />
          조직·기준·기능토글 설정
        </h2>
        <span className="text-xs text-slate-500">전체 {settings.length}건</span>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
          불러오는 중...
        </div>
      ) : settings.length === 0 ? (
        <div className="p-8 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
          설정값이 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {settings.map((s) => {
            const isBool = typeof s.value === 'boolean';
            return (
              <div key={s.key} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{KEY_LABELS[s.key] ?? s.key}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{s.key}</p>
                  </div>
                  {isBool && (
                    <button
                      type="button"
                      disabled={savingKey === s.key}
                      onClick={() => handleToggleBool(s.key, !(s.value as boolean))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors disabled:opacity-50 ${
                        s.value
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-slate-100 border-slate-200 text-slate-500'
                      }`}
                    >
                      {s.value ? 'ON' : 'OFF'}
                    </button>
                  )}
                </div>

                {!isBool && (
                  <div className="space-y-1.5">
                    <textarea
                      value={drafts[s.key] ?? ''}
                      onChange={(e) => setDrafts((d) => ({ ...d, [s.key]: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {errors[s.key] && (
                      <p className="text-[11px] text-rose-600 font-semibold">{errors[s.key]}</p>
                    )}
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={savingKey === s.key}
                        onClick={() => handleSaveJson(s.key)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                      >
                        {savingKey === s.key && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        저장
                      </button>
                    </div>
                  </div>
                )}

                <p className="mt-1.5 text-[10px] text-slate-400">최종수정 {fmtTs(s.updated_at)}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
