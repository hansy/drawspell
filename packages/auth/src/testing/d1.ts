import { Database } from "bun:sqlite";
export function d1(sqlite: Database): D1Database {
  const prepare = (
    sql: string,
    values: unknown[] = [],
  ): D1PreparedStatement => {
    const statement = () => sqlite.prepare(sql);
    return {
      bind: (...bindings: unknown[]) => prepare(sql, bindings),
      first: async (column?: string) => {
        const row = statement().get(...(values as [])) as Record<
          string,
          unknown
        > | null;
        return column && row ? row[column] : row;
      },
      all: async () => ({
        success: true,
        results: statement().all(...(values as [])),
        meta: {
          changes: (
            sqlite.query("SELECT changes() AS n").get() as { n: number }
          ).n,
        },
      }),
      raw: async () => statement().values(...(values as [])),
      run: async () => {
        const result = statement().run(...(values as []));
        return {
          success: true,
          results: [],
          meta: { changes: result.changes },
        };
      },
    } as unknown as D1PreparedStatement;
  };
  return {
    prepare,
    batch: async (statements: D1PreparedStatement[]) =>
      statements
        .map((s) => s.all())
        .reduce(
          async (previous, next) => [...(await previous), await next],
          Promise.resolve([] as D1Result[]),
        ),
    exec: async (sql: string) => {
      sqlite.exec(sql);
      return { count: 0, duration: 0 };
    },
  } as unknown as D1Database;
}
