import {
  AliasNode,
  ColumnNode,
  ColumnUpdateNode,
  TableNode,
  UpdateQueryNode,
  type KyselyPlugin,
  type OperationNode,
  type PluginTransformQueryArgs,
  type PluginTransformResultArgs,
  type QueryResult,
  type RootOperationNode,
  type UnknownRow,
} from 'kysely';
import { now } from './sql';

/**
 * Tablas cuyo `updated_at` se renueva en cada UPDATE. Antes lo hacía el trigger
 * `fn_set_updated_at` de PostgreSQL; se hace acá para que valga en cualquier
 * motor (docs/MULTI_DB.md, etapa 3).
 */
export const UPDATED_AT_TABLES = new Set(['users', 'conversations', 'channel_settings', 'broadcast_lists']);

function tableName(node: OperationNode | undefined): string | undefined {
  if (!node) return undefined;
  if (TableNode.is(node)) return node.table.identifier.name;
  if (AliasNode.is(node)) return tableName(node.node);
  return undefined;
}

/**
 * Agrega `updated_at = now()` a todo UPDATE de esas tablas que no lo fije
 * explícitamente. Igual que el trigger, también aplica a updates que sólo tocan
 * la presencia o el último acceso.
 */
export class UpdatedAtPlugin implements KyselyPlugin {
  transformQuery({ node }: PluginTransformQueryArgs): RootOperationNode {
    if (!UpdateQueryNode.is(node)) return node;
    const table = tableName(node.table);
    if (!table || !UPDATED_AT_TABLES.has(table)) return node;
    const updates = node.updates ?? [];
    const alreadySet = updates.some((u) => ColumnNode.is(u.column) && u.column.column.name === 'updated_at');
    if (alreadySet) return node;
    return UpdateQueryNode.cloneWithUpdates(node, [
      ColumnUpdateNode.create(ColumnNode.create('updated_at'), now().toOperationNode()),
    ]);
  }

  async transformResult({ result }: PluginTransformResultArgs): Promise<QueryResult<UnknownRow>> {
    return result;
  }
}
