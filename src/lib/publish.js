// XEM & DUYỆT NỘI DUNG NGAY TRONG CHAT (23/11): làm xong một lượt nội dung → AI gọi CREWZY_XEM_NOI_DUNG xổ toàn bộ bài (ảnh/video + bài từng kênh · vị trí)
// cho khách xem trong chính cuộc trò chuyện (Claude/ChatGPT qua link MCP vẽ thành bảng duyệt — MCP Apps, ui://crewzy/duyet.html; AI khác trình bày bằng chữ),
// rồi hỏi: Đăng ngay tất cả · Hẹn giờ vàng đăng hàng loạt (Crewzy tự đăng đúng giờ, ops.runDuePosts) · Chọn/sửa bài. Khách chọn → CREWZY_DUYET_HANG_LOAT.
import { listJobs, approveBatch, parseGioDang } from './jobs.js';

const H = 3600e3;
// 10 khung giờ vàng (giờ Việt Nam), trùng BƯỚC 5 của quy trình san_xuat_5x5.
export const GOLDEN = ['07:00', '08:30', '10:00', '11:30', '13:00', '15:00', '17:00', '19:00', '20:30', '21:30'];
export const UI_URI = 'ui://crewzy/duyet.html';
const clip = (s, n) => { const t = String(s == null ? '' : s); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
const isPost = (j) => j.loai === 'bai_dang' || (j.ket_qua && (j.ket_qua.media || []).some((m) => m.loai === 'image' || m.loai === 'video'));

// Xếp giờ vàng: giữ giờ hẹn còn ở tương lai, còn lại lấp lần lượt các khung trống từ 10 phút tới (hết khung hôm nay → ngày mai).
export function goldenTimes(n, nowMs = Date.now(), taken = []) {
  const used = new Set(taken);
  const out = [];
  const vn = new Date(nowMs + 7 * H);
  for (let d = 0; out.length < n && d < 30; d++) {
    for (const hm of GOLDEN) {
      const [h, m] = hm.split(':').map(Number);
      const t = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate() + d, h, m) - 7 * H;
      if (t < nowMs + 10 * 60e3) continue;
      const iso = new Date(t).toISOString();
      if (used.has(iso)) continue;
      used.add(iso); out.push(iso);
      if (out.length >= n) break;
    }
  }
  return out;
}

const vnLabel = (iso) => { if (!iso) return ''; const d = new Date(Date.parse(iso) + 7 * H); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} ${d.getUTCDate()}/${d.getUTCMonth() + 1}`; };

export async function previewPosts(env, uid, origin, args = {}, nowMs = Date.now()) {
  const jobs = await listJobs(env, uid);
  const ids = Array.isArray(args.ids) ? args.ids.map(String) : null;
  let list = jobs.filter((j) => j.trang_thai === 'cho_duyet' && isPost(j));
  if (ids && ids.length) list = jobs.filter((j) => ids.includes(j.id) && ['cho_duyet', 'da_duyet'].includes(j.trang_thai));
  else if (args.chi_moi !== false) list = list.filter((j) => nowMs - Date.parse(j.cap_nhat || j.tao_luc || 0) < 24 * H);
  list = list.slice(0, 40).sort((a, b) => (a.gio_dang || '~').localeCompare(b.gio_dang || '~'));
  const taken = list.map((j) => j.gio_dang).filter((g) => g && Date.parse(g) > nowMs);
  const free = goldenTimes(list.filter((j) => !(j.gio_dang && Date.parse(j.gio_dang) > nowMs)).length, nowMs, taken);
  let k = 0;
  const bai = list.map((j, i) => {
    const r = j.ket_qua || {};
    const gio = j.gio_dang && Date.parse(j.gio_dang) > nowMs ? j.gio_dang : free[k++];
    return { id: j.id, so: i + 1, tieu_de: j.tieu_de, trang_thai: j.trang_thai, kenh: r.kenh || [], gio_vang: gio, gio_vang_vn: vnLabel(gio),
      noi_dung: clip(r.noi_dung, 1500), media: (r.media || []).filter((m) => m.loai === 'image' || m.loai === 'video').slice(0, 10), app_da_dung: r.app_da_dung || undefined };
  });
  return { data: {
    so_bai: bai.length, bai,
    xem_tai: `${origin}/cho-duyet.html`,
    hoi_khach: bai.length ? 'Hỏi khách 1 câu: (A) Đăng ngay tất cả · (B) Hẹn giờ vàng, Crewzy tự đăng hàng loạt đúng giờ (giờ đề xuất ở từng bài) · (C) Chọn bài / sửa bài số mấy. Khách trả lời → gọi CREWZY_DUYET_HANG_LOAT.' : 'Chưa có nội dung chờ duyệt.',
    cach_trinh_bay: 'Bảng duyệt có thể đã hiện ngay trong cuộc trò chuyện. Nếu không thấy bảng: trình bày từng bài một khối gọn (số thứ tự · giờ vàng đề xuất · kênh · vị trí, link ảnh/video, 2–3 dòng đầu bài viết), không lặp lại toàn bộ dữ liệu.',
  } };
}

export async function approvePosts(env, uid, args = {}, who = 'Khách', nowMs = Date.now()) {
  const ids = Array.isArray(args.ids) ? [...new Set(args.ids.map(String))].slice(0, 60) : [];
  if (!ids.length) return { error: 'Thiếu ids (mã các phiếu khách đồng ý đăng).' };
  const cach = ['dang_ngay', 'gio_vang', 'hen_gio'].includes(args.cach) ? args.cach : 'gio_vang';
  const jobs = await listJobs(env, uid);
  const pick = ids.map((id) => jobs.find((j) => j.id === id)).filter(Boolean);
  let items;
  if (cach === 'dang_ngay') items = pick.map((j) => ({ id: j.id, gio_dang: '' }));
  else if (cach === 'hen_gio') {
    const base = parseGioDang(args.gio, nowMs);
    if (!base) return { error: 'Giờ hẹn chưa đúng (dạng "19:00" hoặc "2026-11-24T19:00").' };
    items = pick.map((j, i) => ({ id: j.id, gio_dang: new Date(Date.parse(base) + i * 2 * 60e3).toISOString() })); // lệch 2 phút/bài chống spam
  } else {
    const keep = pick.filter((j) => j.gio_dang && Date.parse(j.gio_dang) > nowMs);
    const free = goldenTimes(pick.length - keep.length, nowMs, keep.map((j) => j.gio_dang));
    let k = 0;
    items = pick.map((j) => ({ id: j.id, gio_dang: j.gio_dang && Date.parse(j.gio_dang) > nowMs ? j.gio_dang : free[k++] }));
  }
  const done = await approveBatch(env, uid, items, who);
  if (!done.length) return { error: 'Không có phiếu nào ở trạng thái chờ duyệt trong danh sách này.' };
  return { data: {
    da_duyet: done.length, cach,
    lich: done.map((d) => ({ id: d.id, tieu_de: d.tieu_de, kenh: d.kenh, gio_dang: d.gio_dang || 'đăng ngay', gio_vn: d.gio_dang ? vnLabel(d.gio_dang) : 'ngay bây giờ' })),
    viec_tiep: cach === 'dang_ngay'
      ? 'Khách đã đồng ý ĐĂNG NGAY: với từng phiếu, đọc đủ bằng CREWZY_VIEC_CAN_LAM id=<mã>, đăng đúng nội dung, ảnh/video lên đúng kênh · vị trí bằng công cụ của app (xem dinh_dang_kenh), xong nộp CREWZY_NOP_KET_QUA id=<mã>, trang_thai da_dang, lien_ket = link bài. Báo khách link từng bài.'
      : 'Đã hẹn giờ: Crewzy tự đăng đúng giờ (khách không cần mở máy), KHÔNG tự đăng lại. Báo khách lịch đăng dạng bảng (giờ · kênh · bài) và link xem: /cho-duyet.html.',
  } };
}

export const PUBLISH_TOOL_DEFS = [
  { type: 'function', function: { name: 'CREWZY_XEM_NOI_DUNG',
    description: 'Xổ toàn bộ nội dung vừa làm (bài đăng + ảnh/video từng kênh · vị trí, giờ vàng đề xuất) để khách xem và duyệt NGAY TRONG CUỘC TRÒ CHUYỆN. Gọi ngay sau khi nộp xong các bài của một lượt làm nội dung (hoặc khi khách hỏi "có gì chờ duyệt"). Sau đó hỏi khách: đăng ngay tất cả, hẹn giờ vàng đăng hàng loạt, hay chọn/sửa bài.',
    parameters: { type: 'object', properties: {
      ids: { type: 'array', items: { type: 'string' }, description: 'Mã phiếu cần xem (bỏ trống = mọi bài chờ duyệt trong 24 giờ qua).' },
      chi_moi: { type: 'boolean', description: 'Mặc định true: chỉ bài nộp trong 24 giờ qua.' },
    } } } },
  { type: 'function', function: { name: 'CREWZY_DUYET_HANG_LOAT',
    description: 'Duyệt và đăng hàng loạt sau khi KHÁCH ĐÃ ĐỒNG Ý trong cuộc trò chuyện (hoặc bấm nút trên bảng duyệt). cach: "dang_ngay" (đăng luôn, bạn tự đăng bằng công cụ của app), "gio_vang" (Crewzy tự đăng từng bài vào 10 khung giờ vàng, lệch giờ chống spam), "hen_gio" (cùng 1 giờ khách chọn, mỗi bài lệch 2 phút). Không tự gọi khi khách chưa trả lời.',
    parameters: { type: 'object', properties: {
      ids: { type: 'array', items: { type: 'string' }, description: 'Mã các phiếu khách đồng ý đăng.' },
      cach: { type: 'string', enum: ['dang_ngay', 'gio_vang', 'hen_gio'] },
      gio: { type: 'string', description: 'Chỉ cho hen_gio: "19:00" (giờ Việt Nam) hoặc "2026-11-24T19:00".' },
    }, required: ['ids', 'cach'] } } },
];

export async function publishTool(env, uid, origin, name, args, who) {
  if (name === 'CREWZY_XEM_NOI_DUNG') return previewPosts(env, uid, origin, args || {});
  return approvePosts(env, uid, args || {}, who);
}

// Bảng duyệt (MCP Apps): iframe nói chuyện với Claude/ChatGPT bằng JSON-RPC postMessage (ui/initialize → tool-result → tools/call, ui/message).
export function publishUiHtml() {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box}body{margin:0;font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#0F0F0F;background:transparent}
.w{padding:12px;border:1px solid #E5E5E5;border-radius:12px;background:#fff}
.h{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px}.h b{font-size:15px;flex:1;min-width:180px}
.btn{border:1px solid #0F0F0F;background:#fff;color:#0F0F0F;border-radius:8px;padding:8px 12px;font:600 13px system-ui;cursor:pointer}
.btn.p{background:#0F0F0F;color:#fff}.btn:disabled{opacity:.45;cursor:default}
.sel{font-size:12.5px;color:#555;display:flex;gap:10px;align-items:center;margin:2px 0 8px}
.c{border:1px solid #ECECEC;border-radius:10px;margin:8px 0;overflow:hidden}.c.off{opacity:.45}
.c summary{list-style:none;display:flex;gap:10px;align-items:center;padding:8px 10px;cursor:pointer}.c summary::-webkit-details-marker{display:none}
.c summary input{width:18px;height:18px;flex:none}.th{width:56px;height:56px;border-radius:8px;object-fit:cover;background:#F1F1F1;flex:none}
.m{flex:1;min-width:0}.m b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.m small{color:#666;font-size:12px}
.t{font:600 12px ui-monospace,monospace;color:#15803D;white-space:nowrap}
.b{padding:0 10px 10px}.media{display:flex;gap:6px;overflow-x:auto;margin-bottom:8px}.media img,.media video{height:180px;border-radius:8px;background:#000}
.txt{white-space:pre-wrap;font-size:13px;background:#FAFAFA;border-radius:8px;padding:8px;max-height:260px;overflow:auto}
.chips{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0}.chips span{font-size:11.5px;border:1px solid #E5E5E5;border-radius:99px;padding:1px 8px}
.fix{display:flex;gap:6px;margin-top:8px}.fix input{flex:1;border:1px solid #DDD;border-radius:8px;padding:7px 9px;font:13px system-ui}
.msg{margin-top:10px;padding:9px 11px;border-radius:8px;background:#ECFDF3;color:#14532D;font-size:13px}.msg.e{background:#FEF2F2;color:#7F1D1D}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.row input[type=time]{border:1px solid #DDD;border-radius:8px;padding:6px}
.empty{color:#666;padding:12px 0}
</style></head><body><div class="w" id="app"><div class="empty">Đang tải nội dung…</div></div>
<script>
(function(){
var A=document.getElementById('app'),seq=0,wait={},data=null,off={},busy=false,note=null,ready=false;
function esc(t){return String(t==null?'':t).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function send(m){window.parent.postMessage(m,'*')}
function req(method,params){var id=++seq;send({jsonrpc:'2.0',id:id,method:method,params:params});return new Promise(function(ok,no){wait[id]={ok:ok,no:no};setTimeout(function(){if(wait[id]){delete wait[id];no(new Error('Hết thời gian chờ'))}},60000)})}
function size(){if(!ready)return;send({jsonrpc:'2.0',method:'ui/notifications/size-changed',params:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}})}
function parse(r){if(!r)return null;if(r.structuredContent)return r.structuredContent;var c=(r.content||[]).filter(function(x){return x.type==='text'})[0];if(!c)return null;try{return JSON.parse(c.text)}catch(e){return null}}
function ids(){return(data.bai||[]).filter(function(b){return!off[b.id]}).map(function(b){return b.id})}
function render(){
 if(!data){A.innerHTML='<div class="empty">Chưa có nội dung.</div>';return size()}
 var L=data.bai||[];if(!L.length){A.innerHTML='<div class="empty">Chưa có nội dung nào chờ duyệt.</div>';return size()}
 var n=ids().length;
 var h='<div class="h"><b>'+L.length+' nội dung chờ bạn duyệt</b>'+
  '<button class="btn p" data-a="gio_vang"'+(busy||!n?' disabled':'')+'>⏰ Hẹn giờ vàng ('+n+')</button>'+
  '<button class="btn" data-a="dang_ngay"'+(busy||!n?' disabled':'')+'>▶ Đăng ngay ('+n+')</button></div>'+
  '<div class="sel"><label><input type="checkbox" data-all'+(n===L.length?' checked':'')+'> Chọn tất cả</label><span>Giờ vàng: Crewzy tự đăng từng bài đúng giờ, bạn không cần mở máy.</span></div>';
 h+=L.map(function(b){
  var md=b.media||[],th=md.filter(function(m){return m.loai==='image'})[0];
  return '<details class="c'+(off[b.id]?' off':'')+'"><summary><input type="checkbox" data-id="'+esc(b.id)+'"'+(off[b.id]?'':' checked')+'>'+
   (th?'<img class="th" src="'+esc(th.link)+'" alt="">':'<span class="th"></span>')+
   '<span class="m"><b>'+b.so+'. '+esc(b.tieu_de)+'</b><small>'+esc((b.kenh||[]).join(' · ')||'chưa ghi kênh')+(md.length?' · '+md.length+' ảnh/video':'')+'</small></span>'+
   '<span class="t">'+esc(b.gio_vang_vn||'')+'</span></summary><div class="b">'+
   (md.length?'<div class="media">'+md.map(function(m){return m.loai==='video'?'<video src="'+esc(m.link)+'" controls playsinline preload="metadata"></video>':'<img src="'+esc(m.link)+'" alt="">'}).join('')+'</div>':'')+
   '<div class="txt">'+esc(b.noi_dung||'')+'</div>'+
   '<div class="fix"><input data-fix="'+esc(b.id)+'" placeholder="Muốn sửa gì ở bài '+b.so+'? (vd: câu mở đầu ngắn lại)"><button class="btn" data-f="'+esc(b.id)+'" data-so="'+b.so+'">Gửi AI sửa</button></div></div></details>';
 }).join('');
 h+='<div class="row" style="margin-top:8px"><span style="font-size:12.5px;color:#555">Hoặc đăng cùng 1 giờ:</span><input type="time" id="hg" value="19:00"><button class="btn" data-a="hen_gio"'+(busy||!n?' disabled':'')+'>Hẹn giờ này</button></div>';
 if(note)h+='<div class="msg'+(note.e?' e':'')+'">'+note.t+'</div>';
 A.innerHTML=h;size();
}
function act(cach){
 var list=ids();if(!list.length||busy)return;busy=true;note=null;render();
 var args={ids:list,cach:cach};if(cach==='hen_gio')args.gio=document.getElementById('hg').value;
 req('tools/call',{name:'CREWZY_DUYET_HANG_LOAT',arguments:args}).then(function(r){
  busy=false;var d=parse(r);
  if(r&&r.isError||!d){note={e:1,t:esc(((r&&r.content&&r.content[0]&&r.content[0].text)||'Chưa duyệt được.'))};return render()}
  if(cach==='dang_ngay'){note={t:'✓ Đã duyệt '+d.da_duyet+' bài. AI đang đăng ngay…'};
   send({jsonrpc:'2.0',id:++seq,method:'ui/message',params:{role:'user',content:{type:'text',text:'Đăng ngay '+d.da_duyet+' bài tôi vừa duyệt (mã '+list.join(', ')+') lên đúng kênh, đúng vị trí. Xong nộp da_dang kèm link từng bài.'}}});}
  else note={t:'✓ Đã hẹn '+d.da_duyet+' bài, Crewzy tự đăng đúng giờ:<br>'+(d.lich||[]).map(function(x){return esc(x.gio_vn)+' · '+esc(x.tieu_de)}).join('<br>')};
  data.bai=data.bai.filter(function(b){return list.indexOf(b.id)<0});render();
 }).catch(function(e){busy=false;note={e:1,t:'Lỗi: '+esc(e.message)};render()});
}
A.addEventListener('click',function(e){
 var a=e.target.closest('[data-a]');if(a){e.preventDefault();return act(a.getAttribute('data-a'))}
 var f=e.target.closest('[data-f]');if(f){e.preventDefault();var id=f.getAttribute('data-f'),inp=A.querySelector('[data-fix="'+id+'"]'),v=inp&&inp.value.trim();if(!v)return inp&&inp.focus();
  send({jsonrpc:'2.0',id:++seq,method:'ui/message',params:{role:'user',content:{type:'text',text:'Sửa bài số '+f.getAttribute('data-so')+' (mã '+id+'): '+v+'. Sửa xong nộp lại phiếu này và cho tôi xem lại.'}}});
  f.textContent='✓ Đã gửi';f.disabled=true;return}
 if(e.target.matches('summary input,[data-all]'))e.stopPropagation();
});
A.addEventListener('change',function(e){
 if(e.target.hasAttribute('data-all')){var on=e.target.checked;(data.bai||[]).forEach(function(b){if(on)delete off[b.id];else off[b.id]=1});return render()}
 var id=e.target.getAttribute('data-id');if(id){if(e.target.checked)delete off[id];else off[id]=1;render()}
});
A.addEventListener('toggle',size,true);
window.addEventListener('message',function(ev){
 var m=ev.data;if(!m||m.jsonrpc!=='2.0')return;
 if(m.id!=null&&wait[m.id]&&(m.result!==undefined||m.error)){var w=wait[m.id];delete wait[m.id];m.error?w.no(new Error(m.error.message||'Lỗi')):w.ok(m.result);return}
 if(m.method==='ui/notifications/tool-result'){data=parse(m.params);render()}
});
req('ui/initialize',{protocolVersion:'2026-01-26',appInfo:{name:'Crewzy duyệt nội dung',version:'1.0.0'},clientInfo:{name:'Crewzy duyệt nội dung',version:'1.0.0'},appCapabilities:{},capabilities:{}})
 .then(function(){send({jsonrpc:'2.0',method:'ui/notifications/initialized',params:{}});ready=true;size()}).catch(function(){ready=true});
if(window.ResizeObserver)new ResizeObserver(size).observe(document.body);
})();
</script></body></html>`;
}
