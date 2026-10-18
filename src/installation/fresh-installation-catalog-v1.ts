/** A catalog snapshot of a source-verified new schema; no lifecycle rows or changing planner statistics. */
type CatalogSqlV1 = Readonly<{ unsafe<T extends Record<string, unknown>[]>(query: string): PromiseLike<T> }>;

const CATALOG_SQL = `WITH public_relations AS (
  SELECT c.* FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
), snapshot AS (
  SELECT jsonb_build_object(
    'database',(SELECT jsonb_build_array(oid,datname,datdba,datistemplate,datallowconn,datconnlimit,dattablespace,datacl)
      FROM pg_catalog.pg_database WHERE datname=current_database()),
    'schema',(SELECT jsonb_build_array(oid,nspowner,nspacl) FROM pg_catalog.pg_namespace WHERE nspname='public'),
    'relations',(SELECT jsonb_agg(jsonb_build_array(oid,relname,relkind,relpersistence,relowner,relam,
      reltablespace,reloftype,relispartition,relrowsecurity,relforcerowsecurity,relreplident,reloptions,relacl,
      CASE WHEN relkind IN ('v','m') THEN pg_catalog.pg_get_viewdef(oid,true) ELSE NULL END) ORDER BY oid) FROM public_relations),
    'attributes',(SELECT jsonb_agg(jsonb_build_array(a.attrelid,a.attnum,a.attname,a.atttypid,a.atttypmod,a.attndims,
      a.attnotnull,a.attidentity,a.attgenerated,a.attisdropped,a.attcollation,a.attstorage,a.attcompression,
      a.atthasmissing,a.attmissingval::text,a.attacl,pg_catalog.pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attrelid,a.attnum)
      FROM pg_catalog.pg_attribute a JOIN public_relations c ON c.oid=a.attrelid
      LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attnum>0),
    'indexes',(SELECT jsonb_agg(jsonb_build_array(i.indexrelid,pg_catalog.pg_get_indexdef(i.indexrelid),
      i.indisvalid,i.indisready,i.indislive,i.indisunique,i.indisprimary,i.indimmediate) ORDER BY i.indexrelid)
      FROM pg_catalog.pg_index i JOIN public_relations c ON c.oid=i.indrelid),
    'constraints',(SELECT jsonb_agg(jsonb_build_array(c.oid,c.conname,c.conrelid,c.contype,c.convalidated,
      c.condeferrable,c.condeferred,c.conparentid,c.conislocal,c.coninhcount,c.connoinherit,
      pg_catalog.pg_get_constraintdef(c.oid,true)) ORDER BY c.oid)
      FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public'),
    'functions',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'),
    'triggers',(SELECT jsonb_agg(jsonb_build_array(t.oid,t.tgrelid,t.tgenabled,t.tgisinternal,
      pg_catalog.pg_get_triggerdef(t.oid,true)) ORDER BY t.oid) FROM pg_catalog.pg_trigger t JOIN public_relations c ON c.oid=t.tgrelid),
    'sequences',(SELECT jsonb_agg(to_jsonb(s) ORDER BY s.seqrelid) FROM pg_catalog.pg_sequence s JOIN public_relations c ON c.oid=s.seqrelid),
    'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_catalog.pg_policy p JOIN public_relations c ON c.oid=p.polrelid),
    'rules',(SELECT jsonb_agg(jsonb_build_array(r.oid,r.ev_class,pg_catalog.pg_get_ruledef(r.oid,true)) ORDER BY r.oid)
      FROM pg_catalog.pg_rewrite r JOIN public_relations c ON c.oid=r.ev_class),
    'inheritance',(SELECT jsonb_agg(to_jsonb(i) ORDER BY i.inhrelid,i.inhseqno) FROM pg_catalog.pg_inherits i
      WHERE i.inhrelid IN (SELECT oid FROM public_relations) OR i.inhparent IN (SELECT oid FROM public_relations)),
    'namespaceDependencies',(SELECT jsonb_agg(to_jsonb(d) ORDER BY d.classid,d.objid,d.objsubid,d.deptype)
      FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_namespace n ON n.oid=d.refobjid
      WHERE d.refclassid='pg_catalog.pg_namespace'::regclass AND n.nspname='public'),
    'types',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_catalog.pg_type t
      JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public')
  ) AS body
) SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(body::text,'UTF8')),'hex') AS hash FROM snapshot`;

export async function readFreshInstallationCatalogHashV1(sql: CatalogSqlV1): Promise<string> {
  const rows = await sql.unsafe<Array<{ hash: string }>>(CATALOG_SQL);
  if (rows.length !== 1 || !/^[a-f0-9]{64}$/.test(rows[0]?.hash ?? "")) throw new Error("FRESH_INSTALLATION_CATALOG_INVALID");
  return rows[0]!.hash;
}
