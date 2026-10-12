// Fit readable labels around map nodes. Keep every label inside the SVG and
// prefer positions that do not cover another label, node, or the compass.
export function mapLabels(nodes, {width, height, here, hereText, english}) {
  const font=english?11:13, lineHeight=font+2;
  const measure=text=>[...text].reduce((n,c)=>n+(/[\u3400-\u9fff]/.test(c)?font:font*.59),0);
  const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
  const occupied=[{x:width-48,y:0,w:46,h:47},...nodes.map(n=>({x:n.x-10,y:n.y-10,w:20,h:20}))];
  const result={};
  for(const node of [...nodes].sort((a,b)=>(b.key===here)-(a.key===here))) {
    const words=english?node.title.split(/\s+/):[...node.title], lines=[];
    for(const word of words){const last=lines.at(-1),joined=last+(english?' ':'')+word;
      if(last&&measure(joined)<=86)lines[lines.length-1]=joined;else lines.push(word);
    }
    if(node.key===here)lines.push(hereText);
    const w=Math.max(...lines.map(measure))+8,h=lines.length*lineHeight+4;
    let best;
    const consider=(x,y)=>{
      const box={x,y,w,h},distance=Math.hypot(x+w/2-node.x,y+h/2-node.y);
      const score=occupied.reduce((n,b)=>n+overlap(box,b),0)*1000+distance;
      if(!best||score<best.score)best={...box,score};
    };
    for(const gap of [12,22,34,48,64,80])for(const [dx,dy] of [[-w/2,-h-gap],[-w/2,gap],[-w-gap,-h/2],[gap,-h/2],[-w-gap,-h-gap],[gap,-h-gap],[-w-gap,gap],[gap,gap]]){
      const x=Math.max(4,Math.min(width-w-4,node.x+dx)),y=Math.max(4,Math.min(height-h-4,node.y+dy));
      consider(x,y);
    }
    if(best.score>1000)for(let y=4;y<=height-h-4;y+=4)for(let x=4;x<=width-w-4;x+=4)consider(x,y);
    result[node.key]={...best,lines,font,lineHeight};
    occupied.push({...best,x:best.x-2,y:best.y-2,w:w+4,h:h+4});
  }
  return result;
}
