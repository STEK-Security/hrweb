/**
 * 조직도 — employees._path("법인 > 본부 > 팀" 파생, derive.ts)로 트리를 구성한다.
 * 노드마다 인원수를 보여주고 클릭하면 우측에 해당 소속 인원 목록을 표시한다.
 * 리더(팀장/부장/매니저 등)는 derive.ts 의 isLeader()로 판정해 강조한다.
 */
import { useEffect, useMemo, useState } from 'react';
import { Building2, ChevronRight, ChevronDown, Users } from 'lucide-react';
import { listEmployees, type Employee } from '../../lib/db';
import { isRealOrg, isLeader } from '../../excel/derive';

interface OrgNode {
  name: string;
  path: string;
  depth: number;
  children: Map<string, OrgNode>;
  members: Employee[];
}

/** 자식 노드를 인원수 내림차순으로 정렬한 배열로 반환 */
function sortedChildren(node: OrgNode): OrgNode[] {
  const arr: OrgNode[] = [];
  node.children.forEach((child) => arr.push(child));
  return arr.sort((a, b) => b.members.length - a.members.length);
}

function buildTree(active: Employee[]): OrgNode {
  const root: OrgNode = { name: '전체', path: '', depth: 0, children: new Map(), members: [] };
  for (const e of active) {
    const segments = (e._path.length ? e._path : [e._corp]).filter((s) => isRealOrg(s));
    if (segments.length === 0) continue;
    let node = root;
    let pathAcc = '';
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      pathAcc = pathAcc ? `${pathAcc} > ${seg}` : seg;
      let child = node.children.get(seg);
      if (!child) {
        child = { name: seg, path: pathAcc, depth: i + 1, children: new Map(), members: [] };
        node.children.set(seg, child);
      }
      child.members.push(e);
      node = child;
    }
  }
  root.members = active.filter((e) => isRealOrg(e._corp) || e._path.some((s) => isRealOrg(s)));
  return root;
}

function TreeNode({
  node,
  selectedPath,
  onSelect,
}: {
  node: OrgNode;
  selectedPath: string;
  onSelect: (n: OrgNode) => void;
}) {
  const [open, setOpen] = useState(node.depth <= 1);
  const children = sortedChildren(node);
  const hasChildren = children.length > 0;
  const isSelected = node.path === selectedPath;

  return (
    <div>
      <div
        role="button"
        onClick={() => {
          onSelect(node);
          if (hasChildren) setOpen((o) => !o);
        }}
        className={`flex items-center gap-1.5 py-1.5 px-2 rounded-lg cursor-pointer text-xs transition-colors ${
          isSelected ? 'bg-blue-100 text-blue-800 font-bold' : 'hover:bg-slate-100 text-slate-700'
        }`}
        style={{ paddingLeft: `${node.depth * 14 + 8}px` }}
      >
        {hasChildren ? (
          open ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        ) : (
          <span className="w-3.5 h-3.5 shrink-0" />
        )}
        <span className="truncate">{node.name}</span>
        <span className={`text-[10px] font-mono ml-auto shrink-0 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`}>
          {node.members.length}명
        </span>
      </div>
      {hasChildren && open && (
        <div>
          {children.map((c) => (
            <div key={c.path}>
              <TreeNode node={c} selectedPath={selectedPath} onSelect={onSelect} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function OrgChartPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<OrgNode | null>(null);

  useEffect(() => {
    let cancelled = false;
    listEmployees().then((data) => {
      if (cancelled) return;
      setEmployees(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const active = useMemo(() => employees.filter((e) => e._activeNow), [employees]);
  const tree = useMemo(() => buildTree(active), [active]);
  const topLevel = useMemo(() => sortedChildren(tree), [tree]);
  const current = selected ?? tree;

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-sm text-slate-500">불러오는 중...</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
        <Building2 className="w-5 h-5 text-blue-600" />
        조직도
      </h2>
      <p className="text-xs text-slate-500">전체소속명(법인 &gt; 본부 &gt; 팀) 기준 트리입니다. 노드를 클릭하면 소속 인원 목록이 표시됩니다.</p>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-xs p-3 max-h-[calc(100vh-260px)] overflow-y-auto">
          <div
            role="button"
            onClick={() => setSelected(null)}
            className={`flex items-center gap-1.5 py-1.5 px-2 rounded-lg cursor-pointer text-xs font-bold transition-colors ${
              !selected ? 'bg-blue-100 text-blue-800' : 'hover:bg-slate-100 text-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            전체
            <span className={`text-[10px] font-mono ml-auto ${!selected ? 'text-blue-600' : 'text-slate-400'}`}>
              {tree.members.length}명
            </span>
          </div>
          {topLevel.map((n) => (
            <div key={n.path}>
              <TreeNode node={n} selectedPath={selected?.path ?? ''} onSelect={setSelected} />
            </div>
          ))}
        </div>

        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div>
              <h3 className="text-sm font-bold text-slate-900">{current.path || '전체'}</h3>
              <p className="text-xs text-slate-500">소속 인원 {current.members.length}명</p>
            </div>
          </div>
          <div className="max-h-[calc(100vh-360px)] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="px-3 py-2">성명</th>
                  <th className="px-3 py-2">소속</th>
                  <th className="px-3 py-2">직책</th>
                  <th className="px-3 py-2">직급</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {current.members.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-slate-400">조회 결과가 없습니다.</td>
                  </tr>
                ) : (
                  current.members
                    .slice()
                    .sort((a, b) => a._name.localeCompare(b._name, 'ko'))
                    .map((e) => (
                      <tr key={e['id'] as string} className={isLeader(e) ? 'bg-blue-50/50' : undefined}>
                        <td className="px-3 py-2 font-bold text-slate-900">
                          {e._name}
                          {isLeader(e) && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-600 text-white">
                              리더
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">{e._team}</td>
                        <td className="px-3 py-2">{e._title}</td>
                        <td className="px-3 py-2">{e._grade}</td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
