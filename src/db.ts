import Dexie, { type EntityTable } from 'dexie';
import type { Capture, Collection, Experience, Relation, Setting, Template } from './types';

export interface HistoryRecord {
  id: string;
  entityType: 'capture' | 'experience' | 'collection';
  entityId: string;
  snapshot: unknown;
  createdAt: string;
}

class RecallDatabase extends Dexie {
  captures!: EntityTable<Capture, 'id'>;
  experiences!: EntityTable<Experience, 'id'>;
  templates!: EntityTable<Template, 'id'>;
  collections!: EntityTable<Collection, 'id'>;
  relations!: EntityTable<Relation, 'id'>;
  settings!: EntityTable<Setting, 'key'>;
  history!: EntityTable<HistoryRecord, 'id'>;

  constructor() {
    super('recallsoro');
    this.version(1).stores({
      captures: 'id, status, kind, importedAt, capturedAt, sha256, *tags',
      experiences: 'id, startAt, endAt, status, *tags',
      templates: 'id, slug, isSystem',
      collections: 'id, templateId, updatedAt',
      relations: 'id, fromId, toId, relationType',
      settings: 'key',
    });
    this.version(2).stores({
      history: 'id, entityType, entityId, createdAt',
    });
  }
}

export const db = new RecallDatabase();

export const SYSTEM_TEMPLATES: Template[] = [
  {
    id: 'tpl-competition',
    name: '竞赛',
    slug: 'competition',
    description: '记录比赛、分级、奖项、佐证照片与复盘',
    icon: 'Trophy',
    isSystem: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    fields: [
      { key: '报名时间', label: '报名时间', type: 'text', placeholder: '2026.3', group: '时间与地点' },
      { key: '比赛时间', label: '比赛时间', type: 'text', placeholder: '2026.5', group: '时间与地点' },
      { key: '获奖时间', label: '获奖时间', type: 'text', placeholder: '2026-05-24', group: '时间与地点' },
      { key: '比赛地点', label: '比赛地点', type: 'text', placeholder: '城市 / 场馆 / 线上', group: '时间与地点' },
      { key: '湖大分级', label: '湖大分级', type: 'text', placeholder: 'A1 / A2 / B1 / B2 / 待确认', group: '级别与奖项' },
      { key: '原表级别', label: '原表级别', type: 'text', placeholder: '校级 / 省级 / 国家级 / 国际级', group: '级别与奖项' },
      { key: '分级依据', label: '分级依据', type: 'text', placeholder: '官方认定目录或条款', group: '级别与奖项' },
      { key: '是否获奖', label: '是否获奖', type: 'text', placeholder: '是 / 否 / 待核实', group: '级别与奖项' },
      { key: '奖项', label: '奖项', type: 'text', placeholder: '一等奖 / 银奖 / 优胜奖', group: '级别与奖项' },
      { key: '成绩', label: '成绩', type: 'text', placeholder: '360分 / 100/100', group: '级别与奖项' },
      { key: '排名', label: '排名', type: 'text', placeholder: '1/279', group: '级别与奖项' },
      { key: '颁奖单位', label: '颁奖单位', type: 'text', placeholder: '主办或颁奖机构', group: '级别与奖项' },
      { key: '个人赛/团队赛', label: '个人赛/团队赛', type: 'text', placeholder: '个人赛 / 团队赛', group: '团队与作品' },
      { key: '团队赛负责人', label: '团队赛负责人', type: 'text', placeholder: '队长或负责人姓名', group: '团队与作品' },
      { key: '指导老师', label: '指导老师', type: 'text', placeholder: '指导教师姓名', group: '团队与作品' },
      { key: '角色', label: '角色', type: 'text', placeholder: '队长 / 队员', group: '团队与作品' },
      { key: '队伍', label: '队伍', type: 'text', placeholder: '队伍名称或成员', group: '团队与作品' },
      { key: '作品链接', label: '作品链接', type: 'text', placeholder: 'https://', group: '团队与作品' },
      { key: '证书照片', label: '证书照片', type: 'evidence', placeholder: '拖拽或关联证书扫描件', group: '佐证材料' },
      { key: '奖牌照片', label: '奖牌照片', type: 'evidence', placeholder: '拖拽或关联奖牌照片', group: '佐证材料' },
      { key: '合照', label: '合照', type: 'evidence', placeholder: '拖拽或关联参赛合照', group: '佐证材料' },
      { key: '相关图片', label: '相关图片', type: 'evidence', placeholder: '拖拽或关联其他现场/截图佐证', group: '佐证材料' },
      { key: '备注', label: '备注', type: 'textarea', placeholder: '补充核验线索、微信记录或待办事项', group: '复盘与备注' },
      { key: '复盘', label: '复盘', type: 'textarea', placeholder: '这次经历学到了什么、下次如何改进', group: '复盘与备注' },
    ],
  },
  {
    id: 'tpl-travel',
    name: '旅行',
    slug: 'travel',
    description: '按时间线记录地点、照片与描述',
    icon: 'Map',
    isSystem: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    fields: [
      { key: 'destination', label: '目的地', type: 'text', placeholder: '城市或地区' },
      { key: 'companions', label: '同行人', type: 'text', placeholder: '和谁一起' },
      { key: 'transport', label: '交通', type: 'text', placeholder: '高铁 / 飞机 / 自驾' },
      { key: 'stay', label: '住宿', type: 'text', placeholder: '住在哪里' },
      { key: 'cost', label: '花费', type: 'text', placeholder: '大致花费' },
      { key: 'notes', label: '旅行笔记', type: 'textarea', placeholder: '沿途见闻与感受' },
    ],
  },
  {
    id: 'tpl-travelogue',
    name: '游记',
    slug: 'travelogue',
    description: '按天记录旅途见闻，图片和文字穿插',
    icon: 'BookOpen',
    isSystem: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    fields: [
      { key: 'destination', label: '目的地', type: 'text', placeholder: '城市或地区' },
      { key: 'companions', label: '同行人', type: 'text', placeholder: '和谁一起' },
      { key: 'route', label: '路线', type: 'textarea', placeholder: '行程路线' },
      { key: 'transport', label: '交通', type: 'text', placeholder: '高铁 / 飞机 / 自驾' },
      { key: 'stay', label: '住宿', type: 'text', placeholder: '住在哪里' },
      { key: 'cost', label: '花费', type: 'text', placeholder: '大致花费' },
      { key: 'photos', label: '照片', type: 'evidence', placeholder: '关联旅途照片' },
      { key: 'body', label: '游记正文', type: 'textarea', placeholder: '今天看到了什么，发生了什么' },
    ],
  },
  {
    id: 'tpl-project',
    name: '项目',
    slug: 'project',
    description: '记录项目背景、职责与成果',
    icon: 'Briefcase',
    isSystem: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    fields: [
      { key: 'stack', label: '技术栈', type: 'tags', placeholder: 'React, Rust' },
      { key: 'role', label: '职责', type: 'text', placeholder: '你负责什么' },
      { key: 'result', label: '成果', type: 'textarea', placeholder: '产出了什么' },
    ],
  },
  {
    id: 'tpl-course',
    name: '课程',
    slug: 'course',
    description: '记录课程、证书与学习收获',
    icon: 'GraduationCap',
    isSystem: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    fields: [
      { key: 'school', label: '机构', type: 'text', placeholder: '学校或平台' },
      { key: 'certificate', label: '证书', type: 'text', placeholder: '证书名称' },
      { key: 'takeaway', label: '收获', type: 'textarea', placeholder: '学到了什么' },
    ],
  },
  {
    id: 'tpl-general',
    name: '通用经历',
    slug: 'general',
    description: '不预设字段，自由记录任何经历',
    icon: 'Sparkles',
    isSystem: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    fields: [],
  },
];

export async function initDatabase() {
  const existing = await db.templates.toArray();
  if (existing.length === 0) {
    await db.templates.bulkPut(SYSTEM_TEMPLATES);
  } else {
    // 升级系统竞赛模板，保证新增字段与佐证槽位生效
    const compTpl = SYSTEM_TEMPLATES.find((t) => t.id === 'tpl-competition');
    if (compTpl) await db.templates.put(compTpl);
  }
  if (!(await db.settings.get('cloudAi'))) {
    await db.settings.put({ key: 'cloudAi', value: 'off' });
  }
}
