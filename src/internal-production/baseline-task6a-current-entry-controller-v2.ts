/**
 * Separate Task6A V2 entry boundary. No diagnostic observation or caller input
 * can grant admission while the DB/OS writer fence and positive owner authority
 * do not exist.
 */
export async function requestTask6aCurrentEntryAdmissionV2(): Promise<never> {
  throw new Error("TASK6A_V2_ADMISSION_NOT_GRANTED");
}
