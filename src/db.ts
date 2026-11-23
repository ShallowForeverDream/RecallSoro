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
    id: 'tpl-credential',
    name: '证件与资质',
    slug: 'credential',
    description: '管理四六级、软考、驾照、学生证等资质与到期提醒',
    icon: 'ShieldCheck',
    isSystem: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    fields: [
      { key: '证件类别', label: '证件类别', type: 'text', placeholder: '语言成绩 / 职业资格 / 身份证明 / 荣誉资质', group: '资质信息' },
      { key: '发证机构', label: '发证机构', type: 'text', placeholder: '教育部考试中心 / 工信部等', group: '资质信息' },
      { key: '证件编号', label: '证件编号', type: 'text', placeholder: '证书号或成绩单号', group: '资质信息' },
      { key: '成绩或等级', label: '成绩或等级', type: 'text', placeholder: '例如：CET-6 580分 / 软考高级', group: '资质信息' },
      { key: '签发日期', label: '签发日期', type: 'text', placeholder: '2025-06-20', group: '有效期管理' },
      { key: '有效期至', label: '有效期至', type: 'text', placeholder: 'YYYY-MM-DD，长期有效可留空', group: '有效期管理' },
      { key: '证书照片', label: '证件扫描件', type: 'evidence', placeholder: '上传证件正反面或电子成绩单', group: '佐证材料' },
      { key: '备注', label: '备注', type: 'textarea', placeholder: '存放位置、年审要求等', group: '备注' },
    ],
  },
  {
    id: 'tpl-project',
    name: '项目',
    slug: 'project',
    description: '按 STAR 结构记录项目背景、技术栈、职责与量化成果',
    icon: 'Briefcase',
    isSystem: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    fields: [
      { key: '技术栈', label: '技术栈', type: 'tags', placeholder: 'React, TypeScript, Rust, Tauri', group: '项目概况' },
      { key: '角色', label: '个人角色', type: 'text', placeholder: '独立开发 / 前端负责人 / 核心成员', group: '项目概况' },
      { key: '作品链接', label: '仓库 / 演示链接', type: 'text', placeholder: 'https://github.com/...', group: '项目概况' },
      { key: '项目背景', label: '背景与目标 (S/T)', type: 'textarea', placeholder: '为什么要做这个项目，解决什么问题', group: 'STAR 简历素材' },
      { key: '核心难点', label: '核心难点与方案 (A)', type: 'textarea', placeholder: '遇到了什么技术瓶颈，怎么解决的', group: 'STAR 简历素材' },
      { key: '量化成果', label: '量化成果 (R)', type: 'textarea', placeholder: '性能提升、用户量、获奖或上线情况', group: 'STAR 简历素材' },
    ],
  },
  {
    id: 'tpl-travel',
    name: '旅行',
    slug: 'travel',
    description: '按时间线记录地点、同行人、花费与沿途照片',
    icon: 'Map',
    isSystem: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    fields: [
      { key: '目的地', label: '目的地', type: 'text', placeholder: '城市或地区', group: '行程信息' },
      { key: '同行人', label: '同行人', type: 'text', placeholder: '和谁一起', group: '行程信息' },
      { key: '交通', label: '交通', type: 'text', placeholder: '高铁 / 飞机 / 自驾', group: '行程信息' },
      { key: '住宿', label: '住宿', type: 'text', placeholder: '住在哪里', group: '行程信息' },
      { key: '花费', label: '花费', type: 'text', placeholder: '大致花费', group: '行程信息' },
      { key: '旅行笔记', label: '旅行笔记', type: 'textarea', placeholder: '沿途见闻与感受', group: '游记' },
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
      { key: '目的地', label: '目的地', type: 'text', placeholder: '城市或地区', group: '行程信息' },
      { key: '同行人', label: '同行人', type: 'text', placeholder: '和谁一起', group: '行程信息' },
      { key: '路线', label: '路线', type: 'textarea', placeholder: '行程路线', group: '行程信息' },
      { key: '花费', label: '花费', type: 'text', placeholder: '大致花费', group: '行程信息' },
      { key: '游记正文', label: '游记正文', type: 'textarea', placeholder: '今天看到了什么，发生了什么', group: '游记' },
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
      { key: '机构', label: '学校或平台', type: 'text', placeholder: '学校 / Coursera / 公开课', group: '课程信息' },
      { key: '证书', label: '结课证书', type: 'text', placeholder: '证书名称或编号', group: '课程信息' },
      { key: '收获', label: '学习收获', type: 'textarea', placeholder: '学到了什么', group: '课程信息' },
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
  await db.templates.bulkPut(SYSTEM_TEMPLATES);
  if (!(await db.settings.get('cloudAi'))) {
    await db.settings.put({ key: 'cloudAi', value: 'off' });
  }
}
