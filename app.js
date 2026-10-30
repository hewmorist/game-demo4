import {ClayGame} from './clay.js?v=clay-32';
const gameMode=!new URLSearchParams(location.search).has('lab');let game;
import {FacetObject,installFacetUI} from './facets.js?v=multi-11';
import {personPoint,Person18} from './person18.js?v=multi-11';
import {personBox,PersonBox} from './person.js?v=multi-11';
import {MultiSystems} from './multi.js?v=multi-11';
import {wirePlatonic} from './platonic.js?v=multi-11';
import {makeLobeform,LobeformSkin,lobeformCarrier,lobeformField} from './lobeform.js?v=multi-11';
import {InertStructure} from './inert.js?v=multi-11';
import {createSoundtrack} from './soundtrack.js?v=multi-11';
import {GravityGPU,CAPACITY} from './gpu.js?v=clay-32';
import {createTimeline} from './timeline.js?v=multi-11';
import {wireSphere,wireBeing,wireBust,wireCell,ringCloud,inertCloud} from './mesh.js?v=multi-11';
let timeline,multi,applyFacetPlacement=()=>{};
const soundtrack=createSoundtrack(()=>{if(timeline?.playing)timeline.pause();running=false;accumulator=0;$('pause').textContent='Play';});
const MIN_DISTANCE=8/1000;
const $=id=>document.getElementById(id),canvas=$('space');let gpu,wasm,running=false,ready=false,time=0,accumulator=0,historyTime=0,last=0,yaw=.4,pitch=.55,distance=8,baseMass=.01,serial=0;
let cameraMode='fixed',tracked=-1,focus=[0,0,0],forward=[0,0,-1],viewBasis=null,rawView=null,sceneYaw=0,scenePitch=0,truck=0,pedestal=0;
const START_CENTRE=[0,0,0];
const DT=.004,MAX_STEPS=128;let frames=0,statsTime=0;
function fail(error){game?.closeGun();game?.voice?.cancel();running=false;ready=false;$('error').hidden=false;$('error').textContent=String(error.message||error);$('status').textContent='Simulation stopped';for(const id of ['reset','pause','fire'])$(id).disabled=true;console.error(error);}
function count(){ $('count').textContent=`${gpu.count.toLocaleString()} bodies`; $('fire').disabled=gpu.count>=gpu.maxCapacity;}
const presets={
 30:{n:1,note:"Person · 18 views: six directions at level, 45° above and 45° below. One invisible gravity body; upright visual with perspective. View changes are discrete."},
 29:{n:8,note:"Person box with head top: four side photographs paired with four transparent overhead head views. Only one side and its matching head cap are selected geometrically. Eight invisible physical nodes; cap follows the box and is visible from above."},
 28:{n:8,note:"Person box: four transparent photographic views on an upright invisible box. Exactly one face is chosen geometrically; perspective foreshortens it. Eight invisible elastic corner nodes carry gravity and motion. Face transitions are discrete."},
 26:{note:'Lobeform inert in random field: fixed visual shell with no mass or gravity. Starting bodies selects cloud count. The field is repeatable for comparison with the cube carrier.'},
 27:{note:'Lobeform carried by cube in random field: rigid massless shell follows an embedded radius .55 elastic cube, total cube mass 1. Starting bodies selects cloud count; 8 cube corners are added. Shell does not deform or collide; cube material controls apply.'},
 21:{n:4,note:'Elastic tetrahedron: 4 corner masses, 4 faces. Radius 2 and total mass 1, initially at rest. Free to move and deform; no central mass or world anchor.'},
 22:{n:8,note:'Elastic cube: 8 corner masses, 6 faces. Radius 2 and total mass 1, initially at rest. Free to move and deform; no central mass or world anchor.'},
 23:{n:6,note:'Elastic octahedron: 6 corner masses, 8 faces. Radius 2 and total mass 1, initially at rest. Free to move and deform; no central mass or world anchor.'},
 24:{n:20,note:'Elastic dodecahedron: 20 corner masses, 12 faces. Radius 2 and total mass 1, initially at rest. Free to move and deform; no central mass or world anchor.'},
 25:{n:12,note:'Elastic icosahedron: 12 corner masses, 20 faces. Radius 2 and total mass 1, initially at rest. Free to move and deform; no central mass or world anchor.'},

 20:{n:162,note:'Lobeform: asymmetric blue, magenta and amber lobes with a curved cyan projection. A detailed visual skin follows 162 elastic physics nodes; its colored silhouette reveals rotation and deformation.'},
 19:{note:'Eigenbeing-inert in cloud: stationary visual human surrounded by free gravitational bodies. Starting bodies controls only the cloud; its color can be multicolor or chosen. The figure contributes no gravity and does not deform.'},
 18:{note:'Eigenbeing-inert: detailed human wireframe, visual only. No mass, gravity, springs or simulated vertices. Camera controls work normally; launched bodies do not affect it.'},
 15:{note:'Cell 2: Maxwell ring around a central mass, surrounded by a random cloud. Ring feedback applies only to the original ring.'},
 16:{note:'Cell 3: two tilted rings around a central mass, surrounded by a random cloud. Second ring tilt controls the relative planes.'},
 17:{note:'Cell 4: spinning ring sphere around a central mass, surrounded by a random cloud. Six orbital planes create a moving ball.'},
 14:{note:'Cell model: a triangulated elastic sphere with 42 linked vertices and a random surrounding cloud. Cloud gravity ripples the shell; stiffness, bending and damping control its response. No central mass or fixed anchor.'},
 0:{note:'Choose any body count for a rotating cloud.'},
 1:{note:'Choose any body count for a thin rotating disk.'},
 2:{n:2,note:'Two equal masses in a circular orbit.'},
 3:{n:3,note:'A close pair with a third body on a wider orbit.'},
 4:{n:3,note:'Three equal masses following a figure eight, tuned to our gravity model.'},
 5:{n:3,note:'The figure eight with a small velocity disturbance.'},
 6:{n:3,note:'A rotating equilateral triangle. Small disturbances can break it apart.'},
 7:{n:4,note:'Two close pairs orbiting their shared centre.'},
 8:{note:'A massive centre with a ring of lighter bodies. Choose at least 8 bodies. Launch mass is relative to one ring body.'},
 9:{note:'Two rings at different radii around one massive centre. Choose at least 17 bodies; tilt applies to the outer ring.'},
 13:{n:1024,note:'Eigenbeing portrait: detailed head and shoulders with eye sockets, brows, nose, lips, chin and ears. 856 linked vertices in rectangular wire cells, surrounded by 168 free cloud particles. Gentle physical turn; cloud bodies have no elastic links.'},
 12:{n:1856,note:'Eigenbeing: 1,652 linked body vertices in rectangular wire cells, plus 204 free particles in a random field. Adult proportions, elastic supports and a gentle physical turn. No central mass or world anchor.'},
 11:{n:42,note:'Triangulated shell: 42 equal-mass vertices, 80 facets and no central mass. Internal springs and bending braces hold its shape while allowing motion and deformation.'},
 10:{note:'Six rings in different planes form a moving ball around a massive centre. Swipe to rotate its shape; choose at least 49 bodies.'}
};
function ringCoreCount(n){const half=Math.floor(n/2);return half+(n-half)%2;}
function configure(){const kind=Number($('arrangement').value),preset=presets[kind];$('nodeGravity').disabled=[18,19,26].includes(kind);const isCell=kind>=14&&kind<=17;for(const option of $('bodies').options)option.disabled=(Number(option.value)===1&&kind!==30)||isCell&&(Number(option.value)<(kind===17?100:50)||Number(option.value)%2!==0);if(isCell&&$('bodies').selectedOptions[0]?.disabled)$('bodies').value=kind===14?'256':'512';$('bodies').disabled=!!preset.n||kind===18;if(kind===18)$('bodies').value='0';else if($('bodies').value==='0'||(kind!==30&&$('bodies').value==='1'))$('bodies').value='1024';$('bodies').querySelector('[value="0"]').disabled=kind!==18;if(preset.n)$('bodies').value=String(preset.n);else if(kind===8&&Number($('bodies').value)<8)$('bodies').value='8';if(kind===9&&Number($('bodies').value)<17)$('bodies').value='17';if(kind===10&&Number($('bodies').value)<49)$('bodies').value='49';$('eigenStyleControl').hidden=kind!==18&&kind!==19;$('overlapColorControl').hidden=kind===18||kind===19;$('blobSizeControl').hidden=kind===18;$('blobSizeLabel').textContent=kind===19?'Cloud blob size':'Blob size';$('cloudColorControl').hidden=kind!==19&&kind!==26&&kind!==27;$('ringTiltControl').hidden=kind!==9&&kind!==16;$('ringStrengthControl').hidden=kind!==8&&kind!==15;$('meshControls').hidden=kind!==11&&kind!==12&&kind!==13&&kind!==14&&kind!==20&&!(kind>=21&&kind<=25)&&kind!==27&&kind!==28&&kind!==29;const total=Number($('bodies').value),core=kind===14?42:ringCoreCount(total);$('presetInfo').textContent=preset.note+(isCell?` ${core} model bodies + ${total-core} cloud bodies (${total} total).`:'')+' Press Deploy system to add it.';if(multi?.systems.length)$('meshControls').hidden=!multi.systems.some(s=>s.model.mesh);}
$('arrangement').onchange=configure;$('bodies').onchange=configure;configure();
function makeGlobalField(){const read=(id,min,max)=>{const e=$(id),n=Number(e.value);if(e.value.trim()===''||!Number.isFinite(n)||n<min||n>max)throw Error(`Choose ${id==='globalCount'?'body count':id==='globalMass'?'mass':'size'} between ${min} and ${max}.`);return n;};const n=read('globalCount',1,100000);if(!Number.isInteger(n))throw Error('Body count must be a whole number.');const mass=read('globalMass',.000001,100),size=read('globalSize',.1,10),radius=Number($('globalRadius').value)||multi.fieldExtent(),p=new Float32Array(n*4),v=new Float32Array(n*4),styles=new Float32Array(n*4);let state=(12345+serial++*7919)>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};for(let i=0;i<n;i++){const z=2*random()-1,angle=2*Math.PI*random(),r=radius*Math.cbrt(random()),xy=Math.sqrt(1-z*z);p.set([r*xy*Math.cos(angle),r*xy*Math.sin(angle),r*z,mass],i*4);styles[i*4+3]=-size;}return {kind:-1,globalField:true,radius,size,p,v,total:n,baseMass:mass,cloudCount:0,cloudOffset:0,ringCount:0,styles};}
function makeSystem(){if(gameMode&&game)return game.model();if($('globalField').checked)return makeGlobalField();configure();const n=Number($('bodies').value);const kind=Number($('arrangement').value),isRingCell=kind>=15&&kind<=17,coreCount=isRingCell?ringCoreCount(n):n,baseKind=isRingCell?kind-7:kind;if(baseKind===10)wasm.seed_ring_sphere(coreCount);else if(baseKind===9)wasm.seed_two_rings(coreCount,Number($('ringTilt').value));else if(!(kind>=21&&kind<=25)&&kind!==26&&kind!==27&&kind!==28&&kind!==29&&kind!==30&&kind!==20&&kind!==19&&kind!==18&&kind!==11&&kind!==12&&kind!==13&&kind!==14)wasm.seed(coreCount,12345+(isRingCell?serial:serial++)*7919,baseKind);const mesh=(kind===28||kind===29)?personBox(CAPACITY):kind===27?lobeformCarrier(CAPACITY,n):kind>=21&&kind<=25?wirePlatonic(kind,CAPACITY):kind===20?makeLobeform(CAPACITY):kind===11?wireSphere(CAPACITY):kind===12?wireBeing(CAPACITY,12345+serial++*7919):kind===13?wireBust(CAPACITY,12345+serial++*7919):kind===14?wireCell(CAPACITY,12345+serial++*7919,n):null;const ringModel=kind===30?personPoint(CAPACITY):kind===26?lobeformField(CAPACITY,n):kind===19?inertCloud(CAPACITY,n,12345+serial++*7919):isRingCell?ringCloud(new Float32Array(wasm.memory.buffer,wasm.positions(),CAPACITY*4),new Float32Array(wasm.memory.buffer,wasm.velocities(),CAPACITY*4),coreCount,n,12345+serial++*7919):null;baseMass=(kind===28||kind===29)?1/8:kind===27?1/8:kind===18?.01:isRingCell?.045/(coreCount-1):kind===12||kind===13||kind===14?.9/mesh.count:kind>=8&&kind<=10?.05/(n-1):1/n;const p=ringModel?ringModel.p:mesh?mesh.p:new Float32Array(wasm.memory.buffer,wasm.positions(),CAPACITY*4).slice(),v=ringModel?ringModel.v:mesh?mesh.v:new Float32Array(wasm.memory.buffer,wasm.velocities(),CAPACITY*4).slice();
const nodeGravity=$('nodeGravity').value;if(!['attract','repel'].includes(nodeGravity))throw Error('Choose Attract or Repel for object nodes.');const gravityCount=[18,19,26].includes(kind)?0:mesh?.count??(isRingCell?coreCount:n);for(let i=0;i<gravityCount;i++)p[i*4+3]=(nodeGravity==='repel'?-1:1)*Math.abs(p[i*4+3]);
return {nodeGravity,gravityCount,kind,p,v,styles:ringModel?.styles,total:kind===27?n+8:n,mesh,baseMass,cloudCount:kind===19||kind===26||kind===27?n:0,cloudOffset:kind===27?8:0,ringCount:kind===8?n:kind===15?coreCount:0};}
function reset(){if(!$('multiMode').checked){multi.clear(false);const model=makeSystem();multi.installLegacy(model);cloudColors();$('overlapColor').oninput();count();time=0;accumulator=0;historyTime=0;return true;}multi.clear();running=false;time=0;accumulator=0;historyTime=0;cameraMode='fixed';tracked=-1;sceneYaw=0;scenePitch=0;truck=0;pedestal=0;yaw=0;pitch=0;distance=Math.max(.1,Math.min(100,Number($('deploymentDistance').value)||12));focus=[0,0,-distance];viewBasis=null;count();$('pause').textContent='Play';return true;}
function deploy(){return multi.deploy();}
// Project world axes with the same camera basis used by the WebGL scene.
const axisRoot=$('axisLines'),svgNS='http://www.w3.org/2000/svg';
function svgElement(name,attrs){const el=document.createElementNS(svgNS,name);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,value);return el;}
const axes=['X','Y','Z'].map((label,k)=>{
 const color=['#ff7b80','#80e39b','#79b7ff'][k],group=svgElement('g',{});
 const negative=svgElement('line',{stroke:color,'stroke-width':1.5,'stroke-dasharray':'3 4',opacity:.35});
 const positive=svgElement('line',{stroke:color,'stroke-width':2.5,'stroke-linecap':'round'});
 const arrow=svgElement('polygon',{fill:color}),text=svgElement('text',{fill:color});text.textContent=label;
 group.append(negative,positive,arrow,text);axisRoot.append(group);return {k,group,negative,positive,arrow,text};
});
function orientation(camera){
 for(const axis of [...axes].sort((a,b)=>camera[a.k+6]-camera[b.k+6])){
  const {k,group,negative,positive,arrow,text}=axis,dx=camera[k],dy=-camera[k+3],length=Math.hypot(dx,dy),x=52+30*dx,y=52+30*dy;
  for(const [el,x2,y2] of [[negative,52-30*dx,52-30*dy],[positive,x,y]]){el.setAttribute('x1',52);el.setAttribute('y1',52);el.setAttribute('x2',x2);el.setAttribute('y2',y2);}
  if(length>.05){const ux=dx/length,uy=dy/length;arrow.setAttribute('points',`${x},${y} ${x-6*ux+3*uy},${y-6*uy-3*ux} ${x-6*ux-3*uy},${y-6*uy+3*ux}`);}else arrow.setAttribute('points','');
  text.setAttribute('x',52+42*dx+(length<.2?10:0));text.setAttribute('y',52+42*dy+(length<.2?-10:0));
  group.setAttribute('opacity',camera[k+6]<0?.65:1);axisRoot.append(group);
 }
}
function home(){$('autoSpin').checked=false;sceneYaw=0;scenePitch=0;truck=0;pedestal=0;yaw=.4;pitch=.55;distance=8;focus=[...START_CENTRE];cameraMode='fixed';tracked=-1;viewBasis=null;}
function captureView(){if(!viewBasis)return;const b=rawView||viewBasis;pitch=Math.asin(Math.max(-1,Math.min(1,b[7])));yaw=Math.atan2(b[6],b[8]);focus=[0,1,2].map(k=>b[k+9]-b[k+6]*distance);}
function sceneBasis(b){
 rawView=new Float32Array(b);
 // Inverse model rotation about the view centre: rendering only, never GPU state.
 const pivot=START_CENTRE;
 const cy=Math.cos(sceneYaw),sy=Math.sin(sceneYaw),cx=Math.cos(scenePitch),sx=Math.sin(scenePitch);
 function inverse(v){const x=cy*v[0]-sy*v[2],z=sy*v[0]+cy*v[2];return [x,cx*v[1]+sx*z,-sx*v[1]+cx*z];}
 const result=new Float32Array(12);
 for(let k=0;k<9;k+=3)result.set(inverse(Array.from(b.slice(k,k+3))),k);
 result.set(inverse([0,1,2].map(k=>b[k+9]-pivot[k])).map((x,k)=>x+pivot[k]),9);
 viewBasis=result;return result;
}
function rotateVector(v){const cy=Math.cos(sceneYaw),sy=Math.sin(sceneYaw),cx=Math.cos(scenePitch),sx=Math.sin(scenePitch),y=cx*v[1]-sx*v[2],z=sx*v[1]+cx*v[2];return [cy*v[0]+sy*z,y,-sy*v[0]+cy*z];}
function rotatePoint(v){return rotateVector(v.map((x,k)=>x-START_CENTRE[k])).map((x,k)=>x+START_CENTRE[k]);}
function centreIndicator(b){
 $('startingCentre').hidden=!$('showCentre').checked||!!multi?.systems.length;if($('startingCentre').hidden)return;
 const el=$('startingCentre'),w=canvas.clientWidth,h=canvas.clientHeight,d=START_CENTRE.map((x,k)=>x-b[k+9]),dot=k=>d[0]*b[k]+d[1]*b[k+1]+d[2]*b[k+2],z=-dot(6);
 const nx=dot(0)*1.8*gpu.zoomScale/(w/h)/Math.max(.0005,z),ny=dot(3)*1.8*gpu.zoomScale/Math.max(.0005,z);
 const visible=z>=.0005&&Math.abs(nx)<1&&Math.abs(ny)<1,x=(nx+1)*w/2,y=(1-ny)*h/2;
 el.style.left=(visible?x:Math.max(16,Math.min(w-16,x)))+'px';el.style.top=(visible?y:Math.max(40,Math.min(h-45,y)))+'px';
 el.classList.toggle('offscreen',!visible);const label=el.querySelector('span');label.textContent=visible?'Starting centre':z<.0005?'Centre behind view':'Centre offscreen';label.style.left=x>w-80?'auto':x<80?'0':'50%';label.style.right=x>w-80?'0':'auto';label.style.transform=x<80||x>w-80?'none':'translateX(-50%)';
 el.dataset.visible=String(visible);
}
function cameraBasis(){
 gpu.zoomScale=gameMode?(game?.viewZoom()??1):cameraMode==='forward'?1:Math.max(1,.4/distance);
 if($('followStructure').checked&&cameraMode==='fixed'){const centre=multi?.centreOfSelected()??gpu.structureCentre();if(centre)focus=rotatePoint(centre);}
 wasm.camera(yaw,pitch,distance);const b=new Float32Array(new Float32Array(wasm.memory.buffer,wasm.camera_ptr(),12));
 if(tracked>=0&&cameraMode!=='fixed'){
  const state=gpu.particle(tracked),position=rotatePoint(Array.from(state.p.slice(0,3)));
  if(cameraMode==='center')focus=position;
  else {
   const speed=Math.hypot(...state.v.slice(0,3));if(speed>1e-6)forward=Array.from(state.v.slice(0,3),x=>x/speed);
   const back=rotateVector(forward).map(x=>-x);let right=[back[2],0,-back[0]];let length=Math.hypot(...right);
   if(length<1e-4){right=[0,-back[2],back[1]];length=Math.hypot(...right);}
   right=right.map(x=>x/length);const up=[back[1]*right[2]-back[2]*right[1],back[2]*right[0]-back[0]*right[2],back[0]*right[1]-back[1]*right[0]];
   b.set(right,0);b.set(up,3);b.set(back,6);b.set(position,9);return sceneBasis(b);
  }
 }
 for(let k=0;k<3;k++)b[k+9]+=focus[k];return sceneBasis(b);
}
function cameraControlMode(){
 const moving=$('cameraTranslate').checked;
 $('cameraPanLabel').textContent=moving?'Truck':'Camera pan';$('cameraTiltLabel').textContent=moving?'Pedestal':'Camera tilt';
 for(const [id,min,max] of [['cameraPan',moving?-5:-180,moving?5:180],['cameraTilt',moving?-5:-80,moving?5:80]]){$(id).min=min;$(id).max=max;$(id).step=moving?.01:.1;}
 $('cameraHelp').textContent=moving?'Move sideways or vertically in simulation units without changing camera heading. Design mode records the camera with action markers.':'Turn the camera from its current position. Design mode saves camera settings with action markers.';
 if(ready)cameraControls(cameraBasis());
}
$('cameraTranslate').onchange=cameraControlMode;
$('followStructure').onchange=()=>{if(!ready)return;if($('followStructure').checked){cameraMode='fixed';tracked=-1;truck=0;pedestal=0;}cameraControls(cameraBasis());};
$('showCentre').onchange=()=>{$('startingCentre').hidden=!$('showCentre').checked||!!multi?.systems.length;};
function translateCamera(id){
 if(!ready)return;const value=Number($(id).value),rendered=cameraBasis(),b=rawView||rendered;$('followStructure').checked=false;
 if(cameraMode!=='fixed'){captureView();cameraMode='fixed';tracked=-1;}
 $('autoSpin').checked=false;
 if(id==='cameraPan'){const delta=value-truck,length=Math.hypot(b[0],b[2]),right=length>1e-6?[b[0]/length,0,b[2]/length]:[Math.cos(yaw),0,-Math.sin(yaw)];for(let k=0;k<3;k++)focus[k]+=right[k]*delta;truck=value;}
 else{focus[1]+=value-pedestal;pedestal=value;}
 viewBasis=null;cameraControls(cameraBasis());
}
function cameraControls(b){
 if($('cameraTranslate').checked){for(const [id,value] of [['cameraPan',truck],['cameraTilt',pedestal]]){const slider=$(id);if(value<Number(slider.min)||value>Number(slider.max)){slider.min=value-5;slider.max=value+5;}}$('cameraPan').value=truck;$('cameraTilt').value=pedestal;$('cameraPanValue').textContent=truck.toFixed(2);$('cameraTiltValue').textContent=pedestal.toFixed(2);return;}
 b=rawView||b;const angle=Math.atan2(b[6],b[8])*180/Math.PI,tilt=Math.asin(Math.max(-1,Math.min(1,b[7])))*180/Math.PI;
 const tiltValue=Math.max(-80,Math.min(80,tilt));if(Math.abs(Number($('cameraPan').value)-angle)>.05)$('cameraPan').value=angle;if(Math.abs(Number($('cameraTilt').value)-tiltValue)>.05)$('cameraTilt').value=tiltValue;
 $('cameraPanValue').textContent=angle.toFixed(1)+'°';$('cameraTiltValue').textContent=tilt.toFixed(1)+'°';
}
function turnCamera(id){if(!ready)return;cameraBasis();$('followStructure').checked=false;const angle=Number($(id).value)*Math.PI/180,rendered=cameraBasis(),b=rawView||rendered,eye=Array.from(b.slice(9,12));
 yaw=id==='cameraPan'?angle:Math.atan2(b[6],b[8]);pitch=id==='cameraTilt'?angle:Math.asin(Math.max(-1,Math.min(1,b[7])));
 pitch=Math.max(-80*Math.PI/180,Math.min(80*Math.PI/180,pitch));cameraMode='fixed';tracked=-1;$('autoSpin').checked=false;
 wasm.camera(yaw,pitch,distance);const back=new Float32Array(wasm.memory.buffer,wasm.camera_ptr()+24,3);
 focus=eye.map((x,k)=>x-back[k]*distance);viewBasis=null;cameraControls(cameraBasis());
}
for(const id of ['cameraPan','cameraTilt'])$(id).oninput=()=>$('cameraTranslate').checked?translateCamera(id):turnCamera(id);
function fire(){if(!ready)return false;const speed=Number($('speed').value);if(!Number.isFinite(speed)||speed<0||speed>5){$('launchInfo').textContent='Choose a speed between 0 and 5.';return false;}
const rad=Number($('launchDistance').value);if(!Number.isFinite(rad)||rad<.1||rad>1000){$('launchInfo').textContent='Choose a launch distance between 0.1 and 1,000.';return false;}
const launchSize=Number($('launchSize').value);if(!Number.isFinite(launchSize)||launchSize<.1||launchSize>20){$('launchInfo').textContent='Choose a launch body size between 0.1 and 20.';return false;}
const hex=$('launchColor').value,launchStyle=[...[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255),launchSize];
const stopping=$('launchStop').checked;if(stopping&&speed===0){$('launchInfo').textContent='Choose a speed above 0 for a guided launch.';return false;}
const delayed=stopping&&$('arrivalGravity').checked,repulsive=$('arrivalType').value==='negative';
const target=stopping?[...START_CENTRE]:null;
const angle=(stopping?0:Number($('angle').value))*Math.PI/180;const a=viewBasis?Math.atan2(viewBasis[6],viewBasis[8]):yaw;const p=[rad*Math.sin(a),0,rad*Math.cos(a),baseMass*Number($('mass').value)*(delayed||repulsive?-1:1)];for(let k=0;k<3;k++)p[k]+=START_CENTRE[k];const v=[-speed*Math.sin(a+angle),0,-speed*Math.cos(a+angle),stopping?(repulsive?(delayed?-3:-4):-2):1];if(gpu.add(p,v,target,launchStyle)){$('autoSpin').checked=false;captureView();cameraMode=$('launchCamera').value;if(cameraMode!=='fixed')$('followStructure').checked=false;tracked=cameraMode==='fixed'?-1:gpu.count-1;if(cameraMode==='forward')forward=[-Math.sin(a+angle),0,-Math.cos(a+angle)];$('launchInfo').textContent=`Body ${gpu.count} fired · ${Number($('mass').value).toLocaleString()}× starting-body mass · distance ${rad.toLocaleString()}${stopping?' · guided to starting centre, then held':''}${delayed?(repulsive?' · repulsive gravity on arrival':' · gravity on arrival'):repulsive?' · repulsive gravity':''}`;count();return true;}return false;}
function frame(now){if(!ready)return;try{let elapsed=last?Math.min((now-last)/1000,.05):0;last=now;if(!timeline?.active&&$('autoSpin').checked&&cameraMode!=='forward'&&!document.hidden)yaw+=elapsed*.22;if((timeline?.active?timeline.playing:running)&&!timeline?.busy&&!document.hidden){accumulator=Math.min(accumulator+elapsed*Number($('rate').value),DT*MAX_STEPS);let steps=0;while(accumulator>=DT&&steps<MAX_STEPS){if(timeline?.active){if(!timeline.tick()){accumulator=0;break;}}else{game?.beforeStep(DT);gpu.step(DT);time+=DT;game?.step();}accumulator-=DT;steps++;}if(time-historyTime>=.04){gpu.record();historyTime=time;}}
if(timeline?.busy){requestAnimationFrame(frame);return;}
const basis=cameraBasis();gpu.draw(basis,$('trails').checked);gpu.inertStructure.draw(basis);gpu.lobeform.draw(basis);if(gpu.legacyPerson){gpu.gl.clear(gpu.gl.DEPTH_BUFFER_BIT);gpu.legacyPerson.draw(basis);}multi.draw(basis);gpu.facetObject.draw(basis);game?.draw(basis);$('facetView').textContent=gpu.facetObject.selected&&gpu.facetObject.placement.show?'Showing: '+(gpu.facetObject.selected.label||gpu.facetObject.selected.id):'';orientation(basis);centreIndicator(basis);cameraControls(basis);document.querySelector('.hint').hidden=gameMode;document.querySelector('.hint').textContent=gameMode?'Mouse drag or Aim Track Pad · Space or Fire':cameraMode==='forward'?'Riding particle · Home view returns to system':cameraMode==='center'?'Swipe to rotate scene · pinch to zoom':'Swipe to rotate scene · pinch to zoom';$('zoom').textContent=cameraMode==='forward'?'Zoom fixed · ride':`Zoom ${(8/distance).toFixed(2)}×`;$('clock').textContent=`t ${time.toFixed(2)}`;frames++;if(now-statsTime>1000){$('status').textContent=`GPU gravity · ${Math.round(frames*1000/(now-statsTime))} fps`;statsTime=now;frames=0;}requestAnimationFrame(frame);}catch(e){fail(e);}}
for(const id of ['rate','angle','ringTilt','systemMass','blobSize','eigenSize','launchSize','ringStrength','meshStiffness','meshBending','meshDamping'])$(id).oninput=()=>{$(id+'Value').textContent=id==='ringStrength'&&Number($(id).value)===0?'Off':$(id).value+(id==='angle'||id==='ringTilt'?'°':id.startsWith('mesh')?'':'×');if(id==='systemMass'&&gpu)gpu.massScale=Number($(id).value);if(id==='blobSize'&&gpu)gpu.blobSize=Number($(id).value);if(id==='eigenSize'&&gpu)gpu.eigenSize=Number($(id).value);if(id==='ringStrength'&&gpu)gpu.ringStrength=Number($(id).value);if(id.startsWith('mesh')&&gpu)gpu[id]=Number($(id).value);};
function cloudColors(){if(multi?.systems.length){multi.cloudColors();return;}if(!gpu?.cloudCount)return;const count=gpu.cloudCount,data=new Float32Array(count*4),hex=$('cloudColor').value,rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);if(!$('cloudRainbow').checked)for(let i=0;i<count;i++)data.set([...rgb,1],i*4);gpu.overlapColor=rgb;const g=gpu.gl,start=gpu.cloudOffset||0;g.bindTexture(g.TEXTURE_2D,gpu.bodyStyle);for(let i=0;i<count;){const slot=start+i,len=Math.min(count-i,64-slot%64);g.texSubImage2D(g.TEXTURE_2D,0,slot%64,Math.floor(slot/64),len,1,g.RGBA,g.FLOAT,data.subarray(i*4,(i+len)*4));i+=len;}}
$('cloudColor').oninput=cloudColors;$('cloudRainbow').onchange=cloudColors;
$('eigenColor').oninput=()=>{if(gpu){const hex=$('eigenColor').value;gpu.eigenColor=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);}};
$('overlapColor').oninput=()=>{if(gpu){const hex=$(gpu.cloudCount?'cloudColor':'overlapColor').value;gpu.overlapColor=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);}};
function launchControls(){const enabled=$('launchStop').checked;$('angle').disabled=enabled;$('arrivalGravityControl').hidden=!enabled;$('arrivalGravityHelp').hidden=!enabled;$('arrivalTypeControl').hidden=false;}
$('launchStop').onchange=launchControls;$('arrivalGravity').onchange=launchControls;
$('reset').onclick=()=>{if(ready){$('multiMode').checked=true;timeline.record('reset');}};$('pause').onclick=()=>{if(multi.editing!==null&&!multi.finishEdit())return;if(timeline?.active){timeline.play();return;}if(!running&&!multi.fitField())return;running=!running;if(!running)soundtrack.pause();accumulator=0;$('pause').textContent=running?'Pause':'Play';};$('home').onclick=home;$('deleteSystem').onclick=()=>multi.requestDelete();$('deploy').onclick=()=>{if(!ready)return;$('globalField').checked=false;timeline.record('deploy');};$('addGlobalField').onclick=async()=>{if(!ready)return;if(multi.editing!==null&&!multi.finishEdit())return;$('globalField').checked=true;$('globalRadius').value=multi.fieldExtent();await timeline.record('deploy');$('globalField').checked=false;};$('fire').onclick=()=>timeline.record('fire');
 $('workMode').onclick=()=>{if(!ready||!timeline.setDesign(!timeline.design))return;running=false;soundtrack.pause();last=0;accumulator=0;$('pause').textContent='Play';const design=timeline.design;$('workMode').textContent=design?'Design mode · switch to Demo':'Demo mode · switch to Design';$('workMode').setAttribute('aria-pressed',String(design));$('timelinePanel').hidden=!design;$('modeInfo').textContent=design?'Action buttons create or update timeline markers. Play from start checks the complete run.':'Explore freely. Settings and actions do not change the timeline.';};
document.addEventListener('visibilitychange',()=>{if(document.hidden){soundtrack.pause();if(timeline?.playing)timeline.pause();running=false;accumulator=0;$('pause').textContent='Play';}});
const pointers=new Map();let pinch=0;
canvas.onpointerdown=e=>{if(gameMode)return;if(cameraMode!=='fixed'){cameraBasis();captureView();cameraMode='fixed';tracked=-1;cameraControls(cameraBasis());}canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});pinch=0;};
canvas.onpointermove=e=>{if(gameMode)return;const old=pointers.get(e.pointerId);if(!old)return;const dx=e.clientX-old.x,dy=e.clientY-old.y;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1){$('autoSpin').checked=false;sceneYaw-=dx*.008;scenePitch=Math.max(-Math.PI,Math.min(Math.PI,scenePitch+dy*.008));}else{const [a,b]=[...pointers.values()];const gap=Math.hypot(a.x-b.x,a.y-b.y);if(pinch>0)distance=Math.max(MIN_DISTANCE,Math.min(100,distance*pinch/gap));pinch=gap;}};
for(const name of ['onpointerup','onpointercancel','onlostpointercapture'])canvas[name]=e=>{pointers.delete(e.pointerId);pinch=0;};
canvas.addEventListener('wheel',e=>{e.preventDefault();if(gameMode)return;distance=Math.max(MIN_DISTANCE,Math.min(100,distance*Math.exp(e.deltaY*.001)));},{passive:false});
canvas.onkeydown=e=>{if(gameMode)return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(e.key)){e.preventDefault();if(e.key==='ArrowLeft')sceneYaw-=.1;if(e.key==='ArrowRight')sceneYaw+=.1;if(e.key==='ArrowUp')scenePitch=Math.min(Math.PI,scenePitch+.1);if(e.key==='ArrowDown')scenePitch=Math.max(-Math.PI,scenePitch-.1);if(e.key==='+')distance=Math.max(MIN_DISTANCE,distance/1.1);if(e.key==='-')distance=Math.min(100,distance*1.1);}};
document.addEventListener('visibilitychange',()=>{last=0;accumulator=0;pointers.clear();});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fail(Error('Graphics context lost. Reload the page to restart.'));});
function applyCamera(c,sync=true){const previousMode=$('cameraTranslate').checked;({yaw,pitch,distance}=c);sceneYaw=c.sceneYaw??0;scenePitch=c.scenePitch??0;truck=c.truck??0;pedestal=c.pedestal??0;$('cameraTranslate').checked=c.translate??false;cameraMode=c.mode;tracked=c.tracked;focus=[...c.focus];forward=[...c.forward];viewBasis=null;if(sync||previousMode!==$('cameraTranslate').checked){cameraBasis();cameraControlMode();}}
function keyCamera(){cameraBasis();const b=rawView;return {yaw:Math.atan2(b[6],b[8]),pitch:Math.asin(Math.max(-1,Math.min(1,b[7]))),distance,sceneYaw,scenePitch,truck,pedestal,translate:$('cameraTranslate').checked,mode:'fixed',tracked:-1,focus:[0,1,2].map(k=>b[k+9]-b[k+6]*distance),forward:[...forward]};}
async function start(){try{const response=await fetch('nbody.wasm?v=multi-11');if(!response.ok)throw Error(`Wasm download failed (${response.status}).`);const result=await WebAssembly.instantiate(await response.arrayBuffer(),{});wasm=result.instance.exports;gpu=new GravityGPU(canvas);gpu.facetObject=new FacetObject(gpu);applyFacetPlacement=installFacetUI({getObject:()=>gpu?.facetObject,isBusy:()=>!ready||timeline?.busy||multi?.editing!==null&&multi?.editing!==undefined,onImported:async({saved})=>{running=false;accumulator=0;soundtrack.pause();timeline?.pause();$('pause').textContent='Play';if(!saved){const centre=multi?.line?.origin??focus;for(const [i,id]of ['facetX','facetY','facetZ'].entries())$(id).value=String(centre[i]);applyFacetPlacement();}}});if(!gameMode)await Promise.all([PersonBox.load(gpu),PersonBox.loadTop(gpu),Person18.load(gpu)]);gpu.inertStructure=new InertStructure(gpu);gpu.lobeform=new LobeformSkin(gpu);multi=new MultiSystems({gpu,makeSystem,seed:()=>serial,makeSeeded:seed=>{const saved=serial;try{serial=seed;return makeSystem();}finally{serial=saved;}},pause:()=>{running=false;accumulator=0;soundtrack.pause();timeline?.pause();$('pause').textContent='Play';},isBusy:()=>timeline?.busy,deleteAction:()=>timeline?.record('delete'),editStarted:s=>timeline?.beginDeploymentEdit(s.event),editUpdated:s=>timeline?.updateDeploymentEdit(s.event,s.settings),editFinished:()=>timeline?.finishDeploymentEdit(),remap:(start,oldCount,newCount)=>{game?.remap(start,oldCount,newCount);if(tracked>=start+oldCount)tracked+=newCount-oldCount;else if(tracked>=start){tracked=-1;cameraMode='fixed';}viewBasis=null;},camera:cameraBasis,centre:START_CENTRE,select:m=>{baseMass=m.baseMass;gpu.followRange={start:m.start,count:m.meshCount||m.total};gpu.structureCentreCache=null;viewBasis=null;},changed:()=>{count();configure();},classes:{LobeformSkin,InertStructure,PersonBox,Person18},message:t=>$('deploymentInfo').textContent=t});$('eigenColor').oninput();$('eigenSize').oninput();gpu.massScale=Number($('systemMass').value);gpu.blobSize=Number($('blobSize').value);for(const id of ['meshStiffness','meshBending','meshDamping'])$(id).oninput();$('overlapColor').oninput();ready=true;reset();timeline=createTimeline({
 audio:soundtrack,prepareField:()=>multi.fitField(),editingDeployment:()=>multi.editing!==null,finishDeploymentEdit:()=>multi.finishEdit(),bindDeployment:e=>{const s=multi.systems.at(-1);if(s)s.event=e.order;},beginDeployment:id=>{const i=multi.systems.findIndex(s=>s.event===id);if(i>=0)multi.beginEdit(i);},
 capture:()=>({serial,camera:{yaw,pitch,distance,sceneYaw,scenePitch,truck,pedestal,translate:$('cameraTranslate').checked,mode:cameraMode,tracked,focus:[...focus],forward:[...forward]}}),
 initial:()=>({serial:0,camera:{yaw,pitch,distance,sceneYaw,scenePitch,truck,pedestal,translate:$('cameraTranslate').checked,mode:'fixed',tracked:-1,focus:[...focus],forward:[0,0,-1]}}),
 apply:s=>{applyFacetPlacement();$('eigenColor').oninput();cloudColors();$('showCentre').onchange();$('overlapColor').oninput();configure();multi.select(Number(s.settings.selectedSystem));$('autoSpin').checked=s.settings.autoSpin;launchControls();for(const id of ['rate','angle','ringTilt','systemMass','blobSize','eigenSize','launchSize','ringStrength','meshStiffness','meshBending','meshDamping'])$(id).oninput();serial=s.serial;applyCamera(s.camera);},
 inspectSettings:()=>{applyFacetPlacement();configure();launchControls();const saved={};for(const id of ['systemMass','blobSize','eigenSize','ringStrength','meshStiffness','meshBending','meshDamping'])saved[id==='systemMass'?'massScale':id]=gpu[id==='systemMass'?'massScale':id];for(const id of ['rate','angle','ringTilt','systemMass','blobSize','eigenSize','launchSize','ringStrength','meshStiffness','meshBending','meshDamping'])$(id).oninput();Object.assign(gpu,saved);},
 flush:()=>gpu.gl.finish(),
 applyCamera,keyCamera,tracking:()=>cameraMode!=='fixed'&&tracked>=0,
 action:a=>{if(a==='camera')return true;if(a==='reset')return reset();if(a==='deploy')return deploy();if(a==='delete')return multi.deleteSelected();cameraBasis();return fire();},
 step:dt=>{if($('autoSpin').checked&&cameraMode!=='forward')yaw+=dt*.22/Number($('rate').value);gpu.step(dt);time+=dt;if(time-historyTime>=.04){gpu.record();historyTime=time;}},
 refresh:()=>{last=0;accumulator=0;},full:()=>gpu.count>=gpu.maxCapacity,systemFull:()=>false,selectSystem:id=>multi.select(id),
 validate:s=>{const c=s.camera;if(c&&((c.translate!==undefined&&typeof c.translate!=='boolean')||![c.truck??0,c.pedestal??0].every(x=>Number.isFinite(x)&&Math.abs(x)<=50)))throw Error('Invalid camera translation.');if(c&&(!Number.isFinite(c.sceneYaw??0)||!Number.isFinite(c.scenePitch??0)))throw Error('Invalid scene rotation.');if(!Number.isInteger(s.serial)||s.serial<0||s.serial>1e6||!c||!['fixed','center','forward'].includes(c.mode)||!Number.isInteger(c.tracked)||c.tracked< -1||c.tracked>=gpu.maxCapacity||![c.yaw,c.pitch,c.distance,...(c.focus||[]),...(c.forward||[])].every(Number.isFinite)||!Array.isArray(c.focus)||c.focus.length!==3||!Array.isArray(c.forward)||c.forward.length!==3||Math.abs(c.pitch)>Math.PI/2||c.distance<MIN_DISTANCE||c.distance>100)throw Error('Invalid camera or seed.');}
});statsTime=performance.now();
// Inspectable development diagnostics; gravity is always calculated by the GPU.
window.nbody={gpu,reset,fire,deploy,multi,timeline,get ready(){return ready;},get running(){return running;},get time(){return time;},get startingCentre(){return [...START_CENTRE];},get camera(){cameraBasis();return {yaw,pitch,distance,sceneYaw,scenePitch,truck,pedestal,translate:$('cameraTranslate').checked,rawBasis:rawView?Array.from(rawView):null,mode:cameraMode,tracked,focus:[...focus],basis:viewBasis?Array.from(viewBasis):null};}};
if(gameMode){game=new ClayGame({gpu,multi,canvas,reset:()=>{reset();time=0;},run:()=>{running=true;last=0;accumulator=0;},camera:()=>{yaw=0;pitch=0;distance=12;focus=[0,0,-12];sceneYaw=scenePitch=0;cameraMode='fixed';tracked=-1;viewBasis=null;}});window.nbody.game=game;game.restart();}
requestAnimationFrame(frame);}catch(e){fail(e);}}
start();


