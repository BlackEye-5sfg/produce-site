// Synchronous decision for Android's Activity Back dispatcher. No writes or automatic submission.
function createViewHistory(initial='browse') {
 let current=initial;const previous=[];
 return{get current(){return current;},visit(next){if(next===current)return;previous.push(current);if(previous.length>30)previous.shift();current=next;},back(){if(!previous.length)return null;current=previous.pop();return current;},reset(next='browse'){current=next;previous.length=0;}};
}
function createBackHandler({document,closeUpdates,cancelPending,popView,resetFilters}){
 return()=>{
  const dialogs=[...document.querySelectorAll('dialog[open]')];
  const focused=document.activeElement?.closest?.('dialog[open]');const dialog=focused||dialogs.at(-1);
  if(dialog){const event=new Event('cancel',{cancelable:true});if(dialog.dispatchEvent(event))dialog.close();return true;}
  if(cancelPending?.())return true;
  if(closeUpdates?.())return true;
  if(popView?.())return true;
  if(resetFilters?.())return true;
  return false; // Native falls back to real WebView history, then backgrounds at root.
 };
}
module.exports={createBackHandler,createViewHistory};
