import {
  AliasNode,
  ColumnNode,
  DeleteQueryNode,
  FetchNode,
  FromNode,
  JoinNode,
  InsertQueryNode,
  OperationNodeTransformer,
  OrderByItemNode,
  OrderByNode,
  OutputNode,
  RawNode,
  ReferenceNode,
  SelectAllNode,
  SelectModifierNode,
  SelectionNode,
  SelectQueryNode,
  TableNode,
  TopNode,
  UnaryOperationNode,
  UpdateQueryNode,
  ValueNode,
  type KyselyPlugin,
  type OperationNode,
  type PluginTransformQueryArgs,
  type PluginTransformResultArgs,
  type QueryId,
  type QueryResult,
  type RootOperationNode,
  type UnknownRow,
} from 'kysely';

/**
 * Adapta a SQL Server lo que los repositorios escriben "a la PostgreSQL", para
 * no tener una versión de cada consulta por motor (docs/MULTI_DB.md, etapa 5):
 *
 * - `.limit(n)` → `TOP n`; con `.offset()`, `OFFSET … FETCH NEXT n ROWS ONLY`.
 * - `.returning(...)` → `OUTPUT inserted.*` / `OUTPUT deleted.*`.
 * - `ORDER BY x NULLS LAST|FIRST` → `ORDER BY CASE WHEN x IS NULL …, x`.
 * - `FOR UPDATE SKIP LOCKED` → hints `WITH (UPDLOCK, READPAST, ROWLOCK)` en la tabla.
 * - `LEFT JOIN LATERAL (…) ON TRUE` → `OUTER APPLY (…)` (la condición tiene que
 *   ir dentro de la subconsulta: APPLY no lleva ON). `ON true` → `ON 1 = 1`.
 * - `EXISTS(…) AS x` en el SELECT → `CAST(CASE WHEN EXISTS(…) THEN 1 ELSE 0 END AS bit)`:
 *   T-SQL no devuelve un predicado como valor; el bit llega como booleano.
 * - `UPDATE t AS a SET …` → `UPDATE a SET … FROM t AS a` (T-SQL no admite el alias ahí).
 *
 * Y en los resultados, lo que SQL Server devuelve distinto que PostgreSQL:
 * - los uniqueidentifier salen en MAYÚSCULA → se pasan a minúscula (la app
 *   compara ids como string y los genera/recibe en minúscula);
 * - el JSON se guarda como texto → se parsea en las columnas que son JSON.
 */

/** Columnas JSON del esquema (más los alias con que se seleccionan). */
const JSON_COLUMNS = new Set([
  'data', 'data_after', 'data_before', 'metadata', 'consented_by', 'quality_stats', 'custom_permissions',
  'pending_attachments', 'state', 'link_preview', 'system_data', 'reference_data', 'extra_metadata',
  'value', 'totp_backup_codes', 'quiet_days', 'keywords',
  'last_message_metadata',
]);

const UPPER_GUID = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/;

function limitValue(node: OperationNode | undefined): number | undefined {
  if (node && ValueNode.is(node) && (typeof node.value === 'number' || typeof node.value === 'bigint')) {
    return Number(node.value);
  }
  return undefined;
}

/** `returning` → `output`, con cada columna tomada de `inserted`/`deleted`. */
function toOutput(selections: ReadonlyArray<SelectionNode>, source: 'inserted' | 'deleted'): OutputNode {
  const table = TableNode.create(source);
  const map = (node: OperationNode): OperationNode => {
    if (SelectAllNode.is(node)) return ReferenceNode.createSelectAll(table);
    if (ReferenceNode.is(node)) {
      return SelectAllNode.is(node.column)
        ? ReferenceNode.createSelectAll(table)
        : ReferenceNode.create(node.column as ColumnNode, table);
    }
    if (ColumnNode.is(node)) return ReferenceNode.create(node, table);
    if (AliasNode.is(node)) return AliasNode.create(map(node.node), node.alias);
    return node;
  };
  return OutputNode.create(selections.map((s) => map(s.selection)));
}

/** Saca FOR UPDATE/SKIP LOCKED y bloquea con hints la tabla del FROM (o las de `of`). */
function lockHints(node: SelectQueryNode): SelectQueryNode {
  const mods = node.endModifiers ?? [];
  const lock = mods.find((m) => SelectModifierNode.is(m) && m.modifier === 'ForUpdate');
  if (!lock || !node.from) return node;
  const skip = mods.some((m) => m.modifier === 'SkipLocked');
  const hints = skip ? ' WITH (UPDLOCK, READPAST, ROWLOCK)' : ' WITH (UPDLOCK, ROWLOCK)';
  const of = (lock.of ?? []).map((o) => (TableNode.is(o) ? o.table.identifier.name : undefined));
  const name = (n: OperationNode): string | undefined => {
    if (TableNode.is(n)) return n.table.identifier.name;
    if (AliasNode.is(n) && 'name' in n.alias) return (n.alias as { name: string }).name;
    return undefined;
  };
  const froms = node.from.froms.map((f, i) => {
    const target = of.length === 0 ? i === 0 : of.includes(name(f));
    return target ? RawNode.create(['', hints], [f]) : f;
  });
  return {
    ...node,
    from: FromNode.create(froms),
    endModifiers: mods.filter((m) => m.modifier !== 'ForUpdate' && m.modifier !== 'SkipLocked'),
  };
}

/** ¿Es `EXISTS (…)` / `NOT EXISTS (…)`? */
function isExists(node: OperationNode): boolean {
  if (!UnaryOperationNode.is(node)) return false;
  const op = node.operator as { operator?: string };
  return op.operator === 'exists' || op.operator === 'not exists';
}

/** Nombre de un alias (`IdentifierNode`). */
function aliasName(alias: OperationNode): string {
  return (alias as { name?: string }).name ?? String(alias);
}

class MssqlTransformer extends OperationNodeTransformer {
  protected override transformSelectQuery(node: SelectQueryNode, queryId?: QueryId): SelectQueryNode {
    const out = lockHints(super.transformSelectQuery(node, queryId));
    const limit = limitValue(out.limit?.limit);
    if (out.limit === undefined || limit === undefined) return out;

    if (!out.offset) {
      return { ...out, limit: undefined, top: TopNode.create(limit) };
    }
    // OFFSET/FETCH exige ORDER BY.
    const orderBy = out.orderBy ?? OrderByNode.create([OrderByItemNode.create(RawNode.createWithSql('(SELECT NULL)'))]);
    return { ...out, limit: undefined, orderBy, fetch: FetchNode.create(limit, 'only') };
  }

  protected override transformJoin(node: JoinNode, queryId?: QueryId): JoinNode {
    const out = super.transformJoin(node, queryId);
    if (out.joinType === 'LateralLeftJoin') return JoinNode.create('OuterApply', out.table);
    // `ON true` (onTrue()) no existe en T-SQL.
    const cond = out.on?.on;
    if (cond && RawNode.is(cond) && cond.sqlFragments.join('').trim().toLowerCase() === 'true') {
      return JoinNode.createWithOn(out.joinType, out.table, RawNode.createWithSql('1 = 1'));
    }
    return out;
  }

  protected override transformInsertQuery(node: InsertQueryNode, queryId?: QueryId): InsertQueryNode {
    const out = super.transformInsertQuery(node, queryId);
    return out.returning ? { ...out, returning: undefined, output: toOutput(out.returning.selections, 'inserted') } : out;
  }

  protected override transformSelection(node: SelectionNode, queryId?: QueryId): SelectionNode {
    const out = super.transformSelection(node, queryId);
    const sel = out.selection;
    if (!AliasNode.is(sel) || !isExists(sel.node)) return out;
    const asBit = RawNode.create(['CAST(CASE WHEN ', ' THEN 1 ELSE 0 END AS bit)'], [sel.node]);
    return SelectionNode.create(AliasNode.create(asBit, sel.alias));
  }

  protected override transformUpdateQuery(node: UpdateQueryNode, queryId?: QueryId): UpdateQueryNode {
    let out = super.transformUpdateQuery(node, queryId);
    if (out.table && AliasNode.is(out.table)) {
      // UPDATE "a" SET … FROM "t" AS "a"
      out = {
        ...out,
        table: TableNode.create(aliasName(out.table.alias)),
        from: FromNode.create([out.table, ...(out.from?.froms ?? [])]),
      };
    }
    return out.returning ? { ...out, returning: undefined, output: toOutput(out.returning.selections, 'inserted') } : out;
  }

  protected override transformDeleteQuery(node: DeleteQueryNode, queryId?: QueryId): DeleteQueryNode {
    const out = super.transformDeleteQuery(node, queryId);
    return out.returning ? { ...out, returning: undefined, output: toOutput(out.returning.selections, 'deleted') } : out;
  }

  protected override transformOrderBy(node: OrderByNode, queryId?: QueryId): OrderByNode {
    const out = super.transformOrderBy(node, queryId);
    if (!out.items.some((i) => i.nulls)) return out;
    const items: OrderByItemNode[] = [];
    for (const item of out.items) {
      if (!item.nulls) {
        items.push(item);
        continue;
      }
      // NULLS LAST → primero los no nulos (0), después los nulos (1).
      const [first, last] = item.nulls === 'last' ? ['0', '1'] : ['1', '0'];
      items.push(OrderByItemNode.create(RawNode.create(
        ['CASE WHEN ', ` IS NULL THEN ${last} ELSE ${first} END`],
        [item.orderBy],
      )));
      items.push(OrderByItemNode.cloneWith(item, { direction: item.direction, nulls: undefined, collation: item.collation }));
    }
    return OrderByNode.create(items);
  }
}

function normalizeRow(row: UnknownRow): UnknownRow {
  for (const [key, value] of Object.entries(row)) {
    if (typeof value !== 'string') continue;
    if (UPPER_GUID.test(value)) {
      row[key] = value.toLowerCase();
    } else if (JSON_COLUMNS.has(key)) {
      try {
        row[key] = JSON.parse(value);
      } catch {
        // No era JSON: queda como texto.
      }
    }
  }
  return row;
}

export class MssqlPlugin implements KyselyPlugin {
  readonly #transformer = new MssqlTransformer();

  transformQuery({ node, queryId }: PluginTransformQueryArgs): RootOperationNode {
    return this.#transformer.transformNode(node, queryId) as RootOperationNode;
  }

  async transformResult({ result }: PluginTransformResultArgs): Promise<QueryResult<UnknownRow>> {
    result.rows?.forEach(normalizeRow);
    return result;
  }
}
