import * as pdfjsLib from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';

const $ = (selector) => document.querySelector(selector);
const files = [];
let selectedSize = 'original';
let convertedFiles = [];
let language = localStorage.getItem('pixelflow-language') || 'ko';

const copy = {
  ko: { eyebrow:'개인정보를 지키는 이미지 도구', title:'파일을 올리고,<br /><em>가볍게</em> 변환하세요.', subtitle:'JPG, PNG, WebP, HEIC, PDF를 서버 전송 없이 브라우저에서 변환합니다.', privacy:'파일은 내 기기에서만 처리됩니다', ad:'광고 영역', adResult:'변환 결과 광고 영역', dropTitle:'파일을 여기에 놓으세요', dropHint:'또는 기기에서 파일 선택', browse:'파일 선택', dropLimit:'JPG · PNG · WebP · HEIC · PDF   |   최대 20개, 파일당 25MB', yourFiles:'선택한 파일', clear:'모두 지우기', addMore:'파일 추가', output:'출력 형식', pdfOption:'하나의 PDF로 합치기', size:'크기', original:'원본', quality:'품질', convert:'변환하기', completeLabel:'완료', complete:'변환이 완료됐어요.', download:'모두 다운로드', footer:'서버 업로드 없음 · 무료 사용 · 로그인 불필요', count:(n)=>`${n}개 파일`, progress:(n,total)=>`${total}개 중 ${n}개 변환 중…`, ready:(n)=>`${n}개 파일이 준비되었습니다.`, error:'일부 파일을 변환하지 못했습니다.', invalid:'지원하지 않는 파일이거나 제한을 초과했습니다.' },
  en: { eyebrow:'A privacy-first image tool', title:'Drop your files,<br />convert them <em>lightly.</em>', subtitle:'Convert JPG, PNG, WebP, HEIC, and PDF entirely in your browser.', privacy:'Your files stay on this device', ad:'ADVERTISEMENT', adResult:'RESULT ADVERTISEMENT', dropTitle:'Drop files here', dropHint:'or choose from your device', browse:'Choose files', dropLimit:'JPG · PNG · WebP · HEIC · PDF   |   Up to 20 files, 25MB each', yourFiles:'Your files', clear:'Clear all', addMore:'Add more files', output:'Output format', pdfOption:'Merge into one PDF', size:'Size', original:'Original', quality:'Quality', convert:'Convert files', completeLabel:'COMPLETE', complete:'Your conversion is ready.', download:'Download all', footer:'No uploads · Free to use · No sign-in', count:(n)=>`${n} file${n === 1 ? '' : 's'}`, progress:(n,total)=>`Converting ${n} of ${total}…`, ready:(n)=>`${n} file${n === 1 ? '' : 's'} ready.`, error:'Some files could not be converted.', invalid:'Unsupported file or size limit exceeded.' }
};
const t = (key, ...args) => typeof copy[language][key] === 'function' ? copy[language][key](...args) : copy[language][key];

function applyLanguage() {
  document.documentElement.lang = language;
  document.title = language === 'ko' ? 'PixelFlow — 이미지 변환기' : 'PixelFlow — Image Converter';
  document.querySelectorAll('[data-i18n]').forEach((node) => node.innerHTML = t(node.dataset.i18n));
  $('#language-toggle').textContent = language === 'ko' ? 'EN' : '한국어';
  renderFiles();
}

function readableSize(bytes) { return `${(bytes / 1024 / 1024).toFixed(bytes > 1024 * 1024 ? 1 : 2)} MB`; }
function isAllowed(file) { return file.size <= 25 * 1024 * 1024 && (/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) || file.type === 'application/pdf' || /\.(heic|heif|pdf)$/i.test(file.name)); }
function extensionFor(type) { return ({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf'})[type]; }
function baseName(name) { return name.replace(/\.[^.]+$/, ''); }

function addFiles(incoming) {
  const remaining = 20 - files.length;
  const accepted = [...incoming].filter(isAllowed).slice(0, remaining);
  if (accepted.length) files.push(...accepted);
  if (accepted.length !== incoming.length) $('#status').textContent = t('invalid');
  $('#workspace').hidden = files.length === 0;
  $('#result').hidden = true; $('#result-ad').hidden = true;
  renderFiles();
}
function renderFiles() {
  $('#file-count').textContent = t('count', files.length);
  $('#file-list').innerHTML = files.map((file, index) => `<li><span class="file-icon">${file.name.split('.').pop().toUpperCase()}</span><div class="file-info"><div class="file-name">${escapeHtml(file.name)}</div><div class="file-meta">${readableSize(file.size)}</div></div><button class="remove" type="button" data-index="${index}" aria-label="Remove file">×</button></li>`).join('');
  document.querySelectorAll('.remove').forEach(btn => btn.addEventListener('click', () => { files.splice(Number(btn.dataset.index), 1); $('#workspace').hidden = files.length === 0; renderFiles(); }));
}
function escapeHtml(value) { return value.replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char])); }

function loadImage(url) { return new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = url; }); }
async function sourceToImages(file) {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) { const page = await pdf.getPage(pageNumber); const viewport = page.getViewport({ scale: 1.6 }); const canvas = document.createElement('canvas'); canvas.width = viewport.width; canvas.height = viewport.height; await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise; pages.push({ image: await loadImage(canvas.toDataURL('image/png')), name: `${baseName(file.name)}-page-${pageNumber}` }); }
    return pages;
  }
  let blob = file;
  if (/image\/(heic|heif)/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)) blob = await window.heic2any({blob:file, toType:'image/png'});
  const url = URL.createObjectURL(blob); try { return [{ image: await loadImage(url), name: baseName(file.name) }]; } finally { URL.revokeObjectURL(url); }
}
function drawResized(image) { const factor = selectedSize === 'original' ? 1 : Number(selectedSize) < 100 ? Number(selectedSize)/100 : Math.min(1, Number(selectedSize)/Math.max(image.width,image.height)); const canvas = document.createElement('canvas'); canvas.width = Math.max(1,Math.round(image.width*factor)); canvas.height = Math.max(1,Math.round(image.height*factor)); const ctx=canvas.getContext('2d'); ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height); return canvas; }
async function createPdf(imageItems) { const { jsPDF } = window.jspdf; let doc; imageItems.forEach(({image}, index) => { const canvas = drawResized(image); const isLandscape=canvas.width>canvas.height; if (!doc) doc=new jsPDF({orientation:isLandscape?'landscape':'portrait',unit:'px',format:[canvas.width,canvas.height],hotfixes:['px_scaling']}); else doc.addPage([canvas.width,canvas.height],isLandscape?'landscape':'portrait'); doc.addImage(canvas.toDataURL('image/jpeg',.92),'JPEG',0,0,canvas.width,canvas.height); }); return {name:'pixelflow-images.pdf',blob:doc.output('blob')}; }

async function convert() {
  if (!files.length) return;
  const button=$('#convert-button'), output=$('#format-select').value, quality=Number($('#quality').value)/100;
  button.disabled=true; convertedFiles=[]; const allImages=[];
  try {
    for (let i=0;i<files.length;i++) { $('#status').textContent=t('progress',i+1,files.length); const images=await sourceToImages(files[i]); allImages.push(...images); }
    if (output==='application/pdf') convertedFiles=[await createPdf(allImages)];
    else { for (const item of allImages) { const canvas=drawResized(item.image); const blob=await new Promise(resolve=>canvas.toBlob(resolve,output,quality)); convertedFiles.push({name:`${item.name}.${extensionFor(output)}`,blob}); } }
    $('#status').textContent=t('ready',convertedFiles.length); $('#result-summary').textContent=t('ready',convertedFiles.length); $('#result').hidden=false; $('#result-ad').hidden=false; $('#result').scrollIntoView({behavior:'smooth',block:'nearest'});
  } catch (error) { console.error(error); $('#status').textContent=t('error'); } finally { button.disabled=false; }
}
async function download() { if (!convertedFiles.length) return; if (convertedFiles.length===1) return triggerDownload(convertedFiles[0]); const zip=new window.JSZip(); convertedFiles.forEach(item=>zip.file(item.name,item.blob)); triggerDownload({name:'pixelflow-converted.zip',blob:await zip.generateAsync({type:'blob'})}); }
function triggerDownload({name,blob}) { const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),300); }

$('#browse-button').addEventListener('click',()=>$('#file-input').click()); $('#add-button').addEventListener('click',()=>$('#file-input').click()); $('#file-input').addEventListener('change',event=>{addFiles(event.target.files);event.target.value='';});
$('#dropzone').addEventListener('click',event=>{if(event.target.tagName!=='BUTTON')$('#file-input').click();}); $('#dropzone').addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();$('#file-input').click();}});
['dragenter','dragover'].forEach(type=>$('#dropzone').addEventListener(type,event=>{event.preventDefault();$('#dropzone').classList.add('dragging');})); ['dragleave','drop'].forEach(type=>$('#dropzone').addEventListener(type,event=>{event.preventDefault();$('#dropzone').classList.remove('dragging');})); $('#dropzone').addEventListener('drop',event=>addFiles(event.dataTransfer.files));
$('#clear-button').addEventListener('click',()=>{files.length=0;convertedFiles=[];$('#workspace').hidden=true;$('#result').hidden=true;$('#result-ad').hidden=true;$('#status').textContent='';}); $('#presets').addEventListener('click',event=>{const btn=event.target.closest('button');if(!btn)return;selectedSize=btn.dataset.size;document.querySelectorAll('#presets button').forEach(b=>b.classList.toggle('active',b===btn));}); $('#quality').addEventListener('input',event=>$('#quality-value').textContent=event.target.value); $('#convert-button').addEventListener('click',convert); $('#download-button').addEventListener('click',download);
$('#language-toggle').addEventListener('click',()=>{language=language==='ko'?'en':'ko';localStorage.setItem('pixelflow-language',language);applyLanguage();}); $('#theme-toggle').addEventListener('click',()=>document.body.classList.toggle('dark'));
applyLanguage();
