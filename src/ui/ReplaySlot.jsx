import {tr} from '../i18n/index.js';
import {forwardRef,lazy,Suspense} from 'react';
const ReplayViewer=lazy(()=>import('../scene/ReplayViewer.jsx'));
// Lazy wrapper so the result page renders immediately while the 3D replay loads.
export default forwardRef(function ReplaySlot(props,ref){
  return <Suspense fallback={<div style={{height:420,display:'grid',placeItems:'center',border:'4px solid #111',background:'#15161c',color:'#fff',fontWeight:900}}>{tr("回放加载中…")}</div>}><ReplayViewer ref={ref} {...props}/></Suspense>;
});
