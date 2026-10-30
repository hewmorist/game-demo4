import {buildMesh} from './mesh.js?v=multi-10';

const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=p=>p.map(x=>x/Math.hypot(...p));
const key=(a,b)=>a<b?`${a},${b}`:`${b},${a}`;
const icoFaces=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];

// Only the true corners carry mass. Polygon triangulation supplies hidden
// elastic supports; the visible wire retains the original Platonic edges.
export function wirePlatonic(kind,capacity=2048){
 const t=(1+Math.sqrt(5))/2;
 const ico=[[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]];
 let vertices,polygons;
 switch(kind){
  case 21:vertices=[[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]];polygons=[[0,1,2],[0,3,1],[0,2,3],[1,3,2]];break;
  case 22:vertices=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];polygons=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[3,7,6,2],[0,4,7,3],[1,2,6,5]];break;
  case 23:vertices=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];polygons=[];for(const x of [0,1])for(const y of [2,3])for(const z of [4,5])polygons.push([x,y,z]);break;
  case 24:
   // The dodecahedron is the dual of the icosahedron: face centres become
   // corners, and the five faces incident to each old corner become a pentagon.
   vertices=icoFaces.map(face=>[0,1,2].map(k=>face.reduce((sum,i)=>sum+ico[i][k],0)/3));
   polygons=ico.map((p,i)=>{const normal=unit(p),u=unit(cross(normal,Math.abs(normal[1])<.9?[0,1,0]:[1,0,0])),v=cross(normal,u);return icoFaces.map((f,j)=>f.includes(i)?j:-1).filter(j=>j>=0).sort((a,b)=>Math.atan2(dot(vertices[a],v),dot(vertices[a],u))-Math.atan2(dot(vertices[b],v),dot(vertices[b],u)));});break;
  case 25:vertices=ico;polygons=icoFaces.map(f=>[...f]);break;
  default:throw Error('Unknown Platonic solid.');
 }
 vertices=vertices.map(p=>unit(p).map(x=>2*x));
 // Orient every face outward, including the procedurally sorted pentagons.
 polygons=polygons.map(poly=>{const a=vertices[poly[0]],b=vertices[poly[1]],c=vertices[poly[2]],normal=cross(b.map((x,k)=>x-a[k]),c.map((x,k)=>x-a[k]));return dot(normal,a)<0?[...poly].reverse():poly;});
 const triangles=polygons.flatMap(poly=>poly.slice(1,-1).map((_,i)=>[poly[0],poly[i+1],poly[i+2]]));
 const mesh=buildMesh(vertices,triangles,capacity),visible=new Map();
 for(const poly of polygons)for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];visible.set(key(a,b),[a,b]);}
 mesh.edges=[...visible.values()];mesh.edgeData=new Float32Array(256*Math.ceil(mesh.edges.length/256)*4);mesh.edges.forEach((e,i)=>mesh.edgeData.set([...e,0,1],i*4));
 mesh.polygons=polygons;
 return mesh;
}
