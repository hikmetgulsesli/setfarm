/** A catalog snapshot of a source-verified new schema; no lifecycle rows or changing planner statistics. */
type CatalogSqlV1 = Readonly<{ unsafe<T extends Record<string, unknown>[]>(query: string): PromiseLike<T> }>;

const CATALOG_SQL = `WITH public_relations AS (
  SELECT c.* FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
), protected_roles AS (
  SELECT r.oid FROM pg_catalog.pg_roles r JOIN pg_catalog.pg_database d ON d.datname=current_database()
  WHERE r.oid=d.datdba OR r.rolname='sf_runtime_'||substring(d.datname FROM 17)
), relevant_roles AS (
  SELECT oid FROM protected_roles UNION SELECT oid FROM pg_catalog.pg_roles WHERE rolname='pg_database_owner'
), current_database_acl AS (
  SELECT a.grantor,a.grantee,a.privilege_type,a.is_grantable FROM pg_catalog.pg_database d
    CROSS JOIN LATERAL pg_catalog.aclexplode(coalesce(d.datacl,pg_catalog.acldefault('d',d.datdba))) a
    WHERE d.datname=current_database()
), expected_database_acl AS (
  SELECT d.datdba AS grantor,d.datdba AS grantee,p.privilege_type,false AS is_grantable
    FROM pg_catalog.pg_database d CROSS JOIN unnest(ARRAY['CREATE','TEMPORARY','CONNECT']) p(privilege_type)
    WHERE d.datname=current_database()
  UNION ALL SELECT d.datdba,r.oid,'CONNECT',false FROM pg_catalog.pg_database d
    JOIN pg_catalog.pg_roles r ON r.rolname='sf_runtime_'||substring(d.datname FROM 17)
    WHERE d.datname=current_database()
), external_acl_objects AS (
  SELECT 'function' AS kind,'pg_catalog.pg_proc'::regclass AS classid,p.oid AS object_id,0 AS subid,p.proacl AS acl,
    pg_catalog.acldefault('f',p.proowner) AS default_acl
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname<>'public'
  UNION ALL SELECT 'relation','pg_catalog.pg_class'::regclass,c.oid,0,c.relacl,
    pg_catalog.acldefault(CASE WHEN c.relkind='S' THEN 's' ELSE 'r' END::"char",c.relowner)
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname<>'public' AND c.relkind IN ('r','p','v','m','f','S')
  UNION ALL SELECT 'column','pg_catalog.pg_class'::regclass,c.oid,a.attnum,a.attacl,'{}'::aclitem[] FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_class c ON c.oid=a.attrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname<>'public' AND a.attnum>0 AND NOT a.attisdropped AND a.attacl IS NOT NULL
  UNION ALL SELECT 'type','pg_catalog.pg_type'::regclass,t.oid,0,t.typacl,pg_catalog.acldefault('T',t.typowner)
    FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname<>'public'
  UNION ALL SELECT 'namespace','pg_catalog.pg_namespace'::regclass,n.oid,0,n.nspacl,pg_catalog.acldefault('n',n.nspowner)
    FROM pg_catalog.pg_namespace n WHERE n.nspname<>'public'
  UNION ALL SELECT 'language','pg_catalog.pg_language'::regclass,oid,0,lanacl,pg_catalog.acldefault('l',lanowner) FROM pg_catalog.pg_language
  UNION ALL SELECT 'foreign-wrapper','pg_catalog.pg_foreign_data_wrapper'::regclass,oid,0,fdwacl,pg_catalog.acldefault('F',fdwowner) FROM pg_catalog.pg_foreign_data_wrapper
  UNION ALL SELECT 'foreign-server','pg_catalog.pg_foreign_server'::regclass,oid,0,srvacl,pg_catalog.acldefault('S',srvowner) FROM pg_catalog.pg_foreign_server
  UNION ALL SELECT 'large-object','pg_catalog.pg_largeobject_metadata'::regclass,oid,0,lomacl,pg_catalog.acldefault('L',lomowner) FROM pg_catalog.pg_largeobject_metadata
  UNION ALL SELECT 'tablespace','pg_catalog.pg_tablespace'::regclass,oid,0,spcacl,pg_catalog.acldefault('t',spcowner) FROM pg_catalog.pg_tablespace
  UNION ALL SELECT 'parameter','pg_catalog.pg_parameter_acl'::regclass,oid,0,paracl,'{}'::aclitem[] FROM pg_catalog.pg_parameter_acl
  UNION ALL SELECT 'other-database','pg_catalog.pg_database'::regclass,oid,0,datacl,pg_catalog.acldefault('d',datdba) FROM pg_catalog.pg_database
    WHERE datname<>current_database()
  UNION ALL SELECT 'default','pg_catalog.pg_default_acl'::regclass,oid,0,defaclacl,'{}'::aclitem[] FROM pg_catalog.pg_default_acl
), external_acl_entries AS (
  SELECT o.kind,o.object_id,o.subid,a.grantor,a.grantee,a.privilege_type,a.is_grantable
    FROM external_acl_objects o CROSS JOIN LATERAL pg_catalog.aclexplode(coalesce(o.acl,o.default_acl)) a
    WHERE (a.grantee=0 AND o.kind<>'other-database') OR a.grantee IN (SELECT oid FROM relevant_roles)
), initial_public_entries AS (
  SELECT o.kind,o.object_id,o.subid,a.privilege_type,a.is_grantable
    FROM external_acl_objects o LEFT JOIN pg_catalog.pg_init_privs i
      ON i.classoid=o.classid AND i.objoid=o.object_id AND i.objsubid=o.subid AND i.privtype='i'
    CROSS JOIN LATERAL pg_catalog.aclexplode(coalesce(i.initprivs,o.default_acl)) a
    WHERE a.grantee=0 AND o.kind<>'other-database' AND NOT (o.kind='function' AND o.object_id>=16384)
  UNION ALL SELECT 'namespace',n.oid,0,'USAGE',false FROM pg_catalog.pg_namespace n
    WHERE n.nspname='information_schema' AND n.oid<16384
  UNION ALL SELECT 'relation',c.oid,0,'SELECT',false FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='information_schema' AND n.oid<16384 AND c.oid<16384 AND c.relkind IN ('r','v')
), snapshot AS (
  SELECT jsonb_build_object(
    'database',(SELECT jsonb_build_array(oid,datname,datdba,datistemplate,datallowconn,datconnlimit,dattablespace,datacl)
      FROM pg_catalog.pg_database WHERE datname=current_database()),
    'schema',(SELECT jsonb_build_array(oid,nspowner,nspacl) FROM pg_catalog.pg_namespace WHERE nspname='public'),
    'externalAcls',(SELECT jsonb_agg(jsonb_build_array(kind,object_id,subid,grantor,grantee,privilege_type,is_grantable)
      ORDER BY kind,object_id,subid,grantor,grantee,privilege_type,is_grantable) FROM external_acl_entries),
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
) SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(body::text,'UTF8')),'hex') AS hash FROM snapshot
  WHERE (SELECT count(*) FROM protected_roles)=2
    AND NOT EXISTS ((SELECT * FROM current_database_acl EXCEPT SELECT * FROM expected_database_acl)
      UNION ALL (SELECT * FROM expected_database_acl EXCEPT SELECT * FROM current_database_acl))
    AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname<>'public' AND p.oid>=16384)
    AND NOT EXISTS (
    SELECT 1 FROM external_acl_entries WHERE grantee IN (SELECT oid FROM relevant_roles)
      AND NOT (grantee IN (SELECT oid FROM protected_roles) AND kind='function' AND object_id='pg_catalog.pg_control_system()'::regprocedure::oid
        AND subid=0 AND privilege_type='EXECUTE' AND NOT is_grantable))
    AND NOT EXISTS (SELECT 1 FROM external_acl_entries a WHERE a.grantee=0 AND NOT EXISTS (
      SELECT 1 FROM initial_public_entries i WHERE i.kind=a.kind AND i.object_id=a.object_id AND i.subid=a.subid
        AND i.privilege_type=a.privilege_type AND (i.is_grantable OR NOT a.is_grantable)))`;

export async function readFreshInstallationCatalogHashV1(sql: CatalogSqlV1): Promise<string> {
  const rows = await sql.unsafe<Array<{ hash: string }>>(CATALOG_SQL);
  if (rows.length !== 1 || !/^[a-f0-9]{64}$/.test(rows[0]?.hash ?? "")) throw new Error("FRESH_INSTALLATION_CATALOG_INVALID");
  return rows[0]!.hash;
}
