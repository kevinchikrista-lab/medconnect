// Penerjemah Markdown → HTML yang kecil dan tertutup (tanpa pustaka luar).
//
// Dipakai oleh Catatan Bisnis. Sengaja ditulis sendiri, bukan memuat pustaka
// dari CDN, karena: (1) halaman ini harus tetap jalan tanpa internet, dan
// (2) sebagian besar pustaka Markdown MENERUSKAN HTML mentah apa adanya —
// tulisan yang disalin-tempel dari mana pun bisa menyusupkan <script>.
//
// Aturan keamanannya sederhana dan tidak bisa ditawar: SELURUH teks di-escape
// lebih dulu, baru dibentuk. Tidak ada satu pun jalur yang mengembalikan HTML
// mentah dari tulisan pengguna. Alamat tautan pun disaring skemanya, jadi
// javascript:... tidak akan pernah jadi tautan yang bisa diklik.

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Hanya skema yang jelas tidak berbahaya. Selain itu, tautannya tidak dibuat
// dan teksnya dibiarkan apa adanya.
function safeUrl(u) {
  const raw = String(u || '').trim();
  if (/^(https?:\/\/|mailto:|tel:|#|\/)/i.test(raw)) return esc(raw);
  return '';
}

// Pembentukan dalam-baris. `text` SUDAH di-escape saat masuk ke sini.
// Potongan kode dipisahkan lebih dulu supaya isinya tidak ikut dibentuk —
// `**bukan tebal**` di dalam backtick harus tetap tampil apa adanya.
function inline(text) {
  return String(text).split(/(`[^`]*`)/g).map(part => {
    if (part.length > 1 && part.startsWith('`') && part.endsWith('`')) {
      return '<code>' + part.slice(1, -1) + '</code>';
    }
    return part
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => {
        const href = safeUrl(u);
        return href ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${t}</a>` : m;
      })
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_]+)__/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
      .replace(/~~([^~]+)~~/g, '<del>$1</del>');
  }).join('');
}

const RE_HEADING = /^(#{1,6})\s+(.*)$/;
const RE_HR = /^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/;
const RE_QUOTE = /^>\s?(.*)$/;
const RE_UL = /^(\s*)[-*+]\s+(.*)$/;
const RE_OL = /^(\s*)\d+[.)]\s+(.*)$/;
const RE_TASK = /^\[([ xX])\]\s+(.*)$/;
const RE_TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function splitRow(line) {
  return line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(c => c.trim());
}

function alignOf(cell) {
  const c = cell.trim();
  if (/^:-+:$/.test(c)) return 'center';
  if (/^-+:$/.test(c)) return 'right';
  return 'left';
}

export function mdToHtml(src) {
  const lines = String(src == null ? '' : src).replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Blok kode berpagar ```
    if (/^\s*```/.test(line)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;                                   // lewati pagar penutup
      out.push('<pre><code>' + esc(buf.join('\n')) + '</code></pre>');
      continue;
    }

    if (!line.trim()) { i++; continue; }

    if (RE_HR.test(line)) { out.push('<hr>'); i++; continue; }

    const mh = RE_HEADING.exec(line);
    if (mh) {
      const lvl = Math.min(6, mh[1].length);
      out.push(`<h${lvl}>` + inline(esc(mh[2])) + `</h${lvl}>`);
      i++; continue;
    }

    // Tabel: baris berpipa yang baris berikutnya berupa garis pemisah.
    if (line.includes('|') && i + 1 < lines.length && RE_TABLE_SEP.test(lines[i + 1])) {
      const head = splitRow(line);
      const aligns = splitRow(lines[i + 1]).map(alignOf);
      i += 2;
      const body = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) { body.push(splitRow(lines[i])); i++; }
      const th = head.map((c, n) => `<th style="text-align:${aligns[n] || 'left'}">` + inline(esc(c)) + '</th>').join('');
      const tr = body.map(r => '<tr>' + head.map((_, n) =>
        `<td style="text-align:${aligns[n] || 'left'}">` + inline(esc(r[n] == null ? '' : r[n])) + '</td>').join('') + '</tr>').join('');
      out.push(`<div class="md-table-wrap"><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`);
      continue;
    }

    // Kutipan
    if (RE_QUOTE.test(line)) {
      const buf = [];
      while (i < lines.length && RE_QUOTE.test(lines[i])) { buf.push(RE_QUOTE.exec(lines[i])[1]); i++; }
      out.push('<blockquote>' + inline(esc(buf.join(' '))) + '</blockquote>');
      continue;
    }

    // Daftar (berpoin / bernomor / checklist), dengan satu tingkat sarang
    if (RE_UL.test(line) || RE_OL.test(line)) {
      const rendered = [];
      // stack menyimpan tag pembuka yang masih terbuka: ['ul'] atau ['ul','ul']
      const stack = [];
      const openList = (tag) => { stack.push(tag); rendered.push('<' + tag + '>'); };
      const closeList = () => { rendered.push('</' + stack.pop() + '>'); };

      while (i < lines.length && (RE_UL.test(lines[i]) || RE_OL.test(lines[i]))) {
        const ordered = RE_OL.test(lines[i]);
        const m = (ordered ? RE_OL : RE_UL).exec(lines[i]);
        const depth = Math.min(1, Math.floor(m[1].replace(/\t/g, '  ').length / 2));
        const tag = ordered ? 'ol' : 'ul';

        while (stack.length > depth + 1) closeList();
        if (!stack.length) openList(tag);
        else if (stack.length < depth + 1) openList(tag);

        let body = m[2];
        const task = RE_TASK.exec(body);
        if (task) {
          const done = task[1].toLowerCase() === 'x';
          rendered.push('<li class="md-task"><input type="checkbox" disabled' + (done ? ' checked' : '') + '><span'
            + (done ? ' class="md-done"' : '') + '>' + inline(esc(task[2])) + '</span></li>');
        } else {
          rendered.push('<li>' + inline(esc(body)) + '</li>');
        }
        i++;
      }
      while (stack.length) closeList();
      out.push(rendered.join(''));
      continue;
    }

    // Paragraf: kumpulkan sampai baris kosong atau awal blok lain.
    const para = [];
    while (i < lines.length && lines[i].trim()
           && !RE_HEADING.test(lines[i]) && !RE_HR.test(lines[i]) && !RE_QUOTE.test(lines[i])
           && !RE_UL.test(lines[i]) && !RE_OL.test(lines[i]) && !/^\s*```/.test(lines[i])
           && !(lines[i].includes('|') && i + 1 < lines.length && RE_TABLE_SEP.test(lines[i + 1]))) {
      para.push(lines[i]); i++;
    }
    if (para.length) out.push('<p>' + inline(esc(para.join('\n'))).replace(/\n/g, '<br>') + '</p>');
  }

  return out.join('');
}

// Cuplikan teks polos untuk kartu daftar — tanpa tanda baca Markdown.
export function mdSnippet(src, max = 160) {
  const t = String(src == null ? '' : src)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\s*\|.*$/gm, ' ')            // baris tabel
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s*/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_~`#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > max ? t.slice(0, max).trim() + '…' : t;
}
