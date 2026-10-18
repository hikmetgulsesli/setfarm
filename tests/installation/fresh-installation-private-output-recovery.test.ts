// Proposed tests/installation/fresh-installation-private-output-recovery.test.ts.
// Source-body components only: no module import, DB, child, network or real /tmp.
// Stubbed entry/selection guards are never operational qualification evidence.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const file=new URL("../../src/installer/step-ops.ts",import.meta.url);
assert.ok(statSync(file).size<=2*1024*1024,"fixed source component read bound");
const source=readFileSync(file,"utf8");
const tree=ts.createSourceFile(file.pathname,source,ts.ScriptTarget.ESNext,true,ts.ScriptKind.TS);
function declaration(name:string):ts.FunctionDeclaration {
  const rows=tree.statements.filter((node):node is ts.FunctionDeclaration=>ts.isFunctionDeclaration(node)&&node.name?.text===name);
  assert.equal(rows.length,1,"one exact top-level function: "+name);return rows[0]!;
}
function body(name:string):string {return declaration(name).getText(tree).replace(/^export\s+/,"");}
function compile(text:string):string {return ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;}

test("all public step operations invoke the actual fixed fence before their old bodies",async()=>{
  for(const [name,args] of [["peekStep",["component-agent"]],["claimStep",["component-agent"]],["completeStep",["component-step","component-output"]]] as const){
    const node=declaration(name),first=node.body?.statements[0];assert.ok(first&&ts.isExpressionStatement(first));
    assert.ok(ts.isCallExpression(first.expression)&&ts.isIdentifier(first.expression.expression));
    assert.equal(first.expression.expression.text,"assertStepOperationInstallationV1");
    const refused=new Error("ACTUAL_ENTRY_COMPONENT_REFUSAL"),calls:string[]=[];
    const invoke=new Function("assertStepOperationInstallationV1",compile(body(name))+";return "+name+";")(()=>{calls.push("fence");throw refused;}) as (...args:unknown[])=>Promise<unknown>;
    await assert.rejects(invoke(...args),(error:unknown)=>error===refused);
    assert.deepEqual(calls,["fence"]);
  }
});

type Calls={enumerate:number;stat:number;read:number;unlink:string[];guards:string[]};
function components(selected:unknown,modeAssertion?:()=>void,entryAssertion?:()=>void){
  const calls:Calls={enumerate:0,stat:0,read:0,unlink:[],guards:[]};
  const entries=["setfarm-output-beta.txt","setfarm-output-alpha.txt","setfarm-output-alpha-spawner-7.txt","setfarm-output-alpha-spawner-8.json","unrelated.txt"];
  const mtimes:Record<string,number>={"setfarm-output-beta.txt":50,"setfarm-output-alpha.txt":10,"setfarm-output-alpha-spawner-7.txt":100};
  const fakeFs={
    readdirSync(directory:string){calls.enumerate++;assert.equal(directory,"/tmp");return [...entries];},
    statSync(file:string){calls.stat++;return {mtimeMs:mtimes[path.basename(file)]??0};},
    readFileSync(){calls.read++;return "STATUS: component-only";},
    unlinkSync(file:string){calls.unlink.push(file);},
  };
  const names=["assertStepOperationInstallationV1","useLegacySharedOutputTmpV1","cleanupLegacySharedOutputTmpV1","recoverableOutputTmpFiles"];
  const implementation=compile(names.map(body).join("\n"));
  const result=new Function("freshInstallationSelectionV1","assertFreshInstallationSelectionUnchangedV1","assertFreshInstallationOperationalEntryV1","fs","path","logger",implementation+";return {"+names.join(",")+"};")(
    selected,
    ()=>{calls.guards.push("selection");modeAssertion?.();},
    ()=>{calls.guards.push("entry");entryAssertion?.();},
    fakeFs,path,{debug(){}},
  ) as {assertStepOperationInstallationV1():void;useLegacySharedOutputTmpV1():boolean;cleanupLegacySharedOutputTmpV1():void;recoverableOutputTmpFiles(agent?:string):string[]};
  return {...result,calls};
}

test("fixed fence delegates selected actual admission and leaves legacy absence behavior",()=>{
  const refused=new Error("NOT_PREPARED_COMPONENT"),selected=components({},undefined,()=>{throw refused;});
  assert.throws(()=>selected.assertStepOperationInstallationV1(),(error:unknown)=>error===refused);
  assert.deepEqual(selected.calls.guards,["selection","entry"]);
  assert.equal(selected.calls.enumerate,0);assert.equal(selected.calls.stat,0);assert.equal(selected.calls.read,0);assert.deepEqual(selected.calls.unlink,[]);
  const legacy=components(null,undefined,()=>{throw Error("SELECTED_ENTRY_IN_LEGACY_COMPONENT");});
  legacy.assertStepOperationInstallationV1();assert.deepEqual(legacy.calls.guards,["selection"]);
});

test("selected output helpers never enumerate stat read or unlink shared files",()=>{
  const selected=components({});
  assert.deepEqual(selected.recoverableOutputTmpFiles("alpha"),[]);
  selected.cleanupLegacySharedOutputTmpV1();
  assert.equal(selected.calls.enumerate,0);assert.equal(selected.calls.stat,0);assert.equal(selected.calls.read,0);assert.deepEqual(selected.calls.unlink,[]);
});

test("mode refusal remains outside best-effort scanner and sweep catches",()=>{
  // The genuine selected-leaf sticky implementation has its existing own tests;
  // this component proves every new caller delegates and never swallows it.
  const refused=new Error("MODE_CHANGED_COMPONENT"),fixture=components(null,()=>{throw refused;});
  assert.throws(()=>fixture.recoverableOutputTmpFiles("alpha"),(error:unknown)=>error===refused);
  assert.throws(()=>fixture.cleanupLegacySharedOutputTmpV1(),(error:unknown)=>error===refused);
  assert.throws(()=>fixture.assertStepOperationInstallationV1(),(error:unknown)=>error===refused);
  assert.equal(fixture.calls.enumerate,0);assert.equal(fixture.calls.stat,0);assert.equal(fixture.calls.read,0);assert.deepEqual(fixture.calls.unlink,[]);
  const cleanup=declaration("cleanupLegacySharedOutputTmpV1");
  assert.ok(cleanup.body?.statements[0]&&ts.isIfStatement(cleanup.body.statements[0]));
  assert.ok(cleanup.body?.statements[1]&&ts.isTryStatement(cleanup.body.statements[1]));
});

test("legacy output filter order and selective cleanup remain genuine old body behavior",()=>{
  const legacy=components(null);
  assert.deepEqual(legacy.recoverableOutputTmpFiles("alpha"),["setfarm-output-alpha-spawner-7.txt","setfarm-output-alpha.txt"]);
  assert.equal(legacy.calls.enumerate,1);assert.ok(legacy.calls.stat>0);
  legacy.cleanupLegacySharedOutputTmpV1();
  assert.equal(legacy.calls.enumerate,2);
  assert.deepEqual(legacy.calls.unlink,["/tmp/setfarm-output-beta.txt","/tmp/setfarm-output-alpha.txt","/tmp/setfarm-output-alpha-spawner-7.txt"]);
});
