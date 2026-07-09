// Shared chat (consultation) pages, rendered for both the Dokter and Pasien
// roles. Each role's page module (doctor.js / patient.js) supplies its own
// sidebar/header markup and role-scoped data, then delegates the actual page
// body to the functions below. Mirrors the ctx-based pattern in homecare.js.

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

export function chatListPage(ctx) {
  const { sidebar, header, conversations = [], viewerRole, viewerId, threadPathPrefix } = ctx;
  window.__chatListInitial = conversations;
  return `
  <div x-data="{
    sideOpen: window.innerWidth > 1024,
    viewerRole: '${viewerRole}',
    viewerId: '${viewerId}',
    conversations: window.__chatListInitial || [],
    init() {
      if (window.__pagePollInterval) clearInterval(window.__pagePollInterval);
      window.__pagePollInterval = setInterval(() => this.poll(), 3000);
    },
    async poll() {
      this.conversations = this.viewerRole === 'patient'
        ? await window.__store.fetchConsultationsForPatient(this.viewerId)
        : await window.__store.fetchConsultationsForDoctor(this.viewerId);
    }
  }" class="min-h-screen bg-wash">
    ${sidebar}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-[236px] lg:ml-64' : 'ml-0'">
      ${header}
      <main class="p-4 lg:p-6 max-w-3xl mx-auto pb-24 lg:pb-6">
        <h2 class="text-xl font-bold text-ink mb-4">Pesan</h2>
        <template x-if="conversations.length === 0">
          <div class="bg-white border border-slate-100 rounded-3xl p-8 text-center">
            <span class="ms text-[40px] text-faint">forum</span>
            <p class="text-sm text-faint mt-2">${viewerRole === 'patient' ? 'Belum ada percakapan. Mulai chat dari kartu dokter di beranda.' : 'Belum ada percakapan dengan pasien.'}</p>
          </div>
        </template>
        <template x-if="conversations.length > 0">
          <div class="bg-white border border-slate-100 rounded-3xl overflow-hidden divide-y divide-slate-50">
            <template x-for="c in conversations" :key="c.id">
              <a :href="'${threadPathPrefix}' + c.id" class="flex items-center gap-3 p-4 hover:bg-wash transition">
                <div class="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)" x-text="(viewerRole === 'patient' ? c.doctor_name : c.patient_name).split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()"></div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between gap-2">
                    <p class="text-sm font-bold text-ink truncate" x-text="viewerRole === 'patient' ? c.doctor_name : c.patient_name"></p>
                    <span class="text-[11px] text-faint font-semibold shrink-0" x-text="c.last_message_at ? new Date(c.last_message_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}) : ''"></span>
                  </div>
                  <p class="text-xs text-muted truncate mt-0.5" x-text="c.last_message || 'Belum ada pesan'"></p>
                </div>
                <template x-if="c.unread_count > 0"><span class="w-5 h-5 rounded-full bg-[#ff5436] text-white text-[10.5px] font-bold flex items-center justify-center shrink-0" x-text="c.unread_count"></span></template>
              </a>
            </template>
          </div>
        </template>
      </main>
    </div>
  </div>`;
}

export function chatThreadPage(ctx) {
  const { sidebar, header, consultationId, otherName, messages = [], viewerRole, listPath } = ctx;
  window.__chatInitialMessages = messages;

  return `
  <div x-data="{
    sideOpen: window.innerWidth > 1024,
    consultationId: '${consultationId}',
    viewerRole: '${viewerRole}',
    messages: window.__chatInitialMessages || [],
    newMessage: '', sending: false,
    init() {
      this.$nextTick(() => this.scrollBottom());
      window.__store.markConversationRead(this.consultationId, this.viewerRole);
      if (window.__pagePollInterval) clearInterval(window.__pagePollInterval);
      window.__pagePollInterval = setInterval(() => this.poll(), 3000);
    },
    async poll() {
      this.messages = await window.__store.fetchMessages(this.consultationId);
      window.__store.markConversationRead(this.consultationId, this.viewerRole);
      this.$nextTick(() => this.scrollBottom());
    },
    send() {
      const text = this.newMessage.trim();
      if (!text || this.sending) return;
      this.newMessage = '';
      window.__store.sendMessage(this.consultationId, this.viewerRole, text);
      this.messages = window.__store.getMessages(this.consultationId);
      this.$nextTick(() => this.scrollBottom());
    },
    scrollBottom() {
      const el = document.getElementById('chat-scroll');
      if (el) el.scrollTop = el.scrollHeight;
    }
  }" class="min-h-screen bg-wash flex flex-col">
    ${sidebar}
    <div class="transition-all duration-300 flex flex-col flex-1" :class="sideOpen ? 'lg:ml-[236px] lg:ml-64' : 'ml-0'">
      <header class="sticky top-0 z-30 h-[66px] bg-white border-b border-slate-100 px-4 flex items-center gap-3">
        <a href="${listPath}" class="p-2 rounded-xl hover:bg-wash transition"><span class="ms text-[20px] text-muted">arrow_back</span></a>
        <div class="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">${(otherName || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}</div>
        <h1 class="font-bold text-ink text-sm">${otherName}</h1>
      </header>
      <main id="chat-scroll" class="flex-1 overflow-y-auto p-4 space-y-2.5 max-w-2xl w-full mx-auto pb-4">
        <template x-if="messages.length === 0"><p class="text-center text-xs text-faint mt-8">Mulai percakapan dengan ${otherName}</p></template>
        <template x-for="m in messages" :key="m.id">
          <div class="flex" :class="m.sender_role === viewerRole ? 'justify-end' : 'justify-start'">
            <div class="max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm" :class="m.sender_role === viewerRole ? 'bg-gradient-to-br from-[#2b7ee0] to-brand-dark text-white rounded-br-md' : 'bg-white border border-slate-100 text-ink rounded-bl-md'">
              <p x-text="m.message" class="whitespace-pre-wrap break-words"></p>
            </div>
          </div>
        </template>
      </main>
      <div class="sticky bottom-0 bg-wash border-t border-slate-100 p-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
        <div class="max-w-2xl mx-auto flex items-center gap-2">
          <input type="text" x-model="newMessage" @keydown.enter="send()" placeholder="Tulis pesan..." class="flex-1 px-4 py-3 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40">
          <button @click="send()" class="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#2b7ee0] to-brand-dark flex items-center justify-center shrink-0"><span class="ms text-[20px] text-white">send</span></button>
        </div>
      </div>
    </div>
  </div>`;
}
