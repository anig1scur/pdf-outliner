var Bn=Array.isArray,ln=Array.prototype.indexOf,Un=Array.from,Vn=Object.defineProperty,wt=Object.getOwnPropertyDescriptor,un=Object.getOwnPropertyDescriptors,Gn=Object.prototype,Kn=Array.prototype,on=Object.getPrototypeOf;function $n(t){return typeof t=="function"}const Zn=()=>{};function zn(t){return t()}function kt(t){for(var n=0;n<t.length;n++)t[n]()}const y=2,It=4,V=8,ct=16,I=32,G=64,Z=128,C=256,z=512,p=1024,S=2048,N=4096,F=8192,L=16384,fn=32768,St=65536,Jn=1<<17,_n=1<<19,xt=1<<20,mt=Symbol("$state"),Qn=Symbol("legacy props"),Wn=Symbol("");function Dt(t){return t===this.v}function cn(t,n){return t!=t?n==n:t!==n||t!==null&&typeof t=="object"||typeof t=="function"}function Rt(t){return!cn(t,this.v)}function vn(t){throw new Error("https://svelte.dev/e/effect_in_teardown")}function pn(){throw new Error("https://svelte.dev/e/effect_in_unowned_derived")}function hn(t){throw new Error("https://svelte.dev/e/effect_orphan")}function dn(){throw new Error("https://svelte.dev/e/effect_update_depth_exceeded")}function Xn(){throw new Error("https://svelte.dev/e/hydration_failed")}function tr(t){throw new Error("https://svelte.dev/e/props_invalid_value")}function nr(){throw new Error("https://svelte.dev/e/state_descriptors_fixed")}function rr(){throw new Error("https://svelte.dev/e/state_prototype_fixed")}function En(){throw new Error("https://svelte.dev/e/state_unsafe_local_read")}function yn(){throw new Error("https://svelte.dev/e/state_unsafe_mutation")}let nt=!1;function er(){nt=!0}const sr=1,ar=2,lr=4,ur=8,or=16,ir=1,fr=2,_r=4,cr=8,vr=16,pr=1,hr=2,wn="[",mn="[!",Tn="]",Ot={},dr=Symbol(),Er="http://www.w3.org/2000/svg";function vt(t,n){var r={f:0,v:t,reactions:null,equals:Dt,rv:0,wv:0};return r}function yr(t){return Ct(vt(t))}function gn(t,n=!1){var e;const r=vt(t);return n||(r.equals=Rt),nt&&i!==null&&i.l!==null&&((e=i.l).s??(e.s=[])).push(r),r}function wr(t,n=!1){return Ct(gn(t,n))}function Ct(t){return u!==null&&!k&&u.f&y&&(g===null?Pn([t]):g.push(t)),t}function mr(t,n){return pt(t,an(()=>lt(t))),n}function pt(t,n){return u!==null&&!k&&rt()&&u.f&(y|ct)&&(g===null||!g.includes(t))&&yn(),An(t,n)}function An(t,n){return t.equals(n)||(t.v,t.v=n,t.wv=Wt(),Nt(t,S),rt()&&f!==null&&f.f&p&&!(f.f&(I|G))&&(A===null?qn([t]):A.push(t))),n}function Nt(t,n){var r=t.reactions;if(r!==null)for(var e=rt(),s=r.length,a=0;a<s;a++){var l=r[a],o=l.f;o&S||!e&&l===f||(w(l,n),o&(p|C)&&(o&y?Nt(l,N):at(l)))}}function bt(t){console.warn("https://svelte.dev/e/hydration_mismatch")}let R=!1;function Tr(t){R=t}let m;function H(t){if(t===null)throw bt(),Ot;return m=t}function gr(){return H(b(m))}function Ar(t){if(R){if(b(m)!==null)throw bt(),Ot;m=t}}function kr(t=1){if(R){for(var n=t,r=m;n--;)r=b(r);m=r}}function Ir(){for(var t=0,n=m;;){if(n.nodeType===8){var r=n.data;if(r===Tn){if(t===0)return n;t-=1}else(r===wn||r===mn)&&(t+=1)}var e=b(n);n.remove(),n=e}}var Tt,kn,Pt,qt;function Sr(){if(Tt===void 0){Tt=window,kn=document;var t=Element.prototype,n=Node.prototype;Pt=wt(n,"firstChild").get,qt=wt(n,"nextSibling").get,t.__click=void 0,t.__className="",t.__attributes=null,t.__styles=null,t.__e=void 0,Text.prototype.__t=void 0}}function ut(t=""){return document.createTextNode(t)}function ot(t){return Pt.call(t)}function b(t){return qt.call(t)}function xr(t,n){if(!R)return ot(t);var r=ot(m);if(r===null)r=m.appendChild(ut());else if(n&&r.nodeType!==3){var e=ut();return r==null||r.before(e),H(e),e}return H(r),r}function Dr(t,n){if(!R){var r=ot(t);return r instanceof Comment&&r.data===""?b(r):r}return m}function Rr(t,n=1,r=!1){let e=R?m:t;for(var s;n--;)s=e,e=b(e);if(!R)return e;var a=e==null?void 0:e.nodeType;if(r&&a!==3){var l=ut();return e===null?s==null||s.after(l):e.before(l),H(l),l}return H(e),e}function Or(t){t.textContent=""}function Ft(t){var n=y|S;f===null?n|=C:f.f|=xt;var r=u!==null&&u.f&y?u:null;const e={children:null,ctx:i,deps:null,equals:Dt,f:n,fn:t,reactions:null,rv:0,v:null,wv:0,parent:r??f};return r!==null&&(r.children??(r.children=[])).push(e),e}function Cr(t){const n=Ft(t);return n.equals=Rt,n}function Lt(t){var n=t.children;if(n!==null){t.children=null;for(var r=0;r<n.length;r+=1){var e=n[r];e.f&y?ht(e):O(e)}}}function In(t){for(var n=t.parent;n!==null;){if(!(n.f&y))return n;n=n.parent}return null}function Mt(t){var n,r=f;X(In(t));try{Lt(t),n=tn(t)}finally{X(r)}return n}function Yt(t){var n=Mt(t),r=(D||t.f&C)&&t.deps!==null?N:p;w(t,r),t.equals(n)||(t.v=n,t.wv=Wt())}function ht(t){Lt(t),U(t,0),w(t,L),t.v=t.children=t.deps=t.ctx=t.reactions=null}function Ht(t){f===null&&u===null&&hn(),u!==null&&u.f&C&&pn(),Et&&vn()}function Sn(t,n){var r=n.last;r===null?n.last=n.first=t:(r.next=t,t.prev=r,n.last=t)}function M(t,n,r,e=!0){var s=(t&G)!==0,a=f,l={ctx:i,deps:null,deriveds:null,nodes_start:null,nodes_end:null,f:t|S,first:null,fn:n,last:null,next:null,parent:s?null:a,prev:null,teardown:null,transitions:null,wv:0};if(r){var o=P;try{gt(!0),st(l),l.f|=fn}catch(T){throw O(l),T}finally{gt(o)}}else n!==null&&at(l);var _=r&&l.deps===null&&l.first===null&&l.nodes_start===null&&l.teardown===null&&(l.f&(xt|Z))===0;if(!_&&!s&&e&&(a!==null&&Sn(l,a),u!==null&&u.f&y)){var c=u;(c.children??(c.children=[])).push(l)}return l}function Nr(t){const n=M(V,null,!1);return w(n,p),n.teardown=t,n}function br(t){Ht();var n=f!==null&&(f.f&I)!==0&&i!==null&&!i.m;if(n){var r=i;(r.e??(r.e=[])).push({fn:t,effect:f,reaction:u})}else{var e=jt(t);return e}}function Pr(t){return Ht(),dt(t)}function qr(t){const n=M(G,t,!0);return(r={})=>new Promise(e=>{r.outro?Rn(n,()=>{O(n),e(void 0)}):(O(n),e(void 0))})}function jt(t){return M(It,t,!1)}function Fr(t,n){var r=i,e={effect:null,ran:!1};r.l.r1.push(e),e.effect=dt(()=>{t(),!e.ran&&(e.ran=!0,pt(r.l.r2,!0),an(n))})}function Lr(){var t=i;dt(()=>{if(lt(t.l.r2)){for(var n of t.l.r1){var r=n.effect;r.f&p&&w(r,N),Y(r)&&st(r),n.ran=!1}t.l.r2.v=!1}})}function dt(t){return M(V,t,!0)}function Mr(t,n=[],r=Ft){const e=n.map(r);return xn(()=>t(...e.map(lt)))}function xn(t,n=0){return M(V|ct|n,t,!0)}function Yr(t,n=!0){return M(V|I,t,!0,n)}function Bt(t){var n=t.teardown;if(n!==null){const r=Et,e=u;At(!0),W(null);try{n.call(null)}finally{At(r),W(e)}}}function Ut(t){var n=t.deriveds;if(n!==null){t.deriveds=null;for(var r=0;r<n.length;r+=1)ht(n[r])}}function Vt(t,n=!1){var r=t.first;for(t.first=t.last=null;r!==null;){var e=r.next;O(r,n),r=e}}function Dn(t){for(var n=t.first;n!==null;){var r=n.next;n.f&I||O(n),n=r}}function O(t,n=!0){var r=!1;if((n||t.f&_n)&&t.nodes_start!==null){for(var e=t.nodes_start,s=t.nodes_end;e!==null;){var a=e===s?null:b(e);e.remove(),e=a}r=!0}Vt(t,n&&!r),Ut(t),U(t,0),w(t,L);var l=t.transitions;if(l!==null)for(const _ of l)_.stop();Bt(t);var o=t.parent;o!==null&&o.first!==null&&Gt(t),t.next=t.prev=t.teardown=t.ctx=t.deps=t.fn=t.nodes_start=t.nodes_end=null}function Gt(t){var n=t.parent,r=t.prev,e=t.next;r!==null&&(r.next=e),e!==null&&(e.prev=r),n!==null&&(n.first===t&&(n.first=e),n.last===t&&(n.last=r))}function Rn(t,n){var r=[];Kt(t,r,!0),On(r,()=>{O(t),n&&n()})}function On(t,n){var r=t.length;if(r>0){var e=()=>--r||n();for(var s of t)s.out(e)}else n()}function Kt(t,n,r){if(!(t.f&F)){if(t.f^=F,t.transitions!==null)for(const l of t.transitions)(l.is_global||r)&&n.push(l);for(var e=t.first;e!==null;){var s=e.next,a=(e.f&St)!==0||(e.f&I)!==0;Kt(e,n,a?r:!1),e=s}}}function Hr(t){$t(t,!0)}function $t(t,n){if(t.f&F){t.f^=F,t.f&p||(t.f^=p),Y(t)&&(w(t,S),at(t));for(var r=t.first;r!==null;){var e=r.next,s=(r.f&St)!==0||(r.f&I)!==0;$t(r,s?n:!1),r=e}if(t.transitions!==null)for(const a of t.transitions)(a.is_global||n)&&a.in()}}const Cn=typeof requestIdleCallback>"u"?t=>setTimeout(t,1):requestIdleCallback;let J=!1,Q=!1,it=[],ft=[];function Zt(){J=!1;const t=it.slice();it=[],kt(t)}function zt(){Q=!1;const t=ft.slice();ft=[],kt(t)}function jr(t){J||(J=!0,queueMicrotask(Zt)),it.push(t)}function Br(t){Q||(Q=!0,Cn(zt)),ft.push(t)}function Nn(){J&&Zt(),Q&&zt()}const Jt=0,bn=1;let K=!1,$=Jt,j=!1,B=null,P=!1,Et=!1;function gt(t){P=t}function At(t){Et=t}let x=[],q=0;let u=null,k=!1;function W(t){u=t}let f=null;function X(t){f=t}let g=null;function Pn(t){g=t}let h=null,E=0,A=null;function qn(t){A=t}let Qt=1,tt=0,D=!1,i=null;function Wt(){return++Qt}function rt(){return!nt||i!==null&&i.l===null}function Y(t){var c;var n=t.f;if(n&S)return!0;if(n&N){var r=t.deps,e=(n&C)!==0;if(r!==null){var s,a,l=(n&z)!==0,o=e&&f!==null&&!D,_=r.length;if(l||o){for(s=0;s<_;s++)a=r[s],(l||!((c=a==null?void 0:a.reactions)!=null&&c.includes(t)))&&(a.reactions??(a.reactions=[])).push(t);l&&(t.f^=z)}for(s=0;s<_;s++)if(a=r[s],Y(a)&&Yt(a),a.wv>t.wv)return!0}(!e||f!==null&&!D)&&w(t,p)}return!1}function Fn(t,n){for(var r=n;r!==null;){if(r.f&Z)try{r.fn(t);return}catch{r.f^=Z}r=r.parent}throw K=!1,t}function Ln(t){return(t.f&L)===0&&(t.parent===null||(t.parent.f&Z)===0)}function et(t,n,r,e){if(K){if(r===null&&(K=!1),Ln(n))throw t;return}r!==null&&(K=!0);{Fn(t,n);return}}function Xt(t,n,r=0){var e=t.reactions;if(e!==null)for(var s=0;s<e.length;s++){var a=e[s];a.f&y?Xt(a,n,r+1):n===a&&(r===0?w(a,S):a.f&p&&w(a,N),at(a))}}function tn(t){var yt;var n=h,r=E,e=A,s=u,a=D,l=g,o=i,_=k,c=t.f;h=null,E=0,A=null,u=c&(I|G)?null:t,D=!P&&(c&C)!==0,g=null,i=t.ctx,k=!1,tt++;try{var T=(0,t.fn)(),v=t.deps;if(h!==null){var d;if(U(t,E),v!==null&&E>0)for(v.length=E+h.length,d=0;d<h.length;d++)v[E+d]=h[d];else t.deps=v=h;if(!D)for(d=E;d<v.length;d++)((yt=v[d]).reactions??(yt.reactions=[])).push(t)}else v!==null&&E<v.length&&(U(t,E),v.length=E);if(rt()&&A!==null&&!(t.f&(y|N|S)))for(d=0;d<A.length;d++)Xt(A[d],t);return s!==null&&tt++,T}finally{h=n,E=r,A=e,u=s,D=a,g=l,i=o,k=_}}function Mn(t,n){let r=n.reactions;if(r!==null){var e=ln.call(r,t);if(e!==-1){var s=r.length-1;s===0?r=n.reactions=null:(r[e]=r[s],r.pop())}}r===null&&n.f&y&&(h===null||!h.includes(n))&&(w(n,N),n.f&(C|z)||(n.f^=z),U(n,0))}function U(t,n){var r=t.deps;if(r!==null)for(var e=n;e<r.length;e++)Mn(t,r[e])}function st(t){var n=t.f;if(!(n&L)){w(t,p);var r=f,e=i;f=t;try{n&ct?Dn(t):Vt(t),Ut(t),Bt(t);var s=tn(t);t.teardown=typeof s=="function"?s:null,t.wv=Qt;var a=t.deps,l}catch(o){et(o,t,r,e||t.ctx)}finally{f=r}}}function nn(){if(q>1e3){q=0;try{dn()}catch(t){if(B!==null)et(t,B,null);else throw t}}q++}function rn(t){var n=t.length;if(n!==0){nn();var r=P;P=!0;try{for(var e=0;e<n;e++){var s=t[e];s.f&p||(s.f^=p);var a=[];en(s,a),Yn(a)}}finally{P=r}}}function Yn(t){var n=t.length;if(n!==0)for(var r=0;r<n;r++){var e=t[r];if(!(e.f&(L|F)))try{Y(e)&&(st(e),e.deps===null&&e.first===null&&e.nodes_start===null&&(e.teardown===null?Gt(e):e.fn=null))}catch(s){et(s,e,null,e.ctx)}}}function Hn(){if(j=!1,q>1001)return;const t=x;x=[],rn(t),j||(q=0,B=null)}function at(t){$===Jt&&(j||(j=!0,queueMicrotask(Hn))),B=t;for(var n=t;n.parent!==null;){n=n.parent;var r=n.f;if(r&(G|I)){if(!(r&p))return;n.f^=p}}x.push(n)}function en(t,n){var r=t.first,e=[];t:for(;r!==null;){var s=r.f,a=(s&I)!==0,l=a&&(s&p)!==0,o=r.next;if(!l&&!(s&F))if(s&V){if(a)r.f^=p;else try{Y(r)&&st(r)}catch(v){et(v,r,null,r.ctx)}var _=r.first;if(_!==null){r=_;continue}}else s&It&&e.push(r);if(o===null){let v=r.parent;for(;v!==null;){if(t===v)break t;var c=v.next;if(c!==null){r=c;continue t}v=v.parent}}r=o}for(var T=0;T<e.length;T++)_=e[T],n.push(_),en(_,n)}function sn(t){var n=$,r=x;try{nn();const s=[];$=bn,x=s,j=!1,rn(r);var e=t==null?void 0:t();return Nn(),(x.length>0||s.length>0)&&sn(),q=0,B=null,e}finally{$=n,x=r}}async function Ur(){await Promise.resolve(),sn()}function lt(t){var T;var n=t.f,r=(n&y)!==0;if(r&&n&L){var e=Mt(t);return ht(t),e}if(u!==null&&!k){g!==null&&g.includes(t)&&En();var s=u.deps;t.rv<tt&&(t.rv=tt,h===null&&s!==null&&s[E]===t?E++:h===null?h=[t]:h.push(t))}else if(r&&t.deps===null)for(var a=t,l=a.parent,o=a;l!==null;)if(l.f&y){var _=l;o=_,l=_.parent}else{var c=l;(T=c.deriveds)!=null&&T.includes(o)||(c.deriveds??(c.deriveds=[])).push(o);break}return r&&(a=t,Y(a)&&Yt(a)),t.v}function an(t){var n=k;try{return k=!0,t()}finally{k=n}}const jn=-7169;function w(t,n){t.f=t.f&jn|n}function Vr(t,n=1){var r=lt(t),e=n===1?r++:r--;return pt(t,r),e}function Gr(t,n=!1,r){i={p:i,c:null,e:null,m:!1,s:t,x:null,l:null},nt&&!n&&(i.l={s:null,u:null,r1:[],r2:vt(!1)})}function Kr(t){const n=i;if(n!==null){const l=n.e;if(l!==null){var r=f,e=u;n.e=null;try{for(var s=0;s<l.length;s++){var a=l[s];X(a.effect),W(a.reaction),jt(a.fn)}}finally{X(r),W(e)}}i=n.p,n.m=!0}return{}}function $r(t){if(!(typeof t!="object"||!t||t instanceof EventTarget)){if(mt in t)_t(t);else if(!Array.isArray(t))for(let n in t){const r=t[n];typeof r=="object"&&r&&mt in r&&_t(r)}}}function _t(t,n=new Set){if(typeof t=="object"&&t!==null&&!(t instanceof EventTarget)&&!n.has(t)){n.add(t),t instanceof Date&&t.getTime();for(let e in t)try{_t(t[e],n)}catch{}const r=on(t);if(r!==Object.prototype&&r!==Array.prototype&&r!==Map.prototype&&r!==Set.prototype&&r!==Date.prototype){const e=un(r);for(let s in e){const a=e[s].get;if(a)try{a.call(t)}catch{}}}}}export{Nr as $,ut as A,ot as B,f as C,hr as D,St as E,gr as F,H as G,Gn as H,Kn as I,vt as J,nr as K,pt as L,wt as M,rr as N,on as O,mn as P,Ir as Q,Tr as R,mt as S,pr as T,dr as U,Hr as V,Rn as W,jt as X,dt as Y,jr as Z,gn as _,br as a,Vn as a0,tr as a1,Jn as a2,_r as a3,Rt as a4,Vr as a5,I as a6,G as a7,X as a8,ir as a9,ar as aA,lr as aB,sr as aC,or as aD,ur as aE,Er as aF,Wn as aG,Br as aH,un as aI,rt as aJ,Fr as aK,Lr as aL,Tt as aM,wr as aN,kn as aO,mr as aP,kr as aQ,fr as aa,cr as ab,Qn as ac,Cr as ad,$n as ae,vr as af,Or as ag,W as ah,u as ai,_n as aj,wn as ak,b as al,Sr as am,Ot as an,Tn as ao,bt as ap,Xn as aq,Un as ar,qr as as,sn as at,Ur as au,yr as av,F as aw,An as ax,Kt as ay,On as az,an as b,i as c,kt as d,$r as e,Ft as f,lt as g,er as h,Dr as i,Kr as j,xr as k,Ar as l,xn as m,Yr as n,Zn as o,Gr as p,O as q,zn as r,Rr as s,Mr as t,Pr as u,R as v,m as w,cn as x,nt as y,Bn as z};
