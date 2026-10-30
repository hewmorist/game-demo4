import {JenniferCaller} from './jennifer.js?v=clay-32';
import {wireSphere} from './mesh.js?v=multi-11';
const $=id=>document.getElementById(id);
const AIM_GAIN=10;
const BALLISTIC_SPEED=160,INTERCEPTOR_SPEED=8,SHOT_MASS=-1,CLAY_SPEED=3*Math.hypot(5,.35,.08)/5;

const vertex=`#version 300 es
precision highp float;precision highp int;
in float node;in vec3 faceNodes,restOffset;uniform bool fractured;uniform sampler2D positions;uniform vec3 right,up,back,eye;uniform float aspect,focal;uniform int offset;out vec3 world;
void main(){int id=int(node)+offset;world=texelFetch(positions,ivec2(id%64,id/64),0).xyz;if(fractured){vec3 centre=vec3(0);for(int k=0;k<3;k++){int j=int(faceNodes[k])+offset;centre+=texelFetch(positions,ivec2(j%64,j/64),0).xyz/3.;}world=centre+restOffset*.85;}vec3 d=world-eye;float z=-dot(d,back),near=.0005,far=10000.;gl_Position=vec4(dot(d,right)*focal/aspect,dot(d,up)*focal,(far+near)/(far-near)*z-2.*far*near/(far-near),z);}`;
const fragment=`#version 300 es
precision highp float;in vec3 world;out vec4 color;
void main(){vec3 n=normalize(cross(dFdx(world),dFdy(world)));float light=.35+.65*abs(dot(n,normalize(vec3(-.4,.8,1.))));color=vec4(vec3(1.,.37,.065)*light,1);}`;
export class ClayGame{
 constructor(api){Object.assign(this,api);this.shots=[];this.aimXY=[0,0];this.nextID=1;this.program=this.gpu.program(vertex,fragment);const g=this.gpu.gl;this.vao=g.createVertexArray();g.bindVertexArray(this.vao);this.buffer=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,this.buffer);const sphere=wireSphere(),data=[];for(const face of sphere.faces){const centre=[0,1,2].map(k=>face.reduce((sum,id)=>sum+sphere.p[id*4+k]*.3/3,0));for(const id of face)data.push(id,...face,...[0,1,2].map(k=>sphere.p[id*4+k]*.3-centre[k]));}g.bufferData(g.ARRAY_BUFFER,new Float32Array(data),g.STATIC_DRAW);for(const [name,size,offset]of [['node',1,0],['faceNodes',3,4],['restOffset',3,16]]){const attr=g.getAttribLocation(this.program,name);g.enableVertexAttribArray(attr);g.vertexAttribPointer(attr,size,g.FLOAT,false,28,offset);}g.bindVertexArray(this.gpu.vao);
 $('gameControls').hidden=false;$('shotDepth').closest('label').hidden=true;$('crosshair').hidden=true;$('space').setAttribute('aria-label','Clay pigeon range. Drag the display with the mouse or drag the Aim Track Pad to move the crosshair; tap Fire or press Space to shoot; P starts or stops the round, Space fires.');$('pull').onclick=()=>this.toggleCalling();this.wireFire();this.wireAim();this.wireMouseAim();$('jenniferEnabled').onchange=()=>{this.voice?.syncVoice();this.update();if(!this.voice?.busy&&!this.pulls)this.readyMessage();};$('shotDepth').oninput=()=>$('shotDepthValue').textContent=$('shotDepth').value;
 this.voice=new JenniferCaller({release:()=>this.releaseCalledClay(),canRelease:()=>this.pulls<24,remaining:()=>24-this.pulls,voiceEnabled:()=>$('jenniferEnabled').checked,needsReload:()=>this.shots.some(s=>s.turn===this.pulls),score:()=>this.hits,settled:()=>!this.shots.some(s=>s.locked&&!s.checked),reload:()=>this.closeGun(),aimReady:()=>this.prepareAim(),endTurn:()=>this.finishTurn(),beforePull:()=>this.closeGun(false),message:text=>this.message(text),changed:()=>this.update()});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)this.closeGun();});
 document.addEventListener('keydown',e=>{if(e.target.closest('input,select,textarea,[contenteditable]:not([contenteditable="false"])')||e.ctrlKey||e.metaKey||e.altKey)return;if(e.code==='Space'){e.preventDefault();e.stopPropagation();if(!e.repeat)this.fire();return;}if(e.repeat||e.target.closest('button'))return;if(e.code==='KeyP'){e.preventDefault();this.toggleCalling();}},true);
 }
 viewZoom(){return matchMedia('(max-width:700px)').matches?.5:1;}
 focal(){return 1.8*this.viewZoom();}
 readyMessage(){this.message('Ready.');}
 message(s){$('gameMessage').textContent=s;}
 restart(){this.preAim=false;this.activeClayID=null;this.gunDeadline=0;this.aimEpoch=(this.aimEpoch||0)+1;this.voice?.reset();this.reset();this.camera();this.shots=[];this.pulls=this.fired=this.hits=0;this.aimXY=[0,0];this.nextID=1;this.gpu.massScale=1;this.gpu.steering=[];this.gpu.acceleration=[0,-.045,0];this.gpu.meshStiffness=30;this.gpu.meshBending=10;this.gpu.meshDamping=2;this.gpu.blobSize=.5;$('soundtrackSync').checked=false;$('autoSpin').checked=false;$('followStructure').checked=false;$('showCentre').checked=false;$('rate').value='1';$('trails').checked=false;this.crosshair();this.update();$('status').textContent='Range ready';this.readyMessage();this.run();}
 model(){const m=wireSphere(this.gpu.capacity),velocity=this.pendingLaunch.velocity;for(let i=0;i<m.count;i++){for(let k=0;k<3;k++)m.p[i*4+k]*=.3;m.p[i*4+3]=.0001;for(let k=0;k<3;k++)m.v[i*4+k]=velocity[k];}
 for(let k=0;k<m.links.length;k+=4)m.links[k+1]*=.3;m.bodyStyle=new Float32Array(this.gpu.capacity*4);for(let i=0;i<m.count;i++)m.bodyStyle.set([1,.4,.08,.6],i*4);return {kind:11,p:m.p,v:m.v,total:m.count,mesh:m,baseMass:.0001,cloudCount:0,cloudOffset:0,ringCount:0};}
 toggleCalling(){if(this.voice.completed){this.restart();this.voice.request();return;}if(this.voice.busy){this.voice.cancel();this.message('Paused.');}else this.voice.request();}
 releaseCalledClay(){// Finish the previous unhit clay at the next call.
 const pending=id=>this.shots.some(shot=>shot.locked&&!shot.checked&&shot.targetID===id);
 for(let i=this.multi.systems.length-1;i>=0;i--){const s=this.multi.systems[i];if(!s.broken&&!pending(s.gameID)){this.multi.select(i);this.multi.deleteSelected();}}
 while(this.multi.systems.length>=6){const index=this.multi.systems.findIndex(s=>!pending(s.gameID));if(index<0)break;this.multi.select(index);this.multi.deleteSelected();}
 return this.pull();}
 finishTurn(){this.closeGun(false);for(let i=this.multi.systems.length-1;i>=0;i--){const s=this.multi.systems[i];if(!s.broken&&!this.shots.some(shot=>shot.locked&&!shot.checked&&shot.targetID===s.gameID)){this.multi.select(i);this.multi.deleteSelected();}}this.run();}
 canPull(){if(this.pulls>=24){this.message('Round complete.');return false;}if(this.multi.systems.length>=6){this.message('Six clays in flight. Wait for one to leave.');return false;}return true;}
 pull(){if(this.pulls>=24){this.message('Round complete.');return false;}if(this.multi.systems.length>=6){this.message('Six clays in flight. Let one fly out before pulling again.');return false;}
 const side=Math.random()<.5?-1:1,azimuth=(20+30*Math.random())*Math.PI/180,elevation=(35+15*Math.random())*Math.PI/180;
 const depth=4,aspect=this.canvas.clientWidth/this.canvas.clientHeight,position=side*(.2+.5*Math.random())*depth*aspect/this.focal();
 this.pendingLaunch={side,azimuth,elevation,position,wave:[1.2+.9*Math.random(),1.1+.7*Math.random(),Math.random()*Math.PI*2,this.gpu.simTime],velocity:[-side*Math.cos(elevation)*Math.sin(azimuth)*CLAY_SPEED,Math.sin(elevation)*CLAY_SPEED,-Math.cos(elevation)*Math.cos(azimuth)*CLAY_SPEED]};
 this.camera();if(!this.multi.line)this.multi.line={distance:12,origin:[0,-4/this.focal(),-4],axis:[1,0,0],axes:{X:[1,0,0],Y:[0,1,0],Z:[0,0,1]}};
 this.multi.line.origin[1]=-4/this.focal();
 $('arrangement').value='11';$('deploymentAxis').value='X';$('deploymentPosition').value=String(position);$('deploymentVelocity').value='0';$('nodeGravity').value='attract';$('globalField').checked=false;
 if(!this.multi.deploy())return false;const s=this.multi.systems.at(-1);s.launch={...this.pendingLaunch};s.gameID=this.nextID++;s.expires=this.gpu.simTime+60;s.broken=false;s.shotTaken=false;const prepared=this.preAim;this.preAim=false;this.activeClayID=s.gameID;this.gunDeadline=performance.now()+7000;if(!prepared)this.aimEpoch=(this.aimEpoch||0)+1;this.pulls++;if(!prepared)this.aimXY=[0,0];this.crosshair();this.update();this.run();this.message('Pull! Clay rising from the bottom.');return true;}
 aim(e){const r=this.canvas.getBoundingClientRect();this.aimXY=[Math.max(-.96,Math.min(.96,2*(e.clientX-r.left)/r.width-1)),Math.max(-.96,Math.min(.96,1-2*(e.clientY-r.top)/r.height))];this.crosshair();}
 crosshair(){$('crosshair').style.left=(this.aimXY[0]+1)*50+'%';$('crosshair').style.top=(1-this.aimXY[1])*50+'%';}
 wireFire(){const button=$('shoot');
 // Secondary touches do not reliably generate click while Aim is held.
 button.onpointerdown=e=>{if(e.button!==0||button.disabled)return;e.preventDefault();this.fire();};
 // Keep keyboard/assistive activation; ignore clicks already handled by pointerdown.
 button.onclick=e=>{e.preventDefault();if(e.detail===0)this.fire();};
 }
 wireMouseAim(){let drag=null;const canvas=this.canvas;
 canvas.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0||!this.aimEnabled())return;e.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);drag={id:e.pointerId,epoch:this.aimEpoch};this.aim(e);});
 canvas.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;if(drag.epoch!==this.aimEpoch||!this.aimEnabled()){drag=null;return;}e.preventDefault();this.aim(e);});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>{if(drag?.id===e.pointerId)drag=null;});
 }
 wireAim(){const button=$('aim');let drag=null;
 button.onpointerdown=e=>{if(e.button!==0||button.disabled||!this.aimEnabled())return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,aim:[...this.aimXY],epoch:this.aimEpoch};button.setPointerCapture(e.pointerId);};
 button.onpointermove=e=>{if(!drag||drag.id!==e.pointerId)return;if(drag.epoch!==this.aimEpoch||!this.aimEnabled()){drag=null;return;}const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)<=3)return;const r=this.canvas.getBoundingClientRect();this.aimXY=[Math.max(-.96,Math.min(.96,drag.aim[0]+2*AIM_GAIN*dx/r.width)),Math.max(-.96,Math.min(.96,drag.aim[1]-2*AIM_GAIN*dy/r.height))];this.crosshair();e.preventDefault();};
 for(const name of ['onpointerup','onpointercancel','onlostpointercapture'])button[name]=e=>{if(drag?.id===e.pointerId)drag=null;};
 }
 destination(clay,state,speed=BALLISTIC_SPEED){const centre=this.centre(clay,state),aspect=this.canvas.clientWidth/this.canvas.clientHeight,ray=[this.aimXY[0]*aspect/this.focal(),this.aimXY[1]/this.focal(),-1];
 // Infer depth only. Aim stays on the crosshair ray, fixed at firing.
 let vz=0;for(let i=clay.start;i<clay.start+clay.total;i++)vz+=state.v[i*4+2]/clay.total;
 const depth=Math.max(1,-centre[2]),travel=depth/Math.max(.5,speed/Math.hypot(...ray)+vz),arrivalDepth=depth-vz*travel;return ray.map(x=>x*arrivalDepth);}
 pickClay(state){const aspect=this.canvas.clientWidth/this.canvas.clientHeight,ray=[this.aimXY[0]*aspect/this.focal(),this.aimXY[1]/this.focal(),-1];
 const sub=(a,b)=>a.map((x,k)=>x-b[k]),dot=(a,b)=>a.reduce((s,x,k)=>s+x*b[k],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];let closest=Infinity,picked=null;
 // Exact ray/triangle test against the same live mesh that draws the silhouette.
 for(const s of this.multi.systems){if(s.broken)continue;const point=id=>Array.from(state.p.slice((s.start+id)*4,(s.start+id)*4+3));
 for(const face of s.model.mesh.faces){const a=point(face[0]),b=point(face[1]),c=point(face[2]);if(Math.max(-a[2],-b[2],-c[2])<.0005)continue;const e1=sub(b,a),e2=sub(c,a),h=cross(ray,e2),det=dot(e1,h);if(Math.abs(det)<1e-9)continue;const inv=1/det,tvec=a.map(x=>-x),u=dot(tvec,h)*inv;if(u< -1e-7||u>1+1e-7)continue;const q=cross(tvec,e1),v=dot(ray,q)*inv;if(v< -1e-7||u+v>1+1e-7)continue;const t=dot(e2,q)*inv;if(t>.0005&&t<closest){closest=t;picked=s;}}
 }return picked;}
 fire(){if(!this.gunEnabled()){this.updateGun();return false;}const active=this.multi.systems.find(s=>s.gameID===this.activeClayID);if(active.shotTaken){this.updateGun();return false;}if(this.fired>=96){this.message('Shot limit reached.');return false;}
 const intact=this.multi.systems.filter(s=>!s.broken);if(!intact.length){this.message('No active clay.');return false;}
 const state=this.gpu.snapshot(),locked=this.pickClay(state),selected=this.multi.systems[this.multi.selected],reference=locked||(selected&&!selected.broken?selected:intact[0]);
 // Capture the mode and the exact silhouette verdict once, at firing.
 const interceptor=$('interceptor').checked,speed=interceptor?INTERCEPTOR_SPEED:BALLISTIC_SPEED,origin=interceptor?[0,-.4,3]:[0,0,0];
 const target=locked?this.centre(locked,state):this.destination(reference,state,speed),delta=target.map((x,k)=>x-origin[k]),distance=Math.hypot(...delta),id=this.gpu.count;
 if(!this.gpu.add([...origin,SHOT_MASS],[...delta.map(x=>speed*x/Math.max(distance,.00001)),-3],target,[0,0,1,12]))return false;
 this.voice.effect('gun');active.shotTaken=true;this.shots.push({id,turn:this.pulls,speed,mode:interceptor?'interceptor':'ballistic',target,targetID:locked?.gameID??null,locked:!!locked,arrival:this.gpu.simTime+distance/speed,checked:false,retired:false});this.fired++;this.update();this.run();this.message(locked?(interceptor?'Interceptor locked to the clay centre.':'Ballistic shot on target.'):'Miss · crosshair was outside the clay.');return true;}
 beforeStep(dt=.004){this.gpu.steering=this.multi.systems.filter(s=>!s.broken&&s.launch).map(s=>({start:s.start,end:s.start+s.total,wave:s.launch.wave}));
 const pending=this.shots.filter(s=>s.locked&&!s.checked);if(!pending.length)return;const state=this.gpu.snapshot(),g=this.gpu.gl;
 for(const shot of pending){const clay=this.multi.systems.find(s=>s.gameID===shot.targetID);if(!clay||clay.broken){this.write(shot.id,[...shot.target,0],[0,0,0,-1]);shot.checked=shot.retired=true;continue;}
 const target=this.centre(clay,state);for(let k=0;k<3;k++){let v=0;for(let i=clay.start;i<clay.start+clay.total;i++)v+=state.v[i*4+k]/clay.total;target[k]+=v*dt;}shot.target=target;
 const current=state.p.slice(shot.id*4,shot.id*4+3),distance=Math.hypot(...target.map((x,k)=>x-current[k]));
 if(distance<=shot.speed*dt+.00001)this.write(shot.id,[...target,SHOT_MASS],[0,0,0,-1]);
 else{this.gpu.destinationData.set([...target,1],shot.id*4);g.bindTexture(g.TEXTURE_2D,this.gpu.destinations);g.texSubImage2D(g.TEXTURE_2D,0,shot.id%64,Math.floor(shot.id/64),1,1,g.RGBA,g.FLOAT,new Float32Array([...target,1]));}
 }}
 centre(s,state){const out=[0,0,0];for(let i=s.start;i<s.start+s.total;i++)for(let k=0;k<3;k++)out[k]+=state.p[i*4+k]/s.total;return out;}
 write(id,p,v){const g=this.gpu.gl;for(const s of this.gpu.states)for(const [texture,data]of [[s.p,p],[s.v,v]]){g.bindTexture(g.TEXTURE_2D,texture);g.texSubImage2D(g.TEXTURE_2D,0,id%64,Math.floor(id/64),1,1,g.RGBA,g.FLOAT,new Float32Array(data));}}
 rebuild(){const mesh=this.multi.merge(this.multi.systems,this.gpu.count);this.gpu.setMesh(mesh);}
 step(){const now=this.gpu.simTime;for(const shot of this.shots){if(!shot.checked){const particle=this.gpu.particle(shot.id);if(particle.v[3]!==-1)continue;shot.checked=true;shot.arrival=now;let hit=false;const clay=shot.locked?this.multi.systems.find(s=>s.gameID===shot.targetID&&!s.broken):null;if(clay){clay.broken=true;clay.expires=Math.min(clay.expires,now+6);clay.model.mesh.links.fill(0);clay.model.mesh.edges=[];this.hits++;hit=true;}
 if(hit){this.voice.effect('breakup');this.rebuild();}else{this.write(shot.id,[...shot.target,0],[0,0,0,-1]);shot.retired=true;}this.update();this.message(hit?'Hit! Repulsion released the clay.':'Miss · aim inside the clay before firing.');}
 if(shot.checked&&!shot.retired&&now>=shot.arrival+.18){this.write(shot.id,[...shot.target,0],[0,0,0,-1]);shot.retired=true;}}
 for(let i=this.multi.systems.length-1;i>=0;i--){const s=this.multi.systems[i];if(now>=s.expires&&!this.shots.some(shot=>shot.locked&&!shot.checked&&shot.targetID===s.gameID)){this.multi.select(i);this.multi.deleteSelected();this.run();}}
 }
 remap(start,oldCount,newCount){for(const s of this.shots)if(s.id>=start+oldCount)s.id+=newCount-oldCount;}
 gunEnabled(){return this.activeClayID!=null&&performance.now()<this.gunDeadline&&this.multi.systems.some(s=>s.gameID===this.activeClayID&&!s.broken);}
 aimEnabled(){return !!this.preAim||this.gunEnabled();}
 prepareAim(){this.closeGun();if(this.pulls>=24)return;this.aimXY=[0,0];this.crosshair();this.preAim=true;this.updateGun();}
 closeGun(hide=true){if(hide||!this.preAim)this.aimEpoch=(this.aimEpoch||0)+1;if(hide)this.preAim=false;this.activeClayID=null;this.gunDeadline=0;this.updateGun();}
 updateGun(){const enabled=this.gunEnabled(),spent=!!this.multi.systems.find(s=>s.gameID===this.activeClayID)?.shotTaken;const aiming=this.aimEnabled();$('crosshair').hidden=!aiming;$('shoot').disabled=!enabled||spent||this.fired>=96;$('shoot').textContent=spent?'Fired':'Fire';$('aim').disabled=!aiming;$('aim').setAttribute('aria-disabled',String(!aiming));$('aim').tabIndex=aiming?0:-1;}
 update(){$('count').textContent=`${this.gpu.count} bodies`;$('gameScore').textContent=`${this.hits} hits · ${this.fired} shots · ${this.pulls}/24 clays`;$('pull').disabled=false;$('pull').textContent=this.voice?.busy?'Stop':this.voice?.completed?'Next':this.voice?.started?'Resume':'Start';this.updateGun();}
 draw(camera){this.updateGun();const g=this.gpu.gl;g.bindFramebuffer(g.FRAMEBUFFER,null);g.viewport(0,0,this.canvas.width,this.canvas.height);g.clear(g.DEPTH_BUFFER_BIT);g.enable(g.DEPTH_TEST);g.depthMask(true);g.disable(g.BLEND);g.useProgram(this.program);g.bindVertexArray(this.vao);this.gpu.bind(this.program,'positions',this.gpu.states[this.gpu.current].p,0);for(const [name,offset]of [['right',0],['up',3],['back',6],['eye',9]])g.uniform3fv(g.getUniformLocation(this.program,name),camera.subarray(offset,offset+3));g.uniform1f(g.getUniformLocation(this.program,'aspect'),this.canvas.width/this.canvas.height);g.uniform1f(g.getUniformLocation(this.program,'focal'),this.focal());for(const s of this.multi.systems){g.uniform1i(g.getUniformLocation(this.program,'fractured'),s.broken?1:0);g.uniform1i(g.getUniformLocation(this.program,'offset'),s.start);g.drawArrays(g.TRIANGLES,0,240);}g.bindVertexArray(this.gpu.vao);g.disable(g.DEPTH_TEST);}
}
