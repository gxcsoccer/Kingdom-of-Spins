# Backlog & pending decisions

## Pending decisions (need the user)

### D1 · 怎么获得新陀螺（2026-10-11 记录）
现状：打赢对手只给金币；新陀螺来自 初始三选一 / 商店盲盒（100 金币）/ AI 融合（不消耗父陀螺）。
最快路线：赢 1 个普通对手 → 开盲盒（第 2 只）→ 融合（第 3 只）→ 职业对手解锁。
问题：路线没有显式引导，孩子打完一局可能不知道下一步。
选项：
1. **（推荐）首次击败某对手 → 获得他的陀螺**（例：赢小岚得 Mist Fish）。"赢 = 拿陀螺"最直观；盲盒与融合作为额外收集。
2. 保持现状 + 结算页引导按钮（"去开盲盒" → "去融合工坊"）。

### D2 · 已按推荐方案实现、待用户确认
- 美术方向 C：漫画分镜 UI + 彩色卡通 3D 对战
- 送给 NPC 队员的陀螺 = 装备（仍留在收藏里）
- 融合不消耗父陀螺，新陀螺计入收藏
- 先拿 4 分获胜（演示模式 2 分）

## Blocked on the user
- Google OAuth Client ID/Secret → `bash supabase/enable-google.sh <ID> <SECRET>`；之后验证家长登录、孩子档案、云存档。
- 美术素材 → 见 `docs/ART_BRIEF.md`，放入 `public/art/`。

## Next up (proposed order)
- P0 演示准备：3 分钟演示脚本 + 预置存档、平板/小屏触控测试、录备用视频
- P1 物理：X Dash 齿轨（不增能量的方式）
- P2 玩法：超级职业 / Boss 战的"队员代打"
