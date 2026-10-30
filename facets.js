// Facet Maker's world axes and per-view physical-size contract.
const RAD=Math.PI/180;
export function validateAtlas(input){
 if(!input||input.format!=='facet-maker-atlas'||input.version!==1)throw Error('Choose Facet Maker atlas metadata (version 1).');
 const m=JSON.parse(JSON.stringify(input));
 if(typeof m.name!=='string'||m.name.length>1000||!Number.isInteger(m.width)||!Number.isInteger(m.height)||m.width<1||m.height<1||m.width*m.height>16777216)throw Error('Invalid atlas name or image dimensions.');
 if(m.axes?.front!=='+Z'||m.axes?.up!=='+Y'||m.axes?.positiveAzimuth!=='+X')throw Error('Unsupported atlas orientation.');
 if(!['centre','base'].includes(m.anchor)||!m.dimensions||!['width','height','depth'].every(k=>Number.isFinite(m.dimensions[k])&&m.dimensions[k]>.0&&m.dimensions[k]<=1000))throw Error('Invalid object dimensions or anchor.');
 if(!Array.isArray(m.facets)||!m.facets.length||m.facets.length>256)throw Error('Atlas must contain 1–256 views.');
 const ids=new Set(),normals=new Set();
 for(const v of m.facets){
  if(typeof v.id!=='string'||!v.id||v.id.length>100||ids.has(v.id)||!Number.isFinite(v.azimuth)||v.azimuth<0||v.azimuth>=360||!Number.isFinite(v.elevation)||Math.abs(v.elevation)>90)throw Error('Invalid or duplicate view direction.');
  ids.add(v.id);const key=Math.abs(v.elevation)===90?String(v.elevation):v.azimuth+':'+v.elevation;if(normals.has(key))throw Error('Duplicate view direction.');normals.add(key);
  if(!Array.isArray(v.size)||v.size.length!==2||!v.size.every(x=>Number.isFinite(x)&&x>0&&x<=10000)||!Array.isArray(v.offset)||v.offset.length!==2||!v.offset.every(x=>Number.isFinite(x)&&Math.abs(x)<=1000))throw Error('Invalid view scale or offset.');
  if(!Array.isArray(v.rect)||v.rect.length!==4||!v.rect.every(Number.isInteger))throw Error('Invalid atlas rectangle.');
  const [x,y,w,h]=v.rect;if(x<0||y<0||w<1||h<1||x+w>m.width||y+h>m.height)throw Error('Atlas rectangle extends outside the image.');
  const uv=[x/m.width,1-(y+h)/m.height,(x+w)/m.width,1-y/m.height];
  if(!Array.isArray(v.uv)||v.uv.length!==4||!v.uv.every((n,i)=>Number.isFinite(n)&&Math.abs(n-uv[i])<1e-5))throw Error('Atlas UV coordinates do not match its rectangles.');
  if(Math.abs((v.size[0]/v.size[1])/(w/h)-1)>.025)throw Error('View dimensions would stretch the picture.');
 }
 return m;
}
export function facetPlane(v){const a=v.azimuth*RAD,e=v.elevation*RAD;return {right:[Math.cos(a),0,-Math.sin(a)],up:[-Math.sin(e)*Math.sin(a),Math.cos(e),-Math.sin(e)*Math.cos(a)],normal:[Math.sin(a)*Math.cos(e),Math.sin(e),Math.cos(a)*Math.cos(e)]};}
export function rotation(yaw=0,pitch=0,roll=0){const a=yaw*RAD,b=pitch*RAD,c=roll*RAD,cy=Math.cos(a),sy=Math.sin(a),cx=Math.cos(b),sx=Math.sin(b),cz=Math.cos(c),sz=Math.sin(c);return v=>{const x=cz*v[0]-sz*v[1],y=sz*v[0]+cz*v[1],yy=cx*y-sx*v[2],z=sx*y+cx*v[2];return [cy*x+sy*z,yy,-sy*x+cy*z];};}
export function selectFacet(meta,direction){let best=null,score=-Infinity;for(const v of meta.facets){const n=facetPlane(v).normal,s=n.reduce((t,x,k)=>t+x*direction[k],0);if(s>score){score=s;best=v;}}return best;}
export class FacetObject{
 constructor(gpu){this.gpu=gpu;this.meta=null;this.texture=null;this.selected=null;this.placement={show:true,scale:1,x:0,y:0,z:0,yaw:0,pitch:0,roll:0};
  const g=gpu.gl;this.program=gpu.program(`#version 300 es
precision highp float;layout(location=0)in vec2 uv;uniform vec3 planeRight,planeUp,centre,right,up,back,eye;uniform vec2 size;uniform vec4 rect;uniform float aspect,zoomScale;out vec2 texcoord;
void main(){vec3 d=centre+planeRight*(uv.x-.5)*size.x+planeUp*(uv.y-.5)*size.y-eye;float z=-dot(d,back),near=.0005,far=10000.;gl_Position=vec4(dot(d,right)*1.8*zoomScale/aspect,dot(d,up)*1.8*zoomScale,(far+near)/(far-near)*z-2.*far*near/(far-near),z);texcoord=mix(rect.xy,rect.zw,uv);}`,`#version 300 es
precision highp float;uniform sampler2D picture;in vec2 texcoord;out vec4 result;void main(){vec4 c=texture(picture,texcoord);if(c.a<.03)discard;result=c;}`);
  this.vao=g.createVertexArray();g.bindVertexArray(this.vao);this.buffer=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,this.buffer);g.bufferData(g.ARRAY_BUFFER,new Float32Array([0,0,1,0,1,1,0,0,1,1,0,1]),g.STATIC_DRAW);g.enableVertexAttribArray(0);g.vertexAttribPointer(0,2,g.FLOAT,false,0,0);g.bindVertexArray(gpu.vao);
 }
 async load(input,imageData){const meta=validateAtlas(input),g=this.gpu.gl;if(meta.width>g.getParameter(g.MAX_TEXTURE_SIZE)||meta.height>g.getParameter(g.MAX_TEXTURE_SIZE))throw Error('Atlas is too large for this GPU.');if(typeof imageData!=='string'||!/^data:image\/(png|webp);base64,[A-Za-z0-9+/=]+$/.test(imageData))throw Error('Choose a PNG or WebP atlas picture.');
  const image=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('Atlas picture could not be decoded.'));im.src=imageData;});
  if(image.naturalWidth*image.naturalHeight>16777216||image.naturalWidth>g.getParameter(g.MAX_TEXTURE_SIZE)||image.naturalHeight>g.getParameter(g.MAX_TEXTURE_SIZE)||Math.abs(image.naturalWidth/meta.width-image.naturalHeight/meta.height)>1/Math.max(meta.width,meta.height))throw Error('The picture proportions do not match the metadata.');
  this.textureSize=[image.naturalWidth,image.naturalHeight];
  const texture=g.createTexture(),flip=g.getParameter(g.UNPACK_FLIP_Y_WEBGL),premultiply=g.getParameter(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL),active=g.getParameter(g.ACTIVE_TEXTURE);g.activeTexture(g.TEXTURE0);const previous=g.getParameter(g.TEXTURE_BINDING_2D);
  try{g.bindTexture(g.TEXTURE_2D,texture);g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL,true);g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,image);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);}catch(e){g.deleteTexture(texture);throw e;}finally{g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL,flip);g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL,premultiply);g.bindTexture(g.TEXTURE_2D,previous);g.activeTexture(active);}
  if(this.texture)g.deleteTexture(this.texture);this.texture=texture;this.meta=meta;this.imageData=imageData;this.selected=null;
 }
 draw(camera){const m=this.meta,p=this.placement;if(!m||!p.show)return;
  const transform=rotation(p.yaw,p.pitch,p.roll),axes=[[1,0,0],[0,1,0],[0,0,1]].map(transform),origin=[p.x,p.y,p.z];
  const anchor=m.anchor==='base'?m.dimensions.height/2:0;
  const delta=origin.map((x,k)=>camera[k+9]-x-axes[1][k]*anchor*p.scale),direction=axes.map(axis=>axis.reduce((sum,n,k)=>sum+n*delta[k],0));
  const v=this.selected=selectFacet(m,direction),basis=facetPlane(v),pr=transform(basis.right),pu=transform(basis.up);
  const centre=origin.map((x,k)=>x+p.scale*(pr[k]*v.offset[0]+pu[k]*v.offset[1]+axes[1][k]*anchor));
  this.lastGeometry={id:v.id,size:v.size.map(x=>x*p.scale),centre,right:pr,up:pu};
  const g=this.gpu.gl,program=this.program;g.bindFramebuffer(g.FRAMEBUFFER,null);g.viewport(0,0,this.gpu.canvas.width,this.gpu.canvas.height);g.bindVertexArray(this.vao);g.useProgram(program);
  for(const [name,offset]of [['right',0],['up',3],['back',6],['eye',9]])g.uniform3fv(g.getUniformLocation(program,name),camera.subarray(offset,offset+3));
  for(const [name,value]of [['planeRight',pr],['planeUp',pu],['centre',centre]])g.uniform3fv(g.getUniformLocation(program,name),value);
  g.uniform2fv(g.getUniformLocation(program,'size'),this.lastGeometry.size);g.uniform4fv(g.getUniformLocation(program,'rect'),v.uv);g.uniform1f(g.getUniformLocation(program,'aspect'),this.gpu.canvas.width/this.gpu.canvas.height);g.uniform1f(g.getUniformLocation(program,'zoomScale'),this.gpu.zoomScale);g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,this.texture);g.uniform1i(g.getUniformLocation(program,'picture'),0);
  // A visual overlay, like existing inert structures; gravity display has no shared depth.
  g.disable(g.DEPTH_TEST);g.depthMask(false);g.enable(g.BLEND);g.blendFunc(g.SRC_ALPHA,g.ONE_MINUS_SRC_ALPHA);g.drawArrays(g.TRIANGLES,0,6);g.disable(g.BLEND);g.depthMask(true);g.bindVertexArray(this.gpu.vao);
 }
}
export const facetDefaults={facetShow:false,facetScale:'1',facetX:'0',facetY:'0',facetZ:'0',facetYaw:'0',facetPitch:'0',facetRoll:'0'};
export function installFacetUI({getObject,onImported,isBusy}){
 const $=id=>document.getElementById(id),message=t=>$('facetInfo').textContent=t;
 const placement=()=>Object.fromEntries(Object.keys(facetDefaults).map(id=>[id.replace('facet','').toLowerCase(),$(id).type==='checkbox'?$(id).checked:Number($(id).value)]));
 const apply=()=>{for(const id of Object.keys(facetDefaults)){const el=$(id);if(el.type!=='checkbox'&&(!el.value.trim()||!Number.isFinite(Number(el.value))||Number(el.value)<Number(el.min)||Number(el.value)>Number(el.max))){message('Enter a valid '+id.replace('facet','').toLowerCase()+'.');return;}}const object=getObject();if(object)object.placement=placement();};
 for(const id of Object.keys(facetDefaults))$(id).oninput=apply;
 $('importFacets').onclick=()=>{if(!isBusy())$('facetFiles').click();};
 let loading=false;
 $('facetFiles').onchange=async()=>{const files=[...$('facetFiles').files];if(!files.length||loading)return;loading=true;$('importFacets').disabled=true;
  try{if(isBusy())throw Error('Wait until the animation is ready.');if(files.some(f=>f.size>32*1024*1024))throw Error('Use files smaller than 32 MB.');const jsonFiles=files.filter(f=>/\.json$/i.test(f.name)),pictureFiles=files.filter(f=>/\.(png|webp)$/i.test(f.name));let meta,imageData,savedPlacement;
   if(jsonFiles.length!==1)throw Error('Select the atlas JSON and PNG together, or one saved object JSON.');const doc=JSON.parse(await jsonFiles[0].text());
   if(doc.format==='facet-animation-object'&&doc.version===1){if(files.length!==1)throw Error('Select just the saved object file.');meta=doc.atlas;imageData=doc.imageData;savedPlacement=doc.placement;for(const [id,def]of Object.entries(facetDefaults)){const v=savedPlacement?.[id];if(typeof def==='boolean'?typeof v!=='boolean':!Number.isFinite(Number(v))||v===''||Number(v)<Number($(id).min)||Number(v)>Number($(id).max))throw Error('Invalid saved object placement.');}}
   else {if(files.length!==2||pictureFiles.length!==1)throw Error('Select both the atlas JSON and its PNG picture.');meta=doc;imageData=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Picture read failed.'));reader.readAsDataURL(pictureFiles[0]);});}
   await getObject().load(meta,imageData);for(const [id,def]of Object.entries(facetDefaults)){const value=savedPlacement?.[id]??(id==='facetShow'?true:def);if($(id).type==='checkbox')$(id).checked=value;else $(id).value=value;}apply();$('facetControls').hidden=false;$('saveFacetObject').disabled=false;await onImported({saved:!!savedPlacement});message(`${getObject().meta.name} · ${getObject().meta.facets.length} views loaded. Save object keeps the picture and placement together.`);
  }catch(e){message('Import failed: '+e.message);}finally{loading=false;$('importFacets').disabled=false;$('facetFiles').value='';}
 };
 $('saveFacetObject').onclick=()=>{const o=getObject();if(!o?.meta)return;const data={format:'facet-animation-object',version:1,atlas:o.meta,imageData:o.imageData,placement:Object.fromEntries(Object.keys(facetDefaults).map(id=>[id,$(id).type==='checkbox'?$(id).checked:$(id).value]))},url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='facet-animation-object.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('Object saved with atlas and placement. Load it again before replaying its timeline in a new session.');};
 return apply;
}
