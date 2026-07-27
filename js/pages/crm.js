import { store } from '../store.js';
import { CONFIG } from '../config.js';

// Shared CRM (leads pipeline) view. Rendered inside either the admin or doctor
// shell via thin wrappers that supply the sidebar + header. Data is passed to
// Alpine through window globals (no free text embedded in the x-data string).
export function crmSetup() {
  window.__crmStages = CONFIG.CRM_STAGES || [];
  window.__crmSources = CONFIG.CRM_SOURCES || [];
}

// x-data body (WITHOUT sideOpen — the wrapper adds that). Single-quotes only;
// no double-quotes or comments here (they would truncate the x-data attribute).
export function crmXData() {
  return `loading: true, leads: [], q: '', sourceFilter: '',
    stages: window.__crmStages || [], sources: window.__crmSources || [],
    modal: false, editing: null, saving: false, msg: '',
    form: { full_name:'', phone:'', source:'', interest:'', stage:'baru', notes:'', next_followup:'' },
    async load() { this.loading = true; try { this.leads = await window.__store.getLeads(); } catch(e) { this.leads = []; } this.loading = false; },
    get shown() { const q=(this.q||'').toLowerCase(); const sf=this.sourceFilter; return this.leads.filter(l => (!sf || l.source===sf) && (!q || ((l.full_name||'')+' '+(l.phone||'')+' '+(l.interest||'')).toLowerCase().includes(q))); },
    byStage(key) { return this.shown.filter(l => (l.stage||'baru')===key); },
    openNew() { this.editing=null; this.form={ full_name:'', phone:'', source:'', interest:'', stage:'baru', notes:'', next_followup:'' }; this.msg=''; this.modal=true; },
    openEdit(l) { this.editing=l; this.form={ full_name:l.full_name||'', phone:l.phone||'', source:l.source||'', interest:l.interest||'', stage:l.stage||'baru', notes:l.notes||'', next_followup:l.next_followup||'' }; this.msg=''; this.modal=true; },
    async save() { if(!this.form.full_name.trim()){ this.msg='Nama wajib diisi.'; return; } this.saving=true;
      if(this.editing){ await window.__store.updateLead(this.editing.id, this.form); Object.assign(this.editing, this.form); }
      else { const r = await window.__store.addLead(this.form); if(r.error){ this.saving=false; this.msg=r.error; return; } if(r.lead) this.leads.unshift(r.lead); }
      this.saving=false; this.modal=false; },
    async moveStage(l) { await window.__store.updateLead(l.id, { stage: l.stage }); },
    async remove(l) { if(!confirm('Hapus prospek '+(l.full_name||'')+'?')) return; await window.__store.deleteLead(l.id); this.leads = this.leads.filter(x=>x.id!==l.id); },
    waLink(l) { return window.__waHref(l.phone, window.__crmWaMsg(l.full_name, l.interest)); },
    onWa(l) { window.__store.logLeadWa(l.id); l.wa_count = ((l.wa_count)||0)+1; },
    async convert(l) { if(!confirm('Jadikan '+(l.full_name||'')+' sebagai pasien terdaftar?')) return;
      const r = await window.__store.convertLeadToPatient(l);
      if(r.error){ window.__showToast && window.__showToast('Gagal', r.error); return; }
      l.stage='pasien'; l.converted_patient_id=r.patientId;
      window.__showToast && window.__showToast('Berhasil', (l.full_name||'')+' kini terdaftar sebagai pasien.'); },
    fmt(d) { if(!d) return ''; const dt=new Date(d); return isNaN(dt)?d:dt.toLocaleDateString('id-ID',{day:'numeric',month:'short'}); }`;
}

// Main content (header controls + pipeline columns + add/edit modal).
export function crmBody() {
  return `
  <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-5">
    <div><h2 class="text-xl font-bold text-gray-800">CRM — Calon Pasien</h2><p class="text-sm text-gray-500" x-text="'Total prospek: '+leads.length"></p></div>
    <div class="flex gap-2 flex-wrap">
      <div class="relative"><svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg><input type="text" x-model="q" placeholder="Cari nama/telepon/minat..." class="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
      <select x-model="sourceFilter" class="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"><option value="">Semua sumber</option><template x-for="s in sources" :key="s"><option :value="s" x-text="s"></option></template></select>
      <button @click="openNew()" class="px-4 py-2 rounded-lg text-sm font-medium text-white whitespace-nowrap" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">+ Tambah Prospek</button>
    </div>
  </div>

  <div x-show="loading" class="text-center py-12 text-gray-400 text-sm">Memuat prospek...</div>

  <div x-show="!loading" x-cloak class="flex gap-3 overflow-x-auto pb-4">
    <template x-for="st in stages" :key="st.key">
      <div class="flex-shrink-0 w-72 bg-slate-50/70 rounded-2xl p-3">
        <div class="flex items-center gap-2 mb-3 px-1">
          <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" :style="'background:'+st.dot"></span>
          <span class="font-semibold text-gray-700 text-sm" x-text="st.label"></span>
          <span class="ml-auto text-xs text-gray-400 bg-white rounded-full px-2 py-0.5" x-text="byStage(st.key).length"></span>
        </div>
        <div class="space-y-2 min-h-[40px]">
          <template x-for="l in byStage(st.key)" :key="l.id">
            <div class="bg-white rounded-xl border border-slate-100 p-3 shadow-sm">
              <div class="flex items-start justify-between gap-2">
                <p class="font-medium text-gray-800 text-sm leading-tight" x-text="l.full_name"></p>
                <button @click="remove(l)" class="text-gray-300 hover:text-red-500 text-xs flex-shrink-0" title="Hapus">&#10005;</button>
              </div>
              <div class="flex flex-wrap items-center gap-1 mt-1">
                <template x-if="l.source"><span class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium" x-text="l.source"></span></template>
                <template x-if="l.wa_count"><span class="text-[10px] text-gray-400" x-text="'\u{1F4E4} '+l.wa_count+'x'"></span></template>
              </div>
              <p class="text-xs text-gray-500 mt-1" x-show="l.interest" x-text="l.interest"></p>
              <p class="text-[11px] text-gray-400 mt-0.5" x-show="l.phone" x-text="l.phone"></p>
              <template x-if="l.next_followup"><p class="text-[11px] text-blue-600 mt-0.5" x-text="'Follow-up: '+fmt(l.next_followup)"></p></template>
              <div class="flex items-center gap-1.5 mt-2 flex-wrap">
                <template x-if="l.phone"><a :href="waLink(l)" @click="onWa(l)" target="_blank" rel="noopener" class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-white bg-[#25D366] hover:brightness-95">WA</a></template>
                <button @click="openEdit(l)" class="px-2 py-1 rounded-lg text-[11px] font-medium text-gray-600 bg-gray-100 hover:bg-gray-200">Edit</button>
                <template x-if="(l.stage||'baru')!=='pasien'"><button @click="convert(l)" class="px-2 py-1 rounded-lg text-[11px] font-semibold text-green-700 bg-green-50 hover:bg-green-100">&#8594; Pasien</button></template>
              </div>
              <select x-model="l.stage" @change="moveStage(l)" class="w-full mt-2 text-[11px] border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-600 focus:outline-none">
                <template x-for="s2 in stages" :key="s2.key"><option :value="s2.key" x-text="s2.label"></option></template>
              </select>
            </div>
          </template>
          <template x-if="byStage(st.key).length===0"><p class="text-center text-gray-300 text-xs py-3">&mdash;</p></template>
        </div>
      </div>
    </template>
  </div>

  <div x-show="modal" x-cloak class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" @click.self="modal=false">
    <div class="bg-white rounded-3xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-semibold text-gray-800" x-text="editing ? 'Edit Prospek' : 'Tambah Prospek'"></h3>
        <button @click="modal=false" class="text-gray-400 hover:text-gray-700"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
      </div>
      <div x-show="msg" class="mb-3 p-2 rounded-lg bg-red-50 text-red-700 text-sm" x-text="msg"></div>
      <div class="grid grid-cols-2 gap-3">
        <div class="col-span-2"><label class="block text-xs text-gray-600 mb-1">Nama *</label><input type="text" x-model="form.full_name" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
        <div><label class="block text-xs text-gray-600 mb-1">No. WhatsApp</label><input type="tel" x-model="form.phone" placeholder="0812..." class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
        <div><label class="block text-xs text-gray-600 mb-1">Sumber</label><select x-model="form.source" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"><option value="">Pilih</option><template x-for="s in sources" :key="s"><option :value="s" x-text="s"></option></template></select></div>
        <div class="col-span-2"><label class="block text-xs text-gray-600 mb-1">Layanan yang diminati</label><input type="text" x-model="form.interest" placeholder="mis. medical check-up, vaksin, dll" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
        <div><label class="block text-xs text-gray-600 mb-1">Tahap</label><select x-model="form.stage" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"><template x-for="s in stages" :key="s.key"><option :value="s.key" x-text="s.label"></option></template></select></div>
        <div><label class="block text-xs text-gray-600 mb-1">Follow-up berikutnya</label><input type="date" x-model="form.next_followup" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
        <div class="col-span-2"><label class="block text-xs text-gray-600 mb-1">Catatan</label><textarea x-model="form.notes" rows="2" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50 resize-none"></textarea></div>
      </div>
      <div class="flex gap-2 mt-5">
        <button @click="save()" :disabled="saving" class="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)"><span x-text="saving ? 'Menyimpan...' : 'Simpan'"></span></button>
        <button @click="modal=false" class="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200">Batal</button>
      </div>
    </div>
  </div>`;
}
