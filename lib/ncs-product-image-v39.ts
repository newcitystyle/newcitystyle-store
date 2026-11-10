type Unit = { id:number; imageUrl:string; status:string };
type Link = { designUnitId:number; status:string; onlineQuantity:number|null };
/** Reuse a stored design photo; never fabricate an image or re-upload it. */
export function resolveProductImageV39(main:string, units:readonly Unit[], links:readonly Link[]):string {
  if(main.trim()) return main.trim();
  const unit=units.find(u=>u.status==='available' && /^https:\/\//i.test(u.imageUrl.trim()) &&
    (links.length===0 || links.some(l=>l.designUnitId===u.id && l.status==='available' && Number(l.onlineQuantity)>0)));
  return unit?.imageUrl.trim()||'';
}
