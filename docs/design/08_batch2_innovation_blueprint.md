# OMT自主创新设计蓝图（Batch 2）

## 1. 自主创新清单（11项）

| 编号 | 创新项 | 原因 |
|-----|-------|------|
| I1 | grasp repo建模 | 定位不符 |
| I2 | PMB持久化 | 能力缺失 |
| I3 | Agent生命周期 | 能力缺失 |
| I4 | Skill动态注入 | 粒度不匹配 |
| I5 | Context动态组装 | 能力缺失 |
| I6 | 四层artifacts对齐 | 定位不符 |
| I7 | 自动WBS分解 | 能力缺失 |
| I8 | Sprint循环 | 定位不符 |
| I9 | Gap验收闭环 | 能力缺失 |
| I10 | 失败恢复 | 能力缺失 |
| I11 | Terminator托管 | 定位不符 |

## 2. 四层Artifacts对齐机制

TSpec→MSpec: Milestone解析验证
MSpec→Sprint: WBS一致性检查  
Sprint→Atom-task: DAG依赖验证

## 3. 任务生命周期

创建→执行→监控→恢复→审查→归档

## 4. 实现优先级

P0: I1-I4, I6-I9
P1: I5, I10  
P2: I11
