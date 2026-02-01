/* =========================================
   ملف برمجة لوحة التحكم (admin.js) - النسخة النهائية
   ========================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- 1. إعدادات فايربيس ---
const firebaseConfig = {
    apiKey: "AIzaSyBeDIXVtLVLzYATP7bGHYHNBPTKi-_rQ48",
    authDomain: "vip3-11eb5.firebaseapp.com",
    projectId: "vip3-11eb5",
    storageBucket: "vip3-11eb5.firebasestorage.app",
    messagingSenderId: "800738404158",
    appId: "1:800738404158:web:3d786a23bc6e89e46dae6f"
};

const app = initializeApp(firebaseConfig);
const db_cloud = getFirestore(app);
const docRef = doc(db_cloud, "restaurant", "mainData");

// --- 2. المتغيرات العامة ---
window.db = { 
    config: { 
        name: "مطعم قصة", 
        status: "auto", 
        isOpen: true, 
        schedule: {}, 
        theme: 1, 
        deliveryFee: 0,
        adText: "",
        adMode: "scroll",
        adImages: [] 
    }, 
    cats: [], 
    items: [] 
};

const daysMap = [
    {key:'sat',label:'السبت'},{key:'sun',label:'الأحد'},{key:'mon',label:'الاثنين'},
    {key:'tue',label:'الثلاثاء'},{key:'wed',label:'الأربعاء'},{key:'thu',label:'الخميس'},
    {key:'fri',label:'الجمعة'}
];

let selectedTheme = 1;
let currentTimeUnit = 'hours';

// --- 3. دوال الحفظ والتحميل ---

window.gatherData = function() {
    const c = window.db.config;
    c.name = document.getElementById('set_name').value;
    c.desc = document.getElementById('set_desc').value;
    c.wa = document.getElementById('set_wa').value;
    c.pass = document.getElementById('set_pass').value;
    c.deliveryFee = parseInt(document.getElementById('set_delivery_fee').value) || 0;
    
    const statusVal = document.getElementById('set_status').value;
    c.status = statusVal; 
    c.isOpen = statusVal !== 'closed'; 

    c.logo = document.getElementById('set_logo').value;
    c.cover = document.getElementById('set_cover').value;
    c.theme = selectedTheme;

    c.adText = document.getElementById('set_ad_text').value;
    c.adMode = document.getElementById('set_ad_mode').value;
    
    c.fb = document.getElementById('set_fb').value;
    c.ig = document.getElementById('set_ig').value;
    c.tk = document.getElementById('set_tk').value;
    c.map = document.getElementById('set_map').value;

    const newSchedule = {};
    daysMap.forEach(d => {
        newSchedule[d.key] = {
            active: document.getElementById(`sch_active_${d.key}`).checked,
            start: document.getElementById(`sch_start_${d.key}`).value,
            end: document.getElementById(`sch_end_${d.key}`).value
        };
    });
    c.schedule = newSchedule;
};

window.saveToCloud = async function() {
    const btn = document.getElementById('saveBtn'); 
    const old = btn.innerHTML;
    
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...'; 
    btn.disabled = true;
    
    gatherData(); 
    
    try { 
        await setDoc(docRef, window.db); 
        btn.innerHTML = '<i class="fas fa-check"></i> تم الحفظ!'; 
        setTimeout(() => { 
            btn.innerHTML = old; 
            btn.disabled = false; 
        }, 2000); 
    } catch (e) { 
        alert("خطأ: " + e.message); 
        btn.innerHTML = old; 
        btn.disabled = false; 
    }
};

window.loadFromCloud = async function() {
    try {
        const docSnap = await getDoc(docRef);
        document.getElementById('loadingOverlay').classList.add('hidden');
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            window.db = { ...window.db, ...data };
            if(data.config) window.db.config = { ...window.db.config, ...data.config };
            checkStockExpiry();
        }
        loadAdminData();
    } catch (e) { 
        console.error(e); 
        alert("فشل تحميل البيانات، تأكد من الاتصال بالإنترنت");
    }
};

function checkStockExpiry() {
    const now = Date.now();
    let changed = false;
    window.db.items.forEach(item => {
        if(item.sold && item.soldInfo && item.soldInfo.mode !== 'manual' && item.soldInfo.until && now > item.soldInfo.until) {
            item.sold = false; 
            item.soldInfo = null; 
            changed = true;
        }
    });
    if(changed) saveToCloud();
}

window.loadAdminData = function() {
    const c = window.db.config;
    selectedTheme = c.theme || 1; 
    document.body.className = "theme-" + selectedTheme;
    renderThemesGrid();

    document.getElementById('set_name').value = c.name || "";
    document.getElementById('set_desc').value = c.desc || "";
    document.getElementById('set_wa').value = c.wa || "";
    document.getElementById('set_pass').value = c.pass || "";
    document.getElementById('set_delivery_fee').value = c.deliveryFee || 0;
    
    selectStatus(c.status || 'auto'); 
    renderSchedule();
    
    document.getElementById('set_logo').value = c.logo || ""; 
    document.getElementById('preview_logo').src = c.logo || "";
    document.getElementById('set_cover').value = c.cover || ""; 
    document.getElementById('preview_cover').src = c.cover || "";
    
    document.getElementById('set_ad_text').value = c.adText || "";
    document.getElementById('set_ad_mode').value = c.adMode || "scroll";
    renderAdImagesInputs();

    document.getElementById('set_fb').value = c.fb || ""; 
    document.getElementById('set_ig').value = c.ig || "";
    document.getElementById('set_tk').value = c.tk || ""; 
    document.getElementById('set_map').value = c.map || "";

    renderCategories(); 
    renderStockItems();
};

// --- 4. وظائف العرض (UI Helpers) ---

// === دالة عرض التصنيفات (مع إصلاح زر الحذف) ===
window.renderCategories = function() { 
    const l = document.getElementById('adminCatList'); 
    l.innerHTML = ''; 
    const searchTerm = document.getElementById('menuSearchInput').value.toLowerCase();

    window.db.cats.forEach(c => { 
        const catItems = window.db.items.filter(i => 
            i.catId == c.id && 
            (i.name.toLowerCase().includes(searchTerm) || (i.desc && i.desc.toLowerCase().includes(searchTerm)))
        );

        if (searchTerm && catItems.length === 0) return;

        const count = window.db.items.filter(i => i.catId == c.id).length;

        l.innerHTML += `
        <div class="bg-[#161616] rounded-xl overflow-hidden border border-white/5 transition-all animate__animated animate__fadeIn">
            <div class="flex items-center gap-2 p-3 bg-[#1a1a1a]">
                
                <button onclick="document.getElementById('cat-items-${c.id}').classList.toggle('hidden')" class="shrink-0 text-gray-400 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center">
                    <i class="fas fa-chevron-down"></i>
                </button>
                
                <input onchange="window.db.cats.find(x=>x.id==${c.id}).name=this.value" value="${c.name}" class="bg-transparent font-bold text-lg outline-none flex-1 text-white min-w-0 truncate">
                
                <span class="cat-badge shrink-0 text-[10px] md:text-xs whitespace-nowrap">${count} أطباق</span>
                
                <button onclick="deleteCat(${c.id})" class="shrink-0 text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition flex items-center justify-center w-8 h-8">
                    <i class="fas fa-trash"></i>
                </button>
            </div>

            <div id="cat-items-${c.id}" class="${searchTerm ? '' : 'hidden'} p-2 bg-[#111] space-y-2 border-t border-white/5">
                ${catItems.map(i=>`
                    <div class="flex items-center gap-3 p-2 bg-white/5 rounded-lg hover:bg-white/10 transition">
                        <img src="${i.img||'https://placehold.co/100'}" class="w-10 h-10 rounded object-cover bg-black shrink-0">
                        <div class="flex-1 min-w-0">
                            <div class="font-bold text-sm truncate">${i.name}</div>
                            <div class="text-xs text-[var(--main)] font-bold">${i.price} د.ع</div>
                        </div>
                        <button onclick="openItemEditor(${i.id})" class="text-blue-400 text-xs px-2 hover:text-blue-300 shrink-0">تعديل</button>
                        <button onclick="deleteItem(${i.id})" class="text-red-500 text-xs px-2 hover:text-red-400 shrink-0"><i class="fas fa-times"></i></button>
                    </div>
                `).join('')}
                ${catItems.length === 0 ? '<div class="text-center text-gray-500 text-xs py-2">لا توجد أطباق في هذا القسم</div>' : ''}
            </div>
        </div>`; 
    }); 
};

window.renderAdImagesInputs = function() { 
    const c = document.getElementById('adImagesContainer'); 
    c.innerHTML = ''; 
    if (!window.db.config.adImages) window.db.config.adImages = [];
    
    window.db.config.adImages.forEach((u, i) => { 
        c.innerHTML += `
            <div class="flex gap-2 animate__animated animate__fadeIn">
                <input type="text" value="${u}" class="input-box text-sm py-2" onchange="window.db.config.adImages[${i}]=this.value" placeholder="رابط الصورة...">
                <button onclick="window.removeAdImage(${i})" class="text-red-500 px-3 hover:bg-red-500/10 rounded"><i class="fas fa-trash"></i></button>
            </div>`; 
    }); 
};

window.addAdImageInput = function() { 
    if(!window.db.config.adImages) window.db.config.adImages = []; 
    window.db.config.adImages.push(""); 
    renderAdImagesInputs(); 
};

window.removeAdImage = function(index) {
    if(confirm('حذف هذه الصورة؟')) {
        window.db.config.adImages.splice(index, 1);
        renderAdImagesInputs();
    }
};

window.renderThemesGrid = function() {
    const themes=[{id:1,name:'كلاسيك',c:'#e67e22'},{id:2,name:'ذهبي',c:'#d4af37'},{id:3,name:'بحري',c:'#3498db'},{id:4,name:'حار',c:'#e74c3c'},{id:5,name:'طبيعي',c:'#2ecc71'},{id:6,name:'ملكي',c:'#9b59b6'},{id:7,name:'أصفر',c:'#f1c40f'},{id:8,name:'فيروزي',c:'#1abc9c'}];
    const container = document.getElementById('themesContainer');
    container.innerHTML = themes.map(t => `
        <div onclick="selectTheme(${t.id})" class="cursor-pointer bg-[#111] p-4 rounded-xl border ${selectedTheme===t.id ? 'border-[var(--main)]' : 'border-white/5'} hover:border-[var(--main)] transition text-center group">
            <div class="w-full h-12 rounded-lg mb-3 shadow-lg" style="background:${t.c}"></div>
            <span class="text-sm font-bold text-gray-400 group-hover:text-white transition">${t.name}</span>
        </div>
    `).join('');
};

// === دوال إدارة الأطباق ===

window.addCat = function() { window.db.cats.push({id: Date.now(), name: "صنف جديد"}); renderCategories(); };
window.deleteCat = function(id) { if(confirm('حذف الصنف؟')) { window.db.cats = window.db.cats.filter(c=>c.id!==id); window.db.items = window.db.items.filter(i=>i.catId!==id); renderCategories(); } };
window.deleteItem = function(id) { if(confirm('حذف الطبق؟')) { window.db.items = window.db.items.filter(i=>i.id!==id); renderCategories(); } };

window.openItemEditor = function(id=null) { 
    document.getElementById('edit_cat').innerHTML = window.db.cats.map(c=>`<option value="${c.id}">${c.name}</option>`).join(''); 
    const m = document.getElementById('itemModal'); 
    m.classList.remove('hidden'); 
    
    if(id) { 
        const i = window.db.items.find(x=>x.id===id); 
        document.getElementById('edit_id').value=i.id; 
        document.getElementById('edit_name').value=i.name; 
        document.getElementById('edit_cat').value=i.catId; 
        document.getElementById('edit_price').value=i.price; 
        document.getElementById('edit_old').value=i.old||0; 
        document.getElementById('edit_img').value=i.img; 
        document.getElementById('edit_desc').value=i.desc; 
    } else { 
        document.getElementById('edit_id').value=''; 
        document.getElementById('edit_name').value=''; 
        document.getElementById('edit_price').value=''; 
        document.getElementById('edit_old').value=''; 
        document.getElementById('edit_img').value=''; 
        document.getElementById('edit_desc').value=''; 
    } 
    updatePreview(); 
};

window.updatePreview = function() {
    const name = document.getElementById('edit_name').value || 'اسم الطبق';
    const price = document.getElementById('edit_price').value || '0';
    const img = document.getElementById('edit_img').value || 'https://placehold.co/400x300/1a1a1a/333?text=Preview';
    const desc = document.getElementById('edit_desc').value || 'الوصف سيظهر هنا...';

    document.getElementById('prev_name').innerText = name;
    document.getElementById('prev_price').innerText = price + ' د.ع';
    document.getElementById('prev_img').src = img;
    document.getElementById('prev_desc').innerText = desc;
};

window.saveItem = function() { 
    const id = document.getElementById('edit_id').value; 
    const currentItem = id ? window.db.items.find(x=>x.id==id) : null; 
    const item = { 
        id: id ? parseInt(id) : Date.now(), 
        catId: parseInt(document.getElementById('edit_cat').value), 
        name: document.getElementById('edit_name').value, 
        price: parseFloat(document.getElementById('edit_price').value)||0, 
        old: parseFloat(document.getElementById('edit_old').value)||0, 
        img: document.getElementById('edit_img').value, 
        desc: document.getElementById('edit_desc').value, 
        sold: currentItem ? currentItem.sold : false, 
        soldInfo: currentItem ? currentItem.soldInfo : null 
    }; 
    if(id) window.db.items[window.db.items.findIndex(x=>x.id==id)] = item; else window.db.items.push(item); 
    document.getElementById('itemModal').classList.add('hidden'); 
    renderCategories(); 
};

window.openStockModal = function(id) { 
    const item = window.db.items.find(i => i.id === id); 
    if(!item) return; 
    document.getElementById('stock_item_id').value = id; 
    document.getElementById('modalItemName').innerText = item.name; 
    document.getElementById('stockModal').classList.remove('hidden'); 
    
    let currentMode = item.sold ? (item.soldInfo ? item.soldInfo.mode : 'manual') : 'available'; 
    selectStockOption(currentMode); 
    document.getElementById('time_duration').value = 1; 
    setTimeUnit('hours'); 
};

window.selectStockOption = function(mode) { 
    document.getElementById('selected_mode').value = mode; 
    document.querySelectorAll('.option-card').forEach(el => el.classList.remove('active')); 
    document.getElementById('opt-' + mode).classList.add('active'); 
    const timeBox = document.getElementById('timeInputs'); 
    mode === 'timed' ? timeBox.classList.remove('hidden') : timeBox.classList.add('hidden'); 
};

window.setTimeUnit = function(unit) { 
    currentTimeUnit = unit; 
    document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active')); 
    document.getElementById('btn-' + unit).classList.add('active'); 
};

window.saveStockSettings = function() { 
    const id = parseInt(document.getElementById('stock_item_id').value); 
    const mode = document.getElementById('selected_mode').value; 
    const item = window.db.items.find(i => i.id === id); 
    
    if (mode === 'available') { 
        item.sold = false; 
        item.soldInfo = null; 
    } else { 
        item.sold = true; 
        item.soldInfo = { mode: mode, until: null }; 
        if (mode === 'auto') { 
            const t = new Date(); 
            t.setDate(t.getDate() + 1); 
            t.setHours(6, 0, 0, 0); 
            item.soldInfo.until = t.getTime(); 
        } else if (mode === 'timed') { 
            const dur = parseInt(document.getElementById('time_duration').value) || 1; 
            item.soldInfo.until = Date.now() + (dur * (currentTimeUnit === 'hours' ? 3600000 : 86400000)); 
        } 
    } 
    document.getElementById('stockModal').classList.add('hidden'); 
    renderStockItems(document.getElementById('stockSearch').value); 
    saveToCloud(); 
};

window.renderStockItems = function(search = "") { 
    const list = document.getElementById('stockList'); 
    list.innerHTML = ''; 
    const soldCount = window.db.items.filter(i => i.sold).length; 
    document.getElementById('stat_sold_count').innerText = soldCount; 
    
    const items = window.db.items.filter(i => i.name.toLowerCase().includes(search.toLowerCase())); 
    if(items.length === 0) { list.innerHTML = `<div class="col-span-1 md:col-span-2 text-center text-gray-500 py-8">لا توجد نتائج</div>`; return; } 
    
    items.forEach(item => { 
        const isSold = item.sold; 
        const mode = item.soldInfo ? item.soldInfo.mode : 'manual'; 
        let statusHtml = '<span class="text-green-500 text-xs font-bold"><i class="fas fa-check-circle me-1"></i> متاح</span>'; 
        let border = 'border-white/5'; 
        
        if (isSold) { 
            if (mode === 'auto') { 
                statusHtml = '<span class="text-yellow-500 text-xs font-bold"><i class="fas fa-moon me-1"></i> يعود غداً</span>'; 
                border = 'border-yellow-500/30'; 
            } else if (mode === 'timed') { 
                const left = item.soldInfo.until - Date.now(); 
                const hrs = Math.ceil(left / 3600000); 
                statusHtml = `<span class="text-blue-400 text-xs font-bold"><i class="fas fa-clock me-1"></i> يعود بعد ${hrs} س</span>`; 
                border = 'border-blue-500/30'; 
            } else { 
                statusHtml = '<span class="text-red-500 text-xs font-bold"><i class="fas fa-ban me-1"></i> متوقف يدوياً</span>'; 
                border = 'border-red-500/30'; 
            } 
        } 
        list.innerHTML += `<div onclick="openStockModal(${item.id})" class="stock-item cursor-pointer rounded-2xl p-4 flex items-center gap-4 border ${border} hover:brightness-125 group relative overflow-hidden"><img src="${item.img || 'https://placehold.co/100'}" class="w-16 h-16 rounded-xl object-cover bg-black"><div class="flex-1"><div class="font-bold text-lg mb-1">${item.name}</div>${statusHtml}</div><div class="bg-white/5 w-10 h-10 rounded-full flex items-center justify-center text-gray-400 group-hover:bg-[var(--main)] group-hover:text-black transition"><i class="fas fa-pen"></i></div></div>`; 
    }); 
};

// === دوال النظام ===

window.doLogin = function() { 
    if(document.getElementById('loginPass').value === window.db.config.pass) { 
        document.getElementById('loginModal').classList.add('hidden'); 
        document.getElementById('adminPanel').classList.remove('hidden'); 
    } else { 
        const pass = document.getElementById('loginPass'); 
        pass.classList.add('animate__shakeX'); 
        setTimeout(()=> pass.classList.remove('animate__shakeX'), 1000); 
    } 
};

window.switchTab = function(t) { 
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden')); 
    document.getElementById('tab-' + t).classList.remove('hidden'); 
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active')); 
    event.currentTarget.classList.add('active'); 
    if(t==='stock') renderStockItems(); 
};

window.selectTheme = function(id) { 
    selectedTheme = id; 
    document.body.className = "theme-" + id; 
    renderThemesGrid();
};

window.selectStatus = function(s) { 
    document.getElementById('set_status').value = s; 
    document.querySelectorAll('.status-card').forEach(el => el.classList.remove('selected')); 
    document.getElementById(`status-card-${s}`).classList.add('selected'); 
    const box = document.getElementById('scheduleContainer'); 
    if(s==='auto') { box.classList.remove('hidden'); box.classList.add('animate__fadeInDown'); } else box.classList.add('hidden'); 
};

window.renderSchedule = function() { 
    const c = document.getElementById('weeklySchedule'); 
    c.innerHTML = ''; 
    const s = window.db.config.schedule || {}; 
    daysMap.forEach(d => { 
        const dd = s[d.key] || { active: true, start: "09:00", end: "23:00" }; 
        c.innerHTML += `<div class="flex flex-wrap items-center gap-4 bg-[#181818] p-3 rounded-xl border border-white/5 hover:border-white/10 transition group"><div class="w-20 font-bold ${d.key==='fri'?'text-[var(--main)]':'text-gray-300'}">${d.label}</div><div class="flex items-center"><input type="checkbox" id="sch_active_${d.key}" class="toggle-checkbox" ${dd.active?'checked':''} onchange="toggleDayInputs('${d.key}')"><label for="sch_active_${d.key}" class="toggle-label"></label></div><div class="flex-1 flex items-center gap-2 justify-end opacity-${dd.active?'100':'20'} transition-opacity" id="time_inputs_${d.key}"><input type="time" id="sch_start_${d.key}" value="${dd.start}" class="bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-white text-sm focus:border-[var(--main)] outline-none" ${!dd.active?'disabled':''}><span class="text-gray-500 text-xs font-bold">إلى</span><input type="time" id="sch_end_${d.key}" value="${dd.end}" class="bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-white text-sm focus:border-[var(--main)] outline-none" ${!dd.active?'disabled':''}></div></div>`; 
    }); 
};

window.toggleDayInputs = function(k) { 
    const a = document.getElementById(`sch_active_${k}`).checked; 
    const d = document.getElementById(`time_inputs_${k}`); 
    if(a){d.classList.remove('opacity-20');d.classList.add('opacity-100');}else{d.classList.remove('opacity-100');d.classList.add('opacity-20');} 
    document.getElementById(`sch_start_${k}`).disabled=!a; 
    document.getElementById(`sch_end_${k}`).disabled=!a; 
};

window.copyFirstDayToAll = function() { 
    if(confirm('تطبيق توقيت السبت على الكل؟')) { 
        const s = document.getElementById('sch_start_sat').value, e = document.getElementById('sch_end_sat').value, a = document.getElementById('sch_active_sat').checked; 
        daysMap.forEach(d=>{ if(d.key!=='sat'){ 
            document.getElementById(`sch_start_${d.key}`).value=s; 
            document.getElementById(`sch_end_${d.key}`).value=e; 
            document.getElementById(`sch_active_${d.key}`).checked=a; 
            toggleDayInputs(d.key); 
        }}); 
    } 
};

// بدء التطبيق
loadFromCloud();
