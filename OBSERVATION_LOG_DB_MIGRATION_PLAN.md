# Observation Log 数据库迁移计划

## 背景

当前生产库以前一直是 **先手动改数据库，再把结构拉回代码** 的 DB-first 流程，并没有 Prisma migration baseline。

因此这次 observation-log 上线不应该直接执行：

```bash
npx prisma migrate deploy
```

原因是当前 `prisma/migrations` 里有一个历史 baseline migration：

```text
20250712125808_init
```

这个 migration 描述的是已有老库结构。如果直接跑 `migrate deploy`，Prisma 会认为这个 migration 也需要执行，可能尝试创建生产库里已经存在的老表，导致冲突或失败。

本次推荐策略是：

1. 继续使用 DB-first 方式。
2. 只执行 observation-log 新增表和读模型 view 的 SQL。
3. 生产库迁移完成后，DEV 库通过每日同步自动获得新结构。
4. Prisma baseline 是否要补，放到后续单独处理。

本次主要 SQL 文件是：

```text
prisma/migrations/20260507000000_observation_log_system/migration.sql
prisma/migrations/20260516000000_observation_log_info_view/migration.sql
```

第一份 SQL 创建 observation-log 相关的新表；第二份 SQL 创建 `observation_log_info` 读模型 view。两者都不修改老表。

## 本次会新增的表和 view

执行后应该新增这些表和 view：

```text
observation_log
observation_log_field
observation_log_field_value
observation_log_tag
observation_log_tag_link
aircraft_info_submission
observation_log_info
```

这些表支持：

- 用户观察日志主记录
- 用户自定义字段模板
- 每条日志的自定义字段值
- 用户标签
- 日志和标签的关联
- 缺失飞机信息提交与审核
- 观察日志列表、详情、搜索和统计需要的机场/航司/队列照片读模型

## 总原则

### 1. 不在 DEV 上作为最终迁移入口

**做什么：**  
不要只在 DEV 库执行迁移并认为完成。

**为什么：**  
DEV 库每天会从生产库同步，而且同步方式是先删库再同步。任何只在 DEV 上做的结构变更，第二天都会被生产库覆盖掉。

**怎么确认：**  
迁移完成后，以生产库结构为准。DEV 只作为验证环境或同步结果。

### 2. 不直接跑 Prisma migrate deploy

**做什么：**  
本次生产迁移不执行：

```bash
npx prisma migrate deploy
```

**为什么：**  
生产库没有 Prisma baseline，而 migration 目录里包含历史老库的 `20250712125808_init`。直接 deploy 可能让 Prisma 尝试执行老库初始化 SQL。

**怎么确认：**  
本次只执行：

```text
prisma/migrations/20260507000000_observation_log_system/migration.sql
prisma/migrations/20260516000000_observation_log_info_view/migration.sql
```

### 3. 先演练，再生产执行

**做什么：**  
先拿生产库 clone 出来的临时库演练，确认 SQL 和代码都能工作，再在生产库执行。

**为什么：**  
这次虽然主要是建新表，风险相对低，但仍然需要确认当前生产库字符集、权限、索引名、唯一约束等都兼容。

**怎么确认：**  
临时库执行后，后端能正常启动，并且 observation-log 的核心接口可以跑通。

## 迁移步骤

## Step 0: 冻结代码版本和 SQL 文件

**做什么：**  
确认本次上线使用的后端代码和 SQL 文件版本固定下来。

需要确认的文件：

```text
prisma/migrations/20260507000000_observation_log_system/migration.sql
prisma/migrations/20260516000000_observation_log_info_view/migration.sql
prisma/schema.prisma
prisma/views/TOGAPhotos/observation_log_info.sql
src/dto/observationLog.ts
src/dto/aircraftInfoSubmission.ts
src/router/index.ts
```

**为什么：**  
数据库结构和后端 Prisma Client 使用的 schema 必须对应。如果 SQL 文件执行的是旧版本，但部署的是新代码，就可能出现字段缺失或索引不一致。

**怎么确认：**  
记录本次部署的 git commit：

```bash
git rev-parse HEAD
```

并确认 migration 文件没有未提交变更：

```bash
git status --short prisma/migrations/20260507000000_observation_log_system/migration.sql prisma/migrations/20260516000000_observation_log_info_view/migration.sql prisma/schema.prisma prisma/views/TOGAPhotos/observation_log_info.sql
```

## Step 1: 生产库执行前只读检查

**做什么：**  
在生产库上执行只读检查，确认 observation-log 表和 view 当前不存在。

检查 SQL：

```sql
SHOW TABLES LIKE 'observation_log';
SHOW TABLES LIKE 'observation_log_field';
SHOW TABLES LIKE 'observation_log_field_value';
SHOW TABLES LIKE 'observation_log_tag';
SHOW TABLES LIKE 'observation_log_tag_link';
SHOW TABLES LIKE 'aircraft_info_submission';
SHOW TABLES LIKE 'observation_log_info';
```

也可以一次性查：

```sql
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name IN (
    'observation_log',
    'observation_log_field',
    'observation_log_field_value',
    'observation_log_tag',
    'observation_log_tag_link',
    'aircraft_info_submission',
    'observation_log_info'
  );
```

**为什么：**  
本次 SQL 使用 `CREATE TABLE`，不是 `CREATE TABLE IF NOT EXISTS`。如果表已经存在，执行会失败。先确认可以避免上线时中途失败。

**怎么确认：**  
查询结果应该为空。  
如果已经存在其中某些表或 view，需要先停止迁移，单独比较结构，不要直接继续执行。

## Step 2: 备份生产库

**做什么：**  
在执行任何 DDL 前，先备份生产库。

示例：

```bash
mysqldump --single-transaction --routines --triggers --events <database_name> > prod-before-observation-log.sql
```

如果实际生产库通过云厂商控制台备份，也可以使用控制台快照。

**为什么：**  
虽然本次主要是新增表，不会改老表，但生产 DDL 仍然应该有回滚点。备份可以处理误连库、权限异常、半执行等情况。

**怎么确认：**  
确认备份文件或云快照已生成，并且记录备份时间、库名、操作人。

## Step 3: 准备生产 clone / 临时演练库

**做什么：**  
从生产库复制一个临时库，用来完整演练本次迁移。

建议命名类似：

```text
TOGAPhotos_migration_rehearsal
```

**为什么：**  
DEV 库每天会自动从生产覆盖，不适合作为唯一演练依据。临时库更适合验证“当前生产真实结构 + 本次 SQL”的组合。

**怎么确认：**  
临时库应来自生产库当前结构和数据。至少确认几个核心老表存在：

```sql
SHOW TABLES LIKE 'photo';
SHOW TABLES LIKE 'user';
SHOW TABLES LIKE 'aircraft';
SHOW TABLES LIKE 'airport';
SHOW TABLES LIKE 'airline';
```

## Step 4: 在临时库执行 observation-log SQL

**做什么：**  
在临时库按顺序执行：

```text
prisma/migrations/20260507000000_observation_log_system/migration.sql
prisma/migrations/20260516000000_observation_log_info_view/migration.sql
```

如果使用 MySQL CLI，可以类似这样执行：

```bash
mysql <database_name> < prisma/migrations/20260507000000_observation_log_system/migration.sql
mysql <database_name> < prisma/migrations/20260516000000_observation_log_info_view/migration.sql
```

也可以把文件内容复制到数据库客户端里执行。

**为什么：**  
这一步验证 SQL 在真实生产结构的 clone 上是否能成功执行。它不影响生产库。

**怎么确认：**  
执行后确认 6 张表和 1 个 view 存在：

```sql
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name IN (
    'observation_log',
    'observation_log_field',
    'observation_log_field_value',
    'observation_log_tag',
    'observation_log_tag_link',
    'aircraft_info_submission',
    'observation_log_info'
  )
ORDER BY table_name;
```

## Step 5: 临时库结构验证

**做什么：**  
确认关键字段、索引、唯一约束存在。

示例 SQL：

```sql
SHOW CREATE TABLE observation_log;
SHOW CREATE TABLE observation_log_field;
SHOW CREATE TABLE observation_log_field_value;
SHOW CREATE TABLE observation_log_tag;
SHOW CREATE TABLE observation_log_tag_link;
SHOW CREATE TABLE aircraft_info_submission;
```

重点确认：

```text
observation_log.source_photo_id 唯一
observation_log.queued_photo_id 唯一
observation_log_field(user_id, field_key) 唯一
observation_log_field_value(log_id, field_id) 唯一
observation_log_tag(user_id, name) 唯一
observation_log_tag_link(log_id, tag_id) 主键
```

**为什么：**  
后端逻辑依赖这些唯一约束来避免重复生成 log、重复标签和重复字段值。如果索引缺失，功能可能能跑，但数据会逐渐变脏。

**怎么确认：**  
`SHOW CREATE TABLE` 输出中能看到对应的 `UNIQUE KEY`、`KEY` 和 `PRIMARY KEY`。

## Step 6: 临时库代码 smoke test

**做什么：**  
把后端连接到临时库，跑一次最小功能验证。

建议验证：

1. 后端能启动。
2. 创建一条 observation log。
3. 查询 observation log 列表。
4. 查询 observation log 详情。
5. 更新 observation log。
6. 创建自定义字段。
7. 给日志写入自定义字段值。
8. 添加 tag。
9. 查询 stats。
10. 创建 aircraft info submission。

**为什么：**  
SQL 能执行只代表结构层面没问题。代码 smoke test 能确认 Prisma Client、DTO、路由和真实数据库结构匹配。

**怎么确认：**  
接口返回正常，后端日志没有出现类似错误：

```text
Table does not exist
Unknown column
Duplicate key name
PrismaClientKnownRequestError
```

## Step 7: 确认生产执行窗口

**做什么：**  
选择一个低流量时间窗口执行生产 DDL。

建议执行顺序：

1. 暂停后端部署。
2. 备份生产库。
3. 执行 SQL。
4. 做结构验证。
5. 部署后端。
6. 部署前端。

**为什么：**  
如果先部署后端，而 DB 还没有新表，任何访问 observation-log 的接口都会报错。先迁 DB，再部署代码，风险更低。

**怎么确认：**  
生产执行前，明确当前后端还没有流量调用新功能，或者新功能入口还未开放。

## Step 8: 生产库执行 SQL

**做什么：**  
在生产库按顺序执行同一组 SQL 文件：

```text
prisma/migrations/20260507000000_observation_log_system/migration.sql
prisma/migrations/20260516000000_observation_log_info_view/migration.sql
```

如果使用 MySQL CLI：

```bash
mysql <production_database_name> < prisma/migrations/20260507000000_observation_log_system/migration.sql
mysql <production_database_name> < prisma/migrations/20260516000000_observation_log_info_view/migration.sql
```

**为什么：**  
这是本次真正的生产结构变更，会创建 observation-log 所需的 6 张新表和 `observation_log_info` view。

**怎么确认：**  
SQL 执行过程没有报错。执行完成后立即进入下一步验证。

## Step 9: 生产库执行后结构验证

**做什么：**  
在生产库确认新表和 view 存在。

```sql
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name IN (
    'observation_log',
    'observation_log_field',
    'observation_log_field_value',
    'observation_log_tag',
    'observation_log_tag_link',
    'aircraft_info_submission',
    'observation_log_info'
  )
ORDER BY table_name;
```

**为什么：**  
这一步确认生产库已经具备新代码运行需要的基础表结构。

**怎么确认：**  
结果应返回 7 行，其中 `observation_log_info` 的 `table_type` 是 `VIEW`：

```text
aircraft_info_submission
observation_log
observation_log_field
observation_log_field_value
observation_log_info
observation_log_tag
observation_log_tag_link
```

## Step 10: 生产库写入验证

**做什么：**  
做最小写入验证。

可以通过后端接口验证，也可以用数据库事务做一次临时插入再回滚。

示例事务：

```sql
START TRANSACTION;

INSERT INTO observation_log (
  user_id,
  visibility,
  source,
  observed_at,
  observed_date,
  ac_reg,
  airport_id,
  image_status
) VALUES (
  1,
  'PRIVATE',
  'MANUAL',
  NOW(),
  CURDATE(),
  'MIGRATION-SMOKE-TEST',
  1,
  'NONE'
);

SELECT id, user_id, source, ac_reg, airport_id
FROM observation_log
WHERE ac_reg = 'MIGRATION-SMOKE-TEST'
ORDER BY id DESC
LIMIT 1;

ROLLBACK;
```

**为什么：**  
表存在不等于写入一定正常。这一步可以确认默认值、非空字段和基础写入路径没有问题。

**怎么确认：**  
`SELECT` 能查到临时插入的数据，`ROLLBACK` 后数据不会保留。

## Step 11: 部署后端

**做什么：**  
生产库结构验证完成后，部署包含 observation-log 后端代码的版本。

后端涉及路径：

```text
src/router/index.ts
src/dto/observationLog.ts
src/dto/aircraftInfoSubmission.ts
src/service/imageProcesser/index.ts
src/handler/queue/index.ts
```

**为什么：**  
后端代码依赖新表。只有 DB 先到位，后端才能安全上线。

**怎么确认：**  
后端启动正常，健康检查正常，日志里没有 Prisma 表结构错误。

## Step 12: 部署前端

**做什么：**  
后端上线稳定后，部署前端 observation-log 页面。

前端主要入口包括：

```text
/logs
/logs/new
/logs/stats
/logs/:id
/logs/:id/edit
```

**为什么：**  
前端入口开放后，用户会开始真实调用 observation-log API。因此前端应该在 DB 和后端都就绪之后部署。

**怎么确认：**  
登录用户可以打开日志列表、新建日志、查看详情和统计页。

## Step 13: 生产功能验证

**做什么：**  
在生产环境用真实账号做最小功能验证。

建议验证：

1. 打开 `/logs`。
2. 新建一条手动 observation log。
3. 上传一张测试图片。
4. 打开详情页。
5. 编辑日志字段。
6. 添加 tag。
7. 打开 stats 页面。
8. 删除测试 log。

**为什么：**  
这一步确认完整链路可用，包括前端、后端、数据库、对象存储、图片处理队列。

**怎么确认：**  
页面行为正常，接口没有 500，后端日志没有 DB 错误。

## Step 14: DEV 库处理

**做什么：**  
生产迁移完成后，等待 DEV 每日自动从生产同步。

**为什么：**  
DEV 的同步方式是先删库再同步生产。只要生产库已经有新表，DEV 下一次同步自然会带上新结构。

**怎么确认：**  
同步完成后，在 DEV 执行：

```sql
SHOW TABLES LIKE 'observation_log';
SHOW TABLES LIKE 'aircraft_info_submission';
```

如果当天必须在 DEV 验证，也可以在 DEV 同步完成后手动执行同一份 SQL。但不要把 DEV 的手动变更当作最终状态。

## Step 15: 可选历史数据回填

**做什么：**  
如果希望历史已通过照片也生成 observation log，可以在生产结构和代码都稳定后执行回填脚本：

```bash
npm run backfill:observation-logs
```

**为什么：**  
schema 迁移和数据回填应该拆开。这样如果回填数量、速度或数据质量有问题，不会影响表结构上线。

**怎么确认：**  
回填前后比较数量：

```sql
SELECT COUNT(*) FROM observation_log;
SELECT COUNT(*) FROM observation_log WHERE source = 'ACCEPTED_PHOTO';
```

也可以抽查几条：

```sql
SELECT id, user_id, source, source_photo_id, ac_reg, observed_at
FROM observation_log
WHERE source = 'ACCEPTED_PHOTO'
ORDER BY id DESC
LIMIT 20;
```

## Step 16: 可选补 Prisma baseline

**做什么：**  
如果未来希望让 Prisma 正式接管 migration，再单独补 baseline。

只有在确认生产库已经具备对应结构后，才考虑执行：

```bash
npx prisma migrate resolve --applied 20250712125808_init
npx prisma migrate resolve --applied 20260507000000_observation_log_system
npx prisma migrate resolve --applied 20260516000000_observation_log_info_view
```

**为什么：**  
`resolve --applied` 是告诉 Prisma：这些 migration 对应的结构已经在库里了。它不是拿来建表的，而是拿来补 migration 记录的。

**怎么确认：**  
执行后再跑：

```bash
npx prisma migrate status
```

应该不再显示这些 migration 未应用。

**注意：**  
这一步不是本次 observation-log 上线必须步骤。它改变的是 Prisma migration 管理状态，不是业务功能本身。

## 回滚方案

## 情况 A: SQL 尚未执行成功

**做什么：**  
如果 SQL 执行中途报错，并且没有创建任何新表或 view，停止操作，保留错误信息。

**为什么：**  
不要在不清楚执行到哪一步时重复执行整份 SQL，否则可能出现部分表已存在、部分表不存在的混合状态。

**怎么确认：**  
执行：

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name IN (
    'observation_log',
    'observation_log_field',
    'observation_log_field_value',
    'observation_log_tag',
    'observation_log_tag_link',
    'aircraft_info_submission',
    'observation_log_info'
  );
```

然后根据实际已创建的表和 view 决定清理方式。

## 情况 B: SQL 已成功执行，但后端尚未部署

**做什么：**  
可以选择保留新表，不需要立即回滚。

**为什么：**  
这些是新表，不影响老功能。只要没有部署新后端，老代码不会使用这些表。

**怎么确认：**  
老功能正常，生产日志没有异常。

## 情况 C: 后端部署后发现新功能异常

**做什么：**  
优先回滚后端和前端版本，不要优先删表。

**为什么：**  
表结构本身是新增，不影响旧功能。回滚代码更快、更安全。删表可能丢失用户已经写入的新日志。

**怎么确认：**  
回滚代码后，旧功能恢复正常，observation-log 入口暂时不可用或不展示。

## 情况 D: 必须删除新表

**做什么：**  
只有在确认没有需要保留的数据，或者已经备份新表数据后，才删除新表。

删除顺序建议：

```sql
DROP TABLE IF EXISTS observation_log_tag_link;
DROP TABLE IF EXISTS observation_log_field_value;
DROP TABLE IF EXISTS observation_log_tag;
DROP TABLE IF EXISTS observation_log_field;
DROP TABLE IF EXISTS aircraft_info_submission;
DROP TABLE IF EXISTS observation_log;
```

**为什么：**  
虽然当前 SQL 没有显式外键，但按照依赖关系从关联表、值表开始删，更符合数据模型，也方便未来如果补外键时保持习惯。

**怎么确认：**  
删除后再查：

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name IN (
    'observation_log',
    'observation_log_field',
    'observation_log_field_value',
    'observation_log_tag',
    'observation_log_tag_link',
    'aircraft_info_submission'
  );
```

结果应该为空。

## 上线检查清单

执行前：

- [ ] 确认生产库不是 DEV 库。
- [ ] 确认已备份生产库。
- [ ] 确认 6 张新表当前不存在。
- [ ] 确认 `observation_log_info` view 当前不存在或可被 `CREATE OR REPLACE VIEW` 更新。
- [ ] 确认已在生产 clone 上演练成功。
- [ ] 确认本次部署的 git commit。
- [ ] 确认 SQL 文件版本固定。

执行中：

- [ ] 按顺序执行 `20260507000000_observation_log_system/migration.sql` 和 `20260516000000_observation_log_info_view/migration.sql`。
- [ ] 不执行 `20250712125808_init`。
- [ ] 不执行 `npx prisma migrate deploy`。
- [ ] 记录 SQL 执行时间和结果。

执行后：

- [ ] 确认 6 张新表和 `observation_log_info` view 存在。
- [ ] 确认关键唯一索引存在。
- [ ] 做一次事务写入测试。
- [ ] 部署后端。
- [ ] 部署前端。
- [ ] 做生产 smoke test。
- [ ] 等待 DEV 自动同步后确认 DEV 结构。

## 本次不做的事

### 不做 Prisma 正式接管

本次不把生产库正式切到 Prisma migration 管理。  
原因是生产库历史上不是 Prisma-first，强行在这次接管会把 observation-log 上线和 migration 体系改造绑在一起，风险变大。

### 不执行历史 init migration

不执行：

```text
20250712125808_init
```

原因是它描述的是已有老库结构，不是本次新增功能需要执行的 SQL。

### 不把 DEV 当作最终状态

DEV 每天会从生产覆盖。  
因此 DEV 上的任何手动迁移都只是临时验证，不是最终迁移来源。
