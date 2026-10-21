export const MANUAL_ORPHAN_BASENAME_V1='manual-control-orphan-bootstrap-v1.integration.test.ts';
export const MANUAL_ORPHAN_VECTOR_V1=Object.freeze([
  'node','--import','tsx','--test','--test-concurrency=1',
  'tests/execution-attempts/'+MANUAL_ORPHAN_BASENAME_V1,
]);

function validateCellsV1(cells){
  if(!Array.isArray(cells))throw Error('MANUAL_ORPHAN_FRAME_REFUSED');
  for(let index=0;index<cells.length;index++){
    if(!Object.hasOwn(cells,index)||typeof cells[index]!=='string'){
      throw Error('MANUAL_ORPHAN_FRAME_REFUSED');
    }
  }
}

export function mentionsManualOrphanFileV1(cells){
  validateCellsV1(cells);
  return cells.some(cell=>cell.toLowerCase().includes(MANUAL_ORPHAN_BASENAME_V1));
}

export function classifyManualOrphanVectorV1(cells){
  validateCellsV1(cells);
  const same=cells.length===MANUAL_ORPHAN_VECTOR_V1.length
    &&cells.every((cell,index)=>cell===MANUAL_ORPHAN_VECTOR_V1[index]);
  return same?'exact':mentionsManualOrphanFileV1(cells)?'near':'unrelated';
}
