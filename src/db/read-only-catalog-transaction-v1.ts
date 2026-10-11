import type postgres from "postgres";

/** Query-only data/effect port, not an authenticated client or transaction grant. */
export type ReadOnlyCatalogTransactionV1 = {
  unsafe<T extends object[] = postgres.Row[]>(
    statement: string,
    parameters?: Parameters<postgres.TransactionSql["unsafe"]>[1],
  ): PromiseLike<postgres.RowList<T>>;
};
