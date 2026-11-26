'use strict';
const $ = id => document.getElementById(id);
const stateKey = 'leaf.tasks.v1';
const uid = () => Array.from(crypto.getRandomValues(new Uint32Array(3)), n => n.toString(36)).join('-');
const defaultState = { lists:[{ id:'inbox', name:'我的任务' }], tasks:[], view:'inbox', sort:'created' };
let state = JSON.parse(localStorage.getItem(stateKey) || 'null') || defaultState;
let messageTimer, closeDialog, previousFocus;
function notify(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => $('toast').hidden = true, 2300);
}
function change(edit) {
  const next = JSON.parse(JSON.stringify(state));
  edit(next);
  try { localStorage.setItem(stateKey, JSON.stringify(next)); }
  catch (error) { notify('保存失败，请检查设备存储空间'); return false; }
  state = next;
  render();
  return true;
}
function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}
function button(label, cls, action, description) {
  const node = el('button', cls, label);
  node.type = 'button';
  node.onclick = action;
  if (description) node.setAttribute('aria-label', description);
  return node;
}
function localDate(d) {
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
}
function dateLabel(value) {
  const today = new Date(), tomorrow = new Date();
  tomorrow.setDate(today.getDate()+1);
  if (value === localDate(today)) return '今天';
  if (value === localDate(tomorrow)) return '明天';
  const [year,month,day] = value.split('-');
  return (year === String(today.getFullYear()) ? '' : year+'年') + Number(month)+'月'+Number(day)+'日';
}
function taskRow(task) {
  const row = el('div','row'+(task.done?' completed':''));
  const toggle = key => change(s => { const t = s.tasks.find(x=>x.id===task.id); t[key]=!t[key]; });
  const check = button('','circle',()=>toggle('done'), (task.done?'恢复任务':'完成任务')+' '+task.title);
  check.append(el('span','',task.done?'✓':''));
  const body = button('','body',()=>editTask(task));
  body.append(el('span','title',task.title));
  const meta = el('span','meta');
  if (task.note) body.append(el('span','note',task.note));
  if (task.subs.length) meta.append(el('span','',task.subs.filter(x=>x.done).length+'/'+task.subs.length+' 子任务'));
  if (state.view==='star') meta.append(el('span','',state.lists.find(x=>x.id===task.list).name));
  if (meta.childElementCount) body.append(meta);
  const star = button(task.star?'★':'☆','star'+(task.star?' marked':''),()=>toggle('star'),(task.star?'取消星标':'加星标')+' '+task.title);
  star.setAttribute('aria-pressed',String(task.star));
  row.append(check,body,star);
  const card = el('div','taskCard');
  const cap = el('div','cap');
  const label = task.done ? '已完成' : task.date ? dateLabel(task.date)+'截止' : '待处理';
  const late = !task.done && task.date && task.date < localDate(new Date());
  cap.append(el('span','tabLabel'+(late?' overdue':''),label));
  if (task.subs.length) {
    const count = task.subs.filter(sub=>sub.done).length;
    const progress = el('progress');
    progress.max=task.subs.length;
    progress.value=count;
    progress.setAttribute('aria-label','子任务进度');
    const ratio=el('span','ratio');
    ratio.append(progress,document.createTextNode(Math.round(count/task.subs.length*100)+'%'));
    cap.append(ratio);
  }
  card.append(cap,row);
  return card;
}
function render() {
  const lists = [...state.lists,{id:'star',name:'星标'}];
  $('tabs').replaceChildren();
  lists.forEach(l=>{
    const active = state.view===l.id;
    const tab = button((l.id==='star'?'☆ ':'')+l.name,active?'active':'',()=>change(s=>s.view=l.id));
    tab.setAttribute('aria-pressed',String(active));
    $('tabs').append(tab);
    if(active) requestAnimationFrame(()=>{ if(tab.offsetLeft < $('tabs').scrollLeft || tab.offsetLeft+tab.offsetWidth > $('tabs').scrollLeft+$('tabs').clientWidth) $('tabs').scrollLeft=tab.offsetLeft-24; });
  });
  $('heading').textContent = lists.find(l=>l.id===state.view).name;
  $('today').textContent = new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'});
  const tasks = state.tasks.filter(t=>state.view==='star'?t.star:t.list===state.view);
  const pending = tasks.filter(t=>!t.done), done = tasks.filter(t=>t.done);
  if (state.sort==='date') pending.sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));
  $('sort').textContent = state.sort==='date'?'按日期 ↕':'按创建时间 ↕';
  $('stats').textContent = pending.length+' 项待办　·　'+done.length+' 项已完成';
  $('meter').max = tasks.length || 1; $('meter').value = done.length;
  $('pending').replaceChildren(...pending.map(taskRow));
  if (!pending.length) {
    const empty = el('div','empty');
    empty.append(el('span','emptyMark','✓'),el('strong','',done.length?'待办都完成了':state.view==='star'?'还没有星标待办':'清单还是空的'),document.createTextNode(state.view==='star'?'点任务右侧的 ☆，在这里集中查看。':'点下方「添加任务」，记下要做的事。'));
    $('pending').append(empty);
  }
  $('finished').hidden = !done.length;
  $('doneCount').textContent = '已完成（'+done.length+'）';
  $('done').replaceChildren(...done.map(taskRow));
}
function hide() {
  $('shade').hidden=true; document.body.classList.remove('modal');
  document.querySelector('main').removeAttribute('inert');
  closeDialog=null;
  if(previousFocus && previousFocus.isConnected) previousFocus.focus();
}
function open(title, onClose=hide) {
  if($('shade').hidden) previousFocus=document.activeElement;
  closeDialog=onClose;
  const head=el('div','bar'), name=el('h2','',title);
  name.id='dialogTitle';
  head.append(name,button('×','',()=>closeDialog(),'关闭'));
  $('dialog').replaceChildren(head); $('shade').hidden=false;
  document.body.classList.add('modal'); document.querySelector('main').setAttribute('inert','');
  $('shade').querySelector('article').scrollTop=0;
  head.lastChild.focus();
  return $('dialog');
}
function goBack() {
  if(closeDialog) { closeDialog(); return true; }
  return false;
}
document.addEventListener('keydown',e=>{if(e.key==='Escape' && goBack()) e.preventDefault();});
function field(parent, title, node) {
  const label=el('label','field',title);
  const id=uid(); node.id=id; label.htmlFor=id;
  parent.append(label,node); return node;
}
function editorInput(value, placeholder) {
  const input=el('input'); input.type='text'; input.value=value; input.placeholder=placeholder;
  return input;
}
function editTask(task) {
  const dialog=open(task?'编辑任务':'添加任务');
  const title=field(dialog,'任务名称',editorInput(task?task.title:'','想完成什么？'));
  const note=field(dialog,'备注',el('textarea')); note.rows=2; note.value=task?task.note:'';
  const pair=el('div','pair'), left=el('div'),right=el('div');
  const list=field(left,'所属清单',el('select'));
  state.lists.forEach(l=>list.add(new Option(l.name,l.id)));
  list.value=task?task.list:state.view==='star'?state.lists[0].id:state.view;
  const date=field(right,'截止日期',el('input')); date.type='date';date.value=task?task.date:'';
  pair.append(left,right);dialog.append(pair);
  const star=el('input');star.type='checkbox';star.checked=task?task.star:state.view==='star';
  const check=el('label','check');check.append(star,document.createTextNode('标为星标'));dialog.append(check);
  dialog.append(el('h2','','子任务'));
  const subs=el('div');dialog.append(subs);
  function addSub(sub) {
    const row=el('div','sub'), tick=el('input'), text=editorInput(sub.title,'子任务名称');
    tick.type='checkbox';tick.checked=sub.done;tick.setAttribute('aria-label','完成子任务');
    text.setAttribute('aria-label','子任务名称');
    row.append(tick,text,button('×','small',()=>row.remove(),'移除子任务'));
    subs.append(row);return text;
  }
  if(task) task.subs.forEach(addSub);
  dialog.append(button('＋ 添加子任务','link',()=>addSub({title:'',done:false}).focus()));
  const foot=el('div','foot');
  if(task) foot.append(button('删除任务','danger',()=>{
    const choice=el('div','foot');
    choice.append(button('取消','',()=>choice.replaceWith(foot)),button('确认删除','primary',()=>{
      if(change(s=>s.tasks=s.tasks.filter(t=>t.id!==task.id))) hide();
    }));foot.replaceWith(choice);
  }));
  foot.append(button('保存','primary',()=>{
    if(!title.value.trim()){title.focus();notify('请输入任务名称');return;}
    const values={title:title.value.trim(),note:note.value,list:list.value,date:date.value,star:star.checked,
      subs:Array.from(subs.children,r=>({title:r.children[1].value.trim(),done:r.children[0].checked})).filter(x=>x.title)};
    if(change(s=>{
      if(task) Object.assign(s.tasks.find(t=>t.id===task.id),values);
      else s.tasks.unshift(Object.assign({id:uid(),done:false},values));
    })) {hide();notify('任务已保存');}
  }));
  dialog.append(foot);
  if(!task) title.focus();
}
function manageLists() {
  const dialog=open('管理清单');
  state.lists.forEach(l=>{
    const row=el('div','manageRow'), input=editorInput(l.name,'清单名称');
    input.setAttribute('aria-label','清单名称');
    row.append(input,button('改名','link',()=>saveName(l.id,input)));
    dialog.append(row);
  });
  const newName=field(dialog,'新建清单',editorInput('','输入清单名称'));
  const foot=el('div','foot');foot.append(button('创建清单','primary',()=>saveName(null,newName)));
  dialog.append(foot);
  function saveName(id,input) {
    const name=input.value.trim();
    if(!name || state.lists.some(l=>l.id!==id && l.name===name)) {notify(name?'已有同名清单':'请输入清单名称');input.focus();return;}
    if(change(s=>{if(id) s.lists.find(l=>l.id===id).name=name;
      else {s.view=uid();s.lists.push({id:s.view,name});}})) {hide();notify(id?'清单已改名':'清单已创建');}
  }
}
$('add').onclick=()=>editTask(null);
$('manage').onclick=manageLists;
$('sort').onclick=()=>change(s=>s.sort=s.sort==='date'?'created':'date');
render();

